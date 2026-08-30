-- Layout do dashboard "Visão geral" do Admin, por usuário.
--
-- Coluna simples em profiles, não uma tabela nova: já existe
-- `profiles_update_own` (RLS: auth.uid() = id, sem restrição de coluna),
-- então cada admin lê/escreve o próprio layout com um select/update direto
-- — sem precisar de RPC nenhuma pra isso. `null` = ainda não personalizou,
-- a tela usa o layout padrão (definido em src/lib/adminDashboard.js).
--
-- Formato: { "widgets": [{ "id": "receita-mensal", "size": "lg" }, ...] } —
-- a ordem do array é a ordem de exibição; um widget fora do array está
-- removido do dashboard daquele admin.

alter table public.profiles add column if not exists dashboard_layout jsonb;
