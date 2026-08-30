-- Envio real de proposta por e-mail (Resend), disparado pela Edge Function
-- send-proposal-email — não mais por RPC chamado direto do navegador.
--
-- Antes, `admin_send_proposal` só virava status='enviada' e mostrava o link
-- pro admin copiar — nenhum e-mail saía. Agora o status só vira 'enviada'
-- DEPOIS do Resend confirmar o envio (a Edge Function fala com o Resend, e
-- só então chama o banco); se o Resend falhar, a proposta continua em
-- rascunho e a falha fica registrada em proposal_events (evento novo
-- 'envio_falhou') pra dar pra debugar sem perder o histórico.

alter table public.proposal_events drop constraint if exists proposal_events_event_type_check;
alter table public.proposal_events add constraint proposal_events_event_type_check
  check (event_type in ('criada', 'editada', 'nova_versao', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada', 'envio_falhou'));

-- Superseded pela função abaixo — só ela decide quando uma proposta vira
-- 'enviada' agora, e só depois de confirmar que o e-mail saiu.
drop function if exists public.admin_send_proposal(uuid);

-- Chamada pela Edge Function send-proposal-email com o service_role key —
-- nunca pelo navegador. Por isso não checa is_admin()/auth.uid(): quem
-- chamou já foi autenticado e conferido como admin dentro da Edge Function,
-- que é a única dona do service_role key. `p_actor_id` carrega quem disparou
-- o envio, pro histórico continuar mostrando "por quem" mesmo sem sessão de
-- banco (a Edge Function roda com o client de service role, sem JWT de
-- usuário — auth.uid() daria null aqui dentro).
create or replace function public.svc_record_proposal_send(
  p_id uuid,
  p_actor_id uuid,
  p_success boolean,
  p_detail text default null
)
returns public.proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
begin
  select * into v_p from public.proposals where id = p_id;
  if v_p.id is null then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;

  if p_success then
    if v_p.status <> 'rascunho' then
      raise exception 'Só é possível enviar uma proposta em rascunho' using errcode = '22023';
    end if;

    update public.proposals set status = 'enviada', sent_at = now() where id = p_id returning * into v_p;

    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (p_id, 'enviada', p_actor_id, 'rascunho', 'enviada', p_detail);
  else
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (p_id, 'envio_falhou', p_actor_id, v_p.status, v_p.status, p_detail);
  end if;

  return v_p;
end;
$$;

revoke execute on function public.svc_record_proposal_send(uuid, uuid, boolean, text) from public;
grant execute on function public.svc_record_proposal_send(uuid, uuid, boolean, text) to service_role;
