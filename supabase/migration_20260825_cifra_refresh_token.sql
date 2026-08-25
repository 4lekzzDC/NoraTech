-- Tira o refresh_token do Google de texto puro e passa a guardá-lo no Vault.
--
-- O QUE ESSE TOKEN VALE: com ele mais o client secret, qualquer um emite
-- access_token do Google indefinidamente e mexe em tudo que o NoraDocs já
-- criou no Drive daquele escritório. É o segredo mais valioso do produto, e
-- era a única coluna sensível ainda em claro. O `token_hash` da tabela de
-- entrada já é hash, e CNPJ/CPF de cliente não podem ser cifrados porque o
-- motor de regras casa documento por eles.
--
-- CONTRA O QUE ISTO PROTEGE, e contra o que não: a tabela já tinha RLS
-- ligada sem policy nenhuma, então nenhum cliente autenticado nunca chegou
-- perto dela — isso continua valendo e não é o que muda aqui. O que muda é o
-- cenário em que o conteúdo do banco escapa por fora do controle de acesso:
-- um dump de backup, um dreno de réplica, um snapshot restaurado num
-- ambiente de teste, alguém com acesso de leitura ao disco. Nesses casos a
-- coluna em claro entregava o token; a cifrada não, porque a chave é
-- gerenciada pelo Supabase e não vive dentro do banco. Não protege contra
-- quem já tem a service_role — essa pessoa chama a RPC e lê. Não existe
-- criptografia que resolva isso, e fingir que existe seria pior que não ter.
--
-- MIGRAÇÃO SEM JANELA DE QUEDA: a leitura cai para a coluna antiga quando
-- ainda não há secret_id. Assim o banco pode ser migrado antes das Edge
-- Functions serem implantadas, e uma função ainda não atualizada continua
-- funcionando. A coluna em claro só é removida numa migração posterior,
-- depois que as três funções estiverem no ar — está marcada no fim do
-- arquivo e NÃO roda agora, de propósito.

begin;

alter table public.noradocs_google_tokens
  add column if not exists secret_id uuid;

-- A coluna em claro nasceu NOT NULL, quando era ela a única guarda do token.
-- Agora quem guarda é o Vault, e a coluna precisa aceitar NULL para poder ser
-- esvaziada — é justamente o esvaziar que tira o segredo de dentro do banco.
-- Ela some de vez na migração de remoção, no fim deste arquivo.
alter table public.noradocs_google_tokens
  alter column refresh_token drop not null;

comment on column public.noradocs_google_tokens.secret_id is
  'Id do segredo no Vault com o refresh_token do Google. Substitui a coluna '
  'refresh_token, que fica só como fallback durante a migração.';

-- ── Gravar ──────────────────────────────────────────────────────────────
create or replace function public.noradocs_guardar_refresh_token(
  p_company_id uuid,
  p_refresh_token text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret_id uuid;
  v_nome text := 'noradocs_google_refresh_token:' || p_company_id::text;
begin
  if p_refresh_token is null or length(p_refresh_token) < 10 then
    raise exception 'refresh_token ausente ou curto demais' using errcode = '22023';
  end if;

  select secret_id into v_secret_id
  from public.noradocs_google_tokens
  where tenant_company_id = p_company_id;

  if v_secret_id is null then
    -- Reconectar depois de desconectar reencontra um segredo órfão com o
    -- mesmo nome; o nome é único no Vault, então reaproveitamos o id em vez
    -- de estourar unique_violation.
    select id into v_secret_id from vault.secrets where name = v_nome;
  end if;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_refresh_token, v_nome,
      'refresh_token do Google Drive do escritório ' || p_company_id::text
    );
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  insert into public.noradocs_google_tokens (tenant_company_id, secret_id, refresh_token)
  values (p_company_id, v_secret_id, null)
  on conflict (tenant_company_id) do update
    set secret_id = excluded.secret_id,
        -- zera o valor em claro que porventura ainda estivesse gravado
        refresh_token = null;
end;
$$;

-- ── Ler ─────────────────────────────────────────────────────────────────
create or replace function public.noradocs_ler_refresh_token(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret_id uuid;
  v_claro text;
  v_token text;
begin
  select secret_id, refresh_token into v_secret_id, v_claro
  from public.noradocs_google_tokens
  where tenant_company_id = p_company_id;

  if v_secret_id is not null then
    select decrypted_secret into v_token
    from vault.decrypted_secrets where id = v_secret_id;
    if v_token is not null then return v_token; end if;
  end if;

  -- Fallback da migração: linha ainda não convertida.
  return v_claro;
end;
$$;

-- ── Apagar ──────────────────────────────────────────────────────────────
-- Desconectar o Google precisa remover o segredo também; deixar para trás um
-- refresh_token cifrado de uma conexão revogada é guardar risco sem utilidade.
create or replace function public.noradocs_apagar_refresh_token(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret_id uuid;
begin
  select secret_id into v_secret_id
  from public.noradocs_google_tokens
  where tenant_company_id = p_company_id;

  delete from public.noradocs_google_tokens where tenant_company_id = p_company_id;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

-- ── Só a service_role ───────────────────────────────────────────────────
-- Mesmo padrão de check_rate_limit: revogar de PUBLIC, que é de onde vinha o
-- acesso implícito, e conceder nominalmente. Estas três funções leem e
-- gravam o segredo mais sensível do produto — nenhum cliente do navegador,
-- autenticado ou não, tem o que fazer aqui.
revoke execute on function public.noradocs_guardar_refresh_token(uuid, text) from public;
revoke execute on function public.noradocs_ler_refresh_token(uuid) from public;
revoke execute on function public.noradocs_apagar_refresh_token(uuid) from public;
grant execute on function public.noradocs_guardar_refresh_token(uuid, text) to service_role;
grant execute on function public.noradocs_ler_refresh_token(uuid) to service_role;
grant execute on function public.noradocs_apagar_refresh_token(uuid) to service_role;

-- ── Converte o que já existe ────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select tenant_company_id, refresh_token
    from public.noradocs_google_tokens
    where refresh_token is not null and secret_id is null
  loop
    perform public.noradocs_guardar_refresh_token(r.tenant_company_id, r.refresh_token);
  end loop;
end $$;

commit;

-- ── DEPOIS de implantar noradocs-google-oauth, noradocs-drive e
--    noradocs-inbound, rodar numa migração separada:
--
--      alter table public.noradocs_google_tokens drop column refresh_token;
--
--    Enquanto a coluna existir, o token em claro segue no banco e o ganho
--    desta migração é só parcial. Não roda junto de propósito: derrubaria
--    qualquer função ainda não atualizada.
