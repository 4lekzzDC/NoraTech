-- NoraDocs — fundação da entrada por e-mail (E10)
--
-- Três coisas que o complemento do Gmail vai precisar e que ainda não
-- existem: uma credencial que prove de que escritório ele é, um lugar onde
-- pôr o documento de uma empresa que ninguém cadastrou, e o conceito de
-- cliente provisório que dá sentido a esse lugar.
--
-- Desenho e justificativas em docs/noradocs/etapa2-gmail.md.


-- =========================================================================
-- 1) Cliente provisório
-- =========================================================================
-- O que é provisório é o CLIENTE, não o documento.
--
-- Quando o e-mail chega de uma empresa que não está cadastrada, a
-- alternativa seria deixar o documento sem dono num monte único. Em vez
-- disso o sistema cria um cliente provisório com o nome que detectou e
-- arquiva normalmente por baixo dele — o pipeline de classificação,
-- template de pastas e histórico não mudam em nada.
--
-- O que muda é ONDE ele mora: sob a raiz _verificação, nunca ao lado dos
-- clientes de verdade. A árvore de clientes é o arquivo oficial do
-- escritório e nada entra nela por palpite; três grafias do mesmo nome
-- virariam três pastas irmãs das reais, e juntá-las depois é trabalho
-- manual dentro do Drive.

alter table public.noradocs_clients
  add column if not exists status text not null default 'confirmado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'noradocs_clients_status_check'
  ) then
    alter table public.noradocs_clients
      add constraint noradocs_clients_status_check
      check (status in ('confirmado', 'provisorio'));
  end if;
end $$;

-- De onde veio o palpite: {"tipo":"dominio_remetente","valor":"aurora.com.br"}.
-- A tela de verificação precisa poder explicar por que aquela pasta existe —
-- "apareceu sozinha" é o que faz o contador desconfiar do produto.
alter table public.noradocs_clients
  add column if not exists origem_deteccao jsonb not null default '{}'::jsonb;

-- Provisório não tem CNPJ, então o índice único de CNPJ não o protege de
-- duplicata. O nome é a chave enquanto ele for provisório — e o índice é o
-- que torna o "cria se não existir" da função de entrada seguro contra dois
-- e-mails da mesma empresa chegando juntos.
create unique index if not exists noradocs_clients_provisorio_unique
  on public.noradocs_clients(tenant_company_id, lower(nome))
  where status = 'provisorio';

comment on column public.noradocs_clients.status is
  'confirmado = cadastrado por uma pessoa. provisorio = criado pela entrada '
  'automática a partir de um nome detectado; mora sob a raiz _verificação até '
  'alguém confirmar ou fundir com um cliente existente.';


-- =========================================================================
-- 2) A raiz de verificação
-- =========================================================================
-- Irmã de _triagem, com propósito diferente: _triagem guarda o que não foi
-- identificado; _verificação guarda o que foi identificado como uma empresa
-- que ainda não é cliente. No primeiro caso falta informação; no segundo
-- falta cadastro.

alter table public.noradocs_settings
  add column if not exists drive_verificacao_folder_id text;


-- =========================================================================
-- 3) Tokens de entrada
-- =========================================================================
-- O complemento roda na conta Google do contador; o NoraDocs autentica por
-- sessão Supabase. São identidades que não se falam, e o Apps Script não
-- alcança a sessão do navegador. A ponte é um token por escritório, gerado
-- aqui e colado no complemento uma vez.
--
-- Guardamos SÓ o hash. O token em claro existe uma única vez, no retorno da
-- função que o cria — não é gravado, não é recuperável, só substituível.
--
-- O que limita o estrago se vazar: ele autoriza uma coisa só, acrescentar um
-- documento à caixa de entrada daquele escritório. Não lê documento, não
-- lista cliente, não apaga nada. No pior caso alguém empurra lixo para uma
-- fila de revisão — visível, com trilha e descartável em massa.

create table if not exists public.noradocs_inbound_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_company_id uuid not null references public.companies(id) on delete cascade,

  token_hash text not null unique,       -- sha-256 hex; o token em claro não mora aqui
  label      text,                       -- "Gmail do João" — para saber qual revogar

  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,              -- escrito pela Edge Function de entrada
  revoked_at   timestamptz
);

create index if not exists noradocs_inbound_tokens_tenant_idx
  on public.noradocs_inbound_tokens(tenant_company_id)
  where revoked_at is null;

alter table public.noradocs_inbound_tokens enable row level security;

-- Só quem responde pelo escritório enxerga a lista de credenciais. E não há
-- policy de INSERT nem de UPDATE de propósito: inserir uma linha à mão seria
-- cunhar um token com um hash escolhido por quem insere. As duas únicas
-- escritas possíveis são as funções abaixo.
drop policy if exists "noradocs_inbound_tokens_read" on public.noradocs_inbound_tokens;
create policy "noradocs_inbound_tokens_read"
  on public.noradocs_inbound_tokens for select
  using (public.has_noradocs_manage(tenant_company_id));

