// Leitura do XML da NF-e. Módulo puro: sem React, sem DOM, sem rede.
//
// Não usa DOMParser de propósito. A camada de domínio roda no navegador (Vite)
// e também no `node --test`, e DOMParser só existe no primeiro. Um parser
// próprio de ~80 linhas custa menos que uma dependência ou que um motor
// fiscal que não dá para testar fora do browser.
//
// O escopo é estreito: XML de NF-e é gerado por máquina, sem namespaces com
// prefixo, sem DTD, sem entidade customizada. O que aparece de verdade é
// declaração, comentário, CDATA (em infCpl) e tag vazia — e isso está tratado.

const ENTIDADES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodificar(texto) {
  if (!texto.includes('&')) return texto;
  return texto.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, corpo) => {
    if (corpo[0] === '#') {
      const codigo = corpo[1] === 'x' || corpo[1] === 'X'
        ? parseInt(corpo.slice(2), 16)
        : parseInt(corpo.slice(1), 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : todo;
    }
    return ENTIDADES[corpo] ?? todo;
  });
}

// 'ns:infNFe' → 'infNFe'. NF-e usa namespace default, mas alguns emissores
// exportam com prefixo; o nome local é o que interessa.
function nomeLocal(nome) {
  const i = nome.indexOf(':');
  return i === -1 ? nome : nome.slice(i + 1);
}

function lerAtributos(corpo) {
  const atributos = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(corpo))) {
    atributos[nomeLocal(m[1])] = decodificar(m[3] ?? m[4] ?? '');
  }
  return atributos;
}

function novoNo(nome, atributos) {
  return { nome, atributos, filhos: [], texto: '' };
}

/**
 * Converte o XML em árvore de nós `{ nome, atributos, filhos, texto }`.
 * Lança em XML malformado — o pipeline captura e transforma em erro da nota,
 * porque meia nota lida é pior que nota nenhuma.
 */
export function parseXml(entrada) {
  const s = String(entrada ?? '');
  const raiz = novoNo('#documento', {});
  const pilha = [raiz];
  let i = 0;

  while (i < s.length) {
    const abre = s.indexOf('<', i);
    if (abre === -1) break;
    if (abre > i) pilha[pilha.length - 1].texto += decodificar(s.slice(i, abre));

    if (s.startsWith('<!--', abre)) {
      const fim = s.indexOf('-->', abre);
      if (fim === -1) throw new Error('XML malformado: comentário sem fechamento.');
      i = fim + 3;
      continue;
    }
    if (s.startsWith('<![CDATA[', abre)) {
      const fim = s.indexOf(']]>', abre);
      if (fim === -1) throw new Error('XML malformado: CDATA sem fechamento.');
      pilha[pilha.length - 1].texto += s.slice(abre + 9, fim);
      i = fim + 3;
      continue;
    }
    if (s.startsWith('<?', abre) || s.startsWith('<!', abre)) {
      const fim = s.indexOf('>', abre);
      if (fim === -1) throw new Error('XML malformado: declaração sem fechamento.');
      i = fim + 1;
      continue;
    }

    const fecha = fimDaTag(s, abre);
    if (fecha === -1) throw new Error('XML malformado: tag sem fechamento.');
    const corpo = s.slice(abre + 1, fecha);
    i = fecha + 1;

    if (corpo[0] === '/') {
      const nome = nomeLocal(corpo.slice(1).trim());
      const atual = pilha[pilha.length - 1];
      if (pilha.length === 1 || atual.nome !== nome) {
        throw new Error(`XML malformado: </${nome}> fecha tag diferente de <${atual.nome}>.`);
      }
      pilha.pop();
      continue;
    }

    const autoFecha = corpo.endsWith('/');
    const util = autoFecha ? corpo.slice(0, -1) : corpo;
    const nome = nomeLocal(util.trim().split(/[\s/]/)[0]);
    const no = novoNo(nome, lerAtributos(util.slice(nome.length)));
    pilha[pilha.length - 1].filhos.push(no);
    if (!autoFecha) pilha.push(no);
  }

  if (pilha.length !== 1) {
    throw new Error(`XML malformado: <${pilha[pilha.length - 1].nome}> não foi fechada.`);
  }
  return raiz.filhos[0] || null;
}

