import { supabase } from '../../../lib/supabase';
import { formatCNPJ } from '../domain/cnpj';
import { resolveFolderPath } from '../domain/folderTemplate';

// Confirmação de um documento que caiu em revisão: o contador diz de quem é,
// de quando é e do que é, e o arquivo sai de _triagem para a pasta definitiva.
//
// O move no Drive é troca de pai, não cópia — o arquivo mantém id, link e
// histórico. É por isso que a etapa de revisão não custa nada em banda: os
// bytes já estão lá desde o envio.

async function invocarDrive(body) {
  const { data, error } = await supabase.functions.invoke('noradocs-drive', { body });
  if (error) {
    let mensagem = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const corpo = await error.context.json();
        if (corpo?.error) mensagem = corpo.error;
      } catch { /* corpo não era JSON */ }
    }
    throw new Error(mensagem);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function registrarEvento(tenantId, documentId, type, payload) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('noradocs_events').insert({
    tenant_company_id: tenantId,
    document_id: documentId,
    type,
    actor_type: 'user',
    actor_id: user?.id ?? null,
    payload,
  });
  return user;
}

/**
 * Confirma a classificação e arquiva o documento na pasta definitiva.
 *
 * @param {object} doc        o documento como veio do banco
 * @param {object} escolha    { clientId, competencia, categoryId }
 * @param {object} contexto   { tenantId, settings, clients, categories }
 */
export async function confirmarDocumento(doc, escolha, contexto) {
  const cliente = contexto.clients.find((c) => c.id === escolha.clientId);
  const categoria = contexto.categories.find((c) => c.id === escolha.categoryId);

  if (!cliente) throw new Error('Escolha o cliente antes de confirmar.');
  if (!categoria) throw new Error('Escolha a categoria antes de confirmar.');
  if (!escolha.competencia) throw new Error('Informe a competência antes de confirmar.');

  const segmentos = resolveFolderPath(contexto.settings.folder_template, {
    clienteNome: cliente.folder_name_override || cliente.nome,
    cnpj: cliente.cnpj ? formatCNPJ(cliente.cnpj) : '',
    competencia: escolha.competencia,
    categoriaNome: categoria.folder_name || categoria.nome,
  });

  const { folderId, path } = await invocarDrive({ action: 'ensure-folder-path', segments: segmentos });

  // Documento em erro pode não ter chegado ao Drive; nesse caso não há o que
  // mover, e confirmar só corrige os metadados.
  let webViewLink = doc.drive_web_link;
  if (doc.drive_file_id) {
    const movido = await invocarDrive({ action: 'move-file', fileId: doc.drive_file_id, folderId });
    webViewLink = movido.webViewLink || webViewLink;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: atualizado, error } = await supabase
    .from('noradocs_documents')
    .update({
      client_id: escolha.clientId,
      competencia: escolha.competencia,
      category_id: escolha.categoryId,
      status: 'organizado',
      review_reason: null,
      error_code: null,
      error_message: null,
      drive_folder_id: folderId,
      drive_path: path,
      drive_web_link: webViewLink,
      confirmed_by: user?.id ?? null,
      confirmed_at: new Date().toISOString(),
      organized_at: new Date().toISOString(),
    })
    .eq('id', doc.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await registrarEvento(contexto.tenantId, doc.id, 'confirmado', {
    client_id: escolha.clientId, competencia: escolha.competencia,
    category_id: escolha.categoryId, drive_path: path,
  });

  return atualizado;
}

export async function descartarDocumento(doc, tenantId) {
  const { error } = await supabase
    .from('noradocs_documents')
    .update({ status: 'descartado', review_reason: null })
    .eq('id', doc.id);
  if (error) throw new Error(error.message);

  await registrarEvento(tenantId, doc.id, 'descartado', { file_name: doc.file_name });
}

// Transforma uma correção em regra para os próximos.
//
// É o mecanismo de aprendizado do produto: sem IA, o que faz a fila de
// revisão encolher é o escritório ensinar o sistema.
export async function criarRegra({ tenantId, clientId, categoryId, pattern }) {
  const padrao = String(pattern || '').trim();
  if (!padrao) throw new Error('Informe o trecho do nome do arquivo que identifica este cliente.');

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('noradocs_client_rules')
    .insert({
      tenant_company_id: tenantId,
      client_id: clientId || null,
      category_id: categoryId || null,
      match_type: 'filename',
      pattern: padrao,
      source: 'learned',
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listarEventos(documentId) {
  const { data, error } = await supabase
    .from('noradocs_events')
    .select('id, type, actor_type, payload, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}
