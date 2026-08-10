-- =========================================================================
-- Migração 09/08/2026 — cobrança consolidada por empresa
--
-- Modelo:
--   • Uma fatura mensal por EMPRESA, somando todos os sistemas assinados.
--   • O dia de vencimento é da empresa (companies.billing_day), igual para
--     todos os sistemas — não existe mais "próxima cobrança" por assinatura.
--   • Cobrança em período vencido: no dia D fecha-se o período [D-1mês, D).
--   • Pro-rata por dias reais: assinatura que entrou no meio do período é
--     cobrada só pelos dias vigentes (valor x dias_cobrados / dias_periodo).
--   • Geração automática via pg_cron, diariamente.
-- =========================================================================

-- ── 1. Schema ────────────────────────────────────────────────────────────
alter table public.companies
  add column if not exists billing_day int
    check (billing_day is null or billing_day between 1 and 31);

alter table public.invoices
  add column if not exists company_id   uuid references public.companies(id) on delete cascade,
  add column if not exists period_start date,
  add column if not exists period_end   date;

-- Fatura de empresa não pertence a um usuário específico.
alter table public.invoices alter column user_id drop not null;

create index if not exists invoices_company_id_idx on public.invoices(company_id);

-- Idempotência: uma fatura por empresa por período.
create unique index if not exists invoices_company_period_uniq
  on public.invoices (company_id, period_start)
  where company_id is not null;

create table if not exists public.invoice_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  system_slug     text,
  description     text not null,
  unit_amount     numeric(12,2) not null default 0,
  amount          numeric(12,2) not null default 0,
  days_charged    int,
  days_in_period  int,
  prorated        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- ── 2. RLS ───────────────────────────────────────────────────────────────
alter table public.invoice_items enable row level security;

drop policy if exists "invoices_select_own_or_admin" on public.invoices;
create policy "invoices_select_own_or_admin"
  on public.invoices for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (company_id is not null and public.is_company_member(company_id))
  );

drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select"
  on public.invoice_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and (
          i.user_id = auth.uid()
          or (i.company_id is not null and public.is_company_member(i.company_id))
        )
    )
  );

drop policy if exists "invoice_items_admin_write" on public.invoice_items;
create policy "invoice_items_admin_write"
  on public.invoice_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── 3. Cálculo ───────────────────────────────────────────────────────────

-- Dia de vencimento no mês da âncora, respeitando meses curtos (31 → 28/29/30).
create or replace function public.due_date_for(p_billing_day int, p_anchor date)
  returns date language sql immutable as $$
  select make_date(
    extract(year from p_anchor)::int,
    extract(month from p_anchor)::int,
    least(
      p_billing_day,
      extract(day from (date_trunc('month', p_anchor) + interval '1 month' - interval '1 day'))::int
    )
  );
$$;

-- Primeiro vencimento >= referência.
create or replace function public.next_due_date(p_billing_day int, p_reference date)
  returns date language sql immutable as $$
  select case
    when public.due_date_for(p_billing_day, p_reference) >= p_reference
      then public.due_date_for(p_billing_day, p_reference)
    else public.due_date_for(p_billing_day, (date_trunc('month', p_reference) + interval '1 month')::date)
  end;
$$;

