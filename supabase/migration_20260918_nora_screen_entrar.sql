-- Entrada na sala validada no servidor.
--
-- Bug que esta migração fecha: "bloquear novas entradas" era uma decisão
-- tomada no navegador de quem chegava. O cliente lia a linha da sala e
-- ele mesmo concluía se podia entrar. Duas consequências:
--
--   1. qualquer falha na leitura (rede, 500, policy) caía no padrão
--      "tudo liberado" e a pessoa entrava apesar do bloqueio;
--   2. a decisão nunca foi do servidor — era o cliente interpretando
--      dados, e um cliente modificado simplesmente não interpretava.
--
-- Agora quem decide é o banco: o cliente pergunta "posso entrar?" e
-- recebe autorizado/recusado já julgado aqui dentro. A leitura direta da
-- tabela continua pública (todo participante precisa conhecer as regras
-- para obedecê-las), mas ela não é mais o que autoriza a entrada.
--
-- Aditiva: só cria uma função nova. Não altera a tabela, os dados, as
-- policies, os grants nem as três RPCs que já existiam.

-- ═══════════════════════════════════════════════════════════════
-- Autorização de entrada
--
-- Devolve uma decisão em vez de levantar exceção: recusa é resposta
-- normal desta função, e o cliente precisa distinguir "o servidor disse
-- não" de "não consegui falar com o servidor" — os dois casos barram a
-- entrada, mas só o primeiro tem um motivo para mostrar à pessoa.
--
-- O token é opcional e serve a um caso só: o host não pode ser trancado
-- do lado de fora da própria sala quando ele mesmo bloqueia as entradas
-- (nem ao recarregar a página, quando o token vem do sessionStorage).
-- Quem não manda token é convidado, e convidado obedece ao bloqueio.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.nora_screen_entrar_na_sala(
  p_codigo text,
  p_token  text default null
)
returns table (
  autorizado               boolean,
  motivo                   text,
  e_host                   boolean,
  entradas_bloqueadas      boolean,
  somente_host_compartilha boolean,
  encerrada                boolean
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sala   public.nora_screen_salas;
  v_e_host boolean := false;
begin
  if p_codigo is null or length(trim(p_codigo)) = 0 then
    return query select false, 'inexistente'::text, false, false, false, false;
    return;
  end if;

  select * into v_sala from public.nora_screen_salas where codigo = upper(p_codigo);

  -- Sala que nunca foi aberta não existe para entrar. Não criamos aqui:
  -- abrir sala é do host, e criar por engano daria a qualquer um uma
  -- sala com código escolhido a dedo.
  if v_sala.codigo is null then
    return query select false, 'inexistente'::text, false, false, false, false;
    return;
  end if;

  v_e_host := p_token is not null
          and v_sala.host_token_hash = encode(digest(p_token, 'sha256'), 'hex');

  -- Ordem dos motivos: encerrada é definitiva e vale até para o host;
  -- bloqueio de entradas é temporário e o host atravessa.
  if v_sala.encerrada then
    return query select false, 'encerrada'::text, v_e_host,
                        v_sala.entradas_bloqueadas, v_sala.somente_host_compartilha, true;
    return;
  end if;

  if v_sala.entradas_bloqueadas and not v_e_host then
    return query select false, 'entradas-bloqueadas'::text, false,
                        true, v_sala.somente_host_compartilha, false;
    return;
  end if;

  return query select true, null::text, v_e_host,
                      v_sala.entradas_bloqueadas, v_sala.somente_host_compartilha, false;
end;
$$;

comment on function public.nora_screen_entrar_na_sala(text, text) is
  'Decide no servidor se alguem pode entrar numa sala do Nora Screen: sala existe, nao encerrada, entradas nao bloqueadas (o host atravessa o bloqueio com o token). Devolve a decisao e as regras atuais.';

-- Mesmo desenho das outras: produto publico, sem login. A autoridade
-- esta no token, nao na sessao.
revoke all on function public.nora_screen_entrar_na_sala(text, text) from public;
grant execute on function public.nora_screen_entrar_na_sala(text, text) to anon, authenticated;
