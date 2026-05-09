-- =========================================================================
-- Schema de empresas (executar no SQL Editor do Supabase)
-- =========================================================================
-- Este arquivo cria/atualiza:
--   1. Tabela `companies` (empresas criadas pelos usuários)
--   2. Tabela `company_members` (membros e solicitações de ingresso)
--   3. Funções `create_company`, `request_join_company`,
--      `approve_member`, `reject_member`, `leave_company`
--   4. Policies RLS adequadas
-- =========================================================================

-- 1) COMPANIES -------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_owner_id_idx on public.companies(owner_id);
create index if not exists companies_code_idx on public.companies(code);

-- 2) COMPANY_MEMBERS -------------------------------------------------------
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_company_idx on public.company_members(company_id);
create index if not exists company_members_user_idx on public.company_members(user_id);

-- 3) Helpers ---------------------------------------------------------------

-- Verifica se o usuário logado é dono da empresa
create or replace function public.is_company_owner(p_company_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid()
  );
$$;

-- Verifica se o usuário logado é membro ativo da empresa
create or replace function public.is_company_member(p_company_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Gera um código aleatório de 6 caracteres (sem caracteres ambíguos)
create or replace function public.generate_company_code()
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.companies where code = candidate);
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'Não foi possível gerar um código único';
    end if;
  end loop;
  return candidate;
end;
$$;

-- 4) RPC: criar empresa ---------------------------------------------------
create or replace function public.create_company(p_name text)
  returns public.companies
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_company public.companies;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Nome da empresa muito curto' using errcode = '22023';
  end if;
  if length(v_name) > 80 then
    raise exception 'Nome da empresa muito longo' using errcode = '22023';
  end if;

  v_code := public.generate_company_code();

  insert into public.companies (name, code, owner_id)
  values (v_name, v_code, v_user)
  returning * into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_user, 'owner', 'active');

  return v_company;
end;
$$;

-- 5) RPC: solicitar ingresso por código -----------------------------------
create or replace function public.request_join_company(p_code text)
  returns public.company_members
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company public.companies;
  v_member public.company_members;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_user is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  if length(v_code) < 4 then
    raise exception 'Código inválido' using errcode = '22023';
  end if;

  select * into v_company from public.companies where code = v_code;
  if v_company.id is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;

  -- Já é membro/solicitação existente?
  select * into v_member
  from public.company_members
  where company_id = v_company.id and user_id = v_user;

  if v_member.id is not null then
    if v_member.status = 'active' then
      raise exception 'Você já é membro desta empresa' using errcode = '23505';
    elsif v_member.status = 'pending' then
      raise exception 'Solicitação já enviada. Aguarde aprovação.' using errcode = '23505';
    elsif v_member.status = 'rejected' then
      -- permite reenviar a solicitação
      update public.company_members
      set status = 'pending', updated_at = now()
      where id = v_member.id
      returning * into v_member;
      return v_member;
    end if;
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_user, 'member', 'pending')
  returning * into v_member;

  return v_member;
end;
$$;

-- 6) RPC: aprovar membro --------------------------------------------------
create or replace function public.approve_member(p_member_id uuid)
  returns public.company_members
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member public.company_members;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select * into v_member from public.company_members where id = p_member_id;
  if v_member.id is null then
    raise exception 'Solicitação não encontrada' using errcode = 'P0002';
  end if;

  if not public.is_company_owner(v_member.company_id) then
    raise exception 'Apenas o dono da empresa pode aprovar membros' using errcode = '42501';
  end if;

  update public.company_members
  set status = 'active', updated_at = now()
  where id = p_member_id
  returning * into v_member;

  return v_member;
end;
$$;

-- 7) RPC: rejeitar/remover membro -----------------------------------------
create or replace function public.reject_member(p_member_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member public.company_members;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select * into v_member from public.company_members where id = p_member_id;
  if v_member.id is null then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;

  if not public.is_company_owner(v_member.company_id) then
    raise exception 'Apenas o dono pode remover membros' using errcode = '42501';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Não é possível remover o dono da empresa' using errcode = '42501';
  end if;

  delete from public.company_members where id = p_member_id;
end;
$$;

-- 8) RPC: sair da empresa -------------------------------------------------
create or replace function public.leave_company(p_company_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company public.companies;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if v_company.id is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;

  if v_company.owner_id = v_user then
    raise exception 'O dono não pode sair da própria empresa. Exclua-a, se desejar.' using errcode = '42501';
  end if;

  delete from public.company_members
  where company_id = p_company_id and user_id = v_user;
end;
$$;

-- 9) RLS -------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- companies: o usuário vê empresas onde é membro (qualquer status)
drop policy if exists "companies_select_member_or_owner" on public.companies;
create policy "companies_select_member_or_owner"
  on public.companies for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.company_members m
      where m.company_id = companies.id and m.user_id = auth.uid()
    )
  );

-- companies: apenas o dono pode atualizar / deletar
drop policy if exists "companies_owner_update" on public.companies;
create policy "companies_owner_update"
  on public.companies for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "companies_owner_delete" on public.companies;
create policy "companies_owner_delete"
  on public.companies for delete
  using (owner_id = auth.uid());

-- companies: insert é feito apenas via RPC create_company (security definer)
-- então não precisamos de policy de INSERT direto.

-- company_members: o usuário vê seus próprios registros e o dono vê todos da empresa
drop policy if exists "company_members_select_self_or_owner" on public.company_members;
create policy "company_members_select_self_or_owner"
  on public.company_members for select
  using (
    user_id = auth.uid()
    or public.is_company_owner(company_id)
    or public.is_company_member(company_id)
  );

-- inserts/updates/deletes diretos são bloqueados — tudo passa pelas RPCs.

-- 10) Trigger updated_at ---------------------------------------------------
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

drop trigger if exists company_members_touch on public.company_members;
create trigger company_members_touch before update on public.company_members
  for each row execute function public.touch_updated_at();
