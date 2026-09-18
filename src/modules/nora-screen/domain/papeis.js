// ═══════════════════════════════════════════════════════════════
// Papéis na sala: dono, admin e participante.
//
// Três níveis, com uma divisão clara: o dono decide o que a sala É
// (limite, quem é admin, se continua existindo); o admin cuida de quem
// está dentro (moderação). Participante não manda em ninguém.
//
// Quem é dono vem do token — só quem abriu a sala tem. Quem é admin vem
// da linha da sala no banco, escrita por uma RPC que exige esse mesmo
// token. Nenhum dos dois é afirmação do cliente.
//
// Puras de propósito: a mesma função responde no navegador de quem manda
// a ordem e no de quem a recebe. Quem obedece confere.
// ═══════════════════════════════════════════════════════════════

export const PAPEL = {
  DONO: 'dono',
  ADMIN: 'admin',
  PARTICIPANTE: 'participante',
};

export const NOME_DO_PAPEL = {
  [PAPEL.DONO]: 'Dono',
  [PAPEL.ADMIN]: 'Admin',
  [PAPEL.PARTICIPANTE]: null,
};

/** O papel de alguém, dado quem é o dono e a lista de admins da sala. */
export function papelDe({ id, donoId, admins } = {}) {
  if (!id) return PAPEL.PARTICIPANTE;
  if (donoId && id === donoId) return PAPEL.DONO;
  if (Array.isArray(admins) && admins.includes(id)) return PAPEL.ADMIN;
  return PAPEL.PARTICIPANTE;
}

/**
 * O que só o dono faz: mudar o limite, promover e rebaixar admins,
 * encerrar a sala. São decisões sobre a sala, não sobre pessoas.
 */
export function podeGerirSala({ id, donoId, admins } = {}) {
  return papelDe({ id, donoId, admins }) === PAPEL.DONO;
}

/** O que dono e admin fazem: cuidar de quem está dentro. */
export function podeModerar({ id, donoId, admins } = {}) {
  const papel = papelDe({ id, donoId, admins });
  return papel === PAPEL.DONO || papel === PAPEL.ADMIN;
}

/**
 * Se `autorId` pode agir sobre `alvoId`.
 *
 * Ninguém age sobre si mesmo — nem o dono, que senão poderia se
 * autobloquear e ficar sem saída na própria sala.
 *
 * E admin não mexe em dono nem em outro admin: promover alguém não pode
 * ser o primeiro passo para derrubar quem promoveu, nem para uma briga
 * entre admins que a sala assiste. Sobre admins, só o dono age.
 */
export function podeAgirSobre({ autorId, alvoId, donoId, admins } = {}) {
  if (!autorId || !alvoId || autorId === alvoId) return false;
  const papelAutor = papelDe({ id: autorId, donoId, admins });
  const papelAlvo = papelDe({ id: alvoId, donoId, admins });
  if (papelAutor === PAPEL.DONO) return true;
  if (papelAutor === PAPEL.ADMIN) return papelAlvo === PAPEL.PARTICIPANTE;
  return false;
}
