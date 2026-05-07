-- =========================================================================
-- Schema do módulo Acompanhamento Contábil
-- =========================================================================
-- Pré-requisitos:
--   - admin_schema.sql aplicado (função is_admin)
--   - companies_schema.sql aplicado (companies, company_members, is_company_member)
--   - subscriptions com colunas company_id e system_slug (admin_schema.sql §7)
-- =========================================================================

-- Helper: verifica se a empresa atual tem assinatura ativa do sistema.
-- Reutilizada pelas três tabelas do módulo nas policies de RLS.
create or replace function public.has_accounting_access(p_company_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    public.is_admin()
    or (
      p_company_id is not null
      and public.is_company_member(p_company_id)
      and exists (
        select 1
        from public.subscriptions s
        where s.company_id = p_company_id
          and s.system_slug = 'acompanhamento-contabil'
          and s.status in ('active', 'trialing')
      )
    );
$$;

-- =========================================================================
-- 1) accounting_companies — empresas acompanhadas pelo escritório
-- =========================================================================
create table if not exists public.accounting_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  responsavel text,
  regime text,
  prioridade text not null default 'media'
    check (prioridade in ('alta', 'media', 'baixa')),
  competencia text,
  prazo date,
  observacoes text,
  particularidades text,
  tasks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_companies_tenant_idx
  on public.accounting_companies(tenant_company_id);
create index if not exists accounting_companies_competencia_idx
  on public.accounting_companies(competencia);

drop trigger if exists accounting_companies_touch on public.accounting_companies;
create trigger accounting_companies_touch before update on public.accounting_companies
  for each row execute function public.touch_updated_at();

alter table public.accounting_companies enable row level security;

drop policy if exists "accounting_companies_access" on public.accounting_companies;
create policy "accounting_companies_access"
  on public.accounting_companies for all
  using (public.has_accounting_access(tenant_company_id))
  with check (public.has_accounting_access(tenant_company_id));

-- =========================================================================
-- 2) accounting_file_records — registro de recebimento de documentos
-- =========================================================================
create table if not exists public.accounting_file_records (
  id uuid primary key default gen_random_uuid(),
  accounting_company_id uuid not null references public.accounting_companies(id) on delete cascade,
  doc_type text not null
    check (doc_type in (
      'contas_pagar', 'contas_receber', 'taxas_adm', 'extratos',
      'estoques', 'apuracao'
    )),
  competencia text not null,
  received boolean not null default false,
  received_at timestamptz,
  file_status text not null default 'pendente'
    check (file_status in ('pendente', 'cobrado', 'recebido')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accounting_company_id, doc_type, competencia)
);

create index if not exists accounting_file_records_company_idx
  on public.accounting_file_records(accounting_company_id);
create index if not exists accounting_file_records_competencia_idx
  on public.accounting_file_records(competencia);

drop trigger if exists accounting_file_records_touch on public.accounting_file_records;
create trigger accounting_file_records_touch before update on public.accounting_file_records
  for each row execute function public.touch_updated_at();

alter table public.accounting_file_records enable row level security;

drop policy if exists "accounting_file_records_access" on public.accounting_file_records;
create policy "accounting_file_records_access"
  on public.accounting_file_records for all
  using (
    exists (
      select 1 from public.accounting_companies ac
      where ac.id = accounting_company_id
        and public.has_accounting_access(ac.tenant_company_id)
    )
  )
  with check (
    exists (
      select 1 from public.accounting_companies ac
      where ac.id = accounting_company_id
        and public.has_accounting_access(ac.tenant_company_id)
    )
  );

-- Migration helpers (safe to run on existing installs):
--
-- A) Add file_status column:
-- alter table public.accounting_file_records
--   add column if not exists file_status text not null default 'pendente'
--     check (file_status in ('pendente', 'cobrado', 'recebido'));
-- update public.accounting_file_records
--   set file_status = case when received then 'recebido' else 'pendente' end;
--
-- B) Remove folha from doc_type / split demais_contas_fornecedores:
-- alter table public.accounting_file_records drop constraint if exists accounting_file_records_doc_type_check;
-- alter table public.accounting_file_records add constraint accounting_file_records_doc_type_check
--   check (doc_type in ('contas_pagar','contas_receber','taxas_adm','extratos','estoques','apuracao'));
-- delete from public.accounting_file_records where doc_type = 'folha';
-- alter table public.accounting_reconciliations drop constraint if exists accounting_reconciliations_category_check;
-- alter table public.accounting_reconciliations add constraint accounting_reconciliations_category_check
--   check (category in ('extrato_aplicacoes','apuracao','folha','demais_contas','fornecedores'));
-- update public.accounting_reconciliations set category = 'demais_contas' where category = 'demais_contas_fornecedores';

-- =========================================================================
-- 3) accounting_reconciliations — conciliação livre por categoria
-- =========================================================================
create table if not exists public.accounting_reconciliations (
  id uuid primary key default gen_random_uuid(),
  accounting_company_id uuid not null references public.accounting_companies(id) on delete cascade,
  competencia text not null,
  category text not null
    check (category in (
      'extrato_aplicacoes', 'apuracao', 'folha', 'demais_contas', 'fornecedores'
    )),
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_andamento', 'conciliado', 'pendencia')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accounting_company_id, category, competencia)
);

create index if not exists accounting_reconciliations_company_idx
  on public.accounting_reconciliations(accounting_company_id);
create index if not exists accounting_reconciliations_competencia_idx
  on public.accounting_reconciliations(competencia);

drop trigger if exists accounting_reconciliations_touch on public.accounting_reconciliations;
create trigger accounting_reconciliations_touch before update on public.accounting_reconciliations
  for each row execute function public.touch_updated_at();

alter table public.accounting_reconciliations enable row level security;

drop policy if exists "accounting_reconciliations_access" on public.accounting_reconciliations;
create policy "accounting_reconciliations_access"
  on public.accounting_reconciliations for all
  using (
    exists (
      select 1 from public.accounting_companies ac
      where ac.id = accounting_company_id
        and public.has_accounting_access(ac.tenant_company_id)
    )
  )
  with check (
    exists (
      select 1 from public.accounting_companies ac
      where ac.id = accounting_company_id
        and public.has_accounting_access(ac.tenant_company_id)
    )
  );
