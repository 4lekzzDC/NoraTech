-- Sala colaborativa: limite de participantes, admins e presença contável.
--
-- Três coisas novas precisam de autoridade no servidor, e não dá para
-- deixar nenhuma delas só na interface:
--
--   1. limite de participantes — quem chega precisa ser barrado ANTES de
--      entrar, e a contagem não pode ser a que o próprio cliente alega;
--   2. admins — quem pode moderar é decisão do dono, e o cliente do
--      moderado precisa poder conferir se a ordem veio de alguém que a
--      sala reconhece;
--   3. o limite em si, que só o dono muda.
--
-- O limite exigiu uma tabela nova. O Realtime sabe quem está na sala,
-- mas o Postgres não, e uma contagem informada pelo cliente é uma
-- contagem forjável. Então cada participante registra presença aqui e
-- renova de tempos em tempos; linhas paradas caducam.
--
-- Aditiva: adiciona colunas com default, cria uma tabela nova e substitui
-- duas RPCs por versões com parâmetros a mais (com default, então
-- chamadas antigas continuam válidas). Não apaga dados.

-- ═══════════════════════════════════════════════════════════════
-- Estado novo da sala
-- ═══════════════════════════════════════════════════════════════

-- `null` é ausência de limite, e não zero: zero seria "sala que não
-- aceita ninguém", que é outra coisa e já tem nome (entradas_bloqueadas).
alter table public.nora_screen_salas
  add column if not exists max_participantes integer;

alter table public.nora_screen_salas
  add column if not exists admins text[] not null default '{}';

-- Quem é o dono, pelo id de participante.
--
-- Sem isto o resto da sala só saberia quem é o dono porque ele mesmo diz,
-- e "sou o dono" seria uma frase que qualquer cliente modificado pronuncia.
-- Aqui a linha só é escrita por quem apresentou o token, então a resposta
-- vem do banco e não de quem está sendo julgado.
alter table public.nora_screen_salas
  add column if not exists dono_id text;

alter table public.nora_screen_salas
  drop constraint if exists nora_screen_salas_max_participantes_check;
alter table public.nora_screen_salas
  add constraint nora_screen_salas_max_participantes_check
  check (max_participantes is null or max_participantes between 2 and 50);

comment on column public.nora_screen_salas.max_participantes is
  'Maximo de participantes simultaneos. NULL = sem limite.';
comment on column public.nora_screen_salas.dono_id is
  'Id de participante do dono, gravado quando ele entra com o token. Autoritativo: e por ele que os outros sabem de quem aceitar ordens.';
comment on column public.nora_screen_salas.admins is
  'Ids de participantes promovidos a admin pelo dono. Efemeros como a propria sala.';

-- ═══════════════════════════════════════════════════════════════
-- Presença contável
--
-- Existe para uma pergunta só: "quantos estão na sala agora?". O
-- Realtime responde isso para quem já está dentro, mas quem está
-- chegando precisa da resposta ANTES de entrar, e vinda de um lugar que
-- ele não possa fabricar.
--
-- Linha parada caduca: aba fechada no meio, rede caída, navegador morto.
-- Sem isso a sala lotaria de fantasmas e ninguém mais entraria.
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.nora_screen_presencas (
  codigo          text        not null references public.nora_screen_salas(codigo) on delete cascade,
  participante_id text        not null,
  visto_em        timestamptz not null default now(),
  primary key (codigo, participante_id)
);

comment on table public.nora_screen_presencas is
  'Quem esta em cada sala agora, para a contagem do limite. Linhas param de valer apos 90s sem renovacao.';

create index if not exists nora_screen_presencas_visto_em_idx
  on public.nora_screen_presencas (visto_em);

alter table public.nora_screen_presencas enable row level security;

-- Leitura pública: a contagem não é segredo, e a listagem de salas usa.
grant select on public.nora_screen_presencas to anon, authenticated;

drop policy if exists nora_screen_presencas_leitura on public.nora_screen_presencas;
create policy nora_screen_presencas_leitura
  on public.nora_screen_presencas
  for select to anon, authenticated
  using (true);

