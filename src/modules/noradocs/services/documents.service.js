import { supabase } from '../../../lib/supabase';

// Consultas da caixa de entrada e do histórico. O isolamento entre
// escritórios é do RLS — nenhuma destas funções filtra por tenant à mão.

const SELECT = `
  id, file_name, mime_type, size_bytes, origem, status, competencia,
  review_reason, matched, drive_path, drive_web_link, received_at, organized_at,
  client:noradocs_clients ( id, nome ),
  category:noradocs_categories ( id, nome )
`;

// Status que a caixa de entrada mostra: o que ainda exige alguma ação.
// 'organizado' e 'descartado' vivem no Histórico (Etapa 7).
export const STATUS_INBOX = ['revisar', 'processando', 'erro'];

export async function listDocuments({ status = null, limite = 200 } = {}) {
  let query = supabase
    .from('noradocs_documents')
    .select(SELECT)
    .order('received_at', { ascending: false })
    .limit(limite);

  if (status) query = query.eq('status', status);
  else query = query.in('status', STATUS_INBOX);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function countByStatus() {
  const { data, error } = await supabase
    .from('noradocs_documents')
    .select('status')
    .in('status', STATUS_INBOX);
  if (error) return {};
  return (data || []).reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});
}

// Contexto que o motor de regras precisa: o cadastro do escritório. Só o que
// está ativo participa da classificação.
export async function fetchContextoDeClassificacao() {
  const [clients, categories, rules] = await Promise.all([
    supabase.from('noradocs_clients')
      .select('id, nome, cnpj, cpf, aliases, ativo, folder_name_override').eq('ativo', true),
    supabase.from('noradocs_categories')
      .select('id, slug, nome, folder_name, keywords, ativo').eq('ativo', true).order('ordem'),
    supabase.from('noradocs_client_rules')
      .select('id, client_id, category_id, match_type, pattern, priority, ativo').eq('ativo', true),
  ]);
  return {
    clients: clients.data || [],
    categories: categories.data || [],
    rules: rules.data || [],
  };
}

// Histórico: o que já saiu da fila. Filtros combinam por AND — é assim que o
// contador procura ("o que arquivei para o cliente X em agosto?").
export async function listHistorico({ clientId = '', competencia = '', status = '', busca = '' } = {}) {
  let query = supabase
    .from('noradocs_documents')
    .select(SELECT)
    .in('status', ['organizado', 'descartado'])
    .order('organized_at', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
    .limit(300);

  if (clientId) query = query.eq('client_id', clientId);
  if (competencia) query = query.eq('competencia', competencia);
  if (status) query = query.eq('status', status);

  // Mesma precaução do cadastro de clientes: vírgula e parênteses são
  // separadores na sintaxe do PostgREST e quebrariam o filtro.
  const termo = busca.trim().replace(/[,()]/g, ' ').trim();
  if (termo) query = query.ilike('file_name', `%${termo}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSettingsCompletas(tenantId) {
  const { data } = await supabase
    .from('noradocs_settings')
    .select('folder_template, auto_organize, keep_original_filename, drive_root_folder_id, drive_root_folder_name')
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  return data;
}
