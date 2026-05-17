-- =========================================================================
-- Migração consolidada — 30/04/2026
-- Aplica TODAS as alterações das features:
--   • Gestão de empresas no admin
--   • Assinaturas por empresa
--   • Catálogo de sistemas (system_slug)
--
-- É seguro rodar mesmo que algumas partes já existam (IF NOT EXISTS / OR REPLACE).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Helpers já existentes — recria para garantir versão mais recente
-- -------------------------------------------------------------------------
create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_company_owner(p_company_id uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.companies where id = p_company_id and owner_id = auth.uid());
$$;

create or replace function public.is_company_member(p_company_id uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and status = 'active'
  );
$$;

-- -------------------------------------------------------------------------
-- 2. Colunas novas em subscriptions
-- -------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.subscriptions
  add column if not exists system_slug text;

-- torna user_id opcional (assinaturas agora pertencem a empresas)
alter table public.subscriptions
  alter column user_id drop not null;

create index if not exists subscriptions_company_id_idx on public.subscriptions(company_id);
create index if not exists subscriptions_system_slug_idx  on public.subscriptions(system_slug);

-- -------------------------------------------------------------------------
-- 3. RLS — subscriptions
-- -------------------------------------------------------------------------
drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (company_id is not null and public.is_company_member(company_id))
  );

drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write"
  on public.subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------------------------
-- 4. RLS — companies (admin vê e gerencia tudo)
-- -------------------------------------------------------------------------
drop policy if exists "companies_admin_all" on public.companies;
create policy "companies_admin_all"
  on public.companies for all
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------------------------
-- 5. RLS — company_members (admin vê e gerencia tudo)
-- -------------------------------------------------------------------------
drop policy if exists "company_members_admin_all" on public.company_members;
create policy "company_members_admin_all"
  on public.company_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------------------------
-- 6. RPCs de administração de empresas
-- -------------------------------------------------------------------------
create or replace function public.admin_create_company(p_name text, p_owner_id uuid default null)
  returns public.companies language plpgsql volatile security definer set search_path = public
as $$
declare
  v_company public.companies;
  v_code    text;
  v_owner   uuid := coalesce(p_owner_id, auth.uid());
  v_name    text := trim(coalesce(p_name, ''));
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

create or replace function public.admin_update_company(p_id uuid, p_name text, p_owner_id uuid default null)
  returns public.companies language plpgsql volatile security definer set search_path = public
as $$
declare
  v_company public.companies;
  v_name    text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Nome da empresa muito curto' using errcode = '22023';
  end if;

  update public.companies
  set name     = v_name,
      owner_id = coalesce(p_owner_id, owner_id),
      updated_at = now()
  where id = p_id
  returning * into v_company;

  if v_company.id is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_company.owner_id, 'owner', 'active')
  on conflict (company_id, user_id) do update
    set role = 'owner', status = 'active', updated_at = now();

  return v_company;
end;
$$;

create or replace function public.admin_delete_company(p_id uuid)
  returns void language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  delete from public.companies where id = p_id;
end;
$$;

-- -------------------------------------------------------------------------
-- 7. Verificação rápida (opcional — retorna colunas de subscriptions)
-- -------------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions'
order by ordinal_position;
