import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classificar, RULES_VERSION } from './domain/rules.js';
import { resolveFolderPath } from './domain/folderTemplate.js';
import { decidirDestino } from './domain/destino.js';
import { formatCNPJ } from './domain/cnpj.js';
import { empresaDoRemetente } from './domain/remetente.js';
import { mesclarReclassificacao } from './domain/reclassificacao.js';
import { extrairTextoDePdf } from './pdfTexto.js';

// A porta de entrada automática do NoraDocs. Quem bate nela hoje é o
// complemento do Gmail; qualquer outra origem futura (portal, WhatsApp) entra
// pelo mesmo lugar.
//
// Duas ações, e a divisão entre elas é o coração do desenho:
//
//   preparar  classifica, decide o destino, grava o documento e devolve uma
//             URL de upload de USO ÚNICO, já autorizada para aquele arquivo
//             naquela pasta
//   concluir  registra que os bytes chegaram
//
// Por que a URL de sessão, e não um access_token do Drive: um token daria a
// quem o tivesse acesso de leitura a TODOS os arquivos que o NoraDocs já criou
// para aquele escritório. A URI de sessão resumable só serve para criar aquele
// arquivo, naquela pasta, uma vez — e não precisa de cabeçalho de autorização
// no PUT, porque ela própria carrega a autorização.
//
// É, aliás, exatamente o desenho que a E0 tentou usar no navegador e teve de
// abandonar: a URL de sessão é servida por um host do Google que não responde
// CORS. O complemento do Gmail não é navegador — o UrlFetchApp do Apps Script
// é servidor, e CORS não se aplica. O que morreu lá vive aqui.
//
// Esta é a ÚNICA função do produto com verify_jwt: false. O token de entrada É
// a autenticação, e por isso ele não pode render nada além de "acrescente um
// documento a esta caixa de entrada".
//
// Desenho em docs/noradocs/etapa2-gmail.md.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const VERIFICACAO_FOLDER_NAME = '_verificação';

// Anexo de e-mail não passa de 25 MB (limite do próprio Gmail). O teto aqui é
// sobre o tamanho DECLARADO — os bytes nunca passam por esta função.
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

// Teto por hora e por escritório. Não é cota de produto, é contenção: se um
// token vazar, isto é o que impede a fila de revisão de receber dez mil itens
// antes de alguém perceber.
const LIMITE_POR_HORA = 300;


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(texto: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  return { ok: res.ok, data: await res.json() };
}

