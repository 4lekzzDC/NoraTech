import { supabase } from '../../../lib/supabase';

// Configurações do escritório que não envolvem o Google — template de pastas
// e as flags de automação. Escrita direta via supabase-js: RLS
// (has_noradocs_manage) já protege quem pode alterar, sem precisar de Edge
// Function nenhuma para isso.
//
// A linha de noradocs_settings sempre existe quando esta tela abre — o RPC
// noradocs_bootstrap (chamado por resolveTenant()) garante isso na primeira
// visita do escritório ao NoraDocs.

const SELECT = 'folder_template, auto_organize, keep_original_filename';

export async function fetchFolderSettings(tenantId) {
  const { data, error } = await supabase
    .from('noradocs_settings')
    .select(SELECT)
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveFolderTemplate(tenantId, template) {
  const { data, error } = await supabase
    .from('noradocs_settings')
    .update({ folder_template: template })
    .eq('tenant_company_id', tenantId)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