// Aspas podem conter '>' (em xNome, por exemplo). Procurar o '>' cru daria
// tag partida no meio.
function fimDaTag(s, inicio) {
  let aspas = null;
  for (let i = inicio + 1; i < s.length; i += 1) {
    const c = s[i];
    if (aspas) {
      if (c === aspas) aspas = null;
    } else if (c === '"' || c === "'") {
      aspas = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

// ── Navegação ──────────────────────────────────────────────────────────────

export function filho(no, nome) {
  return no?.filhos.find((f) => f.nome === nome) || null;
}

export function filhosPorNome(no, nome) {
  return no?.filhos.filter((f) => f.nome === nome) || [];
}

// caminho('infNFe', 'emit', 'CNPJ')
export function caminho(no, ...nomes) {
  return nomes.reduce((atual, nome) => filho(atual, nome), no);
}

export function texto(no, ...nomes) {
  const alvo = nomes.length ? caminho(no, ...nomes) : no;
  return alvo ? alvo.texto.trim() : '';
}

// Valores monetários da NF-e vêm sempre com ponto decimal e sem separador de
// milhar (leiaute do Manual de Orientação). Nada de troca de vírgula aqui:
// se vier fora do leiaute, é erro do arquivo e o padrão é devolvido.
export function numero(no, ...nomes) {
  const bruto = texto(no, ...nomes);
  if (!bruto) return 0;
  const valor = Number(bruto);
  return Number.isFinite(valor) ? valor : 0;
}

// ── Extração da NF-e ───────────────────────────────────────────────────────

// Grupos de ICMS do emitente no Simples Nacional. Vêm com CSOSN, não CST.
const GRUPOS_SN = new Set([
  'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202',
  'ICMSSN500', 'ICMSSN900',
]);

function lerIcms(imposto) {
  const icms = filho(imposto, 'ICMS');
  const grupo = icms?.filhos[0] || null;
  if (!grupo) {
    return { grupo: null, origem: null, cst: null, csosn: null, vBC: 0, pICMS: null, vICMS: 0 };
  }
  const simplesNacional = GRUPOS_SN.has(grupo.nome);
  const pICMS = texto(grupo, 'pICMS');
  return {
    grupo: grupo.nome,
    origem: texto(grupo, 'orig') || null,
    cst: simplesNacional ? null : texto(grupo, 'CST') || null,
    csosn: simplesNacional ? texto(grupo, 'CSOSN') || null : null,
    vBC: numero(grupo, 'vBC'),
    // Ausente em CST 60 / CSOSN sem crédito. `null` diz "não destacado";
    // 0 diria "destacado como zero", que é outra coisa.
    pICMS: pICMS ? Number(pICMS) : null,
    vICMS: numero(grupo, 'vICMS'),
  };
}

function lerItem(det) {
  const prod = filho(det, 'prod');
  const imposto = filho(det, 'imposto');
  const ipiTrib = caminho(imposto, 'IPI', 'IPITrib');
  return {
    nItem: Number(det.atributos.nItem || 0),
    codigo: texto(prod, 'cProd'),
    descricao: texto(prod, 'xProd'),
    ncm: texto(prod, 'NCM'),
    cest: texto(prod, 'CEST') || null,
    cfop: texto(prod, 'CFOP'),
    unidade: texto(prod, 'uCom'),
    quantidade: numero(prod, 'qCom'),
    vProd: numero(prod, 'vProd'),
    vFrete: numero(prod, 'vFrete'),
    vSeg: numero(prod, 'vSeg'),
    vDesc: numero(prod, 'vDesc'),
    vOutro: numero(prod, 'vOutro'),
    vIpi: ipiTrib ? numero(ipiTrib, 'vIPI') : 0,
    icms: lerIcms(imposto),
  };
}

/**
 * Lê o XML e devolve a nota já normalizada. Não calcula nada — separar
 * leitura de cálculo é o que permite testar o motor com nota sintética e
 * testar o parser com XML real de emissor esquisito.
 */
export function lerNFe(xml) {
  const raiz = parseXml(xml);
  if (!raiz) throw new Error('XML vazio.');

  // Aceita tanto <nfeProc> (nota autorizada, com protocolo) quanto <NFe> solto.
  const nfe = raiz.nome === 'NFe' ? raiz : filho(raiz, 'NFe');
  const infNFe = filho(nfe, 'infNFe');
  if (!infNFe) throw new Error('XML não é uma NF-e: <infNFe> não encontrada.');

  const ide = filho(infNFe, 'ide');
  const emit = filho(infNFe, 'emit');
  const dest = filho(infNFe, 'dest');
  const dhEmi = texto(ide, 'dhEmi') || texto(ide, 'dEmi');

  return {
    chave: String(infNFe.atributos.Id || '').replace(/^NFe/, ''),
    versao: infNFe.atributos.versao || null,
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    modelo: texto(ide, 'mod'),
    naturezaOperacao: texto(ide, 'natOp'),
    dhEmi,
    dataEmissao: dhEmi.slice(0, 10) || null,
    // idDest: 1 interna · 2 interestadual · 3 exterior. É a declaração do
    // emitente; o motor confere contra as UFs em vez de confiar cegamente.
    idDest: texto(ide, 'idDest') || null,
    finNFe: texto(ide, 'finNFe') || null,
    emitente: {
      cnpj: texto(emit, 'CNPJ') || texto(emit, 'CPF'),
      nome: texto(emit, 'xNome'),
      uf: texto(caminho(emit, 'enderEmit'), 'UF'),
      // CRT 1/4 = emitente no Simples Nacional (não destaca ICMS próprio).
      crt: texto(emit, 'CRT') || null,
    },
    destinatario: {
      cnpj: texto(dest, 'CNPJ') || texto(dest, 'CPF'),
      nome: texto(dest, 'xNome'),
      uf: texto(caminho(dest, 'enderDest'), 'UF'),
      indIEDest: texto(dest, 'indIEDest') || null,
    },
    itens: filhosPorNome(infNFe, 'det').map(lerItem),
    totais: (() => {
      const icmsTot = caminho(infNFe, 'total', 'ICMSTot');
      return {
        vProd: numero(icmsTot, 'vProd'),
        vFrete: numero(icmsTot, 'vFrete'),
        vSeg: numero(icmsTot, 'vSeg'),
        vDesc: numero(icmsTot, 'vDesc'),
        vOutro: numero(icmsTot, 'vOutro'),
        vIPI: numero(icmsTot, 'vIPI'),
        vNF: numero(icmsTot, 'vNF'),
      };
    })(),
  };
}

// ── Exibição do XML ────────────────────────────────────────────────────────
// A tela precisa mostrar a nota para quem quiser conferir o arquivo. Em vez
// de recortar o texto original — que vem em uma linha só, com o recuo que o
// emissor quis —, a árvore é serializada de volta. O que aparece é o XML
// COMO O MOTOR LEU: se o parser entendeu errado, o erro aparece na tela em
// vez de ficar escondido atrás do arquivo original.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapar(texto) {
  return String(texto).replace(/[&<>]/g, (c) => ESCAPES[c]);
}

function serializar(no, nivel) {
  const recuo = '  '.repeat(nivel);
  const atributos = Object.entries(no.atributos)
    .map(([chave, valor]) => ` ${chave}="${escapar(valor).replace(/"/g, '&quot;')}"`)
    .join('');

  if (!no.filhos.length) {
    const conteudo = no.texto.trim();
    return conteudo
      ? [`${recuo}<${no.nome}${atributos}>${escapar(conteudo)}</${no.nome}>`]
      : [`${recuo}<${no.nome}${atributos}/>`];
  }
  return [
    `${recuo}<${no.nome}${atributos}>`,
    ...no.filhos.flatMap((f) => serializar(f, nivel + 1)),
    `${recuo}</${no.nome}>`,
  ];
}

/** XML identado, a partir do texto bruto ou de um nó já parseado. */
export function identarXml(entrada) {
  if (!entrada) return '';
  const no = typeof entrada === 'string' ? parseXml(entrada) : entrada;
  return no ? serializar(no, 0).join('\n') : '';
}

/** O bloco <det> de um item, identado. `null` quando o item não existe. */
export function xmlDoItem(xml, nItem) {
  const raiz = typeof xml === 'string' ? parseXml(xml) : xml;
  if (!raiz) return null;
  const nfe = raiz.nome === 'NFe' ? raiz : filho(raiz, 'NFe');
  const infNFe = filho(nfe, 'infNFe');
  const det = filhosPorNome(infNFe, 'det')
    .find((d) => String(d.atributos.nItem) === String(nItem));
  return det ? identarXml(det) : null;
}
