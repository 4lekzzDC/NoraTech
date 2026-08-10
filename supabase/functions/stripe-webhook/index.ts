import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@22.4.0?target=deno';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Endpoint público chamado pelo Stripe. Não tem JWT do Supabase —
// a autenticação é a assinatura HMAC verificada abaixo (STRIPE_WEBHOOK_SECRET).
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente.');
    return json({ error: 'Webhook não configurado.' }, 500);
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-07-29.dahlia' });

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return json({ error: 'assinatura ausente' }, 400);

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync: Deno não tem crypto síncrono, por isso a versão async.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] assinatura inválida', err);
    return json({ error: 'assinatura inválida' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    switch (event.type) {
      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        const customerId = typeof si.customer === 'string' ? si.customer : si.customer?.id;
        const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
        if (!customerId || !pmId) break;

        const { data: company } = await admin.from('companies').select('id').eq('stripe_customer_id', customerId).maybeSingle();
        if (!company) { console.error('[stripe-webhook] empresa não encontrada para customer', customerId); break; }

        const pm = await stripe.paymentMethods.retrieve(pmId);
        const card = pm.card;

        // Só um cartão padrão por empresa: zera os antigos antes de inserir o novo.
        await admin.from('payment_methods').update({ is_default: false }).eq('company_id', company.id);
        await admin.from('payment_methods').upsert({
          company_id: company.id,
          stripe_payment_method_id: pm.id,
          brand: card?.brand ?? null,
          last4: card?.last4 ?? null,
          exp_month: card?.exp_month ?? null,
          exp_year: card?.exp_year ?? null,
          is_default: true,
        }, { onConflict: 'stripe_payment_method_id' });

        await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
        break;
      }

      case 'payment_method.detached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        await admin.from('payment_methods').delete().eq('stripe_payment_method_id', pm.id);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id;
        if (!invoiceId) break;
        await admin.from('invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: pi.id,
          payment_error: null,
        }).eq('id', invoiceId);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id;
        if (!invoiceId) break;
        await admin.from('invoices').update({
          stripe_payment_intent_id: pi.id,
          payment_error: pi.last_payment_error?.message ?? 'Pagamento recusado.',
        }).eq('id', invoiceId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] erro ao processar evento', event.type, err);
    // Ainda respondemos 200 pra evitar retry infinito do Stripe em erro nosso;
    // o log acima fica pro admin investigar.
  }

  return json({ received: true });
});
