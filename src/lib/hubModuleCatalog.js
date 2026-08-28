// Catálogo editável de categorias e ferramentas do hub (Admin/Sistemas →
// [sistema] → Estrutura). Uma categoria pertence a um sistema (`system_slug`)
// e, opcionalmente, a uma categoria-pai (`parent_categoria_id`, auto-
// referenciada) — é assim que os módulos internos de uma categoria (ex.:
// as abas Extrato/Fornecedores/Demonstrações/Fechamento, dentro de
// Contábil) viram sub-categorias de verdade, editáveis e não só um array
// fixo na página. Cada ferramenta pertence a uma categoria (de topo ou
// sub-categoria — para o motor de dados as duas são a mesma tabela).
//
// Categorias ligadas a uma página real no cliente hoje: Fiscal
// (FiscalPage.jsx), Contábil e suas 4 sub-categorias (ContabilPage.jsx) e
// Pessoal (PessoalPage.jsx). Financeiro e Gestão ainda não têm ferramenta
// nem página própria — existem só como categoria reservada.

import { supabase } from './supabase';

/**
 * @param {string} systemSlug
 * @param {{ apenasRaiz?: boolean }} [opcoes] apenasRaiz=true devolve só as
 *   categorias de topo (parent_categoria_id nulo) — o que a árvore do
 *   admin usa como primeiro nível.
 */
export async function listarCategorias(systemSlug, { apenasRaiz = false } = {}) {
  let query = supabase
    .from('hub_module_categorias')
    .select('*')
    .eq('system_slug', systemSlug)
    .order('sort_order', { ascending: true });
  if (apenasRaiz) query = query.is('parent_categoria_id', null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listarSubcategorias(parentCategoriaId) {
  const { data, error } = await supabase
    .from('hub_module_categorias')
    .select('*')
    .eq('parent_categoria_id', parentCategoriaId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function buscarCategoria(systemSlug, categoriaSlug) {
  const { data, error } = await supabase
    .from('hub_module_categorias')
    .select('*')
    .eq('system_slug', systemSlug)
    .eq('slug', categoriaSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvarCategoria(categoria, id = null) {
  const payload = {
    system_slug: categoria.systemSlug,
    slug: categoria.slug,
    name: categoria.name,
    icon: categoria.icon || null,
    description: categoria.description || null,
    status: categoria.status || 'available',
    active: categoria.active !== false,
    sort_order: Number(categoria.sortOrder) || 0,
    parent_categoria_id: categoria.parentCategoriaId || null,
  };
  const query = id
    ? supabase.from('hub_module_categorias').update(payload).eq('id', id)
    : supabase.from('hub_module_categorias').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function excluirCategoria(id) {
  const { error } = await supabase.from('hub_module_categorias').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listarFerramentas(categoriaId) {
  const { data, error } = await supabase
    .from('hub_module_ferramentas')
    .select('*')
    .eq('categoria_id', categoriaId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function buscarFerramenta(categoriaId, ferramentaSlug) {
  const { data, error } = await supabase
    .from('hub_module_ferramentas')
    .select('*')
    .eq('categoria_id', categoriaId)
    .eq('slug', ferramentaSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvarFerramenta(ferramenta, id = null) {
  const payload = {
    categoria_id: ferramenta.categoriaId,
    slug: ferramenta.slug,
    name: ferramenta.name,
    icon: ferramenta.icon || null,
    color: ferramenta.color || null,
    description: ferramenta.description || null,
    status: ferramenta.status || 'available',
    active: ferramenta.active !== false,
    sort_order: Number(ferramenta.sortOrder) || 0,
  };
  const query = id
    ? supabase.from('hub_module_ferramentas').update(payload).eq('id', id)
    : supabase.from('hub_module_ferramentas').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function excluirFerramenta(id) {
  const { error } = await supabase.from('hub_module_ferramentas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Grava só categoria e posição de uma ferramenta — o que o arrastar-e-
 * soltar da árvore precisa (reordenar uma lista, ou mover pra outra
 * categoria), sem reenviar nome/ícone/descrição que o chamador não tem à
 * mão nesse momento.
 */
export async function moverFerramenta(id, { categoriaId, sortOrder }) {
  const { error } = await supabase
    .from('hub_module_ferramentas')
    .update({ categoria_id: categoriaId, sort_order: sortOrder })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Categoria + ferramentas ativas, prontas para uma página de categoria
 * simples (sem sub-categorias) renderizar — ex.: FiscalPage.jsx,
 * PessoalPage.jsx. Devolve null se a categoria não existe ou está oculta.
 */
export async function carregarCategoriaComFerramentas(systemSlug, categoriaSlug) {
  const categoria = await buscarCategoria(systemSlug, categoriaSlug);
  if (!categoria || !categoria.active) return null;
  const ferramentas = await listarFerramentas(categoria.id);
  return { categoria, ferramentas: ferramentas.filter((f) => f.active) };
}

/**
 * Categoria de topo + suas sub-categorias, cada uma já com suas
 * ferramentas ativas — o que uma página com abas internas (ex.:
 * ContabilPage.jsx) precisa pra montar essas abas a partir do banco em
 * vez de um array fixo. Devolve null se a categoria não existe ou está
 * oculta; sub-categorias ocultas são filtradas, categorias sem nenhuma
 * sub-categoria ativa devolvem `subcategorias: []`.
 */
export async function carregarCategoriaComSubcategorias(systemSlug, categoriaSlug) {
  const categoria = await buscarCategoria(systemSlug, categoriaSlug);
  if (!categoria || !categoria.active) return null;
  const [ferramentasDiretas, subs] = await Promise.all([
    listarFerramentas(categoria.id),
    listarSubcategorias(categoria.id),
  ]);
  const subcategorias = await Promise.all(
    subs.filter((s) => s.active).map(async (sub) => ({
      categoria: sub,
      ferramentas: (await listarFerramentas(sub.id)).filter((f) => f.active),
    })),
  );
  return {
    categoria,
    ferramentasDiretas: ferramentasDiretas.filter((f) => f.active),
    subcategorias,
  };
}
