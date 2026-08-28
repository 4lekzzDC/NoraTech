-- Propostas comerciais — Admin monta, envia um link público, o cliente
-- aceita ou recusa sem precisar de login, e a aceitação vira assinatura
-- ativa automaticamente.
--
-- Três tabelas, no mesmo espírito de invoices/invoice_items/invoice_events
-- (admin_schema.sql): `proposals` é a proposta em si (uma linha por VERSÃO,
-- não por "proposta lógica" — ver `admin_save_proposal` mais abaixo),
-- `proposal_items` são os sistemas incluídos (mesma forma de invoice_items:
-- system_slug, nome, descrição, valor) e `proposal_events` é o histórico
-- append-only (mesma forma de invoice_events: tipo, ator, status antes/depois,
-- observação).
--
-- Versionamento: editar uma proposta em rascunho atualiza a linha; editar
-- uma que já foi enviada (enviada/visualizada/aceita/recusada/expirada) NÃO
-- mexe nela — cria uma linha nova com `version` maior, `parent_proposal_id`
-- apontando pra anterior, e MOVE o `public_token` pra nova linha (a anterior
-- fica com `public_token = null` e `superseded_by` apontando pra frente). O
-- link que já foi mandado pro cliente continua funcionando, agora mostrando
-- a versão atual — sem precisar gerar e reenviar um link novo a cada ajuste.
-- Todo esse fork mora em `admin_save_proposal`, então nunca fica pela
-- metade.
--
-- Acesso público: nada aqui abre uma policy de SELECT pra `anon` na tabela —
-- seguindo o mesmo raciocínio de migration_20260825_fecha_execute_anon.sql
-- (a anon key é pública, embutida no bundle; uma policy `using (true)` pra
-- anon seria "qualquer um lista todas as propostas por REST direto"). A
-- tela pública só enxerga UMA proposta de cada vez, pelo token, através de
-- `get_proposal_by_token` — uma função SECURITY DEFINER com grant explícito
-- pra `anon`, que devolve só o que a tela pública precisa mostrar.

begin;

-- ── Tabelas ────────────────────────────────────────────────────────────

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada')),
  valid_until date,
  discount_type text check (discount_type is null or discount_type in ('percent', 'amount')),
  discount_value numeric(12,2) not null default 0,
  setup_fee numeric(12,2) not null default 0,
  notes text,
  -- Subtotal/desconto/total são calculados no servidor (admin_save_proposal),
  -- não confiados do cliente — e ficam gravados aqui pra tabela do admin (e
  -- a tela pública) não precisarem recalcular a cada carregamento.
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  public_token uuid unique,
  version integer not null default 1,
  parent_proposal_id uuid references public.proposals(id) on delete set null,
  root_proposal_id uuid references public.proposals(id) on delete set null,
  superseded_by uuid references public.proposals(id) on delete set null,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  decided_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_company_id_idx on public.proposals(company_id);
