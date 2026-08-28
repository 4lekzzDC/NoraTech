-- =========================================================================
-- Migração 28/08/2026 (parte 2) — completa o catálogo de módulos do NoraHub
--
-- A migração anterior só semeou Fiscal + Calculadora de DIFAL, porque era a
-- única categoria cujo cliente (FiscalPage.jsx) lia deste catálogo — as
-- outras ficaram de fora pra não criar edição sem efeito no admin. Pedido
-- explícito do usuário para incluir as demais mesmo assim: catalogam-se
-- Contábil (com as 9 ferramentas já existentes no hub), Pessoal (1
-- ferramenta, ainda "em breve"), Financeiro e Gestão (categorias vazias,
-- reservadas para quando ganharem ferramentas).
--
-- Importante: só a categoria Fiscal está com o cliente (FiscalPage.jsx)
-- ligado a este catálogo. A página de Contábil (ContabilPage.jsx) é um
-- dashboard próprio, bem mais complexo que uma grade simples — continua
-- lendo do HUB_MODULES hardcoded; editar as ferramentas dela aqui atualiza
-- o catálogo administrável, mas ainda não muda o que aparece na página real
-- até uma migração equivalente à do Fiscal ser feita nela.
-- =========================================================================

insert into public.hub_module_categorias (system_slug, slug, name, icon, description, status, sort_order)
values
  ('solucoes-contabeis', 'contabil', 'Contábil', '📒', 'Grade dos módulos contábeis.', 'available', 0),
  ('solucoes-contabeis', 'financeiro', 'Financeiro', '💸', 'Grade dos módulos financeiros.', 'soon', 20),
  ('solucoes-contabeis', 'gestao', 'Gestão', '🗂️', 'Grade dos módulos de gestão.', 'soon', 30),
  ('solucoes-contabeis', 'pessoal', 'Pessoal', '👤', 'Grade dos módulos de RH e pessoal.', 'soon', 40)
on conflict (system_slug, slug) do nothing;

insert into public.hub_module_ferramentas (categoria_id, slug, name, icon, color, description, status, sort_order)
select id, ferramenta.slug, ferramenta.name, ferramenta.icon, '#7C3AED', ferramenta.description, 'available', ferramenta.ordem
from public.hub_module_categorias,
  lateral (values
    ('acompanhamento-contabil', 'Acompanhamento Contábil', '📊', 'Status mensal por empresa: arquivos, conciliação e prazos.', 0),
    ('codificador', 'Codificador de Arquivos', '🔢', 'Aplicação de regras e parsing de arquivos contábeis.', 1),
    ('conciliador-extratos', 'Conciliador de Extratos', '🧮', 'Conciliação automática de extratos bancários.', 2),
    ('conciliador-fornecedores', 'Conciliador de Fornecedores', '🤝', 'Conciliação de relatórios de fornecedores.', 3),
    ('gestao-clientes', 'Gestão de Clientes', '🏢', 'CRM dos clientes do escritório contábil.', 4),
    ('prazos', 'Controle de Prazos', '⏰', 'Tarefas, vencimentos e alertas por empresa.', 5),
    ('analise-demonstracoes', 'Análise de Demonstrações', '📈', 'Indicadores financeiros e gráficos analíticos.', 6),
    ('transformador-extrato', 'Transformador de Extrato', '🔄', 'Conversão de extratos entre formatos.', 7),
    ('calculadora-irpj-csll', 'Calculadora de IRPJ e CSLL', '🧮', 'Apuração trimestral no Lucro Presumido e no Lucro Real.', 8)
  ) as ferramenta(slug, name, icon, description, ordem)
where hub_module_categorias.system_slug = 'solucoes-contabeis' and hub_module_categorias.slug = 'contabil'
on conflict (categoria_id, slug) do nothing;

insert into public.hub_module_ferramentas (categoria_id, slug, name, icon, color, description, status, sort_order)
select id, 'controle-funcionarios', 'Controle dos funcionários', '🪪', '#7C3AED',
  'Gerencie admissões, demissões, férias e obrigações trabalhistas dos funcionários.',
  'soon', 0
from public.hub_module_categorias
where system_slug = 'solucoes-contabeis' and slug = 'pessoal'
on conflict (categoria_id, slug) do nothing;
