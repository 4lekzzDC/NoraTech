// Motor de classificação do NoraDocs. Módulo puro: sem React, sem DOM, sem
// rede. Recebe sinais do arquivo e o cadastro do escritório, devolve o que
// conseguiu identificar e por quê.
//
// É determinístico de propósito. Quando o contador perguntar "por que este
// arquivo foi parar aqui?", a resposta precisa ser uma frase — "CNPJ
// 12.345.678/0001-90 no texto" — e não "o modelo achou".
//
// Regra de ouro: na dúvida, PERGUNTA. Nenhum campo é chutado. A única
// suposição que o motor faz é a competência pelo mês anterior, e ela sozinha
// nunca autoriza arquivamento automático — serve para pré-preencher a revisão.

// Extensão explícita nos imports de `domain/`: estes módulos rodam no Vite e
// também no `node --test`, e o loader ESM do Node exige o `.js`. É a única
// pasta do projeto com essa regra, e é de propósito — é a camada testável.
import { isValidCNPJ, isValidCPF, formatCNPJ, onlyDigits } from './cnpj.js';
import { competenciaAnterior, extrairCompetencia } from './competencia.js';
import { contemTermo, normalizar, normalizarNomeArquivo } from './texto.js';

// Muda quando a lógica de decisão muda. Vai para
// noradocs_classification_runs, para que uma decisão antiga continue
// explicável depois de o motor evoluir.
export const RULES_VERSION = '1';

// Nome de banco no arquivo é indício forte de extrato. Só entradas com 4+
// caracteres: "bb" casaria com meio mundo.
const BANCOS = [
  'itau', 'bradesco', 'santander', 'banco do brasil', 'caixa', 'nubank',
  'inter', 'sicoob', 'sicredi', 'safra', 'banrisul', 'mercado pago',
  'pagseguro', 'stone', 'original', 'daycoval', 'sofisa', 'brb',
];

const CNPJ_RE = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

function extrairDocumentos(texto) {
  const bruto = String(texto ?? '');
  const cnpjs = (bruto.match(CNPJ_RE) || []).map(onlyDigits).filter(isValidCNPJ);
  // Tira os CNPJs antes de procurar CPF: os 11 dígitos do meio de um CNPJ
  // podem formar um CPF que passa na validação por acaso.
  const semCnpj = bruto.replace(CNPJ_RE, ' ');
  const cpfs = (semCnpj.match(CPF_RE) || []).map(onlyDigits).filter(isValidCPF);
  return { cnpjs: [...new Set(cnpjs)], cpfs: [...new Set(cpfs)] };
}

// Um documento só é atribuído quando UM cliente casa. Dois candidatos não é
// meio acerto — é ambiguidade, e ambiguidade vai para revisão.
function unico(clientes) {
  const ids = [...new Set(clientes.map((c) => c.id))];
  return ids.length === 1 ? clientes[0] : null;
}

function identificarCliente(sinais, contexto) {
  const clientes = (contexto.clients || []).filter((c) => c.ativo !== false);
  if (!clientes.length) {
    return { cliente: null, motivo: 'Nenhum cliente ativo cadastrado.' };
  }

  const nome = String(sinais.fileName || '');
  const texto = String(sinais.text || '');

  // 1 e 2) CNPJ — o sinal mais forte, porque não depende de convenção de nome.
  for (const [origem, conteudo] of [['no texto', texto], ['no nome do arquivo', nome]]) {
    const { cnpjs, cpfs } = extrairDocumentos(conteudo);

    const porCnpj = clientes.filter((c) => c.cnpj && cnpjs.includes(onlyDigits(c.cnpj)));
    if (porCnpj.length) {
      const cliente = unico(porCnpj);
      if (cliente) {
        return { cliente, evidencia: `CNPJ ${formatCNPJ(cliente.cnpj)} ${origem}` };
      }
      return { cliente: null, motivo: 'Mais de um cliente com o mesmo CNPJ cadastrado.' };
    }

    // 3) CPF — mesma lógica, para o cliente pessoa física.
    const porCpf = clientes.filter((c) => c.cpf && cpfs.includes(onlyDigits(c.cpf)));
    const clientePf = unico(porCpf);
    if (clientePf) return { cliente: clientePf, evidencia: `CPF ${origem}` };
  }

  // 4) Regras cadastradas pelo escritório — o que ele ensinou ao corrigir.
  const porRegra = aplicarRegrasDeCliente(sinais, contexto, clientes);
  if (porRegra) return porRegra;

  // 5) Apelidos e nome. Último recurso: casa por convenção de nomenclatura,
  // que é justamente a parte que cada cliente faz do seu jeito.
  const nomeNormalizado = normalizarNomeArquivo(nome);
  const porApelido = clientes.filter((c) =>
    [c.nome, ...(c.aliases || [])].some((termo) => contemTermo(nomeNormalizado, termo))
  );

  if (porApelido.length === 1) {
    const cliente = porApelido[0];
    const termo = [cliente.nome, ...(cliente.aliases || [])]
      .find((t) => contemTermo(nomeNormalizado, t));
    return { cliente, evidencia: `"${termo}" no nome do arquivo` };
  }
  if (porApelido.length > 1) {
    const nomes = porApelido.map((c) => c.nome).join(' e ');
    return { cliente: null, motivo: `o nome do arquivo casa com mais de um cliente (${nomes})` };
  }

  return { cliente: null, motivo: 'nenhum CNPJ conhecido no texto nem no nome do arquivo' };
}

