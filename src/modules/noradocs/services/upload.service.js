import { supabase } from '../../../lib/supabase';
import { sha256Hex } from '../domain/hash';
import { formatCNPJ } from '../domain/cnpj';
import { resolveFolderPath } from '../domain/folderTemplate';
import { classificar, RULES_VERSION } from '../domain/rules';
import { extrairTexto } from './pdfText';

// Orquestra a jornada de um arquivo, do drop até o Drive.
//
// A ordem importa e não é acidental: classificar ANTES de enviar é o que
// permite ao documento identificado nascer já na pasta final, sem etapa de
// mover. Só o duvidoso passa por _triagem — e é lá que ele espera a revisão.
//
// Nenhum byte do documento passa por servidor da NoraTech: o navegador lê o
// arquivo, decide o destino e envia direto ao Google usando uma URL de sessão
// que a Edge Function emitiu. O Supabase recebe só metadados.

async function invocarDrive(body) {
  const { data, error } = await supabase.functions.invoke('noradocs-drive', { body });
  if (error) {
    // A mensagem real vem no corpo da resposta; sem ler o context, o
    // supabase-js entrega só "non-2xx status code".
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

// Envia os bytes direto ao Google. Sem cabeçalho Authorization: a URL de
// sessão já é a credencial, e o preflight CORS do Drive só libera
// content-type e content-range (ver docs/noradocs/spike-e0.md).
async function enviarBytes(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`O Google recusou o envio do arquivo (${res.status}). ${corpo.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

// Monta o contexto que o template de pastas espera a partir do que as regras
// identificaram. Os nomes vêm do cadastro, não do arquivo: é o cadastro que
// define como a pasta do cliente se chama.
function contextoDoTemplate(resultado, contexto) {
  const cliente = contexto.clients.find((c) => c.id === resultado.clientId);
  const categoria = contexto.categories.find((c) => c.id === resultado.categoryId);
  return {
    clienteNome: cliente?.folder_name_override || cliente?.nome || '',
    cnpj: cliente?.cnpj ? formatCNPJ(cliente.cnpj) : '',
    competencia: resultado.competencia || '',
    categoriaNome: categoria?.folder_name || categoria?.nome || '',
    tipo: resultado.docType || '',
  };
}

/**
 * Processa um arquivo ponta a ponta.
 *
 * @param {File} file
 * @param {object} opts { tenantId, settings, contexto: {clients, categories, rules}, onEtapa }
 * @returns {Promise<object>} a linha gravada em noradocs_documents
 */
export async function processarArquivo(file, { tenantId, settings, contexto, onEtapa }) {
  const etapa = (nome) => onEtapa?.(nome);

  etapa('lendo');
  const buffer = await file.arrayBuffer();
  const contentHash = await sha256Hex(buffer);

  // Deduplicação antes de qualquer trabalho: se este arquivo já existe, não
  // há por que extrair texto, criar pasta nem gastar uma sessão de upload.
  const { data: jaExiste } = await supabase
    .from('noradocs_documents')
    .select('id, file_name, status')
    .eq('tenant_company_id', tenantId)
    .eq('content_hash', contentHash)
    .neq('status', 'descartado')
    .maybeSingle();
  if (jaExiste) {
    const erro = new Error(`Este arquivo já foi recebido antes, como "${jaExiste.file_name}".`);
    erro.code = 'duplicado';
    erro.documentoExistente = jaExiste;
    throw erro;
  }

  etapa('lendo');
  const texto = await extrairTexto(file, buffer);

  etapa('classificando');
  const resultado = classificar(
    { fileName: file.name, text: texto, mimeType: file.type, sizeBytes: file.size, receivedAt: new Date() },
    contexto,
  );

  const organizar = resultado.decisao === 'organizar' && settings.auto_organize !== false;

  etapa('enviando');
  const segmentos = organizar
    ? resolveFolderPath(settings.folder_template, contextoDoTemplate(resultado, contexto))
    : [];

  const { folderId, path } = await invocarDrive({
    action: 'ensure-folder-path',
    segments: segmentos,
    staging: !organizar,
  });

  const { uploadUrl } = await invocarDrive({
    action: 'upload-session',
    folderId,
    fileName: file.name,
    mimeType: file.type,
  });

  const arquivoNoDrive = await enviarBytes(uploadUrl, file);

  etapa('gravando');
  const { data: { user } } = await supabase.auth.getUser();

  const { data: documento, error } = await supabase
    .from('noradocs_documents')
    .insert({
      tenant_company_id: tenantId,
      origem: 'upload_manual',
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      content_hash: contentHash,
      uploaded_by: user?.id ?? null,
      status: organizar ? 'organizado' : 'revisar',
      client_id: resultado.clientId,
      competencia: resultado.competencia,
      category_id: resultado.categoryId,
      matched: {
        evidence: resultado.evidence,
        suposicoes: resultado.suposicoes,
        pendencias: resultado.pendencias,
      },
      review_reason: resultado.motivoRevisao,
      drive_file_id: arquivoNoDrive.id ?? null,
      drive_folder_id: folderId,
      drive_path: path,
      drive_web_link: arquivoNoDrive.webViewLink ?? null,
      organized_at: organizar ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Histórico e auditoria são append-only e não podem derrubar um upload que
  // já concluiu: o arquivo está no Drive e o documento está no banco. Falhar
  // aqui vira aviso no console, não erro para o usuário.
  await Promise.all([
    supabase.from('noradocs_events').insert([
      { tenant_company_id: tenantId, document_id: documento.id, type: 'recebido',
        actor_type: 'user', actor_id: user?.id ?? null,
        payload: { file_name: file.name, size_bytes: file.size } },
      { tenant_company_id: tenantId, document_id: documento.id,
        type: organizar ? 'organizado' : 'revisao_solicitada',
        actor_type: 'system',
        payload: { evidence: resultado.evidence, drive_path: path, motivo: resultado.motivoRevisao } },
    ]),
    supabase.from('noradocs_classification_runs').insert({
      tenant_company_id: tenantId,
      document_id: documento.id,
      method: 'rules',
      rules_version: RULES_VERSION,
      input_summary: { file_name: file.name, mime_type: file.type, size_bytes: file.size, tinha_texto: Boolean(texto) },
      output: {
        client_id: resultado.clientId, competencia: resultado.competencia,
        category_id: resultado.categoryId, decisao: resultado.decisao,
        evidence: resultado.evidence, pendencias: resultado.pendencias,
      },
    }),
  ]).catch((err) => console.warn('[noradocs] falha ao gravar histórico:', err?.message));

  return documento;
}