create index if not exists proposals_status_idx on public.proposals(status);
create index if not exists proposals_root_proposal_id_idx on public.proposals(root_proposal_id);

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  system_slug text references public.systems(slug),
  name text not null,
  description text,
  -- Valor de catálogo no momento em que o sistema foi adicionado (auditoria
  -- — "isso não é o que o admin editou, é o que o catálogo dizia então").
  unit_amount numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists proposal_items_proposal_id_idx on public.proposal_items(proposal_id);

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  event_type text not null
    check (event_type in ('criada', 'editada', 'nova_versao', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada')),
  -- null = ação do visitante público (visualizou/aceitou/recusou sem sessão),
  -- não confundir com "sistema": aqui é sempre uma pessoa, só que sem login.
  actor_id uuid references auth.users(id),
  status_before text,
  status_after text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_events_proposal_id_idx on public.proposal_events(proposal_id);

drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals
  for each row execute function public.touch_updated_at();

-- ── RLS: só admin, sempre — a tela pública nunca lê a tabela direto ──────

alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_events enable row level security;

drop policy if exists "proposals_admin_all" on public.proposals;
create policy "proposals_admin_all" on public.proposals
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "proposal_items_admin_all" on public.proposal_items;
create policy "proposal_items_admin_all" on public.proposal_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "proposal_events_admin_all" on public.proposal_events;
create policy "proposal_events_admin_all" on public.proposal_events
  for all using (public.is_admin()) with check (public.is_admin());

-- ── admin_save_proposal: cria, edita (rascunho) ou bifurca versão nova ───

create or replace function public.admin_save_proposal(
  p_id uuid,
  p_company_id uuid,
  p_title text,
  p_valid_until date,
  p_discount_type text,
  p_discount_value numeric,
  p_setup_fee numeric,
  p_notes text,
  p_items jsonb
)
returns public.proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.proposals;
  v_result   public.proposals;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total    numeric := 0;
  v_target_id uuid;
  v_item jsonb;
  v_before text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Título muito curto' using errcode = '22023';
  end if;
  if p_company_id is null then
    raise exception 'Selecione uma empresa' using errcode = '22023';
  end if;
  if p_discount_type is not null and p_discount_type not in ('percent', 'amount') then
    raise exception 'Tipo de desconto inválido' using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'Inclua pelo menos um sistema na proposta' using errcode = '22023';
  end if;

  select coalesce(sum((i->>'amount')::numeric), 0) into v_subtotal
  from jsonb_array_elements(p_items) i;

  v_discount := case
    when p_discount_type = 'percent' then round(v_subtotal * coalesce(p_discount_value, 0) / 100, 2)
    when p_discount_type = 'amount' then coalesce(p_discount_value, 0)
    else 0
  end;
  v_discount := least(greatest(v_discount, 0), v_subtotal);
  v_total := greatest(v_subtotal - v_discount, 0) + coalesce(p_setup_fee, 0);

  if p_id is not null then
    select * into v_existing from public.proposals where id = p_id;
    if v_existing.id is null then
      raise exception 'Proposta não encontrada' using errcode = 'P0002';
    end if;
  end if;

  if v_existing.id is null then
    insert into public.proposals (
      company_id, title, status, valid_until, discount_type, discount_value, setup_fee, notes,
      subtotal, discount_amount, total, public_token, version, created_by
    ) values (
      p_company_id, trim(p_title), 'rascunho', p_valid_until, p_discount_type, coalesce(p_discount_value, 0),
      coalesce(p_setup_fee, 0), nullif(trim(coalesce(p_notes, '')), ''),
      v_subtotal, v_discount, v_total, gen_random_uuid(), 1, auth.uid()
    )
    returning * into v_result;

    insert into public.proposal_events (proposal_id, event_type, actor_id, status_after)
      values (v_result.id, 'criada', auth.uid(), 'rascunho');

  elsif v_existing.status = 'rascunho' then
    update public.proposals set
      company_id = p_company_id,
      title = trim(p_title),
      valid_until = p_valid_until,
      discount_type = p_discount_type,
      discount_value = coalesce(p_discount_value, 0),
      setup_fee = coalesce(p_setup_fee, 0),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      subtotal = v_subtotal,
      discount_amount = v_discount,
      total = v_total
    where id = v_existing.id
    returning * into v_result;

    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
      values (v_result.id, 'editada', auth.uid(), 'rascunho', 'rascunho');

  else
    v_before := v_existing.status;

    -- Libera o token ANTES de inserir a versão nova com ele — a constraint
    -- unique é checada na hora do insert (não é deferrable), então
    -- "primeiro insere, depois libera" bate de frente consigo mesma quando
    -- a linha antiga ainda segura o valor.
    update public.proposals set public_token = null
    where id = v_existing.id;

    insert into public.proposals (
      company_id, title, status, valid_until, discount_type, discount_value, setup_fee, notes,
      subtotal, discount_amount, total, public_token, version,
      parent_proposal_id, root_proposal_id, created_by
    ) values (
      p_company_id, trim(p_title), 'rascunho', p_valid_until, p_discount_type, coalesce(p_discount_value, 0),
      coalesce(p_setup_fee, 0), nullif(trim(coalesce(p_notes, '')), ''),
      v_subtotal, v_discount, v_total, v_existing.public_token, v_existing.version + 1,
      v_existing.id, coalesce(v_existing.root_proposal_id, v_existing.id), auth.uid()
    )
    returning * into v_result;

    update public.proposals set superseded_by = v_result.id
    where id = v_existing.id;

    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
      values (
        v_result.id, 'nova_versao', auth.uid(), v_before, 'rascunho',
        format('Nova versão (v%s) a partir da proposta anterior, que estava "%s".', v_result.version, v_before)
      );
  end if;

  v_target_id := v_result.id;

  delete from public.proposal_items where proposal_id = v_target_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.proposal_items (proposal_id, system_slug, name, description, unit_amount, amount, sort_order)
    values (
      v_target_id,
      v_item->>'system_slug',
      v_item->>'name',
      v_item->>'description',
      coalesce((v_item->>'unit_amount')::numeric, 0),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::int, 0)
    );
  end loop;

  return v_result;
end;
$$;

-- ── admin_send_proposal: rascunho → enviada ──────────────────────────────

create or replace function public.admin_send_proposal(p_id uuid)
returns public.proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;

  select * into v_p from public.proposals where id = p_id;
  if v_p.id is null then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;
  if v_p.status <> 'rascunho' then
    raise exception 'Só é possível enviar uma proposta em rascunho' using errcode = '22023';
  end if;

  update public.proposals set status = 'enviada', sent_at = now() where id = p_id returning * into v_p;

  insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
    values (p_id, 'enviada', auth.uid(), 'rascunho', 'enviada');

  return v_p;
end;
$$;

-- ── _apply_proposal_acceptance: cria/atualiza a assinatura de cada sistema
--    aprovado — chamada tanto pelo aceite público quanto pela decisão manual
--    do admin, pra não duplicar a lógica em dois lugares. Não é exposta como
--    RPC (sem grant nenhum) — só outra SECURITY DEFINER pode chamar.

create or replace function public._apply_proposal_acceptance(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  r record;
begin
  select company_id into v_company_id from public.proposals where id = p_proposal_id;

  for r in
    select * from public.proposal_items
    where proposal_id = p_proposal_id and system_slug is not null
  loop
    if exists (
      select 1 from public.subscriptions
      where company_id = v_company_id and system_slug = r.system_slug
    ) then
      update public.subscriptions
      set status = 'active', amount = r.amount, plan = coalesce(r.name, plan), updated_at = now()
      where company_id = v_company_id and system_slug = r.system_slug;
    else
      insert into public.subscriptions (company_id, system_slug, plan, status, amount, currency, billing_cycle, started_at)
      values (v_company_id, r.system_slug, coalesce(r.name, 'Padrão'), 'active', r.amount, 'BRL', 'monthly', now());
    end if;
  end loop;
end;
$$;

-- ── admin_set_proposal_status: aceitar/recusar manualmente (negociação
--    fechada por telefone, por exemplo — sem passar pelo link público) ────

create or replace function public.admin_set_proposal_status(p_id uuid, p_status text, p_notes text default null)
returns public.proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
  v_before text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if p_status not in ('aceita', 'recusada') then
    raise exception 'Status inválido para decisão manual' using errcode = '22023';
  end if;

  select * into v_p from public.proposals where id = p_id;
  if v_p.id is null then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;
  if v_p.status not in ('enviada', 'visualizada') then
    raise exception 'Só é possível decidir manualmente uma proposta enviada ou visualizada' using errcode = '22023';
  end if;

  v_before := v_p.status;
  update public.proposals set status = p_status, decided_at = now() where id = p_id returning * into v_p;

  insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
    values (p_id, p_status, auth.uid(), v_before, p_status, nullif(trim(coalesce(p_notes, '')), ''));

  if p_status = 'aceita' then
    perform public._apply_proposal_acceptance(p_id);
  end if;

  return v_p;
end;
$$;

-- ── get_proposal_by_token: leitura pública, um token = uma proposta ─────
--    Efeito colateral de leitura, de propósito: primeira visita marca
--    "visualizada"; visita depois da validade marca "expirada". Idempotente
--    — só transiciona a partir de 'enviada', então visitar de novo uma já
--    visualizada/decidida não gera evento duplicado.

create or replace function public.get_proposal_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
  v_company record;
  v_result jsonb;
begin
  select * into v_p from public.proposals where public_token = p_token;
  if v_p.id is null or v_p.status = 'rascunho' then
    return null;
  end if;

  if v_p.valid_until is not null and v_p.valid_until < current_date and v_p.status in ('enviada', 'visualizada') then
    update public.proposals set status = 'expirada' where id = v_p.id;
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
      values (v_p.id, 'expirada', null, v_p.status, 'expirada');
    v_p.status := 'expirada';
  end if;

  if v_p.status = 'enviada' then
    update public.proposals set status = 'visualizada', first_viewed_at = coalesce(first_viewed_at, now())
    where id = v_p.id;
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
      values (v_p.id, 'visualizada', null, 'enviada', 'visualizada');
    v_p.status := 'visualizada';
  end if;

  select id, name into v_company from public.companies where id = v_p.company_id;

  select jsonb_build_object(
    'id', v_p.id,
    'title', v_p.title,
    'status', v_p.status,
    'valid_until', v_p.valid_until,
    'subtotal', v_p.subtotal,
    'discount_type', v_p.discount_type,
    'discount_value', v_p.discount_value,
    'discount_amount', v_p.discount_amount,
    'setup_fee', v_p.setup_fee,
    'total', v_p.total,
    'notes', v_p.notes,
    'version', v_p.version,
    'sent_at', v_p.sent_at,
    'decided_at', v_p.decided_at,
    'company', jsonb_build_object('id', v_company.id, 'name', v_company.name),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'system_slug', pi.system_slug, 'name', pi.name, 'description', pi.description,
        'amount', pi.amount, 'icon', s.icon, 'color', s.color
      ) order by pi.sort_order)
      from public.proposal_items pi
      left join public.systems s on s.slug = pi.system_slug
      where pi.proposal_id = v_p.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ── accept_proposal_by_token / reject_proposal_by_token ──────────────────

create or replace function public.accept_proposal_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
  v_before text;
begin
  select * into v_p from public.proposals where public_token = p_token;
  if v_p.id is null then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;

  if v_p.valid_until is not null and v_p.valid_until < current_date and v_p.status in ('enviada', 'visualizada') then
    update public.proposals set status = 'expirada' where id = v_p.id;
    insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
      values (v_p.id, 'expirada', null, v_p.status, 'expirada');
    raise exception 'Esta proposta expirou' using errcode = '22023';
  end if;
  if v_p.status not in ('enviada', 'visualizada') then
    raise exception 'Esta proposta não pode mais ser aceita' using errcode = '22023';
  end if;

  v_before := v_p.status;
  update public.proposals set status = 'aceita', decided_at = now() where id = v_p.id;
  insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after)
    values (v_p.id, 'aceita', null, v_before, 'aceita');

  perform public._apply_proposal_acceptance(v_p.id);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reject_proposal_by_token(p_token uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals;
  v_before text;
begin
  select * into v_p from public.proposals where public_token = p_token;
  if v_p.id is null then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;
  if v_p.status not in ('enviada', 'visualizada') then
    raise exception 'Esta proposta não pode mais ser recusada' using errcode = '22023';
  end if;

  v_before := v_p.status;
  update public.proposals set status = 'recusada', decided_at = now() where id = v_p.id;
  insert into public.proposal_events (proposal_id, event_type, actor_id, status_before, status_after, notes)
    values (v_p.id, 'recusada', null, v_before, 'recusada', nullif(trim(coalesce(p_reason, '')), ''));

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Permissões: revoga de PUBLIC (padrão do Postgres pra função nova) e
--    concede nominalmente — mesmo raciocínio de migration_20260825.
--    `_apply_proposal_acceptance` não recebe grant nenhum, de propósito.

revoke execute on function public.admin_save_proposal(uuid, uuid, text, date, text, numeric, numeric, text, jsonb) from public;
grant execute on function public.admin_save_proposal(uuid, uuid, text, date, text, numeric, numeric, text, jsonb) to authenticated, service_role;

revoke execute on function public.admin_send_proposal(uuid) from public;
grant execute on function public.admin_send_proposal(uuid) to authenticated, service_role;

revoke execute on function public.admin_set_proposal_status(uuid, text, text) from public;
grant execute on function public.admin_set_proposal_status(uuid, text, text) to authenticated, service_role;

revoke execute on function public._apply_proposal_acceptance(uuid) from public;

revoke execute on function public.get_proposal_by_token(uuid) from public;
grant execute on function public.get_proposal_by_token(uuid) to anon, authenticated, service_role;

revoke execute on function public.accept_proposal_by_token(uuid) from public;
grant execute on function public.accept_proposal_by_token(uuid) to anon, authenticated, service_role;

revoke execute on function public.reject_proposal_by_token(uuid, text) from public;
grant execute on function public.reject_proposal_by_token(uuid, text) to anon, authenticated, service_role;

commit;