function aplicarRegrasDeCliente(sinais, contexto, clientes) {
  const regras = (contexto.rules || [])
    .filter((r) => r.ativo !== false && r.client_id)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const regra of regras) {
    if (!casaRegra(regra, sinais)) continue;
    const cliente = clientes.find((c) => c.id === regra.client_id);
    if (cliente) {
      return { cliente, evidencia: `regra do escritório: ${rotuloRegra(regra)}` };
    }
  }
  return null;
}

function casaRegra(regra, sinais) {
  const padrao = String(regra.pattern || '').trim();
  if (!padrao) return false;

  switch (regra.match_type) {
    case 'filename':
      return normalizarNomeArquivo(sinais.fileName).includes(normalizar(padrao));
    case 'cnpj': {
      const alvo = onlyDigits(padrao);
      const { cnpjs } = extrairDocumentos(`${sinais.text || ''} ${sinais.fileName || ''}`);
      return Boolean(alvo) && cnpjs.includes(alvo);
    }
    case 'text':
      return normalizar(sinais.text).includes(normalizar(padrao));
    // 'email_sender' só passa a ter sinal quando a origem for o Gmail (etapa 2
    // do roteiro). Até lá nunca casa, em vez de casar por engano.
    case 'email_sender':
      return normalizar(sinais.remetente || '').includes(normalizar(padrao));
    default:
      return false;
  }
}

function rotuloRegra(regra) {
  const onde = {
    filename: 'no nome do arquivo',
    cnpj: 'CNPJ',
    text: 'no texto',
    email_sender: 'remetente',
  }[regra.match_type] || regra.match_type;
  return `"${regra.pattern}" ${onde}`;
}

function identificarCategoria(sinais, contexto) {
  const categorias = (contexto.categories || []).filter((c) => c.ativo !== false);
  if (!categorias.length) return { categoria: null, motivo: 'nenhuma categoria cadastrada' };

  const nome = normalizarNomeArquivo(sinais.fileName);
  const texto = normalizar(sinais.text);

  // 1) Regra do escritório vence tudo: foi decisão explícita de quem opera.
  const regra = (contexto.rules || [])
    .filter((r) => r.ativo !== false && r.category_id)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    .find((r) => casaRegra(r, sinais));
  if (regra) {
    const categoria = categorias.find((c) => c.id === regra.category_id);
    if (categoria) return { categoria, evidencia: `regra do escritório: ${rotuloRegra(regra)}` };
  }

  // 2 e 3) Palavra-chave, primeiro no nome do arquivo e depois no texto. Entre
  // duas categorias que casam, ganha a palavra-chave mais longa: "conta
  // corrente" é sinal mais específico que "conta".
  for (const [origem, alvo] of [['no nome do arquivo', nome], ['no texto', texto]]) {
    if (!alvo) continue;
    let melhor = null;
    for (const categoria of categorias) {
      for (const palavra of categoria.keywords || []) {
        if (!contemTermo(alvo, palavra)) continue;
        const tamanho = normalizar(palavra).length;
        if (!melhor || tamanho > melhor.tamanho) melhor = { categoria, palavra, tamanho };
      }
    }
    if (melhor) {
      return { categoria: melhor.categoria, evidencia: `"${melhor.palavra}" ${origem}` };
    }
  }

  // 4) Nome de banco no arquivo. Não é palavra-chave de categoria, é
  // conhecimento de domínio: extrato do Itaú não costuma dizer "extrato".
  const banco = BANCOS.find((b) => contemTermo(nome, b));
  if (banco) {
    const extratos = categorias.find((c) => c.slug === 'extratos-bancarios');
    if (extratos) return { categoria: extratos, evidencia: `banco "${banco}" no nome do arquivo` };
  }

  return { categoria: null, motivo: 'nenhuma palavra-chave de categoria encontrada' };
}

