import { supabase } from '../../../lib/supabase';

// ═══════════════════════════════════════════════════════════════
// Sinalização da sala — Supabase Realtime.
//
// WebRTC precisa de um caminho para as duas pontas trocarem SDP e ICE
// antes de existir conexão direta entre elas. Aqui esse caminho é um
// canal Realtime do Supabase, que o projeto já usa: presence dá a lista
// de participantes de graça, broadcast leva as mensagens de negociação,
// e nada disso toca o banco — é tudo efêmero, morre com a sala.
//
// Esta camada não sabe o que é WebRTC: ela entrega mensagens endereçadas
// e avisa quem entrou e quem saiu. Quem negocia mídia é o hook.
// ═══════════════════════════════════════════════════════════════

export const EVENTOS = {
  OFERTA: 'oferta',
  RESPOSTA: 'resposta',
  ICE: 'ice',
  PAROU: 'parou',
  // Pedido de retransmissão: quem entra depois avisa que chegou, e quem
  // está transmitindo abre uma conexão para o recém-chegado.
  QUERO_VER: 'quero-ver',
  // Ordem do host para um participante (bloquear, liberar, parar, remover).
  // Quem recebe confere se veio mesmo do host antes de obedecer.
  MODERACAO: 'moderacao',
};

export const STATUS = {
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
  RECONECTANDO: 'reconectando',
  ERRO: 'erro',
};

// Exportado para a listagem de salas ler a presença dos mesmos canais —
// dois lugares montando o nome à mão divergiriam no primeiro rename.
export function nomeDoCanal(codigo) {
  return `nora-screen:${String(codigo || '').toUpperCase()}`;
}

/**
 * Entra na sala e devolve o controle do canal.
 *
 * @param {object} cfg
 * @param {string} cfg.codigo          código da sala (XXXX-XXXX)
 * @param {object} cfg.eu              { id, nickname, entrouEm }
 * @param {(participantes: object[]) => void} cfg.aoMudarParticipantes
 * @param {(evento: string, payload: object) => void} cfg.aoReceber  só mensagens endereçadas a mim
 * @param {(status: string) => void} cfg.aoMudarStatus
 */
export function entrarNaSala({ codigo, eu, aoMudarParticipantes, aoReceber, aoMudarStatus }) {
  const canal = supabase.channel(nomeDoCanal(codigo), {
    config: {
      presence: { key: eu.id },
      // Sem `self`: as mensagens que eu envio não voltam para mim.
      broadcast: { self: false },
    },
  });

  const listarParticipantes = () => {
    const estado = canal.presenceState();
    const lista = Object.values(estado)
      .map((entradas) => entradas[0])
      .filter(Boolean)
      // Ordem estável por chegada — é ela que define quem é host.
      .sort((a, b) => (a.entrouEm - b.entrouEm) || String(a.id).localeCompare(String(b.id)));
    aoMudarParticipantes(lista);
  };

  canal
    .on('presence', { event: 'sync' }, listarParticipantes)
    .on('presence', { event: 'join' }, listarParticipantes)
    .on('presence', { event: 'leave' }, listarParticipantes);

  Object.values(EVENTOS).forEach((evento) => {
    canal.on('broadcast', { event: evento }, ({ payload }) => {
      // `para` vazio é broadcast para a sala inteira.
      if (payload?.para && payload.para !== eu.id) return;
      if (payload?.de === eu.id) return;
      aoReceber(evento, payload);
    });
  });

  canal.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      aoMudarStatus(STATUS.CONECTADO);
      canal.track({ ...eu, transmitindo: false });
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      aoMudarStatus(STATUS.RECONECTANDO);
      return;
    }
    if (status === 'CLOSED') aoMudarStatus(STATUS.CONECTANDO);
  });

  return {
    canal,
    enviar(evento, payload) {
      return canal.send({ type: 'broadcast', event: evento, payload: { ...payload, de: eu.id } });
    },
    anunciar(patch) {
      return canal.track({ ...eu, transmitindo: false, ...patch });
    },
    sair() {
      try { canal.untrack(); } catch { /* o canal pode já ter caído */ }
      supabase.removeChannel(canal);
    },
  };
}
