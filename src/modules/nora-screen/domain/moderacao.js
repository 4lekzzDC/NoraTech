import { PAPEL, papelDe, podeAgirSobre, podeGerirSala } from './papeis.js';

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
//
// O que NÃO é entre pares: quem é dono e quem é admin. Isso vem da linha
// da sala no Supabase, escrita só com o token do dono. Um cliente
// modificado pode se dizer admin, mas os outros conferem a lista que o
// banco entregou, não o que ele alega.
// ═══════════════════════════════════════════════════════════════

export const ACOES = {
  BLOQUEAR: 'bloquear',
  LIBERAR: 'liberar',
  PARAR: 'parar',
  REMOVER: 'remover',
  PROMOVER: 'promover',
  REBAIXAR: 'rebaixar',
};

const TODAS = new Set(Object.values(ACOES));

// Mexer em quem é admin é decisão sobre a sala, não moderação de gente:
// só o dono.
const SO_DO_DONO = new Set([ACOES.PROMOVER, ACOES.REBAIXAR]);

/**
 * Quem pode moderar quem.
 *
 * Dono e admin moderam participantes; sobre admins, só o dono age; e
 * ninguém age sobre si mesmo.
 */
export function podeModerar({ donoId, admins, autorId, alvoId, acao }) {
  if (!TODAS.has(acao)) return false;
  if (!podeAgirSobre({ autorId, alvoId, donoId, admins })) return false;
  if (SO_DO_DONO.has(acao) && !podeGerirSala({ id: autorId, donoId, admins })) return false;
  return true;
}

/**
 * O menu de um participante, montado a partir do estado dele.
 *
 * O menu é conveniência, não barreira: quem manda a ação confere de novo
 * em `podeModerar`, e quem a recebe também.
 */
export function acoesDisponiveis({ alvo, euId, donoId, admins }) {
  if (!alvo || !podeAgirSobre({ autorId: euId, alvoId: alvo.id, donoId, admins })) return [];
  const souDono = podeGerirSala({ id: euId, donoId, admins });
  const papelAlvo = papelDe({ id: alvo.id, donoId, admins });
  const acoes = [];

  if (alvo.transmitindo) {
    acoes.push({ acao: ACOES.PARAR, rotulo: 'Parar transmissão' });
  }
  if (alvo.bloqueado) {
    acoes.push({ acao: ACOES.LIBERAR, rotulo: 'Permitir compartilhar' });
  } else {
    acoes.push({ acao: ACOES.BLOQUEAR, rotulo: 'Impedir de compartilhar' });
  }
  if (souDono && papelAlvo !== PAPEL.DONO) {
    acoes.push(papelAlvo === PAPEL.ADMIN
      ? { acao: ACOES.REBAIXAR, rotulo: 'Remover admin' }
      : { acao: ACOES.PROMOVER, rotulo: 'Tornar admin' });
  }
  acoes.push({ acao: ACOES.REMOVER, rotulo: 'Remover da sala', destrutiva: true });
  return acoes;
}
