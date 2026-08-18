import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Operações do NoraDocs sobre o Drive do escritório que exigem o token do
// servidor. Quatro ações:
//
//   picker-token       empresta um access_token curto para o Picker abrir
//   set-root-folder    confirma a pasta raiz escolhida e cria a _triagem
//   ensure-folder-path caminha/cria a árvore de pastas do destino, com cache
//   upload-session     abre a sessão resumable e devolve só a URL
//
// Nunca há um segundo login do Google: todo access_token daqui vem de
// REFRESCAR o mesmo refresh_token guardado na conexão inicial. Existe um
// único grant, do início ao fim.
//
// Os BYTES do documento nunca passam por aqui. 'upload-session' devolve ao
// navegador uma URL que carrega o próprio upload_id como credencial, e é o
// navegador que envia o arquivo direto ao Google.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const STAGING_FOLDER_NAME = '_triagem';

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Aspas simples fecham o literal na sintaxe de busca do Drive. Uma pasta de
// cliente chamada "D'Angelo Ltda" montaria uma query quebrada sem isto.
function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Garante UM nível: procura a subpasta pelo nome dentro do pai e cria se não
// existir. Buscar antes de criar é o que impede duas pastas com o mesmo nome
// quando dois uploads do mesmo cliente chegam juntos.
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
    const errBody = await createRes.text().catch(() => '');
    throw new Error(`Falha ao criar a pasta "${name}" no Drive: ${createRes.status} ${errBody}`);
  }
  const created = await createRes.json();
  return created.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '';

  if (!clientId || !clientSecret) {
    return json({ error: 'A integração com o Google ainda não foi configurada neste ambiente.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'Sessão inválida' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Corpo inválido' }, 400); }
  const action = body?.action;

  const { data: membership } = await caller
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const tenantId = membership?.company_id as string | undefined;
  if (!tenantId) return json({ error: 'Você não pertence a nenhum escritório ativo.' }, 400);

  // Duas alçadas diferentes, de propósito. CONFIGURAR a conexão (escolher a
  // pasta raiz, abrir o seletor) é decisão de quem responde pela conta do
  // escritório. USAR o Drive no dia a dia — arquivar um documento — é o
  // trabalho de qualquer membro; exigir owner/admin aqui inviabilizaria o
  // produto para o time que de fato opera a caixa de entrada.
  const ACOES_DE_CONFIGURACAO = ['picker-token', 'set-root-folder'];
  const rpcDeAcesso = ACOES_DE_CONFIGURACAO.includes(String(action))
    ? 'has_noradocs_manage'
    : 'has_noradocs_access';

  const { data: autorizado } = await caller.rpc(rpcDeAcesso, { p_company_id: tenantId });
  if (!autorizado) {
    return json({
      error: rpcDeAcesso === 'has_noradocs_manage'
        ? 'Apenas o responsável pelo escritório (dono ou admin) pode gerenciar o Google Drive.'
        : 'Você não tem acesso ao NoraDocs neste escritório.',
    }, 403);
  }

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
    console.error('[noradocs-drive] refresh failed', refreshed.data);
    // invalid_grant = a conta revogou o acesso fora do NoraDocs (trocou
    // senha, removeu o app na conta Google). Sinalizamos para a UI oferecer
    // reconectar, em vez de deixar o escritório martelando um botão que nunca
    // vai funcionar.
    await admin.from('noradocs_google_accounts')
      .update({ status: 'revoked', last_error: refreshed.data?.error || 'refresh_failed' })
      .eq('tenant_company_id', tenantId);
    return json({ error: 'A conexão com o Google expirou. Reconecte a conta na tela de Configurações.', code: 'revoked' }, 409);
  }
  const accessToken = refreshed.data.access_token as string;

  try {
    if (action === 'picker-token') {
      return json({ accessToken, expiresIn: refreshed.data.expires_in ?? 3600 });
    }

    if (action === 'set-root-folder') {
      const folderId = String(body?.folderId || '');
      const folderName = String(body?.folderName || '');
      if (!folderId) return json({ error: 'folderId é obrigatório' }, 400);

      // Confirma que o token do servidor realmente alcança a pasta que o
      // Picker devolveu, e que é mesmo uma pasta.
      const folderRes = await fetch(
        `${DRIVE_FILES_URL}/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!folderRes.ok) {
        const errBody = await folderRes.text().catch(() => '');
        console.error('[noradocs-drive] folder lookup failed', folderRes.status, errBody);
        return json({ error: 'Não foi possível acessar a pasta escolhida. Selecione novamente pelo seletor do Google.' }, 400);
      }
      const folder = await folderRes.json();
      if (folder.mimeType !== FOLDER_MIME) {
        return json({ error: 'O item escolhido não é uma pasta.' }, 400);
      }

      // Busca antes de criar: um clique duplo (ou reconfirmar a mesma pasta
      // depois) não deve gerar duas "_triagem" na mesma raiz.
      const searchRes = await fetch(
        `${DRIVE_FILES_URL}?q=${encodeURIComponent(
          `'${folderId}' in parents and name='${STAGING_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`
        )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const searchData = await searchRes.json().catch(() => ({ files: [] }));
      let stagingId = searchData.files?.[0]?.id as string | undefined;

      if (!stagingId) {
        const createRes = await fetch(`${DRIVE_FILES_URL}?supportsAllDrives=true`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: STAGING_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [folderId] }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.text().catch(() => '');
          console.error('[noradocs-drive] staging create failed', createRes.status, errBody);
          return json({ error: 'Pasta raiz confirmada, mas não foi possível criar a subpasta de triagem.' }, 500);
        }
        const created = await createRes.json();
        stagingId = created.id;
      }

      const { error: upErr } = await admin.from('noradocs_settings').upsert({
        tenant_company_id: tenantId,
        drive_root_folder_id: folderId,
        drive_root_folder_name: folder.name || folderName || null,
        drive_staging_folder_id: stagingId,
      }, { onConflict: 'tenant_company_id' });
      if (upErr) throw upErr;

      return json({ rootFolderId: folderId, rootFolderName: folder.name, stagingFolderId: stagingId });
    }

    if (action === 'ensure-folder-path') {
      const segments = Array.isArray(body?.segments) ? (body.segments as string[]) : [];
      const useStaging = body?.staging === true;

      const { data: settings } = await admin
        .from('noradocs_settings')
        .select('drive_root_folder_id, drive_staging_folder_id')
        .eq('tenant_company_id', tenantId)
        .maybeSingle();

      const rootId = useStaging ? settings?.drive_staging_folder_id : settings?.drive_root_folder_id;
      if (!rootId) {
        return json({ error: 'O escritório ainda não escolheu a pasta raiz no Google Drive.' }, 400);
      }
      // Documento duvidoso vai inteiro para _triagem, sem árvore: o caminho
      // definitivo só é conhecido depois que alguém confirma a classificação.
      if (useStaging || segments.length === 0) return json({ folderId: rootId, path: null });

      const path = segments.join('/');

      // Cache: evita percorrer o Drive a cada arquivo do mesmo cliente e
      // mês — que é o padrão real de uso, lotes de dezenas de uma vez.
      const { data: cached } = await admin
        .from('noradocs_drive_folders')
        .select('drive_folder_id')
        .eq('tenant_company_id', tenantId)
        .eq('path', path)
        .maybeSingle();
      if (cached?.drive_folder_id) return json({ folderId: cached.drive_folder_id, path, cached: true });

      // Caminha a árvore criando o que faltar, e memoriza cada nível — não só
      // o final: o próximo documento do mesmo cliente em outro mês já acha o
      // caminho do cliente pronto.
      let parentId = rootId;
      const acumulado: string[] = [];
      for (const segment of segments) {
        acumulado.push(segment);
        const parcial = acumulado.join('/');

        const { data: cachedLevel } = await admin
          .from('noradocs_drive_folders')
          .select('drive_folder_id')
          .eq('tenant_company_id', tenantId)
          .eq('path', parcial)
          .maybeSingle();

        if (cachedLevel?.drive_folder_id) {
          parentId = cachedLevel.drive_folder_id;
          continue;
        }

        parentId = await ensureChildFolder(accessToken, parentId, segment);

        // upsert, não insert: dois uploads simultâneos podem ter criado a
        // mesma linha entre a leitura acima e agora.
        await admin.from('noradocs_drive_folders').upsert(
          { tenant_company_id: tenantId, path: parcial, drive_folder_id: parentId },
          { onConflict: 'tenant_company_id,path' },
        );
      }

      return json({ folderId: parentId, path });
    }

    if (action === 'upload-session') {
      const folderId = String(body?.folderId || '');
      const fileName = String(body?.fileName || '');
      const mimeType = String(body?.mimeType || 'application/octet-stream');
      if (!folderId || !fileName) return json({ error: 'folderId e fileName são obrigatórios' }, 400);

      // Abre a sessão resumable e devolve SÓ a URL. Ela carrega um upload_id
      // que funciona como credencial própria — por isso o navegador pode
      // mandar os bytes direto ao Google sem nunca ver o token do escritório,
      // e por isso o PUT do navegador não deve levar Authorization (o
      // preflight CORS do Drive só libera content-type e content-range).
      const sessionRes = await fetch(
        `${DRIVE_UPLOAD_URL}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
          },
          body: JSON.stringify({ name: fileName, parents: [folderId] }),
        },
      );

      if (!sessionRes.ok) {
        const errBody = await sessionRes.text().catch(() => '');
        console.error('[noradocs-drive] upload session failed', sessionRes.status, errBody);
        return json({ error: 'Não foi possível iniciar o envio do arquivo para o Drive.' }, 502);
      }

      const uploadUrl = sessionRes.headers.get('location');
      if (!uploadUrl) {
        console.error('[noradocs-drive] upload session without Location header');
        return json({ error: 'O Google não devolveu a sessão de envio.' }, 502);
      }

      return json({ uploadUrl });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    console.error('[noradocs-drive]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
