// ═══════════════════════════════════════════════════════════════
// Layout do palco com várias transmissões ao mesmo tempo.
//
// Uma função pura, porque a forma da grade é uma decisão sobre números e
// não sobre pixels: dá para testar sem navegador e a CSS só obedece.
// ═══════════════════════════════════════════════════════════════

/**
 * A grade para N transmissões.
 *
 * Uma ocupa tudo; duas ficam lado a lado (dividir em quatro
 * desperdiçaria metade da tela); três e quatro entram num 2×2; daí para
 * cima a grade cresce pela raiz, que é o que mantém os quadros mais
 * próximos do quadrado — e portanto maiores — do que empilhar colunas.
 */
export function layoutDaGrade(quantas) {
  const n = Math.max(0, Math.floor(Number(quantas) || 0));
  if (n <= 1) return { colunas: 1, linhas: 1, nome: 'solo' };
  if (n === 2) return { colunas: 2, linhas: 1, nome: 'dupla' };
  if (n <= 4) return { colunas: 2, linhas: 2, nome: 'quadro' };
  const colunas = Math.ceil(Math.sqrt(n));
  return { colunas, linhas: Math.ceil(n / colunas), nome: 'mosaico' };
}

/**
 * Quando alguém está em foco, o palco mostra só essa transmissão — as
 * outras continuam no ar, recebendo, apenas fora de vista.
 */
export function transmissoesVisiveis({ transmissoes = [], focoId = null } = {}) {
  if (!focoId) return transmissoes;
  const focada = transmissoes.find((t) => t.id === focoId);
  return focada ? [focada] : transmissoes;
}
