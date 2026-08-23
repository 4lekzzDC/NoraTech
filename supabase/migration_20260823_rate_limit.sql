-- Rate limiting compartilhado das Edge Functions.
--
-- Contador de janela fixa. A contagem precisa ser ATÔMICA: se a função lesse o
-- total e depois gravasse, N requisições simultâneas leriam o mesmo total
-- abaixo do limite e passariam todas — exatamente o caso que um atacante
-- provoca de propósito. O `insert ... on conflict do update ... returning` de
-- baixo é uma única instrução, então o Postgres serializa as concorrentes e
-- cada uma recebe o seu próprio número.
--
-- Janela fixa (e não deslizante) por escolha: na virada da janela um cliente
-- pode emitir até 2x o limite em rajada. Para proteger custo e força bruta
-- isso é irrelevante, e o custo de uma janela deslizante (guardar cada hit
-- individual) não se paga aqui.

create table if not exists public.rate_limit_hits (
  bucket       text        not null,
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, key, window_start)
);

comment on table public.rate_limit_hits is
  'Contadores de rate limit das Edge Functions. RLS habilitada e SEM policies: '
  'só service_role toca, e sempre através da RPC check_rate_limit. '
  'Linhas antigas são varridas oportunisticamente pela própria RPC.';

-- Varredura das janelas vencidas usa este índice.
create index if not exists rate_limit_hits_window_idx
  on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;
-- Sem policies de propósito: nenhum cliente autenticado tem o que fazer aqui.
-- A RPC abaixo é security definer e é o único caminho de escrita.

create or replace function public.check_rate_limit(
  p_bucket         text,
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'limite e janela precisam ser positivos' using errcode = '22023';
  end if;

  -- Alinha o instante atual ao início da janela: todo mundo dentro dos mesmos
  -- p_window_seconds cai na mesma linha, e a chave primária faz o resto.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_hits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Limpeza oportunista: 1% das chamadas paga a conta de varrer o que já
  -- venceu, para a tabela não crescer para sempre. Sai barato porque quase
  -- toda chamada pula, e dispensa um cron só para isso.
  if random() < 0.01 then
    delete from public.rate_limit_hits
      where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'hits',    v_hits,
    'limit',   p_limit,
    -- Quanto falta para a janela virar, sempre >= 1 para o Retry-After nunca
    -- dizer "tente de novo agora" e o cliente entrar em laço.
    'retry_after', greatest(
      1,
      ceil(extract(epoch from (
        v_window_start + make_interval(secs => p_window_seconds) - now()
      )))::integer
    )
  );
end;
$$;

comment on function public.check_rate_limit(text, text, integer, integer) is
  'Registra um acesso e diz se ele cabe no limite. Contagem atômica por '
  'janela fixa. Chamada apenas pelas Edge Functions com service_role.';

-- Só service_role. Um cliente autenticado que pudesse chamar isto conseguiria
-- inflar o contador de outra pessoa (negação de serviço dirigida) ou queimar
-- a própria janela de graça.
revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
