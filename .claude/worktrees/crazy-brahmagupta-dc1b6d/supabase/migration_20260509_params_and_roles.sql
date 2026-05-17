-- =========================================================================
-- Migração 09/05/2026
--   1. Adiciona o cargo 'admin' (Administrador/Gestor) em company_members
--   2. RPC set_member_role para o dono alterar o cargo de um membro
--   3. Helper is_company_admin (owner + admin)
--   4. Tabela accounting_params (parâmetros do card "Atrasadas")
-- =========================================================================

-- 1) Expande o constraint de role em company_members ----------------------
alter table public.company_members
  drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- 2) Helper: é owner OU admin ativo da empresa ----------------------------
create or replace function public.is_company_admin(p_company_id uuid)
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
      and role in ('owner', 'admin')
  );
$$;

-- 3) RPC: alterar cargo de um membro --------------------------------------
create or replace function public.set_member_role(p_member_id uuid, p_role text)
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
  if p_role not in ('admin', 'member') then
    raise exception 'Cargo inválido (use admin ou member)' using errcode = '22023';
  end if;

  select * into v_member from public.company_members where id = p_member_id;
  if v_member.id is null then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;

  if not public.is_company_owner(v_member.company_id) then
    raise exception 'Apenas o dono pode alterar cargos' using errcode = '42501';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Não é possível alterar o cargo do dono' using errcode = '42501';
  end if;

  if v_member.status <> 'active' then
    raise exception 'Apenas membros ativos podem ter cargo alterado' using errcode = '42501';
  end if;

  update public.company_members
  set role = p_role, updated_at = now()
  where id = p_member_id
  returning * into v_member;

  return v_member;
end;
$$;

-- 4) accounting_params — thresholds do card "Atrasadas" --------------------
create table if not exists public.accounting_params (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null unique
    references public.companies(id) on delete cascade,
  dia_cobranca           int not null default 0 check (dia_cobranca           between 0 and 31),
  dia_recebimento        int not null default 0 check (dia_recebimento        between 0 and 31),
  dia_extrato_aplicacoes int not null default 0 check (dia_extrato_aplicacoes between 0 and 31),
  dia_apuracao           int not null default 0 check (dia_apuracao           between 0 and 31),
  dia_folha              int not null default 0 check (dia_folha              between 0 and 31),
  dia_demais_contas      int not null default 0 check (dia_demais_contas      between 0 and 31),
  dia_fornecedores       int not null default 0 check (dia_fornecedores       between 0 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_params_tenant_idx
  on public.accounting_params(tenant_company_id);

drop trigger if exists accounting_params_touch on public.accounting_params;
create trigger accounting_params_touch before update on public.accounting_params
  for each row execute function public.touch_updated_at();

alter table public.accounting_params enable row level security;

-- Leitura: qualquer membro ativo da empresa pode ler (necessário para o
-- dashboard calcular Atrasadas). Admin global também pode (super-acesso).
drop policy if exists "accounting_params_select" on public.accounting_params;
create policy "accounting_params_select"
  on public.accounting_params for select
  using (
    public.is_admin()
    or public.is_company_member(tenant_company_id)
  );

-- Escrita: apenas owner/admin da empresa (ou admin global).
drop policy if exists "accounting_params_insert" on public.accounting_params;
create policy "accounting_params_insert"
  on public.accounting_params for insert
  with check (
    public.is_admin()
    or public.is_company_admin(tenant_company_id)
  );

drop policy if exists "accounting_params_update" on public.accounting_params;
create policy "accounting_params_update"
  on public.accounting_params for update
  using (
    public.is_admin()
    or public.is_company_admin(tenant_company_id)
  )
  with check (
    public.is_admin()
    or public.is_company_admin(tenant_company_id)
  );

drop policy if exists "accounting_params_delete" on public.accounting_params;
create policy "accounting_params_delete"
  on public.accounting_params for delete
  using (
    public.is_admin()
    or public.is_company_admin(tenant_company_id)
  );
