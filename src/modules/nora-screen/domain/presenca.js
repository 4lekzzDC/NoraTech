// ═══════════════════════════════════════════════════════════════
// Leitura da presença da sala.
//
// Puro de propósito, e fora da camada que fala com o Supabase: é aqui
// que mora a regra de qual estado de uma pessoa vale, e ela precisa ser
// testável sem subir nada.
// ═══════════════════════════════════════════════════════════════

/**
 * A meta mais recente de um participante.
 *
 * Cada chave do presence guarda uma LISTA de metas, e um `track` novo
 * não substitui o anterior — acrescenta. Ler a primeira devolvia o
 * estado mais VELHO da pessoa, e era por isso que quem começava a
 * compartilhar continuava aparecendo como "só assistindo" para os
 * outros.
 *
 * `anunciadoEm` é carimbado a cada anúncio; na falta dele (meta de
 * outra versão do cliente), quem tem carimbo ganha de quem não tem.
 */
export function maisRecente(metas) {
  if (!Array.isArray(metas) || !metas.length) return null;
  return metas.reduce((melhor, atual) => {
    if (!melhor) return atual;
    const a = Number(atual?.anunciadoEm) || 0;
    const b = Number(melhor?.anunciadoEm) || 0;
    return a >= b ? atual : melhor;
  }, null);
}

/**
 * A lista de participantes a partir do estado bruto do presence.
 *
 * `expulsos` risca quem já foi removido: o `leave` do presence pode
 * demorar ou se perder, e sem isto a pessoa removida continuava na lista
 * de todo mundo como fantasma.
 */
export function participantesDoPresence(estado, { expulsos } = {}) {
  const fora = expulsos instanceof Set ? expulsos : new Set(expulsos || []);
  return Object.values(estado || {})
    .map((metas) => maisRecente(metas))
    .filter((p) => p && p.id && !fora.has(p.id))
    // Ordem estável por chegada — é ela que define quem chegou primeiro.
    .sort((a, b) => (a.entrouEm - b.entrouEm) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Quem está compartilhando a tela agora, por id.
 *
 * Duas fontes, de propósito. A presença é o que a pessoa diz de si, e
 * pode chegar atrasada ou fora de ordem; a mídia que está entrando é o
 * que de fato acontece. Se um vídeo dela está na tela, ela está
 * compartilhando — não importa o que a presença ainda não contou.
 *
 * Nunca um estado global: a resposta é sempre por participante.
 */
export function quemCompartilha({ participantes = [], transmissoes = [] } = {}) {
  const ids = new Set();
  transmissoes.forEach((t) => { if (t?.id) ids.add(t.id); });
  participantes.forEach((p) => { if (p?.transmitindo && p.id) ids.add(p.id); });
  return [...ids];
}
