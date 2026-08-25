-- Fecha o EXECUTE do `anon` nas funções SECURITY DEFINER.
--
-- O PostgREST publica TODA função do schema `public` como endpoint em
-- /rest/v1/rpc/<nome>. Com a anon key — que é pública, está no bundle do
-- navegador e é para estar — qualquer pessoa na internet podia chamar 24
-- dessas funções sem nunca ter feito login.
--
-- A maioria não era explorável: `create_company`, `request_join_company` e as
-- de gestão de membro começam com `if auth.uid() is null then raise`, e as
-- `admin_*` passam por `is_admin()`, que é falso sem sessão. Mas "não é
-- explorável hoje" é uma propriedade do CORPO da função, e corpo muda. A
-- permissão é o que deveria estar segurando isso, e não estava.
--
-- Duas eram exploráveis de fato:
--
--   register_access_log  grava em access_logs com user_id = auth.uid(), que é
--                        NULL para anon. Sem sessão nenhuma dava para inserir
--                        linhas com IP, dispositivo, user agent e metadata
--                        arbitrários — poluir a trilha de auditoria, que é
--                        justamente o registro que se consulta depois de um
--                        incidente. E não é chamada em lugar nenhum do app.
--
--   generate_company_code  varre `companies` num laço até achar um código
--                        livre. Não vaza dado, mas é trabalho de banco de
--                        graça para quem não está logado.
--
-- REVOKE ... FROM anon NÃO RESOLVE, e é a pegadinha que fez a primeira versão
-- desta migração não ter efeito nenhum. O Postgres concede EXECUTE a PUBLIC
-- por padrão em toda função criada; `anon` recebia por ali, não por um grant
-- nominal. Na ACL isso aparece como a entrada `=X/postgres` — repare que as
-- funções já trancadas do NoraDocs (has_noradocs_access, check_rate_limit)
-- não têm essa entrada. O que tira o acesso é revogar de PUBLIC; depois se
-- devolve nominalmente a quem precisa.
--
-- O QUE NÃO É TOCADO, e por quê: os oito predicados usados dentro de policies
-- de RLS (is_admin, is_company_member, is_company_admin, is_company_owner,
-- shares_company_with, has_accounting_access, has_noradocs_access,
-- has_noradocs_manage) continuam com o grant de PUBLIC. 79 das 85 policies
-- são `TO public`, o que inclui `anon`: quando um cliente anônimo consulta a
-- tabela, o Postgres avalia a policy e chama a função. Sem EXECUTE, o que
-- hoje é "zero linhas" viraria "permission denied" — trocaríamos um vazamento
-- que não existe por uma quebra que existe. Chamados diretamente por anon
-- esses predicados devolvem false e não revelam nada.

begin;

-- ── Funções de trigger ──────────────────────────────────────────────────
-- Não são API: rodam pelo mecanismo de trigger, que não consulta o EXECUTE de
-- quem disparou a escrita. Estavam publicadas como RPC por acidente de
-- nascença — toda função em `public` é. Revogar não afeta os triggers, e por
-- isso nenhuma delas recebe grant de volta.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_invoice_creation() from public;
revoke execute on function public.touch_ticket_last_message() from public;

-- ── Auxiliar interna ────────────────────────────────────────────────────
-- Só `create_company` chama, e ela é SECURITY DEFINER: roda como dona
-- (postgres), então continua podendo chamar sem grant nominal. Ninguém de
-- fora tem motivo para gerar código de empresa.
revoke execute on function public.generate_company_code() from public;

-- ── Escreve na trilha de auditoria e não é usada pelo app ───────────────
-- `authenticated` volta, para não quebrar um chamador que a varredura do
-- código não tenha visto; o acesso sem sessão, que era o problema, não.
revoke execute on function public.register_access_log(text, text, text, text, text, jsonb) from public;
grant execute on function public.register_access_log(text, text, text, text, text, jsonb) to authenticated, service_role;

-- ── Ações que exigem sessão ─────────────────────────────────────────────
-- Todas já recusam sem `auth.uid()`. Agora recusam uma camada antes, na
-- permissão, em vez de dependerem de o corpo continuar checando para sempre.
revoke execute on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated, service_role;

revoke execute on function public.request_join_company(text) from public;
grant execute on function public.request_join_company(text) to authenticated, service_role;

revoke execute on function public.leave_company(uuid) from public;
grant execute on function public.leave_company(uuid) to authenticated, service_role;

revoke execute on function public.approve_member(uuid) from public;
grant execute on function public.approve_member(uuid) to authenticated, service_role;

revoke execute on function public.reject_member(uuid) from public;
grant execute on function public.reject_member(uuid) to authenticated, service_role;

revoke execute on function public.set_member_role(uuid, text) from public;
grant execute on function public.set_member_role(uuid, text) to authenticated, service_role;

revoke execute on function public.set_member_role(uuid, text, text) from public;
grant execute on function public.set_member_role(uuid, text, text) to authenticated, service_role;

revoke execute on function public.subscribe_to_system(uuid, text) from public;
grant execute on function public.subscribe_to_system(uuid, text) to authenticated, service_role;

-- ── Cobrança ────────────────────────────────────────────────────────────
revoke execute on function public.generate_company_invoices(date) from public;
grant execute on function public.generate_company_invoices(date) to authenticated, service_role;

revoke execute on function public.preview_company_invoice(uuid) from public;
grant execute on function public.preview_company_invoice(uuid) to authenticated, service_role;

-- ── Administração ───────────────────────────────────────────────────────
-- Protegidas por is_admin(), mas são as de maior dano se essa checagem algum
-- dia sair do corpo: apagar empresa cascateia tudo que pertence a ela.
revoke execute on function public.admin_create_company(text, uuid) from public;
grant execute on function public.admin_create_company(text, uuid) to authenticated, service_role;

revoke execute on function public.admin_update_company(uuid, text, uuid) from public;
grant execute on function public.admin_update_company(uuid, text, uuid) to authenticated, service_role;

revoke execute on function public.admin_delete_company(uuid) from public;
grant execute on function public.admin_delete_company(uuid) to authenticated, service_role;

commit;
