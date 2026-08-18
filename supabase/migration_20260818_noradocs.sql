-- =========================================================================
-- NoraDocs — schema inicial (Etapa 1)
-- =========================================================================
-- Recebimento, classificação e arquivamento automático de documentos para
-- escritórios de contabilidade. Arquitetura em docs/noradocs/.
--
-- Pré-requisitos (já aplicados em produção):
--   - admin_schema.sql .................. is_admin(), touch_updated_at()
--   - companies_schema.sql .............. companies, company_members,
--                                         is_company_member()
--   - migration_20260509_params_and_roles.sql ... is_company_admin()
--   - subscriptions com company_id e system_slug
--
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
--
-- DUAS REGRAS QUE ATRAVESSAM O SCHEMA INTEIRO
--
--   1. O banco guarda METADADOS. Nenhum byte de documento, e nenhum texto
--      extraído do arquivo. O que sobrevive da leitura é a evidência curta
--      que justificou a decisão — ex.: "CNPJ 12.345.678/0001-90 no texto".
--      Os arquivos vivem no Google Drive do próprio escritório.
--
--   2. O tenant é o ESCRITÓRIO (public.companies). Os clientes atendidos por
--      ele são noradocs_clients — entidade do produto, não da plataforma.
-- =========================================================================


-- =========================================================================
-- 1) Helpers de acesso
-- =========================================================================

-- Leitura e operação do dia a dia: membro ativo do escritório, com assinatura
-- ativa do NoraDocs. Mesmo desenho de has_accounting_access.
create or replace function public.has_noradocs_access(p_company_id uuid)
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
          and s.system_slug = 'noradocs'
          and s.status in ('active', 'trialing')
      )
    );
$$;

-- Configuração do escritório (conexão do Drive, estrutura de pastas): exige
-- owner/admin da organização. Conectar o Drive e mudar onde os documentos são
-- arquivados não é decisão de membro comum.
create or replace function public.has_noradocs_manage(p_company_id uuid)
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
      and public.is_company_admin(p_company_id)
      and public.has_noradocs_access(p_company_id)
    );
$$;


-- =========================================================================
-- 2) noradocs_settings — uma linha por escritório
-- =========================================================================
create table if not exists public.noradocs_settings (
  tenant_company_id uuid primary key references public.companies(id) on delete cascade,

  -- Pasta raiz escolhida pelo Google Picker (ou criada pelo próprio NoraDocs).
  drive_root_folder_id    text,
  drive_root_folder_name  text,
  drive_staging_folder_id text,          -- subpasta _triagem, só para duvidosos

  -- Modo de operação da raiz. 'raiz_nova' é o padrão porque o escopo
  -- drive.file NÃO enxerga o conteúdo que já existe numa pasta escolhida —
  -- apontar uma estrutura legada criaria pastas duplicadas em silêncio.
  root_mode text not null default 'raiz_nova'
    check (root_mode in ('raiz_nova', 'mapeamento_por_cliente')),

  folder_template text not null default '{cliente}/{ano}/{competencia}/{categoria}',

  -- Desligado, todo documento passa por confirmação manual mesmo quando as
  -- regras fecham os três campos. Útil nos primeiros dias de cada escritório.
  auto_organize          boolean not null default true,
  keep_original_filename boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists noradocs_settings_touch on public.noradocs_settings;
create trigger noradocs_settings_touch before update on public.noradocs_settings
  for each row execute function public.touch_updated_at();

alter table public.noradocs_settings enable row level security;

drop policy if exists "noradocs_settings_read" on public.noradocs_settings;
create policy "noradocs_settings_read"
  on public.noradocs_settings for select
  using (public.has_noradocs_access(tenant_company_id));

drop policy if exists "noradocs_settings_write" on public.noradocs_settings;
create policy "noradocs_settings_write"
  on public.noradocs_settings for all
  using (public.has_noradocs_manage(tenant_company_id))
  with check (public.has_noradocs_manage(tenant_company_id));


-- =========================================================================
-- 3) Conexão com o Google — duas tabelas, de propósito
-- =========================================================================
-- Os dados visíveis da conexão (qual conta, qual status) ficam numa tabela com
-- RLS normal. O refresh token fica SOZINHO em outra tabela, com RLS habilitada
-- e NENHUMA policy — o que a torna inalcançável pela anon key por construção,
-- não por configuração. Só Edge Function com service_role lê de lá.
--
-- Separar em duas tabelas (em vez de uma tabela + view) evita precisar de uma
-- view SECURITY DEFINER, que o linter do Supabase sinaliza com razão.

