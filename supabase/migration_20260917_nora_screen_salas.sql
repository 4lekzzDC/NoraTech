-- Estado autoritativo das salas do Nora Screen.
--
-- Até aqui as regras da sala viviam só no navegador, sincronizadas por
-- broadcast. Isso basta para combinar comportamento entre clientes que
-- colaboram, mas não é autoridade: qualquer participante podia forjar a
-- mensagem "as entradas estão liberadas" e ela valia tanto quanto a do
-- host. Agora as regras moram aqui.
--
-- O problema de autenticação: a sala não tem login. Quem entra é um
-- nickname anônimo, e `auth.uid()` é NULL para todo mundo. Então a
-- autoridade não pode vir da sessão — vem de um segredo que só quem
-- abriu a sala tem. O host sorteia um token no navegador, guarda com
-- ele, e aqui fica apenas o SHA-256 dele. Sem o token não se altera a
-- sala, nem com a anon key na mão.
--
-- Leitura é pública de propósito: todo participante precisa conhecer as
-- regras para obedecê-las, e não há nada sigiloso na linha (o hash não
-- serve para voltar ao token).

create table if not exists public.nora_screen_salas (
  codigo                    text        primary key,
  host_token_hash           text        not null,
  entradas_bloqueadas       boolean     not null default false,
  somente_host_compartilha  boolean     not null default false,
  encerrada                 boolean     not null default false,
  criada_em                 timestamptz not null default now(),
  atualizada_em             timestamptz not null default now()
);

comment on table public.nora_screen_salas is
  'Regras autoritativas das salas do Nora Screen. Leitura publica (todo participante precisa das regras); escrita so pelas RPCs abaixo, que exigem o token do host. Linhas velhas sao varridas oportunisticamente na abertura.';

create index if not exists nora_screen_salas_criada_em_idx
  on public.nora_screen_salas (criada_em);

alter table public.nora_screen_salas enable row level security;

-- A policy libera a LINHA; o grant libera a TABELA. Sem os dois, o select
-- do cliente (e a entrega do Realtime, que passa pelas mesmas checagens)
-- morre em "permission denied" mesmo com a policy no lugar.
grant select on public.nora_screen_salas to anon, authenticated;

-- Única policy: leitura. Escrever exige o token, e isso só as RPCs sabem
-- conferir — não há policy de insert/update/delete de propósito.
drop policy if exists nora_screen_salas_leitura on public.nora_screen_salas;
create policy nora_screen_salas_leitura
  on public.nora_screen_salas
  for select
  to anon, authenticated
  using (true);

-- Sincronização em tempo real: cada cliente escuta as mudanças da própria
-- linha e reage às regras novas sem ninguém precisar avisar por broadcast.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nora_screen_salas'
  ) then
    alter publication supabase_realtime add table public.nora_screen_salas;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Abertura da sala
--
-- Idempotente por desenho: se a sala já existe, devolve o estado atual
-- SEM tocar em nada. Quem chega por link não pode reabrir a sala de
-- outra pessoa nem zerar as regras dela ao entrar.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_abrir_sala(
  p_codigo text,
  p_token  text
)
returns public.nora_screen_salas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala public.nora_screen_salas;
begin
  if p_codigo is null or p_token is null or length(p_token) < 16 then
    raise exception 'parametros invalidos';
  end if;

  -- Varredura oportunista: sala é efêmera, não há por que guardar as de
  -- ontem. Roda na abertura para não precisar de agendador.
  delete from public.nora_screen_salas where criada_em < now() - interval '24 hours';

  insert into public.nora_screen_salas (codigo, host_token_hash)
  values (upper(p_codigo), encode(digest(p_token, 'sha256'), 'hex'))
  on conflict (codigo) do nothing;

  select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);
  return v_sala;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Regras da sala — só com o token do host
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_definir_regras(
  p_codigo              text,
  p_token               text,
  p_entradas_bloqueadas boolean,
  p_somente_host        boolean
)
returns public.nora_screen_salas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala public.nora_screen_salas;
begin
  select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);
  if v_sala.codigo is null then
    raise exception 'sala nao encontrada';
  end if;
  if v_sala.host_token_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'apenas o host desta sala pode mudar as regras';
  end if;

  update public.nora_screen_salas
     set entradas_bloqueadas      = coalesce(p_entradas_bloqueadas, entradas_bloqueadas),
         somente_host_compartilha = coalesce(p_somente_host, somente_host_compartilha),
         atualizada_em            = now()
   where codigo = upper(p_codigo)
  returning * into v_sala;

  return v_sala;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Encerramento — irreversível, e por isso também só com o token
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_encerrar_sala(
  p_codigo text,
  p_token  text
)
returns public.nora_screen_salas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala public.nora_screen_salas;
begin
  select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);
  if v_sala.codigo is null then
    raise exception 'sala nao encontrada';
  end if;
  if v_sala.host_token_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'apenas o host desta sala pode encerra-la';
  end if;

  update public.nora_screen_salas
     set encerrada = true, atualizada_em = now()
   where codigo = upper(p_codigo)
  returning * into v_sala;

  return v_sala;
end;
$$;

-- O Nora Screen é produto público, sem login: estas três precisam mesmo
-- estar abertas ao `anon`. A autoridade está no token, não na sessão.
revoke all on function public.nora_screen_abrir_sala(text, text) from public;
revoke all on function public.nora_screen_definir_regras(text, text, boolean, boolean) from public;
revoke all on function public.nora_screen_encerrar_sala(text, text) from public;

grant execute on function public.nora_screen_abrir_sala(text, text) to anon, authenticated;
grant execute on function public.nora_screen_definir_regras(text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.nora_screen_encerrar_sala(text, text) to anon, authenticated;
