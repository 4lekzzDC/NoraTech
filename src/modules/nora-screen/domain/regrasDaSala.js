// ═══════════════════════════════════════════════════════════════
// Regras gerais da sala — as que valem para todo mundo, decididas
// pelo host e guardadas no Supabase.
//
// Diferente da moderação individual (domain/moderacao.js), que é uma
// ordem dirigida a uma pessoa, aqui é estado da sala: quem chega depois
// já encontra a regra valendo, sem ninguém precisar reenviar nada.
//
// Puras de propósito: a mesma função responde no navegador de quem entra
// e no de quem já está lá, e dá para testar sem subir nada.
// ═══════════════════════════════════════════════════════════════

export const REGRAS_PADRAO = {
  entradasBloqueadas: false,
  somenteHostCompartilha: false,
  encerrada: false,
};

// A linha do banco vem em snake_case; o resto do módulo fala camelCase.
export function regrasDaLinha(linha) {
  if (!linha) return { ...REGRAS_PADRAO };
  return {
    entradasBloqueadas: Boolean(linha.entradas_bloqueadas),
    somenteHostCompartilha: Boolean(linha.somente_host_compartilha),
    encerrada: Boolean(linha.encerrada),
  };
}

/**
 * Se esta pessoa pode entrar na sala agora.
 *
 * O host entra sempre: bloquear entradas não pode trancar quem abriu a
 * sala do lado de fora dela.
 */
export function podeEntrar({ regras = REGRAS_PADRAO, souHost = false } = {}) {
  if (regras.encerrada) {
    return { pode: false, motivo: 'encerrada' };
  }
  if (regras.entradasBloqueadas && !souHost) {
    return { pode: false, motivo: 'entradas-bloqueadas' };
  }
  return { pode: true, motivo: null };
}

/**
 * Se esta pessoa pode compartilhar a tela agora.
 *
 * Ordem importa: o impedimento individual vem antes da regra geral, para
 * a pessoa ler o motivo mais específico, e não "só o host compartilha"
 * quando na verdade foi ela quem o host bloqueou.
 */
export function podeCompartilhar({
  regras = REGRAS_PADRAO,
  souHost = false,
  bloqueadoIndividualmente = false,
  outroTransmitindo = false,
} = {}) {
  if (regras.encerrada) return { pode: false, motivo: 'encerrada' };
  if (bloqueadoIndividualmente) return { pode: false, motivo: 'bloqueado' };
  if (regras.somenteHostCompartilha && !souHost) return { pode: false, motivo: 'somente-host' };
  if (outroTransmitindo) return { pode: false, motivo: 'ocupado' };
  return { pode: true, motivo: null };
}

export const MOTIVOS = {
  encerrada: 'A sala foi encerrada pelo host',
  'entradas-bloqueadas': 'O host bloqueou novas entradas nesta sala',
  bloqueado: 'O host impediu você de compartilhar nesta sala',
  'somente-host': 'Só o host pode compartilhar nesta sala',
};
