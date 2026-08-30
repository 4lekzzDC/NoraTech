-- =========================================================================
-- Migração 28/08/2026 (parte 3) — sub-categorias de verdade + limpeza
--
-- Descoberta ao investigar o pedido do usuário: a página real do Contábil
-- (ContabilPage.jsx) não lista as 9 ferramentas direto — ela tem 4 abas
-- internas (Extrato, Fornecedores, Demonstrações, Fechamento), cada uma
-- com seu próprio grupo de ferramentas, hardcoded no array SUBCATS. É
-- dentro de "Fechamento" que Acompanhamento Contábil mora — exatamente o
-- exemplo que o usuário deu. Pra "mover pra Fechamento" fazer sentido de
-- verdade, essas 4 abas precisam virar categorias de verdade no banco,
-- filhas de Contábil.
--
-- `parent_categoria_id` (auto-referenciada) faz esse papel — null nas
-- categorias de topo (Contábil, Fiscal, Financeiro, Gestão, Pessoal),
-- preenchida nas 4 sub-categorias do Contábil.
--
-- Limpeza: Gestão de Clientes e Controle de Prazos tinham entrado no
-- catálogo por engano (migração anterior assumiu que eram cards de
-- categoria) — na real são atalhos fixos da tela principal do hub, sem
-- card em nenhuma grade de categoria. Confirmado com o usuário: saem do
-- catálogo, continuam como estão no código.
-- =========================================================================

alter table public.hub_module_categorias
  add column if not exists parent_categoria_id uuid references public.hub_module_categorias(id) on delete cascade;

-- Tira os dois atalhos fixos que não correspondem a nenhum card real.
delete from public.hub_module_ferramentas where slug in ('gestao-clientes', 'prazos');

-- Cria as 4 sub-categorias do Contábil.
insert into public.hub_module_categorias (system_slug, slug, name, icon, description, status, sort_order, parent_categoria_id)
select 'solucoes-contabeis', sub.slug, sub.name, sub.icon, sub.description, 'available', sub.ordem, c.id
from public.hub_module_categorias c,
  lateral (values
    ('extrato', 'Extrato', '🏦', 'Codificação, conciliação e transformação de extratos bancários.', 0),
    ('fornecedores', 'Fornecedores', '🚚', 'Conciliação e controle de pagamentos a fornecedores.', 1),
    ('demonstracoes', 'Demonstrações', '🥧', 'Análise de demonstrações contábeis e indicadores financeiros.', 2),
    ('fechamento', 'Fechamento', '📅', 'Controle mensal do fechamento contábil por empresa.', 3)
  ) as sub(slug, name, icon, description, ordem)
where c.system_slug = 'solucoes-contabeis' and c.slug = 'contabil' and c.parent_categoria_id is null
on conflict (system_slug, slug) do nothing;

-- Move as 7 ferramentas que já existiam sob Contábil pra sua aba de
-- verdade — a partir daqui, Contábil (o nó de topo) fica sem ferramenta
-- direta nenhuma, exatamente como a página real: tudo mora dentro de uma
-- das 4 abas.
update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'transformador-extrato' and sub.slug = 'extrato' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'codificador' and sub.slug = 'extrato' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'conciliador-extratos' and sub.slug = 'extrato' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'conciliador-fornecedores' and sub.slug = 'fornecedores' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'analise-demonstracoes' and sub.slug = 'demonstracoes' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'acompanhamento-contabil' and sub.slug = 'fechamento' and sub.parent_categoria_id is not null;

update public.hub_module_ferramentas f
set categoria_id = sub.id
from public.hub_module_categorias sub
where sub.system_slug = 'solucoes-contabeis'
  and f.slug = 'calculadora-irpj-csll' and sub.slug = 'fechamento' and sub.parent_categoria_id is not null;