comment on table public.noradocs_inbound_tokens is
  'Credenciais de entrada do complemento do Gmail. Só o hash é guardado. '
  'Sem policy de insert/update: cunhar e revogar passam pelas RPCs.';


-- Cria e devolve o token em claro. É a ÚNICA vez que ele existe legível.
create or replace function public.noradocs_create_inbound_token(
  p_company_id uuid,
  p_label      text default null
)
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_token  text;
  v_ativos int;
begin
  if not public.has_noradocs_manage(p_company_id) then
    raise exception 'Apenas o responsável pelo escritório pode gerar tokens de entrada'
      using errcode = '42501';
  end if;

  -- Teto pequeno de propósito: cada token é uma porta aberta, e um
  -- escritório não precisa de dez. O limite existe para que "gerar" clicado
  -- várias vezes por engano não deixe um rastro de credenciais esquecidas.
  select count(*) into v_ativos
  from public.noradocs_inbound_tokens
  where tenant_company_id = p_company_id and revoked_at is null;

  if v_ativos >= 5 then
    raise exception 'Este escritório já tem 5 tokens ativos. Revogue um antes de gerar outro'
      using errcode = '22023';
  end if;

  -- 32 bytes de aleatoriedade. O prefixo é só para quem encontrar a string
  -- solta em algum lugar saber o que ela é e onde revogá-la.
  v_token := 'ndin_' || encode(gen_random_bytes(32), 'hex');

  insert into public.noradocs_inbound_tokens (tenant_company_id, token_hash, label, created_by)
  values (
    p_company_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    nullif(btrim(p_label), ''),
    auth.uid()
  );

  return v_token;
end;
$$;


create or replace function public.noradocs_revoke_inbound_token(p_token_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_company uuid;
begin
  select tenant_company_id into v_company
  from public.noradocs_inbound_tokens
  where id = p_token_id;

  if v_company is null then
    raise exception 'Token não encontrado' using errcode = 'P0002';
  end if;

  if not public.has_noradocs_manage(v_company) then
    raise exception 'Apenas o responsável pelo escritório pode revogar tokens de entrada'
      using errcode = '42501';
  end if;

  -- Revogar não apaga: a linha revogada continua respondendo "quem criou,
  -- quando, e quando foi usada pela última vez" — que é o que se quer saber
  -- justamente quando se revoga por suspeita.
  update public.noradocs_inbound_tokens
  set revoked_at = now()
  where id = p_token_id and revoked_at is null;
end;
$$;


revoke all on function public.noradocs_create_inbound_token(uuid, text) from public, anon;
revoke all on function public.noradocs_revoke_inbound_token(uuid)       from public, anon;
grant execute on function public.noradocs_create_inbound_token(uuid, text) to authenticated;
grant execute on function public.noradocs_revoke_inbound_token(uuid)       to authenticated;


-- =========================================================================
-- 4) Encontrar ou criar o cliente provisório
-- =========================================================================
-- Feito no banco, e não na Edge Function, por uma razão concreta: a chave de
-- unicidade do provisório é um índice de EXPRESSÃO (lower(nome)), e o
-- on_conflict do PostgREST só aceita nomes de coluna. Tentar pelo cliente HTTP
-- daria ou um erro na primeira duplicata, ou um select-depois-insert com
-- janela de corrida — e dois anexos da mesma empresa chegando juntos é
-- exatamente o caso normal de uso.
--
-- `on conflict do nothing` seguido do select resolve os dois: quem perde a
-- corrida encontra o cliente que o vencedor acabou de criar.

create or replace function public.noradocs_cliente_provisorio(
  p_company_id uuid,
  p_nome       text,
  p_origem     jsonb default '{}'::jsonb
)
  returns public.noradocs_clients
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_nome    text := btrim(p_nome);
  v_cliente public.noradocs_clients;
begin
  if v_nome = '' then
    raise exception 'Nome do cliente provisório não pode ser vazio' using errcode = '22023';
  end if;

  insert into public.noradocs_clients (tenant_company_id, nome, status, origem_deteccao)
  values (p_company_id, v_nome, 'provisorio', coalesce(p_origem, '{}'::jsonb))
  on conflict do nothing;

  select * into v_cliente
  from public.noradocs_clients
  where tenant_company_id = p_company_id
    and status = 'provisorio'
    and lower(nome) = lower(v_nome);

  return v_cliente;
end;
$$;

-- Só a Edge Function de entrada chama isto, com service_role. Nenhum usuário
-- do navegador cria cliente provisório — provisório nasce de uma detecção,
-- não de um formulário.
revoke all on function public.noradocs_cliente_provisorio(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.noradocs_cliente_provisorio(uuid, text, jsonb) to service_role;