create table if not exists public.noradocs_google_accounts (
  tenant_company_id uuid primary key references public.companies(id) on delete cascade,
  google_email text not null,
  google_sub   text,                     -- id estável da conta Google
  scopes       text[] not null default array['https://www.googleapis.com/auth/drive.file'],
  status       text not null default 'connected'
    check (status in ('connected', 'revoked', 'error')),
  last_error   text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists noradocs_google_accounts_touch on public.noradocs_google_accounts;
create trigger noradocs_google_accounts_touch before update on public.noradocs_google_accounts
  for each row execute function public.touch_updated_at();

alter table public.noradocs_google_accounts enable row level security;

-- Leitura para quem usa o produto (a tela precisa mostrar "conectado como X").
-- Escrita não tem policy: quem grava é a Edge Function do OAuth, com
-- service_role, que ignora RLS. Ninguém conecta ou desconecta pelo cliente.
drop policy if exists "noradocs_google_accounts_read" on public.noradocs_google_accounts;
create policy "noradocs_google_accounts_read"
  on public.noradocs_google_accounts for select
  using (public.has_noradocs_access(tenant_company_id));

-- O segredo. RLS habilitada e nenhuma policy = ninguém, exceto service_role.
create table if not exists public.noradocs_google_tokens (
  tenant_company_id uuid primary key
    references public.noradocs_google_accounts(tenant_company_id) on delete cascade,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);

alter table public.noradocs_google_tokens enable row level security;
-- (nenhuma policy, intencionalmente)

comment on table public.noradocs_google_tokens is
  'Refresh token do Google por escritório. RLS habilitada e SEM policies: '
  'acessível apenas por service_role, nas Edge Functions. Nunca expor ao cliente.';


-- =========================================================================
-- 4) noradocs_clients — as empresas atendidas pelo escritório
-- =========================================================================
create table if not exists public.noradocs_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,

  nome     text not null,
  cnpj     text,                          -- só dígitos, sem máscara
  cpf      text,
  email    text,                          -- já serve ao disparador (etapa 2)
  telefone text,
  regime   text,

  -- Nomes alternativos pelos quais o cliente aparece em nome de arquivo.
  -- É o segundo sinal mais forte de identificação, depois do CNPJ.
  aliases text[] not null default '{}',

  ativo boolean not null default true,

  -- Pasta do cliente no Drive. No modo 'mapeamento_por_cliente' é escolhida
  -- pelo Picker; no modo 'raiz_nova' é preenchida quando o NoraDocs a cria.
  drive_folder_id      text,
  folder_name_override text,

  -- Vínculo opcional com o cadastro do hub Soluções Contábeis, para a
  -- importação. Nulo quando o escritório não assina o outro produto.
  accounting_company_id uuid references public.accounting_companies(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists noradocs_clients_tenant_idx
  on public.noradocs_clients(tenant_company_id);
create unique index if not exists noradocs_clients_cnpj_unique
  on public.noradocs_clients(tenant_company_id, cnpj)
  where cnpj is not null;

drop trigger if exists noradocs_clients_touch on public.noradocs_clients;
create trigger noradocs_clients_touch before update on public.noradocs_clients
  for each row execute function public.touch_updated_at();

alter table public.noradocs_clients enable row level security;

drop policy if exists "noradocs_clients_access" on public.noradocs_clients;
create policy "noradocs_clients_access"
  on public.noradocs_clients for all
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 5) noradocs_categories — semeadas por escritório, editáveis
-- =========================================================================
create table if not exists public.noradocs_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,

  slug        text not null,
  nome        text not null,
  folder_name text,                       -- nome da pasta, se diferir de `nome`
  ordem       int  not null default 0,
  ativo       boolean not null default true,

  -- Alimenta o motor de regras: presença de qualquer palavra no nome do
  -- arquivo ou no texto sugere esta categoria.
  keywords text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_company_id, slug)
);