function identificarCompetencia(sinais) {
  const doNome = extrairCompetencia(sinais.fileName || '');
  if (doNome) {
    return { competencia: doNome.competencia, evidencia: `${doNome.rotulo} no nome do arquivo` };
  }

  const doTexto = extrairCompetencia(sinais.text || '');
  if (doTexto) {
    return { competencia: doTexto.competencia, evidencia: `${doTexto.rotulo} no texto` };
  }

  // Suposição, e marcada como tal. Serve para pré-preencher a revisão, nunca
  // para autorizar arquivamento sozinha.
  const recebidoEm = sinais.receivedAt ? new Date(sinais.receivedAt) : new Date();
  return {
    competencia: competenciaAnterior(recebidoEm),
    suposicao: true,
    evidencia: 'mês anterior ao recebimento (suposição)',
  };
}

// Sugere o trecho do nome de arquivo que serviria de regra para os próximos.
//
// Vive aqui, e não no serviço de revisão, porque é função pura de string: o
// painel de revisão precisa dela para pré-preencher o campo, e um componente
// de tela não deveria arrastar uma dependência de rede para isso.
//
// Descarta partes curtas e puramente numéricas — data e número de documento
// mudam a cada arquivo. O que sobra costuma ser o trecho estável que
// identifica a origem: "extrato_itau_SILVACOM_08-2026" → "silvacom".
export function sugerirPadrao(fileName) {
  const partes = normalizarNomeArquivo(fileName)
    .split(' ')
    .filter((parte) => parte.length >= 4 && !/^\d+$/.test(parte));
  return partes[0] || '';
}

/**
 * Classifica um arquivo.
 *
 * @param {object} sinais    { fileName, text, mimeType, sizeBytes, receivedAt, remetente }
 * @param {object} contexto  { clients, categories, rules } — o cadastro do escritório
 * @returns {{
 *   clientId: string|null, competencia: string|null, categoryId: string|null,
 *   evidence: Array<{campo: string, detalhe: string}>,
 *   suposicoes: string[], pendencias: string[],
 *   decisao: 'organizar'|'revisar', motivoRevisao: string|null,
 *   rulesVersion: string
 * }}
 */
export function classificar(sinais, contexto = {}) {
  const cliente = identificarCliente(sinais, contexto);
  const categoria = identificarCategoria(sinais, contexto);
  const competencia = identificarCompetencia(sinais);

  const evidence = [];
  const pendencias = [];
  const suposicoes = [];
  const motivos = [];

  if (cliente.cliente) {
    evidence.push({ campo: 'cliente', detalhe: cliente.evidencia });
  } else {
    pendencias.push('cliente');
    motivos.push(`Cliente não identificado: ${cliente.motivo}`);
  }

  if (competencia.suposicao) {
    suposicoes.push('competencia');
    motivos.push('Competência suposta pelo mês anterior ao recebimento');
  }
  evidence.push({ campo: 'competencia', detalhe: competencia.evidencia });

  if (categoria.categoria) {
    evidence.push({ campo: 'categoria', detalhe: categoria.evidencia });
  } else {
    pendencias.push('categoria');
    motivos.push(`Categoria não identificada: ${categoria.motivo}`);
  }

  const decisao = pendencias.length === 0 && suposicoes.length === 0 ? 'organizar' : 'revisar';

  return {
    clientId: cliente.cliente?.id ?? null,
    competencia: competencia.competencia,
    categoryId: categoria.categoria?.id ?? null,
    evidence,
    suposicoes,
    pendencias,
    decisao,
    motivoRevisao: decisao === 'revisar' ? `${motivos.join('. ')}.` : null,
    rulesVersion: RULES_VERSION,
  };
}
