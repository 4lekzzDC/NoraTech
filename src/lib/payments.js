import { supabase } from './supabase';

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

// `functions.invoke` resolve qualquer status fora da faixa 2xx num Error cuja
// mensagem é sempre a mesma frase genérica ("non-2xx status code") — o motivo
// de verdade fica no corpo, dentro de `error.context`. Sem desembrulhar isso,
// um 429 de rate limit chega ao usuário como erro sem explicação, e ele fica
// tentando de novo justamente quando deveria esperar.
async function mensagemDaFuncao(error) {
  try {
    const corpo = await error?.context?.json();
    if (corpo?.error) return corpo.error;
  } catch { /* corpo vazio ou não-JSON: cai no genérico abaixo */ }
  return translate(error);
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
  if (error) throw new Error(await mensagemDaFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data.client_secret;
}

/** Cobra uma fatura pendente usando o cartão padrão salvo (admin). */
export async function chargeInvoice(invoiceId) {
  const { data, error } = await supabase.functions.invoke('stripe-charge-invoice', {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(await mensagemDaFuncao(error));
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
  if (error) throw new Error(await mensagemDaFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data.client_secret;
}
