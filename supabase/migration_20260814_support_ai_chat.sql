-- Chat com IA reaproveitando o schema de suporte que já existia (e nunca foi
-- ligado à UI). Uma conversa de chat É um ticket com channel='chat': assim o
-- admin vê uma fila única, e escalar não precisa copiar histórico de lugar
-- nenhum — só marcar escalated_at.

-- 'ai' como remetente. Note que a policy support_messages_user_insert exige
-- sender_type='user', então um cliente continua sem conseguir forjar uma
-- mensagem da IA: só a Edge Function (service role) grava 'ai'.
alter table public.support_messages drop constraint if exists support_messages_sender_type_check;
alter table public.support_messages
  add constraint support_messages_sender_type_check
  check (sender_type = any (array['user','admin','system','ai']));

alter table public.support_tickets
  add column if not exists channel text not null default 'form',
  -- null = a IA ainda está conduzindo; preenchido = passou para humano
  add column if not exists escalated_at timestamptz;

alter table public.support_tickets drop constraint if exists support_tickets_channel_check;
alter table public.support_tickets
  add constraint support_tickets_channel_check check (channel = any (array['form','chat']));

create index if not exists support_messages_ticket_created_idx
  on public.support_messages (ticket_id, created_at);
create index if not exists support_tickets_user_channel_idx
  on public.support_tickets (user_id, channel, created_at desc);
