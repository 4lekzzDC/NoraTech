import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@22.4.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Cobra uma fatura já gerada pelo nosso motor (pg_cron + pro-rata) usando o
// cartão padrão salvo da empresa. Disparado manualmente pelo botão
// "Cobrar agora" no admin — sem cobrança automática por enquanto.
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

    const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') return json({ error: 'Acesso negado' }, 403);

    const body = await req.json().catch(() => ({}));
    const invoice_id: string | undefined = body?.invoice_id;
    if (!invoice_id) return json({ error: 'invoice_id é obrigatório' }, 400);

    const { data: invoice, error: invErr } = await adminClient
      .from('invoices')
      .select('id, company_id, amount, currency, description, status')
      .eq('id', invoice_id)
      .maybeSingle();
    if (invErr || !invoice) return json({ error: 'Fatura não encontrada.' }, 404);
    if (invoice.status === 'paid') return json({ error: 'Esta fatura já está paga.' }, 400);
    if (!invoice.company_id) return json({ error: 'Fatura sem empresa vinculada.' }, 400);

    const { data: company } = await adminClient
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', invoice.company_id)
      .maybeSingle();
    if (!company?.stripe_customer_id) return json({ error: 'Empresa sem cliente Stripe. Peça pro cliente cadastrar um cartão primeiro.' }, 400);

    const { data: pm } = await adminClient
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('company_id', invoice.company_id)
      .eq('is_default', true)
      .maybeSingle();
    if (!pm) return json({ error: 'Nenhum cartão salvo para esta empresa.' }, 400);

    try {
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(Number(invoice.amount) * 100),
        currency: (invoice.currency || 'BRL').toLowerCase(),
        customer: company.stripe_customer_id,
        payment_method: pm.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: invoice.description,
        metadata: { invoice_id: invoice.id },
      });

      if (pi.status === 'succeeded') {
        await adminClient.from('invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: pi.id,
          payment_error: null,
        }).eq('id', invoice.id);
        return json({ ok: true, status: 'paid' });
      }

      await adminClient.from('invoices').update({
        stripe_payment_intent_id: pi.id,
        payment_error: `Status: ${pi.status}. Pode precisar de autenticação adicional do titular.`,
      }).eq('id', invoice.id);
      return json({ ok: false, status: pi.status });

    } catch (stripeErr) {
      const message = stripeErr instanceof Stripe.errors.StripeError ? stripeErr.message : 'Erro ao cobrar.';
      await adminClient.from('invoices').update({ payment_error: message }).eq('id', invoice.id);
      return json({ error: message }, 402);
    }

  } catch (err) {
    console.error('[stripe-charge-invoice]', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno.' }, 500);
  }
});
