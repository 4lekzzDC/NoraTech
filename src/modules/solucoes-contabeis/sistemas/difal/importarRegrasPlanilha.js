// Leitura da planilha de regras de NCM — o caminho de entrada que serve
// tanto para a equipe digitar hoje (copia da tela da Econet para uma
// planilha, exporta CSV) quanto para o que um coletor automatizado vier a
// produzir amanhã, se um dia ele existir. As duas fontes têm que produzir a
// MESMA forma de linha; esta é a única porta de entrada que valida essa
// forma.
//
// Módulo puro: recebe a matriz que `XLSX.utils.sheet_to_json(ws, {header:1})`
// já devolve (array de arrays, primeira linha é cabeçalho) e devolve linhas
// estruturadas com erro por linha — nunca lança. Uma planilha de 200 linhas
// com uma errada não pode perder as outras 199.

const CABECALHOS = {
  ncm: ['ncm', 'ncm prefixo', 'código ncm', 'codigo ncm'],
  tipo: ['tipo'],
  aliquota: ['aliquota', 'alíquota', 'aliquota (%)', 'alíquota (%)'],
  segueGeral: ['segue geral', 'segue a regra geral', 'exceção sem alíquota própria'],
  fcp: ['fcp', 'fcp (%)'],
  excecaoDe: ['excecao de', 'exceção de', 'ncm pai'],
  fundamento: ['fundamento', 'fundamento legal', 'base legal'],
  vigenciaInicio: ['vigencia inicio', 'vigência início', 'vigente desde'],
  vigenciaFim: ['vigencia fim', 'vigência fim', 'vigente até'],
  uf: ['uf'],
};

const NIVEIS_VALIDOS = new Set([2, 4, 6, 8]);
const TIPOS_VALIDOS = new Set(['capitulo', 'posicao', 'subposicao', 'item', 'excecao']);

function normalizar(texto) {
  return String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function mapearColunas(cabecalho) {
  const normalizado = (cabecalho || []).map(normalizar);
  const indices = {};
  for (const [campo, alternativas] of Object.entries(CABECALHOS)) {
    const alvo = alternativas.map(normalizar);
    const i = normalizado.findIndex((c) => alvo.includes(c));
    if (i !== -1) indices[campo] = i;
  }
  return indices;
}

function paraData(valor) {
  const bruto = String(valor ?? '').trim();
  if (!bruto) return null;
  // Aceita AAAA-MM-DD (o que a planilha exporta) e DD/MM/AAAA (o que quem
  // digita à mão costuma escrever).
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bruto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return undefined; // sinal de formato não reconhecido, distinto de "vazio"
}

function paraBooleano(valor) {
  const bruto = normalizar(valor);
  return ['sim', 'true', 'x', '1', 'verdadeiro'].includes(bruto);
}

/**
 * @param {Array<Array>} matriz  primeira linha = cabeçalho, header:1 do xlsx
 * @param {string} [ufPadrao]    usada quando a planilha não tem coluna UF
 * @returns {{ok: boolean, linhas: Array, erros: Array<{linha:number, motivo:string}>}}
 */
export function linhasDePlanilha(matriz, ufPadrao) {
  if (!Array.isArray(matriz) || matriz.length < 2) {
    return { ok: false, linhas: [], erros: [{ linha: 0, motivo: 'Planilha vazia ou sem linhas de dados.' }] };
  }

  const colunas = mapearColunas(matriz[0]);
  if (colunas.ncm == null) {
    return { ok: false, linhas: [], erros: [{ linha: 0, motivo: "Coluna 'NCM' não encontrada no cabeçalho." }] };
  }
  if (colunas.fundamento == null) {
    return { ok: false, linhas: [], erros: [{ linha: 0, motivo: "Coluna 'Fundamento' não encontrada no cabeçalho." }] };
  }

  const linhas = [];
  const erros = [];
  const pega = (linha, campo) => (colunas[campo] != null ? linha[colunas[campo]] : undefined);

  matriz.slice(1).forEach((linha, i) => {
    const numeroLinha = i + 2; // 1 é o cabeçalho, planilha começa em 1
    if (!linha || linha.every((c) => c === '' || c == null)) return; // linha em branco: ignora, sem erro

    const ncm = String(pega(linha, 'ncm') ?? '').replace(/\D+/g, '');
    if (!NIVEIS_VALIDOS.has(ncm.length)) {
      erros.push({ linha: numeroLinha, motivo: `NCM '${pega(linha, 'ncm')}' precisa ter 2, 4, 6 ou 8 dígitos.` });
      return;
    }

    const tipoBruto = normalizar(pega(linha, 'tipo'));
    const tipo = TIPOS_VALIDOS.has(tipoBruto) ? tipoBruto
      : ({ 2: 'capitulo', 4: 'posicao', 6: 'subposicao', 8: 'item' })[ncm.length];

    const segueGeral = paraBooleano(pega(linha, 'segueGeral'));
    const aliquotaBruta = pega(linha, 'aliquota');
    const aliquota = aliquotaBruta === '' || aliquotaBruta == null ? null : Number(aliquotaBruta);
    if (!segueGeral && (aliquota == null || !Number.isFinite(aliquota))) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: sem alíquota e sem marcar 'segue geral'.` });
      return;
    }
    if (segueGeral && aliquota != null) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: tem alíquota E 'segue geral' marcado — só um dos dois.` });
      return;
    }

    const fundamento = String(pega(linha, 'fundamento') ?? '').trim();
    if (!fundamento) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: sem fundamento legal.` });
      return;
    }

    const excecaoDeBruto = pega(linha, 'excecaoDe');
    const excecaoDe = excecaoDeBruto ? String(excecaoDeBruto).replace(/\D+/g, '') : null;
    if (tipo === 'excecao' && !excecaoDe) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: tipo 'exceção' precisa da coluna 'Exceção de'.` });
      return;
    }

    const vigenciaInicio = paraData(pega(linha, 'vigenciaInicio'));
    const vigenciaFim = paraData(pega(linha, 'vigenciaFim'));
    if (vigenciaInicio === undefined || vigenciaFim === undefined) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: data de vigência não reconhecida (use AAAA-MM-DD ou DD/MM/AAAA).` });
      return;
    }

    const uf = String(pega(linha, 'uf') || ufPadrao || '').toUpperCase().trim();
    if (!/^[A-Z]{2}$/.test(uf)) {
      erros.push({ linha: numeroLinha, motivo: `NCM ${ncm}: UF ausente ou inválida.` });
      return;
    }

    const fcpBruto = pega(linha, 'fcp');
    linhas.push({
      uf, ncm, tipo,
      ...(segueGeral ? { seguirGeral: true } : { aliquota }),
      fcp: fcpBruto === '' || fcpBruto == null ? null : Number(fcpBruto),
      excecaoDe: excecaoDe || undefined,
      fundamento,
      vigenciaInicio: vigenciaInicio || undefined,
      vigenciaFim: vigenciaFim || undefined,
    });
  });

  return { ok: erros.length === 0, linhas, erros };
}

export const MODELO_CABECALHO = [
  'NCM', 'Tipo', 'Alíquota', 'Segue geral', 'FCP', 'Exceção de', 'Fundamento',
  'Vigência início', 'Vigência fim', 'UF',
];
