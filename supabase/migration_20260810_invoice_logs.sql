-- Origem da fatura (sistema x manual) e motivo quando não há assinatura vinculada
alter table public.invoices
  add column if not exists no_subscription_reason text,
  add column if not exists source text not null default 'manual',
  add column if not exists created_by uuid references auth.users(id) default auth.uid(),
  add column if not exists manual_settlement boolean not null default false;

alter table public.invoices drop constraint if exists invoices_source_check;
alter table public.invoices add constraint invoices_source_check check (source in ('system','manual'));

-- Backfill: faturas antigas geradas pelo cron consolidado (sem subscription_id,
-- com company_id e descrição no padrão "Mensalidade ...") viram 'system' retroativamente.
update public.invoices
set source = 'system'
where subscription_id is null
  and company_id is not null
  and description like 'Mensalidade %'
  and source = 'manual';

-- Regra: fatura precisa ter assinatura vinculada OU motivo preenchido — exceto
-- faturas consolidadas geradas pelo sistema (cobrem múltiplos sistemas/assinaturas).
-- NOT VALID: não quebra faturas antigas já existentes, mas passa a valer a
-- partir da próxima edição/inserção — exatamente o "ao editar, passa a exigir".
alter table public.invoices drop constraint if exists invoices_subscription_or_reason_chk;
alter table public.invoices
  add constraint invoices_subscription_or_reason_chk
  check (source = 'system' or subscription_id is not null or no_subscription_reason is not null)
  not valid;

-- Log de ações da fatura: criação (sistema/manual), recobrança, desconto,
-- juros, ajuste de valor (negociação), baixa manual, nota livre.
create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id),
  amount_before numeric,
  amount_after numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.invoice_events drop constraint if exists invoice_events_type_check;
alter table public.invoice_events
  add constraint invoice_events_type_check
  check (event_type in ('created_system','created_manual','recobranca','desconto','juros','ajuste_valor','baixa_manual','marcado_pago','nota'));

alter table public.invoice_events enable row level security;

drop policy if exists invoice_events_admin_all on public.invoice_events;
create policy invoice_events_admin_all on public.invoice_events for all using (public.is_admin()) with check (public.is_admin());

-- Log automático de origem no momento da criação da fatura.
create or replace function public.log_invoice_creation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.invoice_events (invoice_id, event_type, actor_id, amount_after)
  values (new.id, case when new.source = 'system' then 'created_system' else 'created_manual' end, new.created_by, new.amount);
  return new;
end;
$$;

drop trigger if exists trg_log_invoice_creation on public.invoices;
create trigger trg_log_invoice_creation
after insert on public.invoices
for each row execute function public.log_invoice_creation();

-- generate_company_invoices passa a marcar explicitamente source='system'.
create or replace function public.generate_company_invoices(p_reference date DEFAULT CURRENT_DATE)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c          record;
  v_start    date;
  v_total    numeric;
  v_invoice  uuid;
  v_count    int := 0;
begin
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
      issued_at, due_date, period_start, period_end, source, created_by
    )
    values (
      c.id, c.owner_id,
      'Mensalidade ' || to_char(v_start, 'DD/MM/YYYY') || ' a ' || to_char(p_reference - 1, 'DD/MM/YYYY'),
      v_total, 'BRL', 'pending',
      now(), p_reference, v_start, p_reference, 'system', null
    )
    on conflict (company_id, period_start) where company_id is not null do nothing
    returning id into v_invoice;

    if v_invoice is null then continue; end if;

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
$function$;
