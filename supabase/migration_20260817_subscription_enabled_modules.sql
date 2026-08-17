-- Permite ao admin liberar só uma parte dos módulos internos de um sistema
-- (hoje usado pelo hub Soluções Contábeis) numa assinatura específica —
-- caso de um cliente que quer pagar menos e usar só alguns módulos.
--
-- NULL (ou array vazio) = todos os módulos do sistema liberados. É o
-- comportamento padrão e preserva as assinaturas existentes, que nunca
-- tiveram esse controle e sempre deram acesso a tudo.
alter table public.subscriptions
  add column if not exists enabled_modules text[];

comment on column public.subscriptions.enabled_modules is
  'Slugs dos módulos internos liberados nesta assinatura (ex.: módulos do hub Soluções Contábeis). NULL/vazio = todos os módulos liberados (padrão).';
