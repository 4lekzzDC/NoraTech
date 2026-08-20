-- =========================================================================
-- Registra o NoraDocs na tabela `systems`
-- =========================================================================
-- `systems` é a fonte de verdade lida por fetchSystems() (src/lib/systems.js)
-- — e dela dependem tanto o card na Central de Controle (grade de sistemas
-- assinados, em AreaDoClientePage) quanto o dropdown de "atribuir sistema"
-- em /admin/empresas (ManageCompanyModal). O catálogo estático em código só
-- complementa `internal` e `url` para sistemas internos; ele não substitui
-- esta linha.
--
-- Sem isto, o NoraDocs era inalcançável por qualquer navegação do app —
-- só existia digitando a URL direto, e olhe lá: nenhum admin conseguia
-- atribuir uma assinatura, porque o produto nem aparecia na lista.
--
-- Idempotente: on conflict do nothing.
-- =========================================================================

insert into public.systems (slug, name, description, icon, color, url, internal, aliases, sort_order)
values (
  'noradocs',
  'NoraDocs',
  'Recebimento e organização automática de documentos: identifica cliente, competência e categoria e arquiva no Google Drive do escritório.',
  '🗂️',
  '#7C3AED',
  '/noradocs',
  true,
  '{}',
  3
)
on conflict (slug) do nothing;
