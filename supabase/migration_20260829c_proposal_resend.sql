-- Reenvio de proposta por e-mail + endereço informado na hora do envio.
--
-- Duas coisas mudam:
--
-- 1) `svc_record_proposal_send` ganha `p_is_resend` (default false, então a
--    chamada antiga da Edge Function continua funcionando sem alteração).
--    Reenviar uma proposta já enviada/visualizada/decidida NÃO deve voltar o
--    status pra 'enviada' nem mexer em sent_at — é só um novo disparo do
--    mesmo conteúdo, registrado como evento 'reenviada'. `create or replace`
--    com um parâmetro novo no fim, com default, substitui a função no mesmo
--    OID (não cria um overload) — os grants de antes continuam valendo, mas
--    confirmamos isso com uma consulta depois de aplicar mesmo assim.
--
-- 2) `admin_company_contact_email` — a Edge Function já sabia buscar o
--    e-mail do dono da empresa; agora o Admin também precisa pra pré-popular
--    o campo "enviar para" no modal, editável antes de cada envio. RPC nova,
--    só de leitura, admin-only.

alter table public.proposal_events drop constraint if exists proposal_events_event_type_check;
alter table public.proposal_events add constraint proposal_events_event_type_check
  check (event_type in ('criada', 'editada', 'nova_versao', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada', 'envio_falhou', 'reenviada'));

create or replace function public.svc_record_proposal_send(
  p_id uuid,
  p_actor_id uuid,
  p_success boolean,
  p_detail text default null,
  p_is_resend boolean default false
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

  if p_success and not p_is_resend then
    if v_p.status <> 'rascunho' then
      raise exception 'Só é possível enviar uma proposta em rascunho' using errcode = '22023';
    end if;

    update public.proposals set status = 'enviada', sent_at = now() where id = p_id returning * into v_p;

    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (p_id, 'enviada', p_actor_id, 'rascunho', 'enviada', p_detail);
  elsif p_success and p_is_resend then
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (p_id, 'reenviada', p_actor_id, v_p.status, v_p.status, p_detail);
  else
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (p_id, 'envio_falhou', p_actor_id, v_p.status, v_p.status, p_detail);
  end if;

  return v_p;
end;
$$;

-- admin-only: e-mail de login do dono da empresa, pra pré-popular o campo
-- "enviar para" no modal de envio (o admin ainda pode trocar antes de
-- confirmar). auth.users só é legível dentro de uma SECURITY DEFINER —
-- não existe policy de RLS que abra isso pra authenticated direto.
create or replace function public.admin_company_contact_email(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.companies where id = p_company_id;
  if v_owner is null then
    return null;
  end if;

  select email into v_email from auth.users where id = v_owner;
  return v_email;
end;
$$;

revoke execute on function public.admin_company_contact_email(uuid) from public, anon;
grant execute on function public.admin_company_contact_email(uuid) to authenticated, service_role;

-- `create or replace function` com um parâmetro A MAIS não substitui a
-- função de 4 argumentos no lugar — cria um OVERLOAD novo de 5 argumentos,
-- com OID próprio, sujeito ao mesmo default privilege que pegou
-- svc_record_proposal_send e _apply_proposal_acceptance antes (ver
-- migration_20260829b_proposal_grants_fix.sql). Sem isso, o overload novo
-- nascia com EXECUTE liberado pra anon/authenticated — sem checagem de
-- admin nenhuma por dentro, era um bypass direto. A versão de 4 argumentos
-- fica órfã (nada mais chama sem p_is_resend) — melhor derrubar do que
-- deixar around como uma segunda porta pro mesmo nome.
revoke execute on function public.svc_record_proposal_send(uuid, uuid, boolean, text, boolean) from anon, authenticated;
drop function if exists public.svc_record_proposal_send(uuid, uuid, boolean, text);
