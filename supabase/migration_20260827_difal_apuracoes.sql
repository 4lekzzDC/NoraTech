-- =========================================================================
-- Persistência das apurações de DIFAL
-- =========================================================================
-- Até aqui a Calculadora de DIFAL era uma calculadora de verdade: processava
-- o lote na memória do navegador e esquecia tudo ao fechar a aba. Não havia
-- histórico por competência, não havia como responder "o que foi recolhido em
-- julho?", e a lupa parava de mostrar o XML depois de um F5.
--
-- Três tabelas, na granularidade em que o motor já trabalha:
--
--   difal_apuracoes        uma por competência x cliente
--   difal_apuracao_notas   uma por XML, com o arquivo guardado
--   difal_apuracao_itens   uma por <det>, com o cálculo e o dado bruto
--
-- Duas decisões que vale registrar aqui, porque elas custam espaço:
--
-- 1. O XML fica guardado (`xml` em difal_apuracao_notas). Uma NF-e tem 5 a
--    20 KB; 500 notas por mês por escritório dá alguns MB por ano. Em troca:
--    a lupa continua funcionando depois de recarregar, e — o que importa de
--    verdade — dá para REPROCESSAR uma competência antiga com a tabela de
--    NCM corrigida e ver exatamente o que muda. Sem o XML, uma correção de
--    alíquota obrigaria a pedir os arquivos ao cliente de novo.
--
-- 2. Cada apuração grava `versao_motor` e `versao_tabela`. Uma apuração de
--    2026 conferida em 2028 precisa dizer com que regras ela foi feita —
--    senão "o número mudou" vira discussão em vez de auditoria.
--
-- A mesma nota PODE aparecer em apurações diferentes (reprocessamento,
-- correção, competência refeita) — o que não pode é aparecer duas vezes na
-- MESMA apuração, e disso cuida o índice único por (apuracao_id, chave).
-- Pagar DIFAL duas vezes pela mesma nota é o erro clássico que a tela avisa,
-- consultando `chave` dentro do tenant.
--
-- Pré-requisitos: accounting_schema.sql aplicado (has_accounting_access,
-- accounting_companies). Idempotente: pode rodar mais de uma vez.
--
-- Aplicada em produção (projeto NoraTech) em 27/08/2026. Conferido depois de
-- aplicar: RLS ligada nas três tabelas, uma política em cada, e um SELECT
-- como `anon` sobre uma linha real não devolve nada.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) difal_apuracoes — o fechamento de uma competência
-- -------------------------------------------------------------------------
create table if not exists public.difal_apuracoes (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  -- Cliente em apuração. Opcional: o contador também usa a tela para conferir
  -- XMLs avulsos, sem cadastro, e essa apuração continua valendo como
  -- rascunho da equipe.
  accounting_company_id uuid references public.accounting_companies(id) on delete set null,
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  uf_destino char(2),
  -- Parâmetros com que o lote foi processado. Guardados junto porque mudam o
  -- resultado: a mesma nota dá números diferentes em base simples e dupla.
  metodo_base text not null default 'base_simples'
    check (metodo_base in ('base_simples', 'base_dupla')),
  politica_revenda text not null default 'nao_incide'
    check (politica_revenda in ('nao_incide', 'antecipacao_parcial')),
  versao_motor text not null,
  versao_tabela text,
  -- 'aberta' aceita nota nova e reprocessamento; 'fechada' é a guia já
  -- recolhida — vira histórico, e a tela impede alteração.
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  totais jsonb not null default '{}'::jsonb,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  fechada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists difal_apuracoes_tenant_idx
  on public.difal_apuracoes(tenant_company_id, competencia desc);
create index if not exists difal_apuracoes_cliente_idx
  on public.difal_apuracoes(accounting_company_id);

drop trigger if exists difal_apuracoes_touch on public.difal_apuracoes;
create trigger difal_apuracoes_touch before update on public.difal_apuracoes
  for each row execute function public.touch_updated_at();

alter table public.difal_apuracoes enable row level security;

drop policy if exists "difal_apuracoes_access" on public.difal_apuracoes;
create policy "difal_apuracoes_access"
  on public.difal_apuracoes for all
  using (public.has_accounting_access(tenant_company_id))
  with check (public.has_accounting_access(tenant_company_id));

-- -------------------------------------------------------------------------
-- 2) difal_apuracao_notas — um XML processado
-- -------------------------------------------------------------------------
create table if not exists public.difal_apuracao_notas (
  id uuid primary key default gen_random_uuid(),
  apuracao_id uuid not null references public.difal_apuracoes(id) on delete cascade,
  -- Denormalizado da apuração: o aviso de "esta nota já foi apurada" precisa
  -- procurar a chave dentro da equipe inteira, sem passar por join a cada
  -- arquivo enviado.
  tenant_company_id uuid not null references public.companies(id) on delete cascade,
  arquivo text,
  chave text,
  numero text,
  serie text,
  data_emissao date,
  emitente_cnpj text,
  emitente_nome text,
  uf_origem char(2),
  uf_destino char(2),
  -- Espelha o resultado do motor: 'processada' | 'nao_aplicavel' | 'pendente'
  -- | 'erro' (arquivo ilegível).
  situacao text not null,
  motivo text,
  totais jsonb not null default '{}'::jsonb,
  -- A identificação inteira que o parser extraiu (modelo, versão, natureza,
  -- finalidade, CRT do emitente, indicador de IE do destinatário, totais da
  -- nota...). As colunas acima são a projeção do que precisa de índice e
  -- relatório; este jsonb é a fidelidade que o painel da lupa exige — sem
  -- ele, metade dos campos vira travessão depois de recarregar.
  identificacao jsonb,
  -- O arquivo como veio. Ver a nota 1 no cabeçalho.
  xml text,
  created_at timestamptz not null default now()
);

