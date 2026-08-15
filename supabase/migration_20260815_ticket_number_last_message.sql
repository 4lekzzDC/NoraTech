-- 1) Numeração global crescente. O ticket só tinha UUID, que não serve para o
-- cliente citar ("meu ticket 42"). Sequence própria, não serial, para o
-- backfill dos existentes respeitar a ordem de criação.
create sequence if not exists public.support_ticket_number_seq;

alter table public.support_tickets add column if not exists ticket_number bigint;

-- Backfill dos que já existem, na ordem em que foram criados.
with ordenados as (
  select id, row_number() over (order by created_at) as n
  from public.support_tickets
  where ticket_number is null
)
update public.support_tickets t
set ticket_number = o.n
from ordenados o
where t.id = o.id;

-- A sequence continua de onde o backfill parou.
select setval('public.support_ticket_number_seq',
              greatest(coalesce((select max(ticket_number) from public.support_tickets), 0), 1));

alter table public.support_tickets
  alter column ticket_number set default nextval('public.support_ticket_number_seq');

update public.support_tickets
set ticket_number = nextval('public.support_ticket_number_seq')
where ticket_number is null;

alter table public.support_tickets alter column ticket_number set not null;

create unique index if not exists support_tickets_number_idx
  on public.support_tickets (ticket_number);

-- 2) Último trâmite denormalizado. A alternativa seria buscar todas as
-- mensagens e agregar no cliente, o que traria a conversa inteira só para
-- mostrar uma data por linha da listagem.
alter table public.support_tickets
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_sender text;

create or replace function public.touch_ticket_last_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.support_tickets
  set last_message_at = new.created_at,
      last_message_sender = new.sender_type,
      updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_ticket_last_message on public.support_messages;
create trigger trg_touch_ticket_last_message
after insert on public.support_messages
for each row execute function public.touch_ticket_last_message();

-- Backfill do último trâmite a partir das mensagens que já existem.
update public.support_tickets t
set last_message_at = m.created_at,
    last_message_sender = m.sender_type
from (
  select distinct on (ticket_id) ticket_id, created_at, sender_type
  from public.support_messages
  order by ticket_id, created_at desc
) m
where m.ticket_id = t.id and t.last_message_at is null;
