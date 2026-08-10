import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@22.4.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// PaymentIntent on-session para UMA fatura específica — o cliente escolhe
// cartão, PIX ou boleto na hora (método dinâmico via Payment Element, sem
// fixar payment_method_types). Diferente do stripe-setup-intent: aqui não
// salvamos nada pra cobrança futura, é só o pagamento desta fatura agora.
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
    const invoice_id: string | undefined = body?.invoice_id;
    if (!invoice_id) return json({ error: 'invoice_id é obrigatório' }, 400);

    const { data: invoice, error: invErr } = await adminClient
      .from('invoices')
      .select('id, company_id, amount, currency, description, status, stripe_payment_intent_id')
      .eq('id', invoice_id)
      .maybeSingle();
    if (invErr || !invoice) return json({ error: 'Fatura não encontrada.' }, 404);
    if (invoice.status === 'paid') return json({ error: 'Esta fatura já está paga.' }, 400);
    if (!invoice.company_id) return json({ error: 'Fatura sem empresa vinculada.' }, 400);

    // Só membro da empresa (dono/admin/colaborador) pode pagar a própria fatura.
    const { data: isMember } = await callerClient.rpc('is_company_member', { p_company_id: invoice.company_id });
    if (!isMember) return json({ error: 'Você não tem acesso a esta fatura.' }, 403);

    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, name, stripe_customer_id')
      .eq('id', invoice.company_id)
      .maybeSingle();
    if (companyErr || !company) return json({ error: 'Empresa não encontrada.' }, 404);

    let customerId = company.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: company.name, metadata: { company_id: company.id } });
      customerId = customer.id;
      await adminClient.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id);
    }

    // Reaproveita um PaymentIntent ainda pendente da mesma fatura (evita
    // duplicar cobrança se o cliente abrir o modal de novo).
    if (invoice.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
        if (existing.status !== 'succeeded' && existing.status !== 'canceled') {
          return json({ client_secret: existing.client_secret });
        }
      } catch { /* segue e cria um novo */ }
    }

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(invoice.amount) * 100),
      currency: (invoice.currency || 'BRL').toLowerCase(),
      customer: customerId,
      description: invoice.description,
      automatic_payment_methods: { enabled: true },
      metadata: { invoice_id: invoice.id },
    });

    await adminClient.from('invoices').update({ stripe_payment_intent_id: pi.id }).eq('id', invoice.id);

    return json({ client_secret: pi.client_secret });

  } catch (err) {
    console.error('[stripe-payment-intent]', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno.' }, 500);
  }
});
