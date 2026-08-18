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

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

// Acima disso o upload multipart deixa de ser confiável (é envio de uma
// tacada só, sem retomada) e o navegador precisa segurar tudo em memória.
// Documento contábil raramente chega perto: extrato costuma ter centenas de
// KB. Recusar com mensagem clara é melhor que travar no meio.
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

// Envia metadados e bytes numa requisição só, direto ao Google.
//
// É `uploadType=multipart`, não resumable, por um motivo concreto: a URL de
// sessão do upload resumable é servida por um host do Google (UploadServer)
// que NÃO devolve cabeçalhos CORS — o PUT do navegador morre em "Failed to
// fetch". O endpoint multipart responde CORS e aceita `authorization`.
// Medição e detalhe em docs/noradocs/spike-e0.md.
async function enviarArquivoAoDrive(accessToken, folderId, file) {
  const boundary = `noradocs-${crypto.randomUUID()}`;
  const metadados = JSON.stringify({ name: file.name, parents: [folderId] });
  const mime = file.type || 'application/octet-stream';

  const corpo = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadados}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: corpo,
    },
  );

  if (!res.ok) {
    const detalhe = await res.text().catch(() => '');
    throw new Error(`O Google recusou o envio do arquivo (${res.status}). ${detalhe.slice(0, 200)}`);
  }
  return res.json();
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

  if (file.size > TAMANHO_MAXIMO) {
    throw new Error(`Arquivo maior que ${Math.round(TAMANHO_MAXIMO / 1024 / 1024)} MB — ainda não suportado.`);
  }

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
  const { data: { user } } = await supabase.auth.getUser();

  // O documento é gravado ANTES de tocar o Drive, em 'processando'.
  //
  // A ordem inversa parecia mais limpa — gravar só o que deu certo — mas
  // apagava a falha: se o envio quebrasse, a exceção subia sem deixar
  // registro, o erro vivia num toast e sumia no primeiro F5. A aba "Erro"
  // nunca teria nada, e o contador não teria como saber o que faltou
  // arquivar. Gravar antes torna a falha um fato do sistema, não um aviso
  // passageiro.
  const { data: documento, error: erroInsert } = await supabase
    .from('noradocs_documents')
    .insert({
      tenant_company_id: tenantId,
      origem: 'upload_manual',
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      content_hash: contentHash,
      uploaded_by: user?.id ?? null,
      status: 'processando',
      client_id: resultado.clientId,
      competencia: resultado.competencia,
      category_id: resultado.categoryId,
      matched: {
        evidence: resultado.evidence,
        suposicoes: resultado.suposicoes,
        pendencias: resultado.pendencias,
      },
      review_reason: resultado.motivoRevisao,
    })
    .select()
    .single();
  if (erroInsert) throw new Error(erroInsert.message);

  await supabase.from('noradocs_events').insert({
    tenant_company_id: tenantId, document_id: documento.id, type: 'recebido',
    actor_type: 'user', actor_id: user?.id ?? null,
    payload: { file_name: file.name, size_bytes: file.size },
  });

  try {
    etapa('enviando');
    const segmentos = organizar
      ? resolveFolderPath(settings.folder_template, contextoDoTemplate(resultado, contexto))
      : [];

    const { folderId, path } = await invocarDrive({
      action: 'ensure-folder-path',
      segments: segmentos,
      staging: !organizar,
    });

    const { accessToken } = await invocarDrive({ action: 'upload-token' });
    const arquivoNoDrive = await enviarArquivoAoDrive(accessToken, folderId, file);

    etapa('gravando');
    const { data: finalizado, error } = await supabase
      .from('noradocs_documents')
      .update({
        status: organizar ? 'organizado' : 'revisar',
        drive_file_id: arquivoNoDrive.id ?? null,
        drive_folder_id: folderId,
        drive_path: path,
        drive_web_link: arquivoNoDrive.webViewLink ?? null,
        organized_at: organizar ? new Date().toISOString() : null,
      })
      .eq('id', documento.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Histórico e auditoria não podem derrubar um envio que já concluiu: o
    // arquivo está no Drive e o documento está no banco. Vira aviso.
    await Promise.all([
      supabase.from('noradocs_events').insert({
        tenant_company_id: tenantId, document_id: documento.id,
        type: organizar ? 'organizado' : 'revisao_solicitada',
        actor_type: 'system',
        payload: { evidence: resultado.evidence, drive_path: path, motivo: resultado.motivoRevisao },
      }),
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

    return finalizado;
  } catch (err) {
    // A falha vira estado do documento, com a causa em texto. O contador vê
    // na aba "Erro" o que não foi arquivado e por quê — e pode agir.
    await supabase
      .from('noradocs_documents')
      .update({ status: 'erro', error_message: err.message, retry_count: (documento.retry_count || 0) + 1 })
      .eq('id', documento.id);

    await supabase.from('noradocs_events').insert({
      tenant_company_id: tenantId, document_id: documento.id, type: 'erro',
      actor_type: 'system', payload: { mensagem: err.message },
    });

    throw err;
  }
}
