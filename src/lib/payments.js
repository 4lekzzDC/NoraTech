import { supabase } from './supabase';

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

/** Cartão padrão salvo da empresa (ou null se nenhum). */
export async function fetchPaymentMethod(companyId) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, brand, last4, exp_month, exp_year, is_default, created_at')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .maybeSingle();
  if (error) throw new Error(translate(error));
  return data;
}

/** Cria o Customer (se preciso) e um SetupIntent — devolve o client_secret pro Stripe Elements. */
export async function createSetupIntent(companyId) {
  const { data, error } = await supabase.functions.invoke('stripe-setup-intent', {
    body: { company_id: companyId },
  });
  if (error) throw new Error(translate(error));
  if (data?.error) throw new Error(data.error);
  return data.client_secret;
}

/** Cobra uma fatura pendente usando o cartão padrão salvo (admin). */
export async function chargeInvoice(invoiceId) {
  const { data, error } = await supabase.functions.invoke('stripe-charge-invoice', {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(translate(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Cria (ou reaproveita) um PaymentIntent on-session para uma fatura
 * específica — o cliente escolhe cartão, PIX ou boleto na hora.
 */
export async function createInvoicePaymentIntent(invoiceId) {
  const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(translate(error));
  if (data?.error) throw new Error(data.error);
  return data.client_secret;
}