create index if not exists noradocs_categories_tenant_idx
  on public.noradocs_categories(tenant_company_id);

drop trigger if exists noradocs_categories_touch on public.noradocs_categories;
create trigger noradocs_categories_touch before update on public.noradocs_categories
  for each row execute function public.touch_updated_at();

alter table public.noradocs_categories enable row level security;

drop policy if exists "noradocs_categories_access" on public.noradocs_categories;
create policy "noradocs_categories_access"
  on public.noradocs_categories for all
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 6) noradocs_documents — a entidade central
-- =========================================================================
create table if not exists public.noradocs_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,

  -- Origem do arquivo. 'email' entra na etapa 2 pelo complemento do Gmail e
  -- percorre exatamente este mesmo pipeline.
  origem text not null default 'upload_manual'
    check (origem in ('upload_manual', 'email', 'portal', 'whatsapp', 'api')),
  origem_ref jsonb not null default '{}'::jsonb,

  file_name  text not null,
  mime_type  text,
  size_bytes bigint,
  content_hash text,                      -- sha-256 calculado no navegador

  received_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null,

  status text not null default 'processando'
    check (status in ('processando', 'revisar', 'organizado', 'erro', 'descartado')),

  client_id   uuid references public.noradocs_clients(id) on delete set null,
  competencia text check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid references public.noradocs_categories(id) on delete set null,
  doc_type    text,

  -- O que as regras identificaram e por quê. `evidence` guarda frases curtas
  -- ("CNPJ 12.345.678/0001-90 no texto"), nunca o texto do documento.
  matched jsonb not null default '{}'::jsonb,

  -- Preenchido quando o documento cai em revisão, em linguagem de usuário:
  -- "CNPJ não encontrado no texto nem no nome do arquivo".
  review_reason text,

  drive_file_id   text,
  drive_folder_id text,
  drive_path      text,                   -- caminho legível, coluna "Destino"
  drive_web_link  text,

  error_code    text,
  error_message text,
  retry_count   int not null default 0,

  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  organized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists noradocs_documents_tenant_status_idx
  on public.noradocs_documents(tenant_company_id, status, received_at desc);
create index if not exists noradocs_documents_client_idx
  on public.noradocs_documents(client_id);
create index if not exists noradocs_documents_competencia_idx
  on public.noradocs_documents(tenant_company_id, competencia);

-- Deduplicação: o mesmo arquivo enviado duas vezes é detectado, não duplicado.
-- Descartados ficam de fora — reenviar algo que foi descartado é intencional.
create unique index if not exists noradocs_documents_hash_unique
  on public.noradocs_documents(tenant_company_id, content_hash)
  where content_hash is not null and status <> 'descartado';

drop trigger if exists noradocs_documents_touch on public.noradocs_documents;
create trigger noradocs_documents_touch before update on public.noradocs_documents
  for each row execute function public.touch_updated_at();

alter table public.noradocs_documents enable row level security;

