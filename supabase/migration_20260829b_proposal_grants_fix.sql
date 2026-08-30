-- Fecha um furo de grant que migration_20260829_proposal_email.sql (e
-- migration_20260828_proposals.sql antes dela) deixou passar: o Supabase
-- registra `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role` no schema public, então toda função
-- nova nasce com EXECUTE liberado direto pra anon/authenticated — por FORA
-- do papel PUBLIC. `revoke execute ... from public` (o padrão usado nas
-- duas migrations de propostas) não desfaz esse grant direto: só um
-- `revoke ... from anon, authenticated` explícito desfaz.
--
-- Duas funções ficaram expostas por causa disso:
--
-- 1) svc_record_proposal_send — não tem checagem de admin nenhuma por
--    dentro (ela confia 100% em quem chama já ter sido conferido como admin
--    pela Edge Function, que é a única com o service_role key). Com anon
--    conseguindo chamar direto, qualquer um marcava qualquer proposta em
--    rascunho como "enviada" sem nenhum e-mail ter saído — exatamente o
--    buraco que essa migration inteira existe pra fechar.
--
-- 2) _apply_proposal_acceptance — cria/atualiza assinatura (`subscriptions`)
--    a partir dos itens de UMA proposta, sem checar status nem quem está
--    chamando. Com anon conseguindo chamar direto com um proposal_id
--    qualquer, dava pra ativar sistemas pagos pra qualquer empresa sem
--    passar por accept_proposal_by_token — sem sessão nenhuma.

revoke execute on function public.svc_record_proposal_send(uuid, uuid, boolean, text) from anon, authenticated;
revoke execute on function public._apply_proposal_acceptance(uuid) from anon, authenticated;

-- admin_save_proposal e admin_set_proposal_status já checam is_admin() por
-- dentro, então anon nunca conseguia fazer nada com o grant sobrando — mas
-- não custa fechar mesmo assim, pra não depender só da checagem interna.
revoke execute on function public.admin_save_proposal(uuid, uuid, text, date, text, numeric, numeric, text, jsonb) from anon;
revoke execute on function public.admin_set_proposal_status(uuid, text, text) from anon;
