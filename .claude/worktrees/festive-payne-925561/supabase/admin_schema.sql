-- =========================================================================
-- Schema do painel administrativo (executar no SQL Editor do Supabase)
-- =========================================================================
-- Este arquivo cria/atualiza:
--   1. Coluna `role` em `profiles` (controle de admin via RLS)
--   2. Tabela `subscriptions` (assinaturas dos clientes)
--   3. Tabela `invoices` (faturas)
--   4. Policies RLS: usuários veem só os próprios dados, admin vê tudo
-- =========================================================================

-- 1) ROLE em profiles ------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

-- Eleger seu usuário como admin (substitua pelo seu e-mail):
-- update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@noratech.com.br');

-- Helper: identifica se o usuário logado é admin (SECURITY DEFINER evita
-- recursão de RLS em policies que consultam a própria profiles).
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) SUBSCRIPTIONS ---------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'yearly', 'one_time')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

-- 3) INVOICES --------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  currency text not null default 'BRL',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'canceled', 'refunded')),
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_due_date_idx on public.invoices(due_date);

-- 4) RLS -------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;

-- subscriptions: dono lê os próprios; admin faz tudo
drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write"
  on public.subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- invoices: idem
drop policy if exists "invoices_select_own_or_admin" on public.invoices;
create policy "invoices_select_own_or_admin"
  on public.invoices for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "invoices_admin_write" on public.invoices;
create policy "invoices_admin_write"
  on public.invoices for all
  using (public.is_admin())
  with check (public.is_admin());

-- profiles: admin pode ler/atualizar todos (mantém policies existentes do dono)
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 5) updated_at trigger ----------------------------------------------------
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- 6) Admin: gestão de empresas
-- =========================================================================
-- Policies para admin gerenciar todas as empresas (companies / company_members).
-- Pré-requisito: o schema de companies (companies_schema.sql) já deve estar
-- aplicado.

drop policy if exists "companies_admin_all" on public.companies;
create policy "companies_admin_all"
  on public.companies for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "company_members_admin_all" on public.company_members;
create policy "company_members_admin_all"
  on public.company_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- RPC: admin cria empresa (opcionalmente atribuindo dono)
create or replace function public.admin_create_company(p_name text, p_owner_id uuid default null)
  returns public.companies
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_company public.companies;
  v_code text;
  v_owner uuid := coalesce(p_owner_id, auth.uid());
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Nome da empresa muito curto' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'Dono da empresa é obrigatório' using errcode = '22023';
  end if;

  v_code := public.generate_company_code();

  insert into public.companies (name, code, owner_id)
  values (v_name, v_code, v_owner)
  returning * into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_owner, 'owner', 'active')
  on conflict (company_id, user_id) do nothing;

  return v_company;
end;
$$;

-- RPC: admin atualiza empresa
create or replace function public.admin_update_company(p_id uuid, p_name text, p_owner_id uuid default null)
  returns public.companies
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_company public.companies;
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Nome da empresa muito curto' using errcode = '22023';
  end if;

  update public.companies
  set name = v_name,
      owner_id = coalesce(p_owner_id, owner_id),
      updated_at = now()
  where id = p_id
  returning * into v_company;

  if v_company.id is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;

  -- garante membership 'owner' ativa para o dono atual
  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_company.owner_id, 'owner', 'active')
  on conflict (company_id, user_id) do update
    set role = 'owner', status = 'active', updated_at = now();

  return v_company;
end;
$$;

-- =========================================================================
-- 7) Assinaturas por empresa
-- =========================================================================
-- Adiciona company_id em subscriptions e relaxa user_id para que assinaturas
-- possam ser associadas a uma empresa.

alter table public.subscriptions
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.subscriptions
  alter column user_id drop not null;

alter table public.subscriptions
  add column if not exists system_slug text;

create index if not exists subscriptions_company_id_idx on public.subscriptions(company_id);
create index if not exists subscriptions_system_slug_idx on public.subscriptions(system_slug);

-- Atualiza policy de leitura para incluir membros ativos da empresa.
drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (company_id is not null and public.is_company_member(company_id))
  );

-- RPC: admin exclui empresa
create or replace function public.admin_delete_company(p_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  delete from public.companies where id = p_id;
end;
$$;
