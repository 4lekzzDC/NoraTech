import { supabase } from '../../../lib/supabase';
import { normalizar } from '../domain/texto';

const SELECT = 'id, slug, nome, folder_name, ordem, ativo, keywords';

function slugFromNome(nome) {
  return normalizar(nome).replace(/\s+/g, '-');
}

function translateError(error) {
  if (error?.code === '23505') {
    return new Error('Já existe uma categoria com esse nome neste escritório.');
  }
  return new Error(error?.message || 'Não foi possível salvar a categoria.');
}

export async function listCategories(tenantId) {
  const { data, error } = await supabase
    .from('noradocs_categories')
    .select(SELECT)
    .eq('tenant_company_id', tenantId)
    .order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createCategory(tenantId, nome) {
  const nomeLimpo = String(nome || '').trim();
  if (!nomeLimpo) throw new Error('Informe o nome da categoria.');

  const { data: existentes } = await supabase
    .from('noradocs_categories')
    .select('ordem')
    .eq('tenant_company_id', tenantId)
    .order('ordem', { ascending: false })
    .limit(1);
  const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1;

  const { data, error } = await supabase
    .from('noradocs_categories')
    .insert({
      tenant_company_id: tenantId,
      nome: nomeLimpo,
      slug: slugFromNome(nomeLimpo),
      ordem: proximaOrdem,
      keywords: [],
    })
    .select(SELECT)
    .single();
  if (error) throw translateError(error);
  return data;
}

export async function updateCategory(id, patch) {
  const { data, error } = await supabase
    .from('noradocs_categories')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw translateError(error);
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('noradocs_categories').delete().eq('id', id);
  if (error) throw translateError(error);
}
