import { supabase } from '../../../lib/supabase';

// Consultas da caixa de entrada e do histórico. O isolamento entre
// escritórios é do RLS — nenhuma destas funções filtra por tenant à mão.

// As colunas que a caixa de entrada e o histórico precisam trazer.
//
// A lista é explícita e tem teste (documents.select.test.js) porque esquecer
// uma coluna aqui não dá erro em lugar nenhum: o campo chega `undefined`, e
// quem depende dele simplesmente decide errado, em silêncio.
//
// Foi o que aconteceu com `drive_file_id`. Ele ficou de fora desde a Etapa 7 e
// levou junto cinco comportamentos: a pré-visualização do arquivo nunca
// aparecia, o botão "Tentar novamente" nunca surgia, "conferir no Drive"
// respondia sempre que não havia arquivo — e, o pior, `confirmarDocumento`
// achava que não havia arquivo para mover, então gravava o caminho novo no
// banco e deixava o arquivo parado em _triagem. O banco dizia uma coisa, o
// Drive tinha outra, e nada acusava.
export const COLUNAS_DO_DOCUMENTO = [
  'id', 'file_name', 'mime_type', 'size_bytes', 'origem', 'status', 'competencia',
  'review_reason', 'matched', 'received_at', 'organized_at',
  // Do Drive: file_id manda em quase toda decisão da revisão; folder_id é o
  // ponto de partida da verificação; web_link é o atalho para abrir lá.
  'drive_file_id', 'drive_folder_id', 'drive_path', 'drive_web_link',
  // Do erro: sem a mensagem, o painel mostra "o arquivamento falhou" e cala
  // sobre o motivo.
  'error_message', 'retry_count',
];

const SELECT = `
  ${COLUNAS_DO_DOCUMENTO.join(', ')},
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
// contador procura ("o que arquivei para o cliente X entre estas datas?").
// O intervalo filtra por `received_at` (data de envio), não por competência:
// competência é o que o rótulo diz sobre o documento, `received_at` é quando
// ele de fato chegou — e todo documento tem a segunda, mesmo os que a
// classificação não conseguiu supor a primeira.
export async function listHistorico({ clientId = '', dataDe = '', dataAte = '', status = '', busca = '' } = {}) {
  let query = supabase
    .from('noradocs_documents')
    .select(SELECT)
    .in('status', ['organizado', 'descartado'])
    .order('organized_at', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
    .limit(300);

  if (clientId) query = query.eq('client_id', clientId);
  if (dataDe) query = query.gte('received_at', `${dataDe}T00:00:00`);
  if (dataAte) query = query.lte('received_at', `${dataAte}T23:59:59`);
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
