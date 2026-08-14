// Chat de suporte com IA.
//
// A chave da Anthropic e o contexto da conta ficam na Edge Function
// `support-chat` — o navegador só manda o texto digitado e o id da conversa.
// Montar o contexto no cliente permitiria a qualquer um forjar "sou dono da
// empresa X" e fazer a IA falar dos dados de outro cliente.

import { supabase } from './supabase';

/** Envia uma mensagem. `ticketId` null inicia uma conversa nova. */
export async function sendChatMessage({ ticketId, message }) {
  const { data, error } = await supabase.functions.invoke('support-chat', {
    body: { ticket_id: ticketId, message },
  });

  if (error) {
    // O corpo do erro traz a mensagem útil (ex.: chave não configurada);
    // `error.message` sozinho vira um genérico "non-2xx status code".
    let detail = '';
    try { detail = (await error.context?.json())?.error || ''; } catch { /* noop */ }
    throw new Error(detail || error.message || 'Não foi possível falar com o atendimento.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Conversa de chat mais recente do usuário que ainda não foi fechada. */
export async function fetchOpenChat() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, escalated_at, status')
    .eq('channel', 'chat')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function fetchChatMessages(ticketId) {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, sender_type, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
