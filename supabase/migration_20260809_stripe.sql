-- =========================================================================
-- Migração 09/08/2026 — Integração Stripe: cartão salvo + cobrança
--
-- Modelo: usamos Setup Intents (salvar cartão) + PaymentIntents off-session
-- (cobrar) — NÃO as Billing/Subscriptions do Stripe, porque o motor de
-- cobrança (fatura consolidada, pro-rata por dias reais, dia de vencimento
-- por empresa) já é nosso e roda via pg_cron. O Stripe entra só como
-- processador de pagamento das faturas que já geramos.
--
-- Escrita em `payment_methods` e nos campos stripe_* de `invoices` acontece
-- só via Edge Functions (service_role) — nunca direto do cliente.
-- =========================================================================

alter table public.companies
  add column if not exists stripe_customer_id text unique;

create table if not exists public.payment_methods (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  stripe_payment_method_id text not null unique,
  brand                  text,
  last4                  text,
  exp_month              int,
  exp_year               int,
  is_default             boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists payment_methods_company_id_idx on public.payment_methods(company_id);

-- Garante no máximo um cartão padrão por empresa.
create unique index if not exists payment_methods_one_default_per_company
  on public.payment_methods(company_id) where is_default;

alter table public.invoices
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_error text;

create unique index if not exists invoices_stripe_payment_intent_uniq
  on public.invoices(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

drop trigger if exists payment_methods_touch on public.payment_methods;
create trigger payment_methods_touch before update on public.payment_methods
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select" on public.payment_methods;
create policy "payment_methods_select"
  on public.payment_methods for select
  using (public.is_admin() or public.is_company_member(company_id));

drop policy if exists "payment_methods_admin_write" on public.payment_methods;
create policy "payment_methods_admin_write"
  on public.payment_methods for all
  using (public.is_admin())
  with check (public.is_admin());
