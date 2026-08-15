-- Cliente respondendo um ticket que a equipe já atendeu ('waiting_user') ou
-- deu por resolvido ('resolved') precisa voltar pra fila da equipe — senão
-- a resposta do cliente fica presa num status que a aba "Precisam de
-- resposta" do admin não enxerga. O client não tem policy de UPDATE em
-- support_tickets (só admin), então isso só pode acontecer aqui, no mesmo
-- trigger security definer que já atualiza o "último trâmite".
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
      updated_at = now(),
      status = case
        when new.sender_type = 'user' and status in ('waiting_user', 'resolved') then 'open'
        else status
      end
  where id = new.ticket_id;
  return new;
end;
$$;
