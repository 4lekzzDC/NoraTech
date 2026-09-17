-- Varredura de salas vazias e saída protegida.
--
-- Duas correções no estado autoritativo:
--
--   1. sala que ficou sem ninguém continuava aparecendo em "Ver salas".
--      Agora ela é encerrada sozinha — mas só depois de um respiro, para
--      um F5 ou uma reconexão não matar a sala de quem ainda ia voltar.
--
--   2. largar a vaga de OUTRA pessoa passa a exigir o token do dono. A
--      moderação precisa disso ao remover alguém; um participante comum
--      não precisa, e não deve poder.
--
-- Aditiva: uma função nova e uma substituída por versão com parâmetro a
-- mais (com default, então a chamada antiga continua válida).

-- ═══════════════════════════════════════════════════════════════
-- O limite vai até 99
--
-- O controle da sala passou a ser um slider de 0 a 99, e o check antigo
-- parava em 50: de 51 para cima o banco recusaria, e o dono veria um
-- erro sem entender por quê. A faixa do banco acompanha a do controle.
-- ═══════════════════════════════════════════════════════════════
alter table public.nora_screen_salas
  drop constraint if exists nora_screen_salas_max_participantes_check;
alter table public.nora_screen_salas
  add constraint nora_screen_salas_max_participantes_check
  check (max_participantes is null or max_participantes between 2 and 99);

-- Respiro antes de considerar uma sala abandonada. Bem maior que a
-- janela de presença: primeiro a presença caduca, depois a sala.
create or replace function public.nora_screen_respiro_sala()
returns interval language sql immutable as $$ select interval '45 seconds' $$;

-- ═══════════════════════════════════════════════════════════════
-- Encerra as salas que ficaram vazias
--
-- "Vazia" é não ter NENHUMA presença viva. E só conta depois do respiro,
-- medido da última atividade da sala: sala recém-aberta, cujo dono ainda
-- está registrando a própria presença, não pode ser varrida no caminho.
--
-- Não apaga a linha: marca encerrada. Quem estiver com a sala aberta
-- recebe isso por postgres_changes e sai sabendo o que aconteceu, em vez
-- de ver a sala sumir sem explicação. A linha some depois, na varredura
-- de 24h que já existia.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_varrer_salas_vazias()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quantas integer := 0;
begin
  -- Primeiro os fantasmas: sem isto, uma presença parada faria a sala
  -- parecer habitada para sempre.
  delete from public.nora_screen_presencas
   where visto_em < now() - public.nora_screen_janela_presenca();

  with vazias as (
    select s.codigo
      from public.nora_screen_salas s
     where not s.encerrada
       and s.atualizada_em < now() - public.nora_screen_respiro_sala()
       and s.criada_em     < now() - public.nora_screen_respiro_sala()
       and not exists (
         select 1 from public.nora_screen_presencas p where p.codigo = s.codigo
       )
  )
  update public.nora_screen_salas s
     set encerrada = true, atualizada_em = now()
    from vazias v
   where s.codigo = v.codigo;

  get diagnostics v_quantas = row_count;
  return v_quantas;
end;
$$;

comment on function public.nora_screen_varrer_salas_vazias() is
  'Encerra salas sem nenhuma presenca viva ha mais que o respiro. Chamada oportunisticamente pela listagem; nao apaga linhas.';

-- ═══════════════════════════════════════════════════════════════
-- Salas ativas, já com a contagem de gente
--
-- A listagem contava participantes entrando nos canais do Realtime, o
-- que era lento, às vezes não respondia e mostrava salas mortas. Agora a
-- contagem sai da mesma tabela que o limite usa: uma consulta, número
-- exato, e sala vazia simplesmente não aparece.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_salas_ativas(
  p_limite integer default 24
)
returns table (
  codigo                   text,
  entradas_bloqueadas      boolean,
  somente_host_compartilha boolean,
  max_participantes        integer,
  participantes            integer,
  criada_em                timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.nora_screen_varrer_salas_vazias();

  return query
    select s.codigo, s.entradas_bloqueadas, s.somente_host_compartilha,
           s.max_participantes,
           (select count(*)::integer from public.nora_screen_presencas p where p.codigo = s.codigo),
           s.criada_em
      from public.nora_screen_salas s
     where not s.encerrada
       and s.criada_em > now() - interval '24 hours'
       -- Sala sem ninguém dentro só aparece durante o respiro: é a
       -- janela em que quem recarregou a página ainda vai voltar.
       and (
         exists (select 1 from public.nora_screen_presencas p where p.codigo = s.codigo)
         or s.criada_em > now() - public.nora_screen_respiro_sala()
       )
     order by s.criada_em desc
     limit greatest(1, least(coalesce(p_limite, 24), 100));
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Largar a vaga — a própria sempre, a de outro só com o token
-- ═══════════════════════════════════════════════════════════════
-- A versão de dois parâmetros sai: com um terceiro de default, as duas
-- ficariam ambíguas e o Postgres recusaria a chamada de duas colunas.
drop function if exists public.nora_screen_sair_da_sala(text, text);

create or replace function public.nora_screen_sair_da_sala(
  p_codigo          text,
  p_participante_id text,
  p_token           text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala public.nora_screen_salas;
begin
  if p_codigo is null or p_participante_id is null then return; end if;

  -- Sem token, só quem está saindo por conta própria. Com o token do
  -- dono, a moderação pode liberar a vaga de quem foi removido sem
  -- esperar a presença caducar.
  if p_token is not null then
    select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);
    if v_sala.codigo is null
       or v_sala.host_token_hash <> encode(digest(p_token, 'sha256'), 'hex') then
      raise exception 'apenas o dono desta sala pode liberar a vaga de outra pessoa';
    end if;
  end if;

  delete from public.nora_screen_presencas
   where codigo = upper(p_codigo) and participante_id = p_participante_id;
end;
$$;

revoke all on function public.nora_screen_varrer_salas_vazias() from public;
revoke all on function public.nora_screen_salas_ativas(integer) from public;
revoke all on function public.nora_screen_sair_da_sala(text, text, text) from public;

grant execute on function public.nora_screen_varrer_salas_vazias() to anon, authenticated;
grant execute on function public.nora_screen_salas_ativas(integer) to anon, authenticated;
grant execute on function public.nora_screen_sair_da_sala(text, text, text) to anon, authenticated;