// Idêntica à de noradocs-drive, e pelo mesmo motivo: todo valor que entra numa
// query do Drive vem de fora, inclusive os que "sempre" são ids.
function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function ensureChildFolder(accessToken: string, parentId: string, name: string) {
  const q = `'${escapeDriveQuery(parentId)}' in parents and name='${escapeDriveQuery(name)}' `
    + `and mimeType='${FOLDER_MIME}' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)`
    + '&supportsAllDrives=true&includeItemsFromAllDrives=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const found = await searchRes.json().catch(() => ({ files: [] }));
  if (found.files?.[0]?.id) return found.files[0].id as string;

  const createRes = await fetch(`${DRIVE_FILES_URL}?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!createRes.ok) {
    throw new Error(`Falha ao criar a pasta "${name}" no Drive: ${createRes.status}`);
  }
  return (await createRes.json()).id as string;
}

// Caminha a árvore a partir de uma das três bases, com o mesmo cache e a mesma
// convenção de chave de noradocs-drive: o prefixo da base entra na chave,
// senão "Aurora/2026/08" em _verificação reusaria o id da pasta homônima na
// raiz e o documento iria para a árvore errada.
async function resolverPasta(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  tenantId: string,
  base: 'raiz' | 'triagem' | 'verificacao',
  segments: string[],
) {
  const { data: settings } = await admin
    .from('noradocs_settings')
    .select('drive_root_folder_id, drive_staging_folder_id, drive_verificacao_folder_id')
    .eq('tenant_company_id', tenantId)
    .maybeSingle();

  if (!settings?.drive_root_folder_id) {
    throw new Error('O escritório ainda não escolheu a pasta raiz no Google Drive.');
  }

  let rootId: string | null = {
    raiz: settings.drive_root_folder_id,
    triagem: settings.drive_staging_folder_id,
    verificacao: settings.drive_verificacao_folder_id,
  }[base] ?? null;

  if (!rootId && base === 'verificacao') {
    rootId = await ensureChildFolder(accessToken, settings.drive_root_folder_id, VERIFICACAO_FOLDER_NAME);
    await admin.from('noradocs_settings')
      .update({ drive_verificacao_folder_id: rootId })
      .eq('tenant_company_id', tenantId);
  }
  if (!rootId) throw new Error('A pasta de trabalho do escritório não foi encontrada no Drive.');

  if (base === 'triagem' || segments.length === 0) return { folderId: rootId, path: null };

  const path = segments.join('/');
  const pathExibido = base === 'verificacao' ? `${VERIFICACAO_FOLDER_NAME}/${path}` : path;

  let parentId = rootId;
  const acumulado: string[] = [];
  for (const segment of segments) {
    acumulado.push(segment);
    const chave = base === 'raiz' ? acumulado.join('/') : `${base}:${acumulado.join('/')}`;

    const { data: cache } = await admin
      .from('noradocs_drive_folders')
      .select('drive_folder_id')
      .eq('tenant_company_id', tenantId)
      .eq('path', chave)
      .maybeSingle();

    if (cache?.drive_folder_id) { parentId = cache.drive_folder_id; continue; }

    parentId = await ensureChildFolder(accessToken, parentId, segment);
    await admin.from('noradocs_drive_folders').upsert(
      { tenant_company_id: tenantId, path: chave, drive_folder_id: parentId },
      { onConflict: 'tenant_company_id,path' },
    );
  }

  return { folderId: parentId, path: pathExibido };
}

// Abre a sessão de upload e devolve a URL. A partir daqui, quem tiver a URL
// pode enviar AQUELE arquivo para AQUELA pasta, uma vez, e nada mais.
async function abrirSessaoDeUpload(
  accessToken: string, folderId: string, fileName: string, mimeType: string, sizeBytes: number,
) {
  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(sizeBytes),
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });
  const uploadUrl = res.headers.get('Location');
  if (!res.ok || !uploadUrl) {
    const detalhe = await res.text().catch(() => '');
    throw new Error(`O Google recusou abrir a sessão de upload (${res.status}). ${detalhe.slice(0, 200)}`);
  }
  return uploadUrl;
}


Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não suportado' }, 405);

  // Cabeçalho próprio, não Authorization: este token não é um JWT e não tem
  // nada a ver com a sessão do Supabase. Misturar os dois convida a confusão
  // do tipo "por que meu login não funciona aqui".
  const tokenBruto = req.headers.get('X-NoraDocs-Token') || '';
  if (!tokenBruto.startsWith('ndin_')) {
    return json({ error: 'Token de entrada ausente ou malformado.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '';
  if (!clientId || !clientSecret) {
    return json({ error: 'A integração com o Google não está configurada neste ambiente.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenRow } = await admin
    .from('noradocs_inbound_tokens')
    .select('id, tenant_company_id, revoked_at')
    .eq('token_hash', await sha256Hex(tokenBruto))
    .maybeSingle();

  // Mesma resposta para token inexistente e token revogado: dizer qual dos
  // dois é confirmaria para quem sonda que aquele valor já existiu.
  if (!tokenRow || tokenRow.revoked_at) {
    return json({ error: 'Token de entrada inválido ou revogado.' }, 401);
  }
  const tenantId = tokenRow.tenant_company_id as string;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Corpo inválido' }, 400); }
  const action = String(body?.action || '');

  try {
    if (action === 'preparar') {
      return await preparar({ admin, body, tenantId, tokenId: tokenRow.id, clientId, clientSecret });
    }
    if (action === 'concluir') {
      return await concluir({ admin, body, tenantId, clientId, clientSecret });
    }
    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    console.error('[noradocs-inbound]', err);
    return json({ error: (err as Error).message || 'Erro interno.' }, 500);
  }
});


async function preparar({ admin, body, tenantId, tokenId, clientId, clientSecret }: {
  // deno-lint-ignore no-explicit-any
  admin: any; body: Record<string, unknown>; tenantId: string; tokenId: string;
  clientId: string; clientSecret: string;
}) {
  const fileName = String(body?.fileName || '').trim();
  const mimeType = String(body?.mimeType || 'application/octet-stream');
  const sizeBytes = Number(body?.sizeBytes || 0);
  const contentHash = String(body?.contentHash || '').toLowerCase();
  const remetente = String(body?.remetente || '').trim();
  const remetenteNome = String(body?.remetenteNome || '').trim();
  const assunto = String(body?.assunto || '').trim();
  const texto = String(body?.texto || '');
  const recebidoEm = body?.recebidoEm ? new Date(String(body.recebidoEm)) : new Date();

  if (!fileName) return json({ error: 'fileName é obrigatório' }, 400);
  if (!sizeBytes || sizeBytes > TAMANHO_MAXIMO) {
    return json({ error: `Anexo vazio ou maior que ${TAMANHO_MAXIMO / 1024 / 1024} MB.` }, 400);
  }
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    return json({ error: 'contentHash deve ser um SHA-256 em hexadecimal.' }, 400);
  }

  const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from('noradocs_documents')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_company_id', tenantId)
    .eq('origem', 'email')
    .gte('created_at', umaHoraAtras);
  if ((count ?? 0) >= LIMITE_POR_HORA) {
    return json({ error: 'Limite de entrada por hora atingido para este escritório.' }, 429);
  }

  // Deduplicação, igual à do navegador: o mesmo anexo reencaminhado não vira
  // dois arquivos no Drive.
  const { data: jaExiste } = await admin
    .from('noradocs_documents')
    .select('id, file_name, status, drive_path')
    .eq('tenant_company_id', tenantId)
    .eq('content_hash', contentHash)
    .neq('status', 'descartado')
    .maybeSingle();
  if (jaExiste) {
    return json({
      duplicado: true,
      documentId: jaExiste.id,
      mensagem: `Já recebido antes como "${jaExiste.file_name}"`
        + (jaExiste.drive_path ? `, arquivado em ${jaExiste.drive_path}.` : '.'),
    }, 200);
  }

  const [{ data: clients }, { data: categories }, { data: rules }, { data: settings }] =
    await Promise.all([
      admin.from('noradocs_clients')
        .select('id, nome, cnpj, cpf, aliases, ativo, status, folder_name_override')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_categories')
        .select('id, nome, slug, folder_name, keywords, ativo')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_client_rules')
        .select('id, client_id, category_id, match_type, pattern, priority, ativo')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_settings')
        .select('folder_template, auto_organize')
        .eq('tenant_company_id', tenantId).maybeSingle(),
    ]);

  const contexto = { clients: clients || [], categories: categories || [], rules: rules || [] };

  // O texto que o motor examina junta assunto e corpo ao que veio do anexo.
  // Pelo e-mail, o assunto costuma carregar competência e categoria
  // ("NF de agosto"), e é informação que o upload manual simplesmente não tem.
  const resultado = classificar({
    fileName,
    text: [assunto, texto].filter(Boolean).join('\n'),
    mimeType,
    sizeBytes,
    receivedAt: recebidoEm,
    remetente,
  }, contexto);

  // ── Quem é o dono deste documento, e onde ele mora ──────────────────────
  let cliente = contexto.clients.find((c: { id: string }) => c.id === resultado.clientId) || null;
  let provisorioCriado = false;

  if (!cliente) {
    const empresa = empresaDoRemetente(remetente, remetenteNome);
    if (empresa) {
      // Encontra-ou-cria no banco, não aqui. A chave de unicidade do
      // provisório é um índice de expressão (lower(nome)), que o on_conflict
      // do PostgREST não sabe endereçar — e um select-depois-insert daqui
      // teria janela de corrida justamente no caso normal: dois anexos da
      // mesma empresa chegando no mesmo minuto.
      const { data: provisorioRow, error: erroProvisorio } = await admin.rpc(
        'noradocs_cliente_provisorio',
        {
          p_company_id: tenantId,
          p_nome: empresa.nome,
          p_origem: { tipo: 'dominio_remetente', valor: empresa.dominio, remetente },
        },
      );
      if (erroProvisorio) throw new Error(erroProvisorio.message);
      cliente = provisorioRow;
      provisorioCriado = Boolean(cliente);
    }
  }

  // A decisão vive em domain/destino.js, com testes. Aqui dentro ela seria o
  // pedaço mais importante da função no único lugar onde nenhum teste
  // alcança: exercitá-la exigiria token, conta Google conectada e rede.
  const provisorio = cliente?.status === 'provisorio';
  const { base, status: statusFinal, motivo } = decidirDestino({
    resultado,
    cliente,
    autoOrganize: settings?.auto_organize !== false,
  });

  const categoria = contexto.categories.find((c: { id: string }) => c.id === resultado.categoryId);
  const segmentos = base === 'triagem' ? [] : resolveFolderPath(
    settings?.folder_template || '{cliente}/{ano}/{competencia}/{categoria}',
    {
      clienteNome: cliente?.folder_name_override || cliente?.nome || '',
      cnpj: cliente?.cnpj ? formatCNPJ(cliente.cnpj) : '',
      competencia: resultado.competencia || '',
      categoriaNome: categoria?.folder_name || categoria?.nome || '',
      tipo: '',
    },
  );

  // ── Drive ───────────────────────────────────────────────────────────────
  const { data: tokRow } = await admin
    .from('noradocs_google_tokens')
    .select('refresh_token')
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  if (!tokRow?.refresh_token) {
    return json({ error: 'O escritório ainda não conectou uma conta do Google.' }, 400);
  }

  const refreshed = await refreshAccessToken(tokRow.refresh_token, clientId, clientSecret);
  if (!refreshed.ok || !refreshed.data.access_token) {
    await admin.from('noradocs_google_accounts')
      .update({ status: 'revoked', last_error: refreshed.data?.error || 'refresh_failed' })
      .eq('tenant_company_id', tenantId);
    return json({ error: 'A conexão do escritório com o Google expirou.', code: 'revoked' }, 409);
  }
  const accessToken = refreshed.data.access_token as string;

  // `base` vem de decidirDestino() como string solta (destino.js é JS puro,
  // sem união de tipos); decidirDestino só devolve um dos três valores de
  // DESTINOS, então o cast é seguro — pré-existente desde a E11, corrigido
  // aqui só porque o type-check real (bloqueado até agora pela rede) o pegou.
  const { folderId, path } = await resolverPasta(
    admin, accessToken, tenantId, base as 'raiz' | 'triagem' | 'verificacao', segmentos,
  );
  const uploadUrl = await abrirSessaoDeUpload(accessToken, folderId, fileName, mimeType, sizeBytes);

  // ── O documento nasce antes dos bytes, como no navegador ────────────────
  // Se o PUT falhar do outro lado, o documento fica em 'processando' e é
  // visível. A alternativa — gravar só o que deu certo — apagaria a falha.
  const { data: documento, error: erroInsert } = await admin
    .from('noradocs_documents')
    .insert({
      tenant_company_id: tenantId,
      origem: 'email',
      origem_ref: { remetente, remetenteNome, assunto, recebidoEm: recebidoEm.toISOString() },
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      content_hash: contentHash,
      status: 'processando',
      client_id: cliente?.id ?? null,
      competencia: resultado.competencia,
      category_id: resultado.categoryId,
      matched: {
        evidence: resultado.evidence,
        suposicoes: resultado.suposicoes,
        pendencias: resultado.pendencias,
        provisorio,
        // O status que este documento deve ter quando os bytes chegarem.
        // Gravado aqui porque quem decide é `preparar`; `concluir` não pode
        // redecidir sem virar uma segunda fonte de verdade que discorda da
        // primeira no dia em que uma das duas mudar.
        status_previsto: statusFinal,
      },
      review_reason: motivo,
      drive_folder_id: folderId,
      drive_path: path,
    })
    .select()
    .single();
  if (erroInsert) throw new Error(erroInsert.message);

  await Promise.all([
    admin.from('noradocs_events').insert({
      tenant_company_id: tenantId, document_id: documento.id, type: 'recebido',
      actor_type: 'system',
      payload: { origem: 'email', remetente, assunto, file_name: fileName },
    }),
    admin.from('noradocs_classification_runs').insert({
      tenant_company_id: tenantId, document_id: documento.id,
      method: 'rules', rules_version: RULES_VERSION,
      input_summary: { file_name: fileName, mime_type: mimeType, size_bytes: sizeBytes, remetente, tinha_texto: Boolean(texto) },
      output: {
        client_id: cliente?.id ?? null, competencia: resultado.competencia,
        category_id: resultado.categoryId, decisao: resultado.decisao,
        evidence: resultado.evidence, pendencias: resultado.pendencias,
        base, provisorio, status_previsto: statusFinal,
      },
    }),
    admin.from('noradocs_inbound_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenId),
  ]).catch((err) => console.warn('[noradocs-inbound] trilha:', err?.message));

  return json({
    documentId: documento.id,
    uploadUrl,
    destino: path,
    cliente: cliente ? { nome: cliente.nome, provisorio } : null,
    provisorioCriado,
    decisao: statusFinal === 'organizado' ? 'organizar' : 'revisar',
  });
}


async function concluir({ admin, body, tenantId, clientId, clientSecret }: {
  // deno-lint-ignore no-explicit-any
  admin: any; body: Record<string, unknown>; tenantId: string;
  clientId: string; clientSecret: string;
}) {
  const documentId = String(body?.documentId || '');
  const driveFileId = String(body?.driveFileId || '');
  const webViewLink = body?.webViewLink ? String(body.webViewLink) : null;
  const erroDoUpload = body?.erro ? String(body.erro) : null;
  if (!documentId) return json({ error: 'documentId é obrigatório' }, 400);

  // O filtro por tenant não é redundante com o id: ele impede que um token de
  // um escritório finalize (ou marque como erro) o documento de outro, mesmo
  // que descubra o uuid.
  const { data: documento } = await admin
    .from('noradocs_documents')
    .select(`
      id, file_name, mime_type, status, client_id, category_id, competencia,
      drive_path, drive_folder_id, matched, origem_ref
    `)
    .eq('id', documentId)
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  if (!documento) return json({ error: 'Documento não encontrado.' }, 404);

  if (erroDoUpload) {
    await admin.from('noradocs_documents')
      .update({ status: 'erro', error_message: erroDoUpload.slice(0, 500) })
      .eq('id', documentId);
    await admin.from('noradocs_events').insert({
      tenant_company_id: tenantId, document_id: documentId, type: 'erro',
      actor_type: 'system', payload: { mensagem: erroDoUpload.slice(0, 500), etapa: 'upload' },
    });
    return json({ status: 'erro' });
  }

  if (!driveFileId) return json({ error: 'driveFileId é obrigatório' }, 400);

  // O status foi decidido em `preparar` e gravado com o documento. Inferi-lo
  // aqui a partir do texto do caminho — "começa com _verificação?" — daria
  // certo hoje e erraria em silêncio no dia em que o nome da pasta mudasse.
  const status = documento.matched?.status_previsto === 'organizado' ? 'organizado' : 'revisar';

  const { error } = await admin
    .from('noradocs_documents')
    .update({
      status,
      drive_file_id: driveFileId,
      drive_web_link: webViewLink,
      organized_at: status === 'organizado' ? new Date().toISOString() : null,
    })
    .eq('id', documentId);
  if (error) throw new Error(error.message);

  await admin.from('noradocs_events').insert({
    tenant_company_id: tenantId, document_id: documentId,
    type: status === 'organizado' ? 'organizado' : 'revisao_solicitada',
    actor_type: 'system',
    payload: { drive_path: documento.drive_path, drive_file_id: driveFileId },
  });

  // ── Reclassificação com o texto real do PDF ─────────────────────────────
  // Só quando o documento acabou de cair em revisão: um documento que já foi
  // para a pasta final (raiz) não é reaberto por uma segunda opinião
  // automática — mover um arquivo sozinho, sem ninguém pedir, é o tipo de
  // coisa que corrói confiança no produto. Melhorar o que ainda ESTÁ pendente
  // é puro ganho; mexer no que já está pronto não é.
  //
  // Best-effort e isolado de propósito: o upload já está registrado e
  // arquivado acima. Nenhuma falha daqui pra frente pode virar erro para o
  // complemento — na pior das hipóteses, o documento fica exatamente como
  // já estava, esperando revisão manual como sempre esperou.
  if (status === 'revisar' && documento.mime_type === 'application/pdf') {
    try {
      await reclassificarComTextoDoPdf({
        admin, tenantId, documentId, documento, driveFileId, clientId, clientSecret,
      });
    } catch (err) {
      console.warn('[noradocs-inbound] reclassificação pós-upload falhou:', (err as Error)?.message);
    }
  }

  const { data: final } = await admin
    .from('noradocs_documents')
    .select('status, drive_path')
    .eq('id', documentId)
    .maybeSingle();

  return json({ status: final?.status ?? status, destino: final?.drive_path ?? documento.drive_path });
}

// Troca o pai do arquivo no Drive — mesma operação de `noradocs-drive`'s
// move-file, reescrita aqui porque esta função não tem acesso a ela e não
// vale a pena resolver import cross-função só por uma chamada de API.
async function moverArquivo(accessToken: string, fileId: string, novaPastaId: string) {
  const atualRes = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,parents&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!atualRes.ok) throw new Error(`Não foi possível localizar o arquivo no Drive (${atualRes.status}).`);
  const atual = await atualRes.json();
  if ((atual.parents || []).includes(novaPastaId)) return; // já está lá

  const paisAtuais = (atual.parents || []).join(',');
  const moveRes = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(novaPastaId)}`
    + `${paisAtuais ? `&removeParents=${encodeURIComponent(paisAtuais)}` : ''}`
    + '&fields=id&supportsAllDrives=true',
    { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!moveRes.ok) throw new Error(`O Google recusou mover o arquivo (${moveRes.status}).`);
}

/**
 * Lê de volta o PDF que acabou de ser criado no Drive, reclassifica com o
 * texto de verdade, e — só quando a decisão melhora de fato — atualiza o
 * registro e move o arquivo.
 *
 * O grant que lê o arquivo é o MESMO que o criou (`drive.file`): nenhum
 * escopo novo, nenhuma reautorização. Ver pdfTexto.js para o porquê disto
 * acontecer aqui e não em `preparar`.
 */
async function reclassificarComTextoDoPdf({ admin, tenantId, documentId, documento, driveFileId, clientId, clientSecret }: {
  // deno-lint-ignore no-explicit-any
  admin: any; tenantId: string; documentId: string; driveFileId: string;
  clientId: string; clientSecret: string;
  documento: {
    file_name: string; client_id: string | null; category_id: string | null;
    competencia: string | null; drive_folder_id: string | null; drive_path: string | null;
    // deno-lint-ignore no-explicit-any
    origem_ref: any;
  };
}) {
  const { data: tokRow } = await admin
    .from('noradocs_google_tokens')
    .select('refresh_token')
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  if (!tokRow?.refresh_token) return;

  const refreshed = await refreshAccessToken(tokRow.refresh_token, clientId, clientSecret);
  if (!refreshed.ok || !refreshed.data.access_token) return;
  const accessToken = refreshed.data.access_token as string;

  const bytesRes = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(driveFileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!bytesRes.ok) return; // arquivo ainda pode não estar indexado; não é erro, é "tenta na próxima"
  const bytes = new Uint8Array(await bytesRes.arrayBuffer());

  const textoPdf = await extrairTextoDePdf(bytes);
  if (!textoPdf) return; // PDF escaneado (só imagem), ou extração falhou — nada a melhorar

  const [{ data: clients }, { data: categories }, { data: rules }, { data: settings }] =
    await Promise.all([
      admin.from('noradocs_clients')
        .select('id, nome, cnpj, cpf, aliases, ativo, status, folder_name_override')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_categories')
        .select('id, nome, slug, folder_name, keywords, ativo')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_client_rules')
        .select('id, client_id, category_id, match_type, pattern, priority, ativo')
        .eq('tenant_company_id', tenantId).eq('ativo', true),
      admin.from('noradocs_settings')
        .select('folder_template, auto_organize, drive_root_folder_id')
        .eq('tenant_company_id', tenantId).maybeSingle(),
    ]);
  const contexto = { clients: clients || [], categories: categories || [], rules: rules || [] };

  const assunto = documento.origem_ref?.assunto || '';
  const remetente = documento.origem_ref?.remetente || '';
  const resultado = classificar({
    fileName: documento.file_name,
    text: [assunto, textoPdf].filter(Boolean).join('\n'),
    mimeType: 'application/pdf',
    remetente,
  }, contexto);

  const clienteAtual = contexto.clients.find((c: { id: string }) => c.id === documento.client_id);

  // Só um cliente CONFIRMADO conta como "achou de verdade". Um match do
  // motor contra um provisório (por apelido, por exemplo) não pode contar
  // como a segunda opinião que substitui o palpite — ele PRÓPRIO é palpite.
  const clienteNovo = contexto.clients.find((c: { id: string }) => c.id === resultado.clientId);
  const clientIdConfirmadoNovo = clienteNovo && clienteNovo.status !== 'provisorio' ? clienteNovo.id : null;

  const { clientId: clientIdFinal, categoryId: categoryIdFinal, competencia: competenciaFinal, mudou } =
    mesclarReclassificacao(
      { clientId: documento.client_id, categoryId: documento.category_id, competencia: documento.competencia },
      { ...resultado, clientId: clientIdConfirmadoNovo },
      clienteAtual?.status === 'provisorio',
    );
  if (!mudou) return;

  const cliente = contexto.clients.find((c: { id: string }) => c.id === clientIdFinal) || null;
  const categoria = contexto.categories.find((c: { id: string }) => c.id === categoryIdFinal);

  const faltando = [
    !clientIdFinal && 'cliente', !categoryIdFinal && 'categoria', !competenciaFinal && 'competência',
  ].filter(Boolean);
  const { base: baseFinal, status: statusFinal, motivo: motivoFinal } = decidirDestino({
    resultado: {
      decisao: faltando.length ? 'revisar' : 'organizar',
      motivoRevisao: faltando.length ? `Falta ${faltando.join(' e ')} para arquivar.` : null,
    },
    cliente,
    autoOrganize: settings?.auto_organize !== false,
  });

  // ── Só mexe no Drive se o destino realmente mudou ───────────────────────
  // O padrão é MANTER onde já está: se o destino continua sendo _triagem ou
  // _verificação, o caminho gravado não muda — só é recalculado quando o
  // novo destino é a raiz.
  let folderId = documento.drive_folder_id;
  let path = documento.drive_path;
  if (baseFinal === 'raiz' && settings?.drive_root_folder_id) {
    const segmentos = resolveFolderPath(
      settings?.folder_template || '{cliente}/{ano}/{competencia}/{categoria}',
      {
        clienteNome: cliente?.folder_name_override || cliente?.nome || '',
        cnpj: cliente?.cnpj ? formatCNPJ(cliente.cnpj) : '',
        competencia: competenciaFinal || '',
        categoriaNome: categoria?.folder_name || categoria?.nome || '',
        tipo: '',
      },
    );
    // Caminha a árvore com o MESMO cache de pastas de `resolverPasta`, sem
    // duplicar a função aqui: uma passagem simples basta, porque reclassificar
    // é raro (só quando o texto do PDF muda a decisão) e o volume não paga a
    // reaproveitação de código entre as duas.
    let parentId = settings.drive_root_folder_id;
    const acumulado: string[] = [];
    for (const segmento of segmentos) {
      acumulado.push(segmento);
      const chave = acumulado.join('/');
      const { data: cache } = await admin
        .from('noradocs_drive_folders')
        .select('drive_folder_id')
        .eq('tenant_company_id', tenantId).eq('path', chave).maybeSingle();
      if (cache?.drive_folder_id) { parentId = cache.drive_folder_id; continue; }
      parentId = await ensureChildFolder(accessToken, parentId, segmento);
      await admin.from('noradocs_drive_folders').upsert(
        { tenant_company_id: tenantId, path: chave, drive_folder_id: parentId },
        { onConflict: 'tenant_company_id,path' },
      );
    }
    folderId = parentId;
    path = segmentos.join('/');

    if (folderId && folderId !== documento.drive_folder_id) {
      await moverArquivo(accessToken, driveFileId, folderId);
    }
  }

  await admin.from('noradocs_documents').update({
    status: statusFinal,
    client_id: clientIdFinal,
    category_id: categoryIdFinal,
    competencia: competenciaFinal,
    drive_folder_id: folderId,
    drive_path: path,
    review_reason: motivoFinal,
    organized_at: statusFinal === 'organizado' ? new Date().toISOString() : null,
    matched: {
      evidence: resultado.evidence,
      suposicoes: resultado.suposicoes,
      pendencias: resultado.pendencias,
      provisorio: cliente?.status === 'provisorio',
      status_previsto: statusFinal,
      reclassificado_com_pdf: true,
    },
  }).eq('id', documentId);

  await admin.from('noradocs_events').insert({
    tenant_company_id: tenantId, document_id: documentId,
    type: 'reprocessado',
    actor_type: 'system',
    payload: {
      motivo: 'reclassificado com o texto do PDF', evidence: resultado.evidence,
      drive_path: path, status_final: statusFinal,
    },
  });
}
