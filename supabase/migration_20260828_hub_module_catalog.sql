-- =========================================================================
-- Migração 28/08/2026 — catálogo editável de categorias e ferramentas do hub
--
-- Até aqui, "Fiscal", "Calculadora de DIFAL" e as demais categorias/
-- ferramentas do hub viviam hardcoded em HUB_MODULES (constants.js) e no
-- ITEMS de cada página de categoria (FiscalPage.jsx etc.) — o admin não
-- tinha como editar nada disso, só o cadastro do sistema em si (`systems`).
--
-- Esta migração cria duas tabelas — categorias e ferramentas, ambas
-- escopadas por sistema/categoria — para que /admin/sistemas/:slug ganhe
-- uma tela real de gerenciamento (não mais um modal) com navegação até
-- Módulos → categoria → ferramenta, e a ferramenta hospede sua configuração
-- interna quando existir uma (caso da Calculadora de DIFAL, cujas regras de
-- NCM já eram uma tela própria — GerenciadorRegrasNcm).
--
-- Escopo desta migração: só a categoria "Fiscal" e a ferramenta
-- "Calculadora de DIFAL" entram povoadas, porque são as únicas cuja
-- renderização no cliente (FiscalPage.jsx) passa a ler daqui. As demais
-- categorias do hub (Contábil, Financeiro, Gestão, Pessoal) continuam
-- hardcoded nas suas próprias páginas — cadastrá-las aqui sem ligar o
-- cliente correspondente criaria edição que não teria efeito nenhum.
--
-- Também renomeia o sistema 'solucoes-contabeis' para "NoraHub" (só o nome
-- exibido — o slug interno, do qual assinaturas dependem, não muda).
-- =========================================================================

create table if not exists public.hub_module_categorias (
  id           uuid primary key default gen_random_uuid(),
  system_slug  text not null references public.systems(slug) on delete cascade,
  slug         text not null,
  name         text not null,
  icon         text,
  description  text,
  status       text not null default 'available' check (status in ('available', 'soon')),
  active       boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (system_slug, slug)
);

create table if not exists public.hub_module_ferramentas (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.hub_module_categorias(id) on delete cascade,
  slug          text not null,
  name          text not null,
  icon          text,
  color         text,
  description   text,
  status        text not null default 'available' check (status in ('available', 'soon')),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (categoria_id, slug)
);

drop trigger if exists hub_module_categorias_touch on public.hub_module_categorias;
create trigger hub_module_categorias_touch before update on public.hub_module_categorias
  for each row execute function public.touch_updated_at();

drop trigger if exists hub_module_ferramentas_touch on public.hub_module_ferramentas;
create trigger hub_module_ferramentas_touch before update on public.hub_module_ferramentas
  for each row execute function public.touch_updated_at();

alter table public.hub_module_categorias enable row level security;
alter table public.hub_module_ferramentas enable row level security;

-- Leitura: qualquer usuário autenticado (o hub precisa disso pra montar a
-- navegação das categorias e ferramentas, não é dado sensível).
drop policy if exists "hub_module_categorias_select_authenticated" on public.hub_module_categorias;
create policy "hub_module_categorias_select_authenticated"
  on public.hub_module_categorias for select
  to authenticated
  using (true);

drop policy if exists "hub_module_ferramentas_select_authenticated" on public.hub_module_ferramentas;
create policy "hub_module_ferramentas_select_authenticated"
  on public.hub_module_ferramentas for select
  to authenticated
  using (true);

-- Escrita: apenas admin global — mesmo padrão de `systems`.
drop policy if exists "hub_module_categorias_admin_write" on public.hub_module_categorias;
create policy "hub_module_categorias_admin_write"
  on public.hub_module_categorias for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "hub_module_ferramentas_admin_write" on public.hub_module_ferramentas;
create policy "hub_module_ferramentas_admin_write"
  on public.hub_module_ferramentas for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── Seed: categoria Fiscal + ferramenta Calculadora de DIFAL ────────────
insert into public.hub_module_categorias (system_slug, slug, name, icon, description, status, sort_order)
values (
  'solucoes-contabeis', 'fiscal', 'Fiscal', '🧾',
  'Apuração de tributos e obrigações fiscais.', 'available', 10
)
on conflict (system_slug, slug) do nothing;

insert into public.hub_module_ferramentas (categoria_id, slug, name, icon, color, description, status, sort_order)
select id, 'calculadora-difal', 'Calculadora de DIFAL', '🧾', '#7C3AED',
  'Diferencial de alíquota do Simples Nacional, produto a produto, a partir do XML da NF-e.',
  'available', 0
from public.hub_module_categorias
where system_slug = 'solucoes-contabeis' and slug = 'fiscal'
on conflict (categoria_id, slug) do nothing;

-- ── Renomeia o sistema para NoraHub (só o nome exibido) ─────────────────
update public.systems
set name = 'NoraHub'
where slug = 'solucoes-contabeis' and name = 'Soluções Contábeis';
