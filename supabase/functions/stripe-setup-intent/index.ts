import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@22.4.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Setup Intents — salva um cartão para cobrança futura (off-session) das
// faturas consolidadas que já geramos no nosso próprio motor de cobrança.
// Não usamos Billing/Subscriptions do Stripe: o pro-rata e o dia de
// vencimento já são nossos.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Stripe não configurado (STRIPE_SECRET_KEY ausente).' }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-07-29.dahlia' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Sessão inválida' }, 401);

    const body = await req.json().catch(() => ({}));
    const company_id: string | undefined = body?.company_id;
    if (!company_id) return json({ error: 'company_id é obrigatório' }, 400);

    // Apenas owner/admin da empresa (ou admin global) pode gerenciar cobrança.
    const { data: isCompanyAdmin } = await callerClient.rpc('is_company_admin', { p_company_id: company_id });
    const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single();
    const isGlobalAdmin = callerProfile?.role === 'admin';
    if (!isCompanyAdmin && !isGlobalAdmin) return json({ error: 'Apenas o dono ou admin da empresa pode gerenciar a forma de pagamento.' }, 403);

    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, name, stripe_customer_id')
      .eq('id', company_id)
      .maybeSingle();
    if (companyErr || !company) return json({ error: 'Empresa não encontrada.' }, 404);

    let customerId = company.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: { company_id: company.id },
      });
      customerId = customer.id;
      const { error: updErr } = await adminClient
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', company.id);
      if (updErr) return json({ error: updErr.message }, 500);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { company_id: company.id },
    });

    return json({ client_secret: setupIntent.client_secret, customer_id: customerId });

  } catch (err) {
    console.error('[stripe-setup-intent]', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno.' }, 500);
  }
});
