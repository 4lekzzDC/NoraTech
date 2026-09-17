// ═══════════════════════════════════════════════════════════════
// Regras de moderação da sala.
//
// Ficam fora do React e fora do WebRTC de propósito: são a mesma regra
// aplicada duas vezes — quem envia a ação confere antes de mandar, e
// quem recebe confere antes de obedecer. Uma função pura, testada, usada
// nas duas pontas.
//
// Limite importante: o canal de sinalização é broadcast com chave
// pública, sem autoridade no servidor. Isto impede que um participante
// comum mande ordens que os outros aceitem, mas não impede que alguém
// rode um cliente modificado e ignore uma ordem dirigida a ele. É
// moderação entre pares, não controle de servidor.
// ═══════════════════════════════════════════════════════════════

export const ACOES = {
  BLOQUEAR: 'bloquear',
  LIBERAR: 'liberar',
  PARAR: 'parar',
  REMOVER: 'remover',
};

const TODAS = new Set(Object.values(ACOES));

/**
 * Quem pode moderar quem.
 *
 * Só o host modera, e ninguém modera a si mesmo — inclusive o host, que
 * senão poderia se autobloquear e ficar sem saída na própria sala.
 */
export function podeModerar({ hostId, autorId, alvoId, acao }) {
  if (!hostId || !autorId || !alvoId) return false;
  if (!TODAS.has(acao)) return false;
  if (autorId !== hostId) return false;
  if (autorId === alvoId) return false;
  return true;
}

/**
 * O menu de um participante, montado a partir do estado dele.
 * Só aparece para o host, e nunca no próprio host.
 */
export function acoesDisponiveis({ alvo, souHost, euId }) {
  if (!souHost || !alvo || alvo.id === euId) return [];
  const acoes = [];
  if (alvo.transmitindo) {
    acoes.push({ acao: ACOES.PARAR, rotulo: 'Parar transmissão' });
  }
  if (alvo.bloqueado) {
    acoes.push({ acao: ACOES.LIBERAR, rotulo: 'Permitir compartilhar' });
  } else {
    acoes.push({ acao: ACOES.BLOQUEAR, rotulo: 'Impedir de compartilhar' });
  }
  acoes.push({ acao: ACOES.REMOVER, rotulo: 'Remover da sala', destrutiva: true });
  return acoes;
}
