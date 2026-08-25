-- Remove a coluna refresh_token em claro. É o passo que realiza a proteção.
--
-- Rodar SÓ depois que noradocs-google-oauth, noradocs-drive e noradocs-inbound
-- estiverem implantadas lendo pela RPC (v11, v15 e v7 respectivamente). Antes
-- disso, derruba a integração com o Drive e a entrada por e-mail.
--
-- Enquanto a coluna existiu, o ganho da criptografia era zero: o token cifrado
-- no Vault convivia com uma cópia legível ao lado, e é a cópia legível que
-- aparece num dump de backup, num dreno de réplica ou num snapshot restaurado
-- em ambiente de teste.
--
-- As duas funções são redefinidas ANTES do drop porque ambas referenciam a
-- coluna: a de gravar mantinha o espelho, a de ler tinha o fallback da
-- migração. Derrubar a coluna com elas ainda apontando para lá quebraria as
-- duas na primeira chamada.

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
      'refresh_token do Google Drive do escritorio ' || p_company_id::text
    );
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  insert into public.noradocs_google_tokens (tenant_company_id, secret_id)
  values (p_company_id, v_secret_id)
  on conflict (tenant_company_id) do update
    set secret_id = excluded.secret_id;
end;
$$;

create or replace function public.noradocs_ler_refresh_token(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  select v.decrypted_secret into v_token
  from public.noradocs_google_tokens t
  join vault.decrypted_secrets v on v.id = t.secret_id
  where t.tenant_company_id = p_company_id;

  return v_token;
end;
$$;

revoke execute on function public.noradocs_guardar_refresh_token(uuid, text) from public;
revoke execute on function public.noradocs_ler_refresh_token(uuid) from public;
grant execute on function public.noradocs_guardar_refresh_token(uuid, text) to service_role;
grant execute on function public.noradocs_ler_refresh_token(uuid) to service_role;

-- Guarda: não deixa cair a coluna se alguma conexão ainda não foi convertida.
-- Sem isto, uma linha não migrada perderia o token para sempre — e o único
-- jeito de voltar seria o escritório reconectar o Google na mão.
do $$
declare v_orfas int;
begin
  select count(*) into v_orfas
  from public.noradocs_google_tokens
  where secret_id is null;
  if v_orfas > 0 then
    raise exception 'ha % conexao(oes) sem secret_id no Vault; converter antes de remover a coluna', v_orfas;
  end if;
end $$;

alter table public.noradocs_google_tokens drop column refresh_token;

alter table public.noradocs_google_tokens
  alter column secret_id set not null;

comment on table public.noradocs_google_tokens is
  'Vinculo entre o escritorio e o segredo do Vault que guarda o refresh_token do Google. O token em si nunca fica em claro aqui. RLS ligada sem policy: so service_role, e sempre pelas RPCs noradocs_guardar/ler/apagar_refresh_token.';
