import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Único ponto do sistema que troca segredo com o Google. O Client Secret vive
// só nos secrets desta função (Deno.env) — nunca no banco, nunca no
// repositório, nunca visível ao navegador.
//
// O tenant NUNCA vem do corpo da requisição: é resolvido a partir da
// membresia ativa de quem chama, do mesmo jeito que o resto do NoraTech
// resolve "minha empresa" (ver src/lib/subscriptions.js). Um corpo malicioso
// não consegue apontar para o escritório de outra pessoa.
//
// Self-contained de propósito (sem import de ../_shared/): evita qualquer
// ambiguidade de resolução de caminho relativo no empacotamento remoto desta
// implantação. O custo é ~10 linhas duplicadas com noradocs-drive.

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
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
// `openid email` acompanham o drive.file só para identificar QUAL conta ficou
// conectada — a tela precisa dizer "conectado como fulano@...". Ambos são
// escopos não sensíveis; nenhum dá acesso a dado além da identidade.
const GRANTED_SCOPES = ['openid', 'email', DRIVE_FILE_SCOPE];

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
    return json({ error: 'A integração com o Google ainda não foi configurada neste ambiente (faltam as credenciais OAuth).' }, 503);
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
    return json({ error: 'Apenas o responsável pelo escritório (dono ou admin) pode gerenciar a conexão com o Google.' }, 403);
  }

  try {
    if (action === 'connect') {
      const code = String(body?.code || '');
      const redirectUri = String(body?.redirectUri || '');
      if (!code || !redirectUri) return json({ error: 'code e redirectUri são obrigatórios' }, 400);

      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      // Sem refresh_token não há o que guardar. O fluxo sempre manda
      // prompt=consent para garantir que ele venha; se ainda assim faltar, é
      // melhor recusar a conexão do que gravar um estado pela metade que vai
      // falhar silenciosamente na primeira tentativa de upload.
      if (!tokenRes.ok || !tokenData.refresh_token) {
        console.error('[noradocs-google-oauth] token exchange failed', tokenRes.status, tokenData);
        return json({ error: tokenData.error_description || 'Não foi possível concluir a conexão com o Google.' }, 400);
      }

      const userinfoRes = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userinfo = await userinfoRes.json().catch(() => ({}));

      const { error: accErr } = await admin.from('noradocs_google_accounts').upsert({
        tenant_company_id: tenantId,
        google_email: userinfo.email || '(e-mail não informado)',
        google_sub: userinfo.sub || null,
        scopes: GRANTED_SCOPES,
        status: 'connected',
        last_error: null,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'tenant_company_id' });
      if (accErr) throw accErr;

      const { error: tokErr } = await admin.from('noradocs_google_tokens').upsert({
        tenant_company_id: tenantId,
        refresh_token: tokenData.refresh_token,
      }, { onConflict: 'tenant_company_id' });
      if (tokErr) throw tokErr;

      return json({ connected: true, email: userinfo.email || null });
    }

    if (action === 'disconnect') {
      const { data: tokRow } = await admin
        .from('noradocs_google_tokens')
        .select('refresh_token')
        .eq('tenant_company_id', tenantId)
        .maybeSingle();

      if (tokRow?.refresh_token) {
        // Revoga no Google. Derruba TODOS os escopos concedidos a este
        // client_id por esta conta, não só o desta sessão — a UI avisa isso
        // antes de chamar esta ação.
        await fetch(REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: tokRow.refresh_token }),
        }).catch((e) => console.error('[noradocs-google-oauth] revoke failed', e));
      }

      await admin.from('noradocs_google_tokens').delete().eq('tenant_company_id', tenantId);
      await admin.from('noradocs_google_accounts')
        .update({ status: 'revoked', last_error: null })
        .eq('tenant_company_id', tenantId);

      return json({ disconnected: true });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    console.error('[noradocs-google-oauth]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