-- Escrita só pelas RPCs. Sem policy de insert/update/delete de propósito,
-- e sem os grants diretos que o Supabase dá por padrão.
revoke insert, update, delete, truncate, references, trigger
  on public.nora_screen_presencas from anon, authenticated;

-- Quanto tempo uma presença vale sem renovação.
create or replace function public.nora_screen_janela_presenca()
returns interval language sql immutable as $$ select interval '90 seconds' $$;

-- ═══════════════════════════════════════════════════════════════
-- Entrada na sala — agora também confere o limite
--
-- Substitui a versão de duas colunas. Os parâmetros novos têm default,
-- então qualquer chamada antiga continua resolvendo aqui.
-- ═══════════════════════════════════════════════════════════════
drop function if exists public.nora_screen_entrar_na_sala(text, text);

create or replace function public.nora_screen_entrar_na_sala(
  p_codigo          text,
  p_token           text default null,
  p_participante_id text default null
)
returns table (
  autorizado               boolean,
  motivo                   text,
  e_host                   boolean,
  entradas_bloqueadas      boolean,
  somente_host_compartilha boolean,
  encerrada                boolean,
  max_participantes        integer,
  participantes_agora      integer,
  admins                   text[],
  dono_id                  text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala    public.nora_screen_salas;
  v_e_host  boolean := false;
  v_quantos integer := 0;
  v_ja_esta boolean := false;
begin
  if p_codigo is null or length(trim(p_codigo)) = 0 then
    return query select false, 'inexistente'::text, false, false, false, false,
                        null::integer, 0, '{}'::text[], null::text;
    return;
  end if;

  select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);

  if v_sala.codigo is null then
    return query select false, 'inexistente'::text, false, false, false, false,
                        null::integer, 0, '{}'::text[], null::text;
    return;
  end if;

  v_e_host := p_token is not null
          and v_sala.host_token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if v_sala.encerrada then
    return query select false, 'encerrada'::text, v_e_host,
                        v_sala.entradas_bloqueadas, v_sala.somente_host_compartilha, true,
                        v_sala.max_participantes, 0, v_sala.admins, v_sala.dono_id;
    return;
  end if;

  if v_sala.entradas_bloqueadas and not v_e_host then
    return query select false, 'entradas-bloqueadas'::text, false,
                        true, v_sala.somente_host_compartilha, false,
                        v_sala.max_participantes, 0, v_sala.admins, v_sala.dono_id;
    return;
  end if;

  -- Varre os fantasmas antes de contar: quem fechou a aba não ocupa vaga.
  delete from public.nora_screen_presencas
   where codigo = upper(p_codigo)
     and visto_em < now() - public.nora_screen_janela_presenca();

  -- Quem já está na sala volta sempre: o limite é uma porta para quem
  -- chega, não uma armadilha para quem recarregou a página. Sem isto um
  -- F5 numa sala cheia custaria a vaga a quem já estava dentro.
  select exists (
    select 1 from public.nora_screen_presencas
     where codigo = upper(p_codigo) and participante_id = p_participante_id
  ) into v_ja_esta;

  select count(*) into v_quantos
    from public.nora_screen_presencas
   where codigo = upper(p_codigo)
     and (p_participante_id is null or participante_id <> p_participante_id);

  -- O dono entra sempre. Trancá-lo fora por lotação deixaria a sala sem
  -- quem possa aumentar o limite ou encerrar.
  if v_sala.max_participantes is not null
     and not v_e_host
     and not v_ja_esta
     and v_quantos >= v_sala.max_participantes then
    return query select false, 'lotada'::text, false,
                        v_sala.entradas_bloqueadas, v_sala.somente_host_compartilha, false,
                        v_sala.max_participantes, v_quantos, v_sala.admins, v_sala.dono_id;
    return;
  end if;

  -- Autorizado: a vaga é tomada aqui, na mesma transação da contagem.
  -- Conferir e registrar em chamadas separadas deixaria duas pessoas
  -- passarem pela última vaga ao mesmo tempo.
  if p_participante_id is not null then
    insert into public.nora_screen_presencas (codigo, participante_id)
    values (upper(p_codigo), p_participante_id)
    on conflict (codigo, participante_id) do update set visto_em = now();
    v_quantos := v_quantos + 1;
  end if;

  -- O dono se apresenta ao entrar: daqui em diante a sala inteira sabe
  -- de quem aceitar ordens, sem depender do que cada um diz de si.
  if v_e_host and p_participante_id is not null
     and v_sala.dono_id is distinct from p_participante_id then
    update public.nora_screen_salas
       set dono_id = p_participante_id, atualizada_em = now()
     where codigo = upper(p_codigo)
    returning * into v_sala;
  end if;

  return query select true, null::text, v_e_host,
                      v_sala.entradas_bloqueadas, v_sala.somente_host_compartilha, false,
                      v_sala.max_participantes, v_quantos, v_sala.admins, v_sala.dono_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Renovar e largar a vaga
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_bater_ponto(
  p_codigo          text,
  p_participante_id text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_codigo is null or p_participante_id is null then return; end if;
  update public.nora_screen_presencas
     set visto_em = now()
   where codigo = upper(p_codigo) and participante_id = p_participante_id;
end;
$$;

create or replace function public.nora_screen_sair_da_sala(
  p_codigo          text,
  p_participante_id text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_codigo is null or p_participante_id is null then return; end if;
  delete from public.nora_screen_presencas
   where codigo = upper(p_codigo) and participante_id = p_participante_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Regras da sala — agora também o limite. Só com o token do dono.
-- ═══════════════════════════════════════════════════════════════
drop function if exists public.nora_screen_definir_regras(text, text, boolean, boolean);

create or replace function public.nora_screen_definir_regras(
  p_codigo              text,
  p_token               text,
  p_entradas_bloqueadas boolean default null,
  p_somente_host        boolean default null,
  p_max_participantes   integer default null,
  p_limpar_max          boolean default false
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
    raise exception 'apenas o dono desta sala pode mudar as regras';
  end if;

  update public.nora_screen_salas
     set entradas_bloqueadas      = coalesce(p_entradas_bloqueadas, entradas_bloqueadas),
         somente_host_compartilha = coalesce(p_somente_host, somente_host_compartilha),
         -- `null` significa "não mexe"; para tirar o limite existe uma
         -- bandeira própria, senão não haveria como voltar a "sem limite".
         max_participantes        = case
                                      when p_limpar_max then null
                                      else coalesce(p_max_participantes, max_participantes)
                                    end,
         atualizada_em            = now()
   where codigo = upper(p_codigo)
  returning * into v_sala;

  return v_sala;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Admins — promover e rebaixar, só o dono
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_definir_admin(
  p_codigo          text,
  p_token           text,
  p_participante_id text,
  p_admin           boolean
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
    raise exception 'apenas o dono desta sala pode promover admins';
  end if;
  if p_participante_id is null or length(trim(p_participante_id)) = 0 then
    raise exception 'participante invalido';
  end if;

  update public.nora_screen_salas
     set admins = case
                    when p_admin then
                      (select array(select distinct unnest(admins || p_participante_id)))
                    else array_remove(admins, p_participante_id)
                  end,
         atualizada_em = now()
   where codigo = upper(p_codigo)
  returning * into v_sala;

  return v_sala;
end;
$$;

-- Mesmo desenho das outras: produto publico, sem login. A autoridade
-- esta no token, nao na sessao.
revoke all on function public.nora_screen_entrar_na_sala(text, text, text) from public;
revoke all on function public.nora_screen_definir_regras(text, text, boolean, boolean, integer, boolean) from public;
revoke all on function public.nora_screen_definir_admin(text, text, text, boolean) from public;
revoke all on function public.nora_screen_bater_ponto(text, text) from public;
revoke all on function public.nora_screen_sair_da_sala(text, text) from public;

grant execute on function public.nora_screen_entrar_na_sala(text, text, text) to anon, authenticated;
grant execute on function public.nora_screen_definir_regras(text, text, boolean, boolean, integer, boolean) to anon, authenticated;
grant execute on function public.nora_screen_definir_admin(text, text, text, boolean) to anon, authenticated;
grant execute on function public.nora_screen_bater_ponto(text, text) to anon, authenticated;
grant execute on function public.nora_screen_sair_da_sala(text, text) to anon, authenticated;
