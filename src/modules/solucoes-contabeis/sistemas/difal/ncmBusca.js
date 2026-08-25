// Busca hierárquica de alíquota interna por NCM.
//
// O XML traz sempre 8 dígitos. A tabela de regras é cadastrada no nível em
// que a legislação escreveu — às vezes a posição inteira (4), às vezes um
// item específico (8). Então a busca desce do específico para o genérico e
// para na PRIMEIRA faixa cadastrada:
//
//   33072010  → 8 dígitos: nada
//             → 6 dígitos: 330720  → exceção, cai na regra geral → 18%
//
//   33071000  → 8: nada · 6: nada · 4: 3307 → 25%
//
//   84713012  → 8: nada · 6: nada · 4: 8471 → 18% (regra própria)
//
//   12345678  → nada em nível nenhum → regra geral da UF → 18%
//
// Parar na primeira faixa é o que faz a exceção funcionar: 330720 é achado
// antes de 3307, então o desodorante nunca chega a ver os 25% da posição.

import { digitosNcm, NIVEIS_VALIDOS } from './ncmRegras.js';

// Do mais específico para o mais genérico. A ordem É o algoritmo.
export const NIVEIS_BUSCA = [...NIVEIS_VALIDOS].sort((a, b) => b - a);

// NCM válido é exatamente 8 dígitos. Nota com NCM de 2 dígitos ('00' de
// serviço) ou truncado não é erro de cálculo — é item que vai para revisão
// humana, e por isso devolvemos null em vez de tentar completar com zeros.
export function normalizarNcm(valor) {
  const digitos = digitosNcm(valor);
  return digitos.length === 8 ? digitos : null;
}

// '33072010' → ['33072010', '330720', '3307', '33']
export function fatiarNcm(valor) {
  const ncm = normalizarNcm(valor);
  if (!ncm) return [];
  return NIVEIS_BUSCA.map((n) => ncm.slice(0, n));
}

// Índice prefixo → regras. Montar uma vez e reaproveitar no lote inteiro:
// uma nota tem dezenas de itens e um lote tem centenas de notas; varrer o
// array de regras por item transforma o processamento em quadrático à toa.
export function indexarTabela(tabela) {
  const porPrefixo = new Map();
  for (const regra of tabela?.regras || []) {
    const chave = digitosNcm(regra.ncm);
    if (!NIVEIS_VALIDOS.includes(chave.length)) continue;
    const lista = porPrefixo.get(chave) || [];
    lista.push(regra);
    porPrefixo.set(chave, lista);
  }
  return { uf: tabela?.uf, porPrefixo };
}

function vigente(regra, data) {
  // Sem data de referência não dá para filtrar vigência: aceita tudo e deixa
  // o desempate para a regra mais recente, lá na busca.
  if (!data) return true;
  if (regra.vigenciaInicio && data < regra.vigenciaInicio) return false;
  if (regra.vigenciaFim && data > regra.vigenciaFim) return false;
  return true;
}

/**
 * Resolve a alíquota interna de um NCM.
 *
 * @param {string} ncmBruto  NCM como veio do XML (com ou sem pontuação).
 * @param {object} tabela    Tabela da UF de destino (ver ncmRegras.js).
 * @param {object} opcoes
 *   @param {string} [opcoes.data]    data de emissão 'AAAA-MM-DD' — filtra vigência.
 *   @param {object} [opcoes.indice]  índice pré-montado por `indexarTabela`.
 *
 * @returns {{
 *   encontrada: boolean, aliquota: number|null, fcp: number,
 *   nivel: number, origem: string, ncmRegra: string|null,
 *   fundamento: string|null, tipo: string|null, motivo: string|null
 * }}
 *
 * `origem` diz de onde veio o número, e é o que vai para o relatório:
 *   'ncm'          faixa própria do NCM
 *   'excecao'      faixa de exceção que remete à regra geral
 *   'regra_geral'  nenhuma faixa casou
 *   'nao_resolvida' NCM inválido ou tabela sem regra geral → revisão humana
 */
