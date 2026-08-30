// Pipeline de processamento do DIFAL: XML → itens → cálculo → consolidação.
//
// Fluxo de uma nota:
//
//   lerNFe()            arquivo vira estrutura navegável
//     ↓
//   triagem da nota     modelo, finalidade, UFs, destinatário, tabela da UF
//     ↓                 (uma nota reprovada aqui não gera item calculado)
//   calcularItem()      item a item, cruzando com o motor de regras
//     ↓
//   consolidar()        totais da nota, do lote, por NCM e lista de pendências
//
// Nada aqui decide alíquota: isso é do `ncmBusca`/`difalEngine`. Este arquivo
// só orquestra e junta.

import { lerNFe } from './nfeXml.js';
import { calcularItem, centavos } from './difalEngine.js';
import { getTabela, validarTabela } from './ncmRegras.js';
import { indexarTabela } from './ncmBusca.js';

export const VERSAO_MOTOR = '1';

// Só NF-e modelo 55. NFC-e (65) é venda a consumidor dentro da UF e nunca
// gera DIFAL de aquisição.
const MODELO_NFE = '55';

// finNFe: 1 normal · 2 complementar · 3 ajuste · 4 devolução.
const FINALIDADES_SEM_DIFAL = { 3: 'nota de ajuste', 4: 'nota de devolução' };

function notaRejeitada(nota, situacao, motivo) {
  return {
    ok: true,
    processada: false,
    situacao,
    motivo,
    nota,
    itens: [],
    totais: totaisZerados(),
    alertas: [],
  };
}

/**
 * Processa UM XML de NF-e.
 *
 * @param {string} xml
 * @param {object} opcoes
 *   @param {object}  [opcoes.tabela]        tabela de regras da UF de destino.
 *                                           Ausente → resolvida por `getTabela(uf)`.
 *   @param {string}  [opcoes.cnpjCliente]   CNPJ do cliente; a nota é ignorada
 *                                           se o destinatário for outro.
 *   @param {string}  [opcoes.politicaRevenda] 'nao_incide' (padrão) ou
 *                                           'antecipacao_parcial' para as UFs
 *                                           que cobram antecipação na revenda.
 *   @param {object}  [opcoes.finalidades]   { [nItem]: finalidade } — correção
 *                                           manual da destinação do item.
 *   @param {string}  [opcoes.metodoBase]    sobrepõe o método da tabela.
 */
export function processarNota(xml, opcoes = {}) {
  let nfe;
  try {
    nfe = lerNFe(xml);
  } catch (erro) {
    return { ok: false, processada: false, erro: erro.message, nota: null, itens: [], totais: totaisZerados(), alertas: [] };
  }

  // Identificação completa, não só o que o cálculo usa: a tela mostra a nota
  // inteira quando o contador quer conferir de onde o número saiu.
  const identificacao = {
    chave: nfe.chave,
    versao: nfe.versao,
    modelo: nfe.modelo,
    numero: nfe.numero,
    serie: nfe.serie,
    dataEmissao: nfe.dataEmissao,
    dhEmi: nfe.dhEmi,
    naturezaOperacao: nfe.naturezaOperacao,
    finNFe: nfe.finNFe,
    idDest: nfe.idDest,
    emitente: nfe.emitente,
    destinatario: nfe.destinatario,
    totaisNota: nfe.totais,
  };

  if (nfe.modelo && nfe.modelo !== MODELO_NFE) {
    return notaRejeitada(identificacao, 'nao_aplicavel', `Modelo ${nfe.modelo}: só NF-e modelo 55 gera DIFAL de aquisição.`);
  }
  if (FINALIDADES_SEM_DIFAL[nfe.finNFe]) {
    return notaRejeitada(identificacao, 'nao_aplicavel', `Documento é ${FINALIDADES_SEM_DIFAL[nfe.finNFe]} (finNFe ${nfe.finNFe}).`);
  }

  const cnpjCliente = digitos(opcoes.cnpjCliente);
  if (cnpjCliente && digitos(nfe.destinatario.cnpj) !== cnpjCliente) {
    return notaRejeitada(identificacao, 'nao_aplicavel', `Destinatário ${formatarCnpj(nfe.destinatario.cnpj)} não é o cliente em apuração.`);
  }

  const ufOrigem = nfe.emitente.uf;
  const ufDestino = nfe.destinatario.uf;
  if (!ufOrigem || !ufDestino) {
    return notaRejeitada(identificacao, 'pendente', 'UF do emitente ou do destinatário ausente no XML.');
  }
  if (ufOrigem === ufDestino) {
    return notaRejeitada(identificacao, 'nao_aplicavel', `Operação interna (${ufOrigem} → ${ufDestino}): não há diferencial de alíquota.`);
  }

  const tabela = opcoes.tabela || getTabela(ufDestino);
  if (!tabela) {
    return notaRejeitada(identificacao, 'pendente', `Não há tabela de alíquotas internas cadastrada para ${ufDestino}.`);
  }
  if (tabela.uf !== ufDestino) {
    return notaRejeitada(identificacao, 'pendente', `Tabela informada é de ${tabela.uf} e o destinatário está em ${ufDestino}.`);
  }
  const errosTabela = validarTabela(tabela);
  if (errosTabela.length) {
    return notaRejeitada(identificacao, 'pendente', `Tabela de ${tabela.uf} com erro de cadastro: ${errosTabela[0]}`);
  }

  const alertas = [];
  // idDest é declaração do emitente; as UFs é que mandam. Divergência costuma
  // ser erro de emissão e vale um aviso no relatório.
  if (nfe.idDest && nfe.idDest !== '2') {
    alertas.push(`Emitente declarou idDest ${nfe.idDest}, mas a operação é de ${ufOrigem} para ${ufDestino}.`);
  }

  const contextoBase = {
    tabela,
    indice: indexarTabela(tabela),
    ufOrigem,
    ufDestino,
    dataEmissao: nfe.dataEmissao,
    politicaRevenda: opcoes.politicaRevenda || tabela.politicaRevenda || 'nao_incide',
    metodoBase: opcoes.metodoBase || tabela.metodoBase || 'base_simples',
  };

  const finalidades = opcoes.finalidades || {};
  const itens = nfe.itens.map((item) => calcularItem(item, {
    ...contextoBase,
    finalidadeForcada: finalidades[item.nItem] || null,
  }));

  return {
    ok: true,
    processada: true,
    situacao: 'processada',
    motivo: null,
    versaoMotor: VERSAO_MOTOR,
    versaoTabela: tabela.versao,
    nota: identificacao,
    operacao: {
      ufOrigem,
      ufDestino,
      metodoBase: contextoBase.metodoBase,
      politicaRevenda: contextoBase.politicaRevenda,
    },
    itens,
    totais: somarItens(itens),
    alertas,
  };
}

