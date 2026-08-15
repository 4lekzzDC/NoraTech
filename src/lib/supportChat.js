// Suporte: chat com IA e tickets.
//
// A chave do Gemini e o contexto da conta ficam na Edge Function
// `support-chat` — o navegador só manda o texto digitado e o id da conversa.
// Montar o contexto no cliente permitiria a qualquer um forjar "sou dono da
// empresa X" e fazer a IA falar dos dados de outro cliente.

import { supabase } from './supabase';

// Os 5 status do banco viram 3 rótulos para o cliente: o que ele precisa
// saber é de quem é a vez, não o estado interno da fila do suporte.
export const TICKET_STATUS = {
  open:         { label: 'Aguardando', color: '#f59e0b', group: 'aguardando' },
  in_progress:  { label: 'Aguardando', color: '#f59e0b', group: 'aguardando' },
  waiting_user: { label: 'Respondido', color: '#60a5fa', group: 'respondido' },
  resolved:     { label: 'Concluído',  color: '#22c55e', group: 'concluido' },
  closed:       { label: 'Concluído',  color: '#22c55e', group: 'concluido' },
};

export const TICKET_CATEGORY = {
  account:   'Acesso / Login',
  technical: 'Problema no sistema',
  billing:   'Financeiro / Assinatura',
  general:   'Dúvida geral',
  other:     'Outro',
};

export const SENDER_LABEL = {
  user: 'Você',
  admin: 'Equipe',
  ai: 'Atendimento IA',
  system: 'Sistema',
};

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

/**
 * Responde a um ticket já aberto (fora do chat de IA). A RLS só aceita a
 * inserção com sender_type='user' se o ticket for do próprio usuário e
 * ainda não estiver fechado; o trigger do banco reabre o ticket (volta pra
 * 'open') quando ele estava em 'waiting_user'/'resolved'.
 */
export async function sendTicketReply({ ticketId, message }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const text = message.trim();
  if (!text) throw new Error('Mensagem vazia');

  const { error } = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'user',
    sender_id: user.id,
    message: text,
  });
  if (error) throw new Error(error.message);
}

/** Todos os tickets do usuário (RLS já limita aos dele). */
export async function fetchMyTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, status, category, channel, created_at, last_message_at, last_message_sender')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
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
