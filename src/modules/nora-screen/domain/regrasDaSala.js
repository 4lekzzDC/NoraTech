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
  // `null` é ausência de limite, e não zero: zero seria "sala que não
  // aceita ninguém", que é outra coisa e já tem nome.
  maxParticipantes: null,
  admins: [],
  // Quem é o dono, pelo id de participante. Vem do banco: é por ele que a
  // sala sabe de quem aceitar ordens, sem depender do que cada um diz.
  donoId: null,
};

// A linha do banco vem em snake_case; o resto do módulo fala camelCase.
export function regrasDaLinha(linha) {
  if (!linha) return { ...REGRAS_PADRAO };
  const max = Number(linha.max_participantes);
  return {
    entradasBloqueadas: Boolean(linha.entradas_bloqueadas),
    somenteHostCompartilha: Boolean(linha.somente_host_compartilha),
    encerrada: Boolean(linha.encerrada),
    maxParticipantes: Number.isFinite(max) && max > 0 ? max : null,
    admins: Array.isArray(linha.admins) ? linha.admins : [],
    donoId: linha.dono_id || null,
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
    max_participantes: resposta.max_participantes,
    admins: resposta.admins,
    dono_id: resposta.dono_id,
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
} = {}) {
  if (regras.encerrada) return { pode: false, motivo: 'encerrada' };
  if (bloqueadoIndividualmente) return { pode: false, motivo: 'bloqueado' };
  if (regras.somenteHostCompartilha && !souHost) return { pode: false, motivo: 'somente-host' };
  // Não existe mais "ocupado": a sala aceita vários compartilhamentos ao
  // mesmo tempo, e quem chega depois divide o palco em vez de esperar.
  return { pode: true, motivo: null };
}

export const LIMITE_MIN = 0;
export const LIMITE_MAX = 99;

/**
 * O limite que o controle aceita: inteiro de 0 a 99, onde 0 é "sem
 * limite".
 *
 * Existe porque o campo numérico aceita qualquer coisa — texto colado,
 * 1e9, vírgula, vazio — e nada disso pode virar limite da sala.
 */
export function normalizarLimite(valor) {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n)) return LIMITE_MIN;
  return Math.min(LIMITE_MAX, Math.max(LIMITE_MIN, n));
}

/**
 * O limite como o banco guarda: `null` é sem limite, e o mínimo real é
 * 2 — uma sala de 1 pessoa não é uma sala, é uma porta fechada, e para
 * isso já existe "bloquear novas entradas".
 */
export function limiteParaOBanco(valor) {
  const n = normalizarLimite(valor);
  return n === 0 ? null : Math.max(2, n);
}

/** O que a porta mostra para quem o servidor recusou. */
export const MOTIVOS_ENTRADA = {
  'entradas-bloqueadas': 'Esta sala não está aceitando novas entradas no momento.',
  lotada: 'Esta sala atingiu o limite de participantes.',
  encerrada: 'Esta sala foi encerrada pelo host.',
  inexistente: 'Esta sala não existe ou já expirou.',
  indisponivel: 'Não foi possível confirmar o estado desta sala agora. Tente de novo em instantes.',
};

export const MOTIVOS = {
  encerrada: 'A sala foi encerrada pelo host',
  'entradas-bloqueadas': 'O host bloqueou novas entradas nesta sala',
  bloqueado: 'O host impediu você de compartilhar nesta sala',
  'somente-host': 'Só o dono e os admins podem compartilhar nesta sala',
  lotada: 'Esta sala atingiu o limite de participantes',
};
