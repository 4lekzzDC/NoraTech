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

// Quem pode entrar é decidido pelo servidor, na RPC
// nora_screen_entrar_na_sala. Não há cópia da regra aqui de propósito:
// uma segunda implementação no cliente é uma que pode discordar da que
// vale — e foi assim que a sala bloqueada deixou gente entrar.
export const ENTRADA = {
  VERIFICANDO: 'verificando',
  AUTORIZADA: 'autorizada',
  RECUSADA: 'recusada',
};

/**
 * Traduz a resposta do servidor sobre a entrada.
 *
 * Resposta ausente é recusa, não liberação: antes, qualquer falha ao
 * consultar o estado da sala caía no padrão "tudo liberado" e a pessoa
 * entrava apesar do bloqueio. Porta que não sabe se pode abrir fica
 * fechada.
 */
export function decisaoDaEntrada(resposta) {
  if (!resposta || typeof resposta !== 'object') {
    return {
      estado: ENTRADA.RECUSADA,
      motivo: 'indisponivel',
      eHost: false,
      regras: { ...REGRAS_PADRAO },
    };
  }
  const regras = regrasDaLinha({
    entradas_bloqueadas: resposta.entradas_bloqueadas,
    somente_host_compartilha: resposta.somente_host_compartilha,
    encerrada: resposta.encerrada,
  });
  const eHost = Boolean(resposta.e_host);
  if (resposta.autorizado) {
    return { estado: ENTRADA.AUTORIZADA, motivo: null, eHost, regras };
  }
  return { estado: ENTRADA.RECUSADA, motivo: resposta.motivo || 'indisponivel', eHost, regras };
}

/**
 * Se quem JÁ ESTÁ na sala precisa sair por causa das regras atuais.
 *
 * Só o encerramento tira alguém de dentro. "Bloquear novas entradas" é
 * uma porta, não uma expulsão: quem já estava conversando continua, e o
 * host consegue fechar a sala para estranhos sem derrubar a reunião que
 * está acontecendo.
 */
export function saidaObrigatoria({ regras = REGRAS_PADRAO } = {}) {
  return regras.encerrada ? 'encerrada' : null;
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

/** O que a porta mostra para quem o servidor recusou. */
export const MOTIVOS_ENTRADA = {
  'entradas-bloqueadas': 'Esta sala não está aceitando novas entradas no momento.',
  encerrada: 'Esta sala foi encerrada pelo host.',
  inexistente: 'Esta sala não existe ou já expirou.',
  indisponivel: 'Não foi possível confirmar o estado desta sala agora. Tente de novo em instantes.',
};

export const MOTIVOS = {
  encerrada: 'A sala foi encerrada pelo host',
  'entradas-bloqueadas': 'O host bloqueou novas entradas nesta sala',
  bloqueado: 'O host impediu você de compartilhar nesta sala',
  'somente-host': 'Só o host pode compartilhar nesta sala',
};
