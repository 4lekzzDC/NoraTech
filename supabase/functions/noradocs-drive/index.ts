import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Operações do NoraDocs sobre o Drive do escritório que exigem o token do
// servidor: emprestar um access_token de curta duração para o Google Picker
// abrir no navegador, e confirmar a pasta raiz escolhida (criando a subpasta
// de triagem).
//
// Nunca há um segundo login do Google. O access_token devolvido a
// 'picker-token' é obtido REFRESCANDO o mesmo refresh_token guardado na
// conexão inicial — não é uma nova concessão. Por isso a pergunta que o spike
// da Etapa 0 deixou em aberto ("o grant do Picker alcança o token do
// servidor?") nem chega a existir aqui: só existe UM grant, do início ao fim.
// A verificação real acontece em tempo de execução, em 'set-root-folder',
// quando o servidor tenta ler a pasta que o Picker devolveu.

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

  const { data: canManage } = await caller.rpc('has_noradocs_manage', { p_company_id: tenantId });
  if (!canManage) {
    return json({ error: 'Apenas o responsável pelo escritório (dono ou admin) pode gerenciar o Google Drive.' }, 403);
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

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    console.error('[noradocs-drive]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
