-- =========================================================================
-- Regras de NCM do DIFAL — do arquivo para o banco
-- =========================================================================
-- Até aqui a tabela de alíquotas por NCM vivia em
-- `sistemas/difal/ncmRegras.js`: uma constante no código, e corrigir uma
-- alíquota exigia passar por mim e por um deploy. Esta migration tira o
-- DADO do código sem tocar na LÓGICA — `ncmBusca.js` e `difalEngine.js`
-- continuam puros, recebendo o mesmo objeto `{ uf, regraGeral, regras }` de
-- sempre; o que muda é de onde esse objeto vem.
--
-- Duas tabelas, porque `TABELA_SP` sempre teve duas partes com natureza
-- diferente:
--
--   difal_uf_config       o "cabeçalho" da UF — regra geral, método de base,
--                         política de revenda. Uma linha por UF.
--   difal_regras_ncm      as exceções por NCM — posição, subposição, item.
--                         Uma linha por faixa cadastrada.
--
-- ── Global + ajuste por escritório ──────────────────────────────────────
-- Alíquota de ICMS é legislação estadual: a mesma regra vale para qualquer
-- escritório que opere naquele estado. Por isso `tenant_company_id` é
-- OPCIONAL nas duas tabelas:
--
--   NULL   → regra da base compartilhada, mantida pelo admin da plataforma.
--            Visível para qualquer usuário autenticado (é lei publicada,
--            não dado sensível) — só o admin escreve.
--   Preenchido (uuid) → ajuste daquele escritório específico. Sobrepõe a
--            base global no MESMO prefixo de NCM/UF — útil quando um cliente
--            tem um regime diferenciado que a base geral não cobre. Só
--            quem administra aquele escritório (owner/admin) escreve; a
--            leitura segue o mesmo gate de acesso contábil do resto do
--            módulo (`has_accounting_access`).
--
-- A montagem do objeto final (global + override do tenant, prefixo a
-- prefixo) é responsabilidade do `regrasNcmMerge.js` no app — pura,
-- testável, e reaproveitando `validarTabela` do arquivo original.
--
-- Pré-requisitos: accounting_schema.sql (has_accounting_access),
-- companies_schema.sql (is_company_admin), admin_schema.sql (is_admin,
-- touch_updated_at). Idempotente: pode rodar mais de uma vez.
--
-- Aplicada em produção (projeto NoraTech) em 27/08/2026. Conferido depois de
-- aplicar: RLS ligada nas duas tabelas, 4 políticas em cada, a semente de SP
-- (1 config + 7 regras) gravada, e `anon` não enxerga nenhuma linha em
-- nenhuma das duas tabelas.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) difal_uf_config — regra geral, método de base e política de revenda
-- -------------------------------------------------------------------------
create table if not exists public.difal_uf_config (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid references public.companies(id) on delete cascade,
  uf char(2) not null,
  versao text,
  metodo_base text not null default 'base_simples'
    check (metodo_base in ('base_simples', 'base_dupla')),
  politica_revenda text not null default 'nao_incide'
    check (politica_revenda in ('nao_incide', 'antecipacao_parcial')),
  regra_geral_aliquota numeric(5,2) not null check (regra_geral_aliquota between 0 and 40),
  regra_geral_fcp numeric(5,2) not null default 0 check (regra_geral_fcp between 0 and 10),
  regra_geral_fundamento text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma config por UF na base global, e uma por UF em cada ajuste de
-- escritório. `coalesce` porque unique index não trata NULL como igual a
-- NULL — sem isso dois escritórios (ambos NULL) não colidiriam entre si,
-- mas dois registros GLOBAIS da mesma UF colidiriam por acidente.
create unique index if not exists difal_uf_config_escopo_uf_key
  on public.difal_uf_config (coalesce(tenant_company_id, '00000000-0000-0000-0000-000000000000'::uuid), uf);

drop trigger if exists difal_uf_config_touch on public.difal_uf_config;
create trigger difal_uf_config_touch before update on public.difal_uf_config
  for each row execute function public.touch_updated_at();

alter table public.difal_uf_config enable row level security;

-- Leitura da base global: qualquer autenticado (é lei publicada).
drop policy if exists "difal_uf_config_select_global" on public.difal_uf_config;
create policy "difal_uf_config_select_global"
  on public.difal_uf_config for select
  to authenticated
  using (tenant_company_id is null);

-- Escrita da base global: só admin da plataforma.
drop policy if exists "difal_uf_config_admin_write_global" on public.difal_uf_config;
create policy "difal_uf_config_admin_write_global"
  on public.difal_uf_config for all
  using (tenant_company_id is null and public.is_admin())
  with check (tenant_company_id is null and public.is_admin());

-- Ajuste do escritório: leem quem tem acesso contábil ao tenant; escrevem
-- só owner/admin daquele tenant (ou o admin da plataforma, em suporte).
drop policy if exists "difal_uf_config_tenant_read" on public.difal_uf_config;
create policy "difal_uf_config_tenant_read"
  on public.difal_uf_config for select
  using (tenant_company_id is not null and public.has_accounting_access(tenant_company_id));

drop policy if exists "difal_uf_config_tenant_write" on public.difal_uf_config;
create policy "difal_uf_config_tenant_write"
  on public.difal_uf_config for all
  using (tenant_company_id is not null and (public.is_admin() or public.is_company_admin(tenant_company_id)))
  with check (tenant_company_id is not null and (public.is_admin() or public.is_company_admin(tenant_company_id)));

-- -------------------------------------------------------------------------
-- 2) difal_regras_ncm — as exceções por prefixo de NCM
-- -------------------------------------------------------------------------
create table if not exists public.difal_regras_ncm (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid references public.companies(id) on delete cascade,
  uf char(2) not null,
  ncm_prefixo varchar(8) not null,
  nivel smallint generated always as (length(ncm_prefixo)) stored,
  aliquota numeric(5,2) check (aliquota is null or aliquota between 0 and 40),
  segue_geral boolean not null default false,
  fcp numeric(5,2) check (fcp is null or fcp between 0 and 10),
  tipo text not null check (tipo in ('capitulo', 'posicao', 'subposicao', 'item', 'excecao')),
  excecao_de varchar(8),
  fundamento text not null,
  vigencia_inicio date,
  vigencia_fim date,
  -- De onde a linha veio — o robô de coleta (quando existir) grava 'econet';
  -- hoje só 'manual' (cadastro na tela) e 'seed' (migração do arquivo
  -- original) são produzidos.
  fonte text not null default 'manual' check (fonte in ('manual', 'seed', 'econet', 'planilha')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint difal_regras_ncm_valor check (segue_geral <> (aliquota is not null)),
  constraint difal_regras_ncm_nivel check (length(ncm_prefixo) in (2, 4, 6, 8)),
  constraint difal_regras_ncm_excecao check (
    (tipo <> 'excecao' and excecao_de is null) or
    (tipo = 'excecao' and excecao_de is not null and ncm_prefixo like excecao_de || '%'
       and length(excecao_de) < length(ncm_prefixo))
  )
);

-- Mesmo prefixo, mesmo escopo (global ou aquele tenant) e mesma UF só pode
-- ter UMA vigência começando na mesma data — o guarda-corpo mais barato
-- contra duplicidade. Sobreposição de vigências com datas de início
-- diferentes continua checada em `validarTabela`, como já era no arquivo.
create unique index if not exists difal_regras_ncm_escopo_faixa_key
  on public.difal_regras_ncm (
    coalesce(tenant_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    uf, ncm_prefixo, coalesce(vigencia_inicio, '0001-01-01'::date)
  );

create index if not exists difal_regras_ncm_busca_idx
  on public.difal_regras_ncm (uf, ncm_prefixo) where tenant_company_id is null;
create index if not exists difal_regras_ncm_tenant_busca_idx
  on public.difal_regras_ncm (tenant_company_id, uf, ncm_prefixo) where tenant_company_id is not null;

drop trigger if exists difal_regras_ncm_touch on public.difal_regras_ncm;
create trigger difal_regras_ncm_touch before update on public.difal_regras_ncm
  for each row execute function public.touch_updated_at();

alter table public.difal_regras_ncm enable row level security;

drop policy if exists "difal_regras_ncm_select_global" on public.difal_regras_ncm;
create policy "difal_regras_ncm_select_global"
  on public.difal_regras_ncm for select
  to authenticated
  using (tenant_company_id is null);

drop policy if exists "difal_regras_ncm_admin_write_global" on public.difal_regras_ncm;
create policy "difal_regras_ncm_admin_write_global"
  on public.difal_regras_ncm for all
  using (tenant_company_id is null and public.is_admin())
  with check (tenant_company_id is null and public.is_admin());

drop policy if exists "difal_regras_ncm_tenant_read" on public.difal_regras_ncm;
create policy "difal_regras_ncm_tenant_read"
  on public.difal_regras_ncm for select
  using (tenant_company_id is not null and public.has_accounting_access(tenant_company_id));

drop policy if exists "difal_regras_ncm_tenant_write" on public.difal_regras_ncm;
create policy "difal_regras_ncm_tenant_write"
  on public.difal_regras_ncm for all
  using (tenant_company_id is not null and (public.is_admin() or public.is_company_admin(tenant_company_id)))
  with check (tenant_company_id is not null and (public.is_admin() or public.is_company_admin(tenant_company_id)));

-- -------------------------------------------------------------------------
-- 3) Semente — migra TABELA_SP (ncmRegras.js) para a base global
-- -------------------------------------------------------------------------
-- Mesmos valores que já estavam em produção via o arquivo, marcados
-- `fonte = 'seed'` para diferenciar do que for cadastrado depois pela tela
-- ou coletado da Econet. Sem isso, o dia em que a tela passar a ler do
-- banco, SP fica sem nenhuma regra até alguém recadastrar tudo na mão.
insert into public.difal_uf_config
  (tenant_company_id, uf, versao, metodo_base, politica_revenda,
   regra_geral_aliquota, regra_geral_fcp, regra_geral_fundamento)
values
  (null, 'SP', '2026-01', 'base_simples', 'nao_incide',
   18, 0, 'RICMS/SP art. 52, I — alíquota interna geral')
on conflict (coalesce(tenant_company_id, '00000000-0000-0000-0000-000000000000'::uuid), uf) do nothing;

insert into public.difal_regras_ncm
  (tenant_company_id, uf, ncm_prefixo, aliquota, segue_geral, fcp, tipo, excecao_de, fundamento, vigencia_inicio, fonte)
values
  (null, 'SP', '3307', 25, false, null, 'posicao', null,
   'RICMS/SP art. 55, XI — perfumaria e cosméticos', null, 'seed'),
  (null, 'SP', '330720', null, true, null, 'excecao', '3307',
   'Desodorantes corporais e antiperspirantes — fora do rol do art. 55', null, 'seed'),
  (null, 'SP', '33079000', 18, false, null, 'excecao', '3307',
   'Demais produtos de perfumaria não arrolados no art. 55', null, 'seed'),
  (null, 'SP', '2203', 25, false, 2, 'posicao', null,
   'RICMS/SP art. 55 — cervejas e chopes; FCP conforme Lei 16.006/2015', null, 'seed'),
  (null, 'SP', '2402', 25, false, 2, 'posicao', null,
   'RICMS/SP art. 55 — cigarros e produtos de tabacaria', null, 'seed'),
  (null, 'SP', '1006', 7, false, null, 'posicao', null,
   'RICMS/SP art. 53-A — cesta básica (arroz)', '2024-01-01', 'seed'),
  (null, 'SP', '8471', 18, false, null, 'posicao', null,
   'RICMS/SP art. 52, I — máquinas de processamento de dados', null, 'seed')
on conflict (coalesce(tenant_company_id, '00000000-0000-0000-0000-000000000000'::uuid), uf, ncm_prefixo, coalesce(vigencia_inicio, '0001-01-01'::date))
  do nothing;
