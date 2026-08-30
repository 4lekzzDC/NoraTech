// Motor de cálculo do DIFAL nas aquisições interestaduais de empresas do
// Simples Nacional. Módulo puro: recebe XML e cadastro, devolve números e o
// porquê de cada um.
//
// Três compromissos de projeto, nesta ordem:
//
// 1. ITEM A ITEM. Nada é calculado no total da nota. Uma nota de material de
//    limpeza mistura produto de 25%, produto de 18% e produto com ST — e o
//    rateio do frete muda a base de cada um. O item é a unidade de apuração.
//
// 2. DETERMINÍSTICO. Toda alíquota sai de tabela cadastrada ou de valor
//    destacado no XML, com o caminho registrado em `origem`/`fonte`. Nada é
//    inferido de descrição de produto.
//
// 3. NA DÚVIDA, PENDENTE. Um item que o motor não sabe classificar com certeza
//    (NCM fora do padrão, CST de isenção, redução de base) sai como
//    'pendente' com o motivo escrito. Não existe chute que vire guia paga.

import { buscarAliquotaInterna } from './ncmBusca.js';

// ── Alíquotas interestaduais (Resoluções do Senado 22/1989 e 13/2012) ──────

// Sul e Sudeste, exceto ES. Só a saída DESTAS UFs para as demais é 7%.
const SUL_SUDESTE = new Set(['SP', 'RJ', 'MG', 'PR', 'SC', 'RS']);

// Origem da mercadoria (tag <orig> do grupo ICMS) que sujeita a operação aos
// 4% da Resolução 13/2012: importada (1), com conteúdo de importação > 40%
// (2, 3) e assemelhados (8). As origens 6 e 7 (sem similar nacional, lista
// CAMEX) ficam de fora e seguem a regra dos 7%/12%.
const ORIGENS_IMPORTADAS = new Set(['1', '2', '3', '8']);

export const ALIQUOTAS_INTERESTADUAIS_VALIDAS = [4, 7, 12];

export function aliquotaInterestadual({ ufOrigem, ufDestino, origemProduto }) {
  if (ORIGENS_IMPORTADAS.has(String(origemProduto ?? ''))) return 4;
  if (SUL_SUDESTE.has(ufOrigem) && !SUL_SUDESTE.has(ufDestino)) return 7;
  return 12;
}

// ── CFOP → finalidade declarada pelo emitente ─────────────────────────────
// O CFOP do fornecedor é o único indício da destinação que existe DENTRO do
// arquivo. Quando ele não declara (6102 e afins), a destinação real é do
// cliente e pode ser corrigida por `opcoes.finalidades`.

// 551 venda de ativo, 552 transferência. O 553 (devolução de compra de
// ativo) fica de fora — é devolução, e entra na lista sem DIFAL.
const CFOP_ATIVO = new Set(['551', '552']);
const CFOP_USO_CONSUMO = new Set(['556', '557']);
const CFOP_COMERCIALIZACAO = new Set([
  '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
  '111', '112', '113', '114', '115', '116', '117', '118', '119', '120',
  '122', '123', '124', '125',
]);
// Devolução, retorno, remessa e industrialização por conta de terceiro: a
// entrada não é aquisição, então não há diferencial a recolher.
const CFOP_SEM_DIFAL = new Set([
  '201', '202', '208', '209', '210', '410', '411', '412', '413', '414', '415',
  '503', '504', '505', '553', '901', '902', '903', '904', '905', '906', '907',
  '908', '909', '910', '911', '912', '913', '914', '915', '916', '917', '918',
  '919', '920', '921', '922', '923', '924', '925', '926', '929', '931', '932',
  '933', '934', '949',
]);

export const FINALIDADES = ['ativo_imobilizado', 'uso_consumo', 'comercializacao', 'nao_aquisicao', 'indefinida'];

export function finalidadeDoCfop(cfop) {
  const digitos = String(cfop ?? '').replace(/\D+/g, '');
  if (digitos.length !== 4) return { finalidade: 'indefinida', interestadual: false };
  const grupo = digitos[0];
  const sufixo = digitos.slice(1);
  // 5/1 = mesma UF, 6/2 = outra UF, 7/3 = exterior.
  const interestadual = grupo === '6' || grupo === '2';

  if (CFOP_SEM_DIFAL.has(sufixo)) return { finalidade: 'nao_aquisicao', interestadual };
  if (CFOP_ATIVO.has(sufixo)) return { finalidade: 'ativo_imobilizado', interestadual };
  if (CFOP_USO_CONSUMO.has(sufixo)) return { finalidade: 'uso_consumo', interestadual };
  if (CFOP_COMERCIALIZACAO.has(sufixo)) return { finalidade: 'comercializacao', interestadual };
  return { finalidade: 'indefinida', interestadual };
}

