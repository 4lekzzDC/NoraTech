-- CORREÇÃO. As três RPCs do refresh_token estavam chamáveis por `anon`.
--
-- É o espelho exato da pegadinha de migration_20260825_fecha_execute_anon.sql,
-- e eu caí nas duas pontas dela.
--
-- Lá, o acesso vinha do grant implícito para PUBLIC e eu tentei revogar de
-- `anon` — não adiantou. Aqui é o contrário: este projeto tem default
-- privileges que concedem EXECUTE a `anon` e `authenticated` em toda função
-- nova criada em `public`. No momento do `create function`, os dois ganharam
-- um grant NOMINAL — na ACL aparece `anon=X/postgres`, não a entrada `=X` de
-- PUBLIC. E `revoke ... from public` não encosta em grant nominal: ele só
-- remove o do pseudo-papel PUBLIC. De novo revoguei o que não estava
-- concedendo, e de novo o efeito foi zero.
--
-- Consequência enquanto durou: `noradocs_ler_refresh_token(<uuid>)` respondia
-- em /rest/v1/rpc com a anon key — que é pública e está no bundle do
-- navegador — devolvendo o refresh_token do Google JÁ DESCRIPTOGRAFADO.
-- Cifrar no Vault não protege contra isso em nada: é a própria função que
-- descriptografa antes de devolver. Bastava conhecer o uuid da empresa.
--
-- A lição das duas vezes é a mesma, e é por isso que daqui em diante toda
-- revogação nomeia os três: um `revoke` só serve se mirar em quem de fato
-- detém o privilégio, e supor por onde o acesso entrou é o erro. Depois de
-- revogar, CONFERIR com has_function_privilege — foi o linter que pegou isto,
-- não a migração, porque eu tinha assumido que o revoke tinha funcionado.

revoke execute on function public.noradocs_guardar_refresh_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.noradocs_ler_refresh_token(uuid)           from public, anon, authenticated;
revoke execute on function public.noradocs_apagar_refresh_token(uuid)        from public, anon, authenticated;

grant execute on function public.noradocs_guardar_refresh_token(uuid, text) to service_role;
grant execute on function public.noradocs_ler_refresh_token(uuid)           to service_role;
grant execute on function public.noradocs_apagar_refresh_token(uuid)        to service_role;

-- As outras duas que já deviam estar trancadas, pelo mesmo motivo: elas também
-- nasceram sob as default privileges e podiam carregar o mesmo grant nominal.
revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

revoke execute on function public.noradocs_cliente_provisorio(uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.noradocs_cliente_provisorio(uuid, text, jsonb) to service_role;

-- Tira da API as três funções de trigger que sobraram publicadas. São
-- SECURITY INVOKER, então chamar por RPC não escala privilégio nenhum — só
-- estoura erro por falta de contexto de trigger. É ruído na superfície da API,
-- não buraco. Revogar não afeta os triggers, que não consultam o EXECUTE de
-- quem disparou a escrita.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_whatsapp_connections_updated_at() from public, anon, authenticated;