drop policy if exists "noradocs_documents_access" on public.noradocs_documents;
create policy "noradocs_documents_access"
  on public.noradocs_documents for all
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 7) noradocs_events — histórico append-only
-- =========================================================================
-- Sem policy de update nem de delete: o histórico só cresce. É o que permite
-- responder "por que este arquivo foi parar aqui?" semanas depois.
create table if not exists public.noradocs_events (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid references public.noradocs_documents(id) on delete cascade,

  type text not null
    check (type in (
      'recebido', 'classificado', 'revisao_solicitada', 'confirmado',
      'organizado', 'erro', 'reprocessado', 'descartado',
      'regra_criada', 'divergencia_drive'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('user', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  payload  jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists noradocs_events_document_idx
  on public.noradocs_events(document_id, created_at desc);
create index if not exists noradocs_events_tenant_idx
  on public.noradocs_events(tenant_company_id, created_at desc);

alter table public.noradocs_events enable row level security;

drop policy if exists "noradocs_events_read" on public.noradocs_events;
create policy "noradocs_events_read"
  on public.noradocs_events for select
  using (public.has_noradocs_access(tenant_company_id));

drop policy if exists "noradocs_events_insert" on public.noradocs_events;
create policy "noradocs_events_insert"
  on public.noradocs_events for insert
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 8) noradocs_classification_runs — auditoria da decisão automática
-- =========================================================================
create table if not exists public.noradocs_classification_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.noradocs_documents(id) on delete cascade,

  method text not null default 'rules' check (method in ('rules')),
  rules_version text,

  -- Sinais usados, NÃO o conteúdo: nome do arquivo, mime, tamanho e quais
  -- regras dispararam. O texto extraído do documento nunca chega aqui.
  input_summary jsonb not null default '{}'::jsonb,
  output        jsonb not null default '{}'::jsonb,
  latency_ms    int,

  created_at timestamptz not null default now()
);

create index if not exists noradocs_classification_runs_document_idx
  on public.noradocs_classification_runs(document_id, created_at desc);

alter table public.noradocs_classification_runs enable row level security;

drop policy if exists "noradocs_classification_runs_read" on public.noradocs_classification_runs;
create policy "noradocs_classification_runs_read"
  on public.noradocs_classification_runs for select
  using (public.has_noradocs_access(tenant_company_id));

drop policy if exists "noradocs_classification_runs_insert" on public.noradocs_classification_runs;
create policy "noradocs_classification_runs_insert"
  on public.noradocs_classification_runs for insert
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 9) noradocs_drive_folders — cache caminho → id de pasta
-- =========================================================================
-- Evita listar o Drive a cada arquivo e, pelo índice único, impede que dois
-- uploads simultâneos criem a mesma pasta duas vezes.
create table if not exists public.noradocs_drive_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  path            text not null,          -- ex.: 'Silva ME/2026/08/Extratos bancários'
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  unique (tenant_company_id, path)
);

alter table public.noradocs_drive_folders enable row level security;

drop policy if exists "noradocs_drive_folders_access" on public.noradocs_drive_folders;
create policy "noradocs_drive_folders_access"
  on public.noradocs_drive_folders for all
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 10) noradocs_client_rules — regras do escritório
-- =========================================================================
-- Sem IA no MVP, este é o mecanismo de aprendizado do produto: cada correção
-- do contador vira uma regra, legível e editável.
create table if not exists public.noradocs_client_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,

  client_id   uuid references public.noradocs_clients(id) on delete cascade,
  category_id uuid references public.noradocs_categories(id) on delete cascade,

  match_type text not null
    check (match_type in ('filename', 'cnpj', 'email_sender', 'text')),
  pattern  text not null,
  priority int  not null default 100,
  source   text not null default 'manual' check (source in ('manual', 'learned')),
  ativo    boolean not null default true,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists noradocs_client_rules_tenant_idx
  on public.noradocs_client_rules(tenant_company_id, ativo, priority);

drop trigger if exists noradocs_client_rules_touch on public.noradocs_client_rules;
create trigger noradocs_client_rules_touch before update on public.noradocs_client_rules
  for each row execute function public.touch_updated_at();

alter table public.noradocs_client_rules enable row level security;

drop policy if exists "noradocs_client_rules_access" on public.noradocs_client_rules;
create policy "noradocs_client_rules_access"
  on public.noradocs_client_rules for all
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));


