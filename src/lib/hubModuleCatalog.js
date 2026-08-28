// Catálogo editável de categorias e ferramentas do hub (Admin/Sistemas →
// [sistema] → Módulos). Cada categoria pertence a um sistema (`system_slug`,
// FK para `systems`), e cada ferramenta pertence a uma categoria — os dois
// níveis que a tela de admin em 3 passos (sistema → módulo → ferramenta)
// percorre.
//
// Só a categoria "Fiscal" e a ferramenta "Calculadora de DIFAL" estão
// ligadas a uma página real no cliente (FiscalPage.jsx lê daqui). As demais
// categorias do hub continuam hardcoded nas próprias páginas — cadastrar
// aqui sem ligar o cliente correspondente criaria edição sem efeito.

import { supabase } from './supabase';

export async function listarCategorias(systemSlug) {
  const { data, error } = await supabase
    .from('hub_module_categorias')
    .select('*')
    .eq('system_slug', systemSlug)
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
 * Categorias + ferramentas ativas de um sistema, prontas para o hub
 * renderizar — só o que está `active` em ambos os níveis. Usada pelas
 * páginas de categoria do cliente (ex.: FiscalPage.jsx) para não depender
 * mais de uma lista hardcoded.
 */
export async function carregarCategoriaComFerramentas(systemSlug, categoriaSlug) {
  const categoria = await buscarCategoria(systemSlug, categoriaSlug);
  if (!categoria || !categoria.active) return null;
  const ferramentas = await listarFerramentas(categoria.id);
  return { categoria, ferramentas: ferramentas.filter((f) => f.active) };
}