create index if not exists difal_apuracao_notas_apuracao_idx
  on public.difal_apuracao_notas(apuracao_id);
-- Suporta o aviso de nota repetida: chave dentro da equipe.
create index if not exists difal_apuracao_notas_tenant_chave_idx
  on public.difal_apuracao_notas(tenant_company_id, chave)
  where chave is not null and chave <> '';
-- Uma nota entra uma vez por apuração. Reenviar o mesmo arquivo corrige a
-- linha (upsert), não soma de novo na guia.
create unique index if not exists difal_apuracao_notas_apuracao_chave_key
  on public.difal_apuracao_notas(apuracao_id, chave)
  where chave is not null and chave <> '';

alter table public.difal_apuracao_notas enable row level security;

drop policy if exists "difal_apuracao_notas_access" on public.difal_apuracao_notas;
create policy "difal_apuracao_notas_access"
  on public.difal_apuracao_notas for all
  using (public.has_accounting_access(tenant_company_id))
  with check (public.has_accounting_access(tenant_company_id));

-- -------------------------------------------------------------------------
-- 3) difal_apuracao_itens — a granularidade do cálculo
-- -------------------------------------------------------------------------
-- O DIFAL é apurado produto a produto, então é produto a produto que ele
-- precisa ser guardado: a guia é a soma destas linhas, e é aqui que a
-- conferência acontece.
create table if not exists public.difal_apuracao_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.difal_apuracao_notas(id) on delete cascade,
  n_item int not null,
  codigo text,
  descricao text,
  ncm text,
  cfop text,
  situacao text not null check (situacao in ('calculado', 'pendente', 'nao_aplicavel')),
  motivo text,
  finalidade text,
  -- Alíquotas e a procedência delas: sem `origem_interna` e `fundamento`, a
  -- linha guardada responde "quanto" mas não "por quê", que é metade do
  -- valor de ter guardado.
  aliquota_interna numeric(5,2),
  aliquota_interestadual numeric(5,2),
  fcp numeric(5,2),
  origem_interna text,
  ncm_regra text,
  fundamento text,
  -- 'destaque_xml' quando a alíquota interestadual veio destacada na nota,
  -- 'matriz_uf' quando saiu da matriz origem x destino. Não dá para deduzir
  -- depois, e é a primeira coisa que se confere quando o número surpreende.
  fonte_interestadual text,
  v_base numeric(14,2) not null default 0,
  -- Base sobre a qual a alíquota interna incidiu. Igual a v_base em base
  -- simples; em base dupla é a base recomposta por dentro, e é ela que
  -- explica o número.
  v_base_difal numeric(14,2) not null default 0,
  v_difal numeric(14,2) not null default 0,
  v_fcp numeric(14,2) not null default 0,
  v_total numeric(14,2) not null default 0,
  -- Composição da base como ela foi montada NA ÉPOCA (parcelas e se o IPI
  -- entrou). Guardada em vez de recalculada: se a regra de composição mudar,
  -- a apuração antiga tem que continuar explicando o próprio número.
  base jsonb,
  -- O item como saiu do XML (prod + ICMS + IPI) e os avisos do motor.
  fonte jsonb,
  alertas text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists difal_apuracao_itens_nota_idx
  on public.difal_apuracao_itens(nota_id);
create unique index if not exists difal_apuracao_itens_nota_item_key
  on public.difal_apuracao_itens(nota_id, n_item);

alter table public.difal_apuracao_itens enable row level security;

drop policy if exists "difal_apuracao_itens_access" on public.difal_apuracao_itens;
create policy "difal_apuracao_itens_access"
  on public.difal_apuracao_itens for all
  using (
    exists (
      select 1
      from public.difal_apuracao_notas n
      where n.id = nota_id
        and public.has_accounting_access(n.tenant_company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.difal_apuracao_notas n
      where n.id = nota_id
        and public.has_accounting_access(n.tenant_company_id)
    )
  );