/**
 * Processa um lote de XMLs e consolida.
 * @param {Array<{nome?: string, xml: string}|string>} arquivos
 */
export function processarLote(arquivos, opcoes = {}) {
  const notas = (arquivos || []).map((entrada) => {
    const nome = typeof entrada === 'string' ? null : entrada.nome ?? null;
    const xml = typeof entrada === 'string' ? entrada : entrada.xml;
    return { arquivo: nome, ...processarNota(xml, opcoes) };
  });
  return { notas, ...consolidar(notas) };
}

// ── Consolidação ──────────────────────────────────────────────────────────

function totaisZerados() {
  return {
    itens: 0, calculados: 0, pendentes: 0, naoAplicaveis: 0,
    vBase: 0, vDifal: 0, vFcp: 0, vTotal: 0,
  };
}

function somarItens(itens) {
  return itens.reduce((acc, item) => {
    acc.itens += 1;
    if (item.situacao === 'calculado') acc.calculados += 1;
    else if (item.situacao === 'pendente') acc.pendentes += 1;
    else acc.naoAplicaveis += 1;
    acc.vBase = centavos(acc.vBase + item.valores.vBase);
    acc.vDifal = centavos(acc.vDifal + item.valores.vDifal);
    acc.vFcp = centavos(acc.vFcp + item.valores.vFcp);
    acc.vTotal = centavos(acc.vTotal + item.valores.vTotal);
    return acc;
  }, totaisZerados());
}

/**
 * Junta o resultado de várias notas: totais do período, quebra por NCM e a
 * lista de pendências. A lista de pendências é o produto mais importante —
 * é o que o fiscal precisa resolver antes de fechar a guia.
 */
export function consolidar(notas) {
  const totais = totaisZerados();
  const porNcm = new Map();
  const pendencias = [];
  const erros = [];

  for (const nota of notas || []) {
    if (!nota.ok) {
      erros.push({ arquivo: nota.arquivo ?? null, erro: nota.erro });
      continue;
    }
    if (!nota.processada) {
      if (nota.situacao === 'pendente') {
        pendencias.push({
          arquivo: nota.arquivo ?? null,
          chave: nota.nota?.chave ?? null,
          numeroNota: nota.nota?.numero ?? null,
          nItem: null,
          descricao: null,
          motivo: nota.motivo,
        });
      }
      continue;
    }

    const parcial = somarItens(nota.itens);
    totais.itens += parcial.itens;
    totais.calculados += parcial.calculados;
    totais.pendentes += parcial.pendentes;
    totais.naoAplicaveis += parcial.naoAplicaveis;
    totais.vBase = centavos(totais.vBase + parcial.vBase);
    totais.vDifal = centavos(totais.vDifal + parcial.vDifal);
    totais.vFcp = centavos(totais.vFcp + parcial.vFcp);
    totais.vTotal = centavos(totais.vTotal + parcial.vTotal);

    for (const item of nota.itens) {
      if (item.situacao === 'pendente') {
        pendencias.push({
          arquivo: nota.arquivo ?? null,
          chave: nota.nota.chave,
          numeroNota: nota.nota.numero,
          nItem: item.nItem,
          descricao: item.descricao,
          motivo: item.motivo,
        });
      }
      if (item.situacao !== 'calculado') continue;

      const linha = porNcm.get(item.ncm) || {
        ncm: item.ncm,
        aliquotaInterna: item.aliquotas.interna,
        origemInterna: item.aliquotas.origemInterna,
        ncmRegra: item.aliquotas.ncmRegra,
        itens: 0, vBase: 0, vDifal: 0, vFcp: 0, vTotal: 0,
      };
      linha.itens += 1;
      linha.vBase = centavos(linha.vBase + item.valores.vBase);
      linha.vDifal = centavos(linha.vDifal + item.valores.vDifal);
      linha.vFcp = centavos(linha.vFcp + item.valores.vFcp);
      linha.vTotal = centavos(linha.vTotal + item.valores.vTotal);
      porNcm.set(item.ncm, linha);
    }
  }

  return {
    totais,
    porNcm: [...porNcm.values()].sort((a, b) => b.vTotal - a.vTotal),
    pendencias,
    erros,
  };
}

// ── Utilidades ────────────────────────────────────────────────────────────

function digitos(valor) {
  return String(valor ?? '').replace(/\D+/g, '');
}

function formatarCnpj(valor) {
  const d = digitos(valor);
  if (d.length !== 14) return valor || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