// ── Situação tributária do item ───────────────────────────────────────────

// ICMS já retido por substituição tributária: o ciclo se encerrou na origem,
// não há diferencial a recolher.
const CST_ST = new Set(['10', '30', '60', '70']);
const CSOSN_ST = new Set(['201', '202', '203', '500']);
// Sem ICMS destacado por isenção, não incidência, suspensão ou diferimento —
// e o tratamento no destino depende de o benefício existir lá também.
const CST_SEM_DESTAQUE = new Set(['40', '41', '50', '51']);
const CST_ANALISE = new Set(['20', '90']);   // redução de base / outras
const CSOSN_ANALISE = new Set(['900']);

function situacaoTributaria(icms) {
  const cst = icms.cst;
  const csosn = icms.csosn;
  if (cst && CST_ST.has(cst)) {
    return { ok: false, situacao: 'nao_aplicavel', motivo: `ICMS-ST (CST ${cst}): imposto já retido na origem.` };
  }
  if (csosn && CSOSN_ST.has(csosn)) {
    return { ok: false, situacao: 'nao_aplicavel', motivo: `ICMS-ST (CSOSN ${csosn}): imposto já retido na origem.` };
  }
  if (cst && CST_SEM_DESTAQUE.has(cst)) {
    return { ok: false, situacao: 'pendente', motivo: `CST ${cst}: operação sem ICMS destacado — conferir se o benefício alcança a UF de destino.` };
  }
  if (cst && CST_ANALISE.has(cst)) {
    return { ok: false, situacao: 'pendente', motivo: `CST ${cst}: base reduzida ou 'outras' — a redução no destino precisa ser confirmada antes do cálculo.` };
  }
  if (csosn && CSOSN_ANALISE.has(csosn)) {
    return { ok: false, situacao: 'pendente', motivo: `CSOSN ${csosn}: tributação 'outros' — exige análise manual.` };
  }
  if (!cst && !csosn) {
    return { ok: false, situacao: 'pendente', motivo: 'Item sem grupo de ICMS legível no XML.' };
  }
  return { ok: true, situacao: 'calculado', motivo: null };
}

// ── Aritmética ────────────────────────────────────────────────────────────

