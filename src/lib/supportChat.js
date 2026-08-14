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

// Categorias do formulário -> valores aceitos pelo check de support_tickets.
const CATEGORY_MAP = {
  acesso: 'account',
  sistema: 'technical',
  financeiro: 'billing',
  duvida: 'general',
  outro: 'other',
};

/** Abre um ticket pelo formulário (canal 'form'), já com a descrição como 1ª mensagem. */
export async function createTicket({ subject, category, description, companyId }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      subject: subject.trim(),
      description: description.trim(),
      user_id: user.id,
      company_id: companyId ?? null,
      category: CATEGORY_MAP[category] || 'general',
      channel: 'form',
      status: 'open',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  // A descrição vira a primeira mensagem do thread para que a resposta do
  // admin continue a mesma conversa, em vez de começar do nada.
  const { error: msgError } = await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'user',
    sender_id: user.id,
    message: description.trim(),
  });
  if (msgError) throw new Error(msgError.message);

  return ticket;
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