export function buscarAliquotaInterna(ncmBruto, tabela, opcoes = {}) {
  const { data = null, indice = null } = opcoes;
  const ncm = normalizarNcm(ncmBruto);

  if (!ncm) {
    return naoResolvida(
      `NCM '${String(ncmBruto ?? '').trim() || '(vazio)'}' não tem 8 dígitos.`,
    );
  }

  const { porPrefixo } = indice && indice.porPrefixo ? indice : indexarTabela(tabela);

  for (const nivel of NIVEIS_BUSCA) {
    const prefixo = ncm.slice(0, nivel);
    const candidatas = (porPrefixo.get(prefixo) || []).filter((r) => vigente(r, data));
    if (!candidatas.length) continue;

    // Empate no mesmo prefixo só acontece por vigências disjuntas — e
    // `validarTabela` reprova qualquer outro caso. Pegando a mais recente,
    // a regra nova sempre ganha da antiga que ficou no cadastro.
    const regra = candidatas.sort(
      (a, b) => String(b.vigenciaInicio ?? '').localeCompare(String(a.vigenciaInicio ?? '')),
    )[0];

    if (regra.seguirGeral) {
      const geral = tabela?.regraGeral;
      if (!geral || typeof geral.aliquota !== 'number') {
        return naoResolvida(
          `NCM ${ncm} cai na faixa de exceção ${prefixo}, que remete à regra geral — e a UF ${tabela?.uf ?? '?'} não tem regra geral cadastrada.`,
        );
      }
      return {
        encontrada: true,
        aliquota: geral.aliquota,
        fcp: regra.fcp ?? geral.fcp ?? 0,
        nivel,
        origem: 'excecao',
        ncmRegra: prefixo,
        tipo: regra.tipo || 'excecao',
        fundamento: regra.fundamento,
        motivo: null,
      };
    }

    return {
      encontrada: true,
      aliquota: regra.aliquota,
      fcp: regra.fcp ?? tabela?.regraGeral?.fcp ?? 0,
      nivel,
      origem: 'ncm',
      ncmRegra: prefixo,
      tipo: regra.tipo || tipoPorNivel(nivel),
      fundamento: regra.fundamento,
      motivo: null,
    };
  }

  const geral = tabela?.regraGeral;
  if (!geral || typeof geral.aliquota !== 'number') {
    return naoResolvida(
      `Nenhuma faixa casou com o NCM ${ncm} e a UF ${tabela?.uf ?? '?'} não tem regra geral cadastrada.`,
    );
  }

  return {
    encontrada: true,
    aliquota: geral.aliquota,
    fcp: geral.fcp ?? 0,
    nivel: 0,
    origem: 'regra_geral',
    ncmRegra: null,
    tipo: null,
    fundamento: geral.fundamento,
    motivo: null,
  };
}

function tipoPorNivel(nivel) {
  return { 2: 'capitulo', 4: 'posicao', 6: 'subposicao', 8: 'item' }[nivel] || null;
}

function naoResolvida(motivo) {
  return {
    encontrada: false,
    aliquota: null,
    fcp: 0,
    nivel: 0,
    origem: 'nao_resolvida',
    ncmRegra: null,
    tipo: null,
    fundamento: null,
    motivo,
  };
}

// Frase pronta para o relatório: "3307 (posição, 4 dígitos)".
export function explicarOrigem(resultado) {
  if (!resultado?.encontrada) return resultado?.motivo || 'Alíquota não resolvida.';
  if (resultado.origem === 'regra_geral') return 'Regra geral da UF (nenhuma faixa de NCM casou)';
  const nome = { 2: 'capítulo', 4: 'posição', 6: 'subposição', 8: 'item' }[resultado.nivel];
  const rotulo = `${resultado.ncmRegra} (${nome}, ${resultado.nivel} dígitos)`;
  return resultado.origem === 'excecao'
    ? `${rotulo} — exceção que cai na regra geral`
    : rotulo;
}
