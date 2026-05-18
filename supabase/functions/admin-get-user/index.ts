import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Admin client — service role, never exposed to browser
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller has a valid session and is an admin
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

    // Parse body
    const body = await req.json().catch(() => ({}));
    const user_id: string | undefined = body?.user_id;
    if (!user_id) return json({ error: 'user_id é obrigatório' }, 400);

    // Fetch target user from auth.users
    const { data: { user }, error } = await adminClient.auth.admin.getUserById(user_id);
    if (error || !user) {
      return json({ error: error?.message ?? 'Usuário não encontrado' }, 404);
    }

    return json({
      email:              user.email             ?? null,
      phone:              user.phone             ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at:    user.last_sign_in_at   ?? null,
      created_at:         user.created_at        ?? null,
    });

  } catch (err) {
    console.error('[admin-get-user]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
