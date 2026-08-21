-- =========================================================================
-- Gestão de Clientes vira base compartilhada de verdade — não mais
-- localStorage por navegador.
-- =========================================================================
-- Até aqui, a Gestão de Clientes (tela "Clientes" do Soluções Contábeis) e
-- as Contas Bancárias do Codificador de Arquivos viviam em localStorage,
-- namespaced por company_id só no NOME da chave — nenhuma linha de banco,
-- nenhuma RLS, nenhum isolamento real entre equipes. Qualquer script rodando
-- na mesma origem conseguia ler a chave de qualquer empresa, e o cadastro
-- não saía do navegador de quem cadastrou: outro analista da mesma equipe,
-- em outra máquina, via uma base vazia.
--
-- `accounting_companies` já existe, já é uma tabela real com RLS por
-- `tenant_company_id`, e já significa "cliente do escritório" — só que com um
-- schema pensado para o acompanhamento de prazos (Acompanhamento Contábil),
-- não para o cadastro completo (CNPJ, contato, endereço, quadro societário).
-- Em vez de criar uma segunda tabela de clientes — o oposto do que se pede
-- aqui, "não criar cópias independentes dos clientes para cada sistema" —
-- esta migration ESTENDE accounting_companies com os campos que faltam.
-- `nome` (Razão Social) e `regime` (regime tributário) já existiam com o
-- mesmo significado que a Gestão de Clientes usa, então nenhum dos dois é
-- duplicado.
--
-- As contas bancárias — com o código contábil que o Codificador usa como
-- contrapartida — ganham tabela própria, uma linha por conta, para um
-- cliente poder ter mais de uma.
--
-- Pré-requisitos: accounting_schema.sql já aplicado (accounting_companies,
-- has_accounting_access). Idempotente: pode rodar mais de uma vez.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) accounting_companies ganha os campos do cadastro completo
-- -------------------------------------------------------------------------
alter table public.accounting_companies
  add column if not exists cnpj text,
  add column if not exists trade_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists atividade text,
  add column if not exists cnae text,
  add column if not exists ramo_atividade text,
  add column if not exists capital_social text,
  add column if not exists ativo boolean not null default true,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_level text,
  add column if not exists socios jsonb not null default '[]'::jsonb;

-- Um CNPJ não pode responder por dois cadastros na mesma equipe — é a raiz
-- de "não criar cópias independentes": sem isto, um reimport ou um cadastro
-- duplicado por engano criaria dois clientes que deveriam ser um só. Parcial
-- (só quando o CNPJ está preenchido) porque nem todo cliente cadastrado a
-- essa altura vai ter CNPJ digitado ainda.
create unique index if not exists accounting_companies_tenant_cnpj_key
  on public.accounting_companies (tenant_company_id, cnpj)
  where cnpj is not null and cnpj <> '';

-- -------------------------------------------------------------------------
-- 2) accounting_company_bank_accounts — uma ou mais contas por cliente
-- -------------------------------------------------------------------------
create table if not exists public.accounting_company_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  accounting_company_id uuid not null references public.accounting_companies(id) on delete cascade,
  bank_name text,
  agencia text,
  conta_numero text,
  -- Código contábil da conta — a contrapartida que o Codificador de Extrato
  -- usa como "banco" na exportação Domínio. Mesmo campo que já existia em
  -- cod_banks.code, agora com um dono único em vez de uma cópia por sistema.
  code text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_company_bank_accounts_company_idx
  on public.accounting_company_bank_accounts(accounting_company_id);

drop trigger if exists accounting_company_bank_accounts_touch on public.accounting_company_bank_accounts;
create trigger accounting_company_bank_accounts_touch
  before update on public.accounting_company_bank_accounts
  for each row execute function public.touch_updated_at();

alter table public.accounting_company_bank_accounts enable row level security;

drop policy if exists "accounting_company_bank_accounts_access" on public.accounting_company_bank_accounts;
create policy "accounting_company_bank_accounts_access"
  on public.accounting_company_bank_accounts for all
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