// Arredondamento em centavos, item a item. O total da guia é a soma dos itens
// já arredondados — é assim que o valor confere com o relatório impresso.
export function centavos(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/**
 * Base de cálculo do item.
 *
 * vProd − vDesc + vFrete + vSeg + vOutro (+ vIPI conforme a finalidade).
 *
 * O IPI integra a base quando o destinatário é consumidor final do bem — uso
 * e consumo e ativo imobilizado (CF art. 155, § 2º, XI). Em mercadoria para
 * revenda, não integra.
 */
export function baseDeCalculo(item, finalidade) {
  const ipiIntegra = finalidade === 'uso_consumo' || finalidade === 'ativo_imobilizado';
  const parcelas = {
    vProd: item.vProd,
    vFrete: item.vFrete,
    vSeg: item.vSeg,
    vOutro: item.vOutro,
    vDesc: -item.vDesc,
    vIpi: ipiIntegra ? item.vIpi : 0,
  };
  const total = Object.values(parcelas).reduce((s, v) => s + v, 0);
  return { valor: centavos(total), parcelas, ipiIntegra };
}

/**
 * Aplica alíquotas sobre a base.
 *
 * base_simples — a maioria das UFs para o Simples Nacional:
 *   DIFAL = base × (interna − interestadual)
 *
 * base_dupla — UFs que mandam recompor a base "por dentro" com a alíquota
 * interna antes do confronto:
 *   base2 = base × (1 − interestadual) ÷ (1 − interna)
 *   DIFAL = base2 × interna − base × interestadual
 */
export function aplicarAliquotas({ base, aliquotaInterna, aliquotaInter, fcp = 0, metodoBase = 'base_simples' }) {
  const interna = aliquotaInterna / 100;
  const inter = aliquotaInter / 100;

  if (metodoBase === 'base_dupla') {
    const baseDupla = centavos((base * (1 - inter)) / (1 - interna));
    const vDifal = centavos(baseDupla * interna - base * inter);
    const vFcp = centavos(baseDupla * (fcp / 100));
    return { metodoBase, vBaseDifal: baseDupla, vDifal, vFcp, vTotal: centavos(vDifal + vFcp) };
  }

  const vDifal = centavos(base * (interna - inter));
  const vFcp = centavos(base * (fcp / 100));
  return { metodoBase: 'base_simples', vBaseDifal: base, vDifal, vFcp, vTotal: centavos(vDifal + vFcp) };
}

// ── Item ──────────────────────────────────────────────────────────────────

// `fonte` é o item exatamente como saiu do XML. Anda junto do resultado em
// TODOS os caminhos — inclusive nos que não geram cálculo, que são
// justamente os que alguém vai querer conferir contra a nota.
function itemVazio(item, situacao, motivo, extra = {}) {
  return {
    fonte: item,
    nItem: item.nItem,
    codigo: item.codigo,
    descricao: item.descricao,
    ncm: item.ncm,
    cfop: item.cfop,
    situacao,
    motivo,
    finalidade: extra.finalidade ?? null,
    aliquotas: extra.aliquotas ?? null,
    valores: { vBase: 0, vBaseDifal: 0, vDifal: 0, vFcp: 0, vTotal: 0 },
    alertas: extra.alertas ?? [],
  };
}

export function calcularItem(item, contexto) {
  const { tabela, indice, ufOrigem, ufDestino, dataEmissao, finalidadeForcada, politicaRevenda, metodoBase } = contexto;
  const alertas = [];

  const doCfop = finalidadeDoCfop(item.cfop);
  const finalidade = finalidadeForcada || doCfop.finalidade;

  if (finalidade === 'nao_aquisicao') {
    return itemVazio(item, 'nao_aplicavel', `CFOP ${item.cfop}: operação que não é aquisição (devolução, remessa ou retorno).`, { finalidade });
  }
  if (finalidade === 'indefinida') {
    return itemVazio(item, 'pendente', `CFOP ${item.cfop} não mapeado: a destinação do item precisa ser informada para saber se há DIFAL.`, { finalidade });
  }
  if (finalidade === 'comercializacao' && politicaRevenda !== 'antecipacao_parcial') {
    return itemVazio(item, 'nao_aplicavel', `CFOP ${item.cfop}: mercadoria para revenda, e ${ufDestino} não cobra antecipação parcial nessa hipótese.`, { finalidade });
  }

  const st = situacaoTributaria(item.icms);
  if (!st.ok) return itemVazio(item, st.situacao, st.motivo, { finalidade });

  const interna = buscarAliquotaInterna(item.ncm, tabela, { data: dataEmissao, indice });
  if (!interna.encontrada) {
    return itemVazio(item, 'pendente', interna.motivo, { finalidade });
  }

  // Alíquota interestadual: o destaque do XML manda quando existe e é uma das
  // três alíquotas legais — só o emitente sabe o conteúdo de importação da
  // mercadoria. Fora disso, a matriz origem × destino resolve.
  const daTabela = aliquotaInterestadual({ ufOrigem, ufDestino, origemProduto: item.icms.origem });
  const destacada = item.icms.pICMS;
  let aliqInter = daTabela;
  let fonteInter = 'matriz_uf';
  if (destacada != null && ALIQUOTAS_INTERESTADUAIS_VALIDAS.includes(destacada)) {
    aliqInter = destacada;
    fonteInter = 'destaque_xml';
    if (destacada !== daTabela) {
      alertas.push(`Alíquota destacada (${destacada}%) diferente da esperada para ${ufOrigem}→${ufDestino} (${daTabela}%). Usado o destaque; conferir origem da mercadoria.`);
    }
  } else if (destacada != null) {
    alertas.push(`Alíquota destacada (${destacada}%) não é alíquota interestadual válida. Usada a matriz: ${daTabela}%.`);
  }

  if (interna.aliquota <= aliqInter) {
    return itemVazio(
      item,
      'nao_aplicavel',
      `Alíquota interna (${interna.aliquota}%) não supera a interestadual (${aliqInter}%): não há diferencial a recolher.`,
      { finalidade, alertas },
    );
  }

  const base = baseDeCalculo(item, finalidade);
  const calculo = aplicarAliquotas({
    base: base.valor,
    aliquotaInterna: interna.aliquota,
    aliquotaInter: aliqInter,
    fcp: interna.fcp,
    metodoBase,
  });

  return {
    fonte: item,
    nItem: item.nItem,
    codigo: item.codigo,
    descricao: item.descricao,
    ncm: item.ncm,
    cfop: item.cfop,
    situacao: 'calculado',
    motivo: null,
    finalidade,
    aliquotas: {
      interna: interna.aliquota,
      interestadual: aliqInter,
      fcp: interna.fcp,
      diferencial: centavos(interna.aliquota - aliqInter),
      fonteInterestadual: fonteInter,
      origemInterna: interna.origem,
      nivelNcm: interna.nivel,
      ncmRegra: interna.ncmRegra,
      fundamento: interna.fundamento,
    },
    base: { valor: base.valor, parcelas: base.parcelas, ipiIntegra: base.ipiIntegra },
    valores: {
      vBase: base.valor,
      vBaseDifal: calculo.vBaseDifal,
      vDifal: calculo.vDifal,
      vFcp: calculo.vFcp,
      vTotal: calculo.vTotal,
    },
    metodoBase: calculo.metodoBase,
    alertas,
  };
}
