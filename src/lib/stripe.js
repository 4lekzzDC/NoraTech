import { loadStripe } from '@stripe/stripe-js';

// Chave publicável — segura no navegador. A chave secreta nunca sai das
// Edge Functions (STRIPE_SECRET_KEY nos segredos do Supabase).
let stripePromise;

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