-- Fonte ÚNICA do cálculo: uma linha por assinatura ativa, com pro-rata
-- proporcional aos dias vigentes dentro do período. Usada tanto pela prévia
-- no painel quanto pela geração automática — não duplicar essa conta.
create or replace function public.company_invoice_lines(
  p_company_id   uuid,
  p_period_start date,
  p_period_end   date
)
returns table (
  subscription_id uuid,
  system_slug     text,
  system_name     text,
  unit_amount     numeric,
  amount          numeric,
  charge_start    date,
  days_charged    int,
  days_in_period  int,
  prorated        boolean
)
language sql stable as $$
  select
    s.id,
    s.system_slug,
    coalesce(sy.name, s.plan),
    s.amount,
    round(
      s.amount
      * (p_period_end - greatest(s.started_at::date, p_period_start))::numeric
      / nullif((p_period_end - p_period_start), 0),
      2
    ),
    greatest(s.started_at::date, p_period_start),
    (p_period_end - greatest(s.started_at::date, p_period_start))::int,
    (p_period_end - p_period_start)::int,
    s.started_at::date > p_period_start
  from public.subscriptions s
  left join public.systems sy on sy.slug = s.system_slug
  where s.company_id = p_company_id
    and s.status = 'active'
    and s.started_at::date < p_period_end
  order by sy.sort_order nulls last, s.created_at;
$$;

-- Prévia do próximo fechamento (RPC usada pelo painel admin).
create or replace function public.preview_company_invoice(p_company_id uuid)
returns table (
  period_start    date,
  period_end      date,
  subscription_id uuid,
  system_slug     text,
  system_name     text,
  unit_amount     numeric,
  amount          numeric,
  charge_start    date,
  days_charged    int,
  days_in_period  int,
  prorated        boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_day   int;
  v_end   date;
  v_start date;
begin
  if not (public.is_admin() or public.is_company_member(p_company_id)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select c.billing_day into v_day from public.companies c where c.id = p_company_id;
  if v_day is null then return; end if;

  v_end   := public.next_due_date(v_day, current_date);
  v_start := public.due_date_for(v_day, (date_trunc('month', v_end) - interval '1 month')::date);

  return query
  select v_start, v_end, l.*
  from public.company_invoice_lines(p_company_id, v_start, v_end) l;
end;
$$;

-- ── 4. Geração automática ────────────────────────────────────────────────
create or replace function public.generate_company_invoices(p_reference date default current_date)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  c         record;
  v_start   date;
  v_total   numeric;
  v_invoice uuid;
  v_count   int := 0;
begin
  -- cron roda sem auth.uid(); usuários logados precisam ser admin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;

  for c in
    select id, owner_id, billing_day from public.companies where billing_day is not null
  loop
    continue when public.due_date_for(c.billing_day, p_reference) <> p_reference;

    v_start := public.due_date_for(
      c.billing_day, (date_trunc('month', p_reference) - interval '1 month')::date
    );

    select coalesce(sum(l.amount), 0) into v_total
    from public.company_invoice_lines(c.id, v_start, p_reference) l;

    if v_total <= 0 then continue; end if;

    insert into public.invoices (
      company_id, user_id, description, amount, currency, status,
      issued_at, due_date, period_start, period_end
    )
    values (
      c.id, c.owner_id,
      'Mensalidade ' || to_char(v_start, 'DD/MM/YYYY') || ' a ' || to_char(p_reference - 1, 'DD/MM/YYYY'),
      v_total, 'BRL', 'pending',
      now(), p_reference, v_start, p_reference
    )
    on conflict (company_id, period_start) where company_id is not null do nothing
    returning id into v_invoice;

    if v_invoice is null then continue; end if;  -- período já faturado

    insert into public.invoice_items (
      invoice_id, subscription_id, system_slug, description,
      unit_amount, amount, days_charged, days_in_period, prorated
    )
    select
      v_invoice, l.subscription_id, l.system_slug,
      l.system_name || case when l.prorated
        then ' (pro-rata ' || l.days_charged || '/' || l.days_in_period || ' dias)'
        else '' end,
      l.unit_amount, l.amount, l.days_charged, l.days_in_period, l.prorated
    from public.company_invoice_lines(c.id, v_start, p_reference) l;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── 5. Agendamento ───────────────────────────────────────────────────────
create extension if not exists pg_cron;

-- 09:00 UTC = 06:00 em Brasília.
select cron.schedule(
  'generate-company-invoices',
  '0 9 * * *',
  $$select public.generate_company_invoices();$$
);
