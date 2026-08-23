import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Cada chamada dispara um e-mail de redefinição para a caixa de outra pessoa.
// Sem teto, um admin com a conta tomada transforma isto em uma máquina de
// spam contra os próprios usuários — e queima a reputação do domínio de envio
// junto. O limite é por admin, não global: um não trava o trabalho do outro.
const LIMITE_RESET = { bucket: 'admin_reset_password', limit: 15, windowSeconds: 3600 };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is authenticated and is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Sessão inválida' }, 401);

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'admin') return json({ error: 'Acesso negado' }, 403);

    // Depois da checagem de admin, para não gastar contador com quem nem
    // podia chamar — e antes do envio, que é o que custa.
    const limite = await checkRateLimit(adminClient, LIMITE_RESET, caller.id);
    if (!limite.allowed) {
      return rateLimitResponse(
        limite, corsHeaders,
        'Muitas redefinições de senha enviadas nesta hora. Aguarde antes de enviar outra.',
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const user_id: string | undefined = body?.user_id;
    if (!user_id) return json({ error: 'user_id é obrigatório' }, 400);

    // Fetch target user's email from auth.users
    const { data: { user }, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
    if (getUserErr || !user) {
      return json({ error: getUserErr?.message ?? 'Usuário não encontrado' }, 404);
    }
    if (!user.email) {
      return json({ error: 'Usuário não possui e-mail cadastrado.' }, 422);
    }

    // Determine redirect URL
    const origin = req.headers.get('origin')
      ?? Deno.env.get('SITE_URL')
      ?? supabaseUrl.replace('.supabase.co', '');
    const redirectTo = `${origin}/reset-password`;

    // Send password reset email via Supabase Auth
    const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });

    if (resetErr) {
      console.error('[admin-reset-password] resetPasswordForEmail:', resetErr);
      return json({ error: resetErr.message }, 400);
    }

    return json({ ok: true, message: 'E-mail de redefinição de senha enviado com sucesso.' });

  } catch (err) {
    console.error('[admin-reset-password]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