-- =========================================================================
-- 11) RPC de bootstrap — cria settings e semeia as categorias
-- =========================================================================
-- Chamada na primeira entrada do escritório no produto. Idempotente: rodar de
-- novo não duplica categoria nem sobrescreve o que o escritório já ajustou.
create or replace function public.noradocs_bootstrap(p_company_id uuid)
  returns public.noradocs_settings
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_settings public.noradocs_settings;
begin
  if not public.has_noradocs_access(p_company_id) then
    raise exception 'Sem acesso ao NoraDocs nesta empresa' using errcode = '42501';
  end if;

  insert into public.noradocs_settings (tenant_company_id)
  values (p_company_id)
  on conflict (tenant_company_id) do nothing;

  insert into public.noradocs_categories (tenant_company_id, slug, nome, ordem, keywords)
  values
    (p_company_id, 'extratos-bancarios', 'Extratos bancários', 1,
      array['extrato', 'extratos', 'bancario', 'conta corrente', 'aplicacao']),
    (p_company_id, 'contas-a-pagar', 'Contas a pagar', 2,
      array['pagar', 'boleto', 'fornecedor', 'despesa', 'pagamento']),
    (p_company_id, 'contas-a-receber', 'Contas a receber', 3,
      array['receber', 'recebimento', 'cliente', 'faturamento']),
    (p_company_id, 'cartoes-taxas', 'Cartões e taxas', 4,
      array['cartao', 'cartoes', 'taxa', 'taxas', 'tarifa', 'maquininha']),
    (p_company_id, 'notas-fiscais', 'Notas fiscais', 5,
      array['nota fiscal', 'nfe', 'nfse', 'nf-e', 'nfs-e', 'danfe', 'nota']),
    (p_company_id, 'estoque', 'Estoque', 6,
      array['estoque', 'inventario', 'balanco de estoque']),
    (p_company_id, 'folha', 'Folha', 7,
      array['folha', 'holerite', 'salario', 'rescisao', 'ferias', 'fgts', 'inss']),
    (p_company_id, 'outros', 'Outros', 99, array[]::text[])
  on conflict (tenant_company_id, slug) do nothing;

  select * into v_settings
  from public.noradocs_settings
  where tenant_company_id = p_company_id;

  return v_settings;
end;
$$;

revoke all on function public.noradocs_bootstrap(uuid) from public;
grant execute on function public.noradocs_bootstrap(uuid) to authenticated;


-- =========================================================================
-- 12) Privilégios de execução — fechar o RPC para quem não está logado
-- =========================================================================
-- O Supabase expõe toda função de `public` como endpoint /rest/v1/rpc, e o
-- papel `anon` herda EXECUTE do grant a PUBLIC que vem por padrão. Nenhuma
-- tabela do NoraDocs é acessível sem autenticação, então `anon` não tem
-- caminho legítimo até nenhuma destas funções.
--
-- `authenticated` PRECISA continuar com EXECUTE nos dois helpers: expressões
-- de policy de RLS são avaliadas com os privilégios de quem faz a consulta,
-- então revogar deles derrubaria o RLS de todas as tabelas noradocs_* com
-- "permission denied for function". Verificado em produção com
-- `set role authenticated` — a consulta volta 0 linhas, sem erro.

revoke execute on function public.has_noradocs_access(uuid) from public, anon;
revoke execute on function public.has_noradocs_manage(uuid) from public, anon;
revoke execute on function public.noradocs_bootstrap(uuid)  from anon;

grant execute on function public.has_noradocs_access(uuid) to authenticated, service_role;
grant execute on function public.has_noradocs_manage(uuid) to authenticated, service_role;


-- =========================================================================
-- Alertas esperados no linter do Supabase, depois desta migration
-- =========================================================================
--   [INFO] rls_enabled_no_policy em noradocs_google_tokens
--          Intencional — é o desenho. RLS ligada e zero policies é o que torna
--          o refresh token inalcançável pela anon key por construção.
--
--   [WARN] authenticated_security_definer_function_executable nas três funções
--          Inerente a helper de RLS: sem EXECUTE para `authenticated` o RLS
--          não avalia. Mesmo alerta que as ~27 funções já existentes no
--          projeto (is_admin, is_company_member, has_accounting_access...).
--
-- Nenhum alerta de `anon` deve aparecer. Se aparecer, algo regrediu aqui.
