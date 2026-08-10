import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas. ' +
      'Configure o arquivo .env.local (dev) ou as variáveis de ambiente no Vercel (produção).'
  );
}

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isNoratechHost = hostname === 'noratech.com.br' || hostname.endsWith('.noratech.com.br');

// Lock de auth com timeout. O supabase-js serializa refresh/signIn com
// navigator.locks para evitar que duas abas rotacionem o refresh token ao
// mesmo tempo (o token é de uso único — a segunda tentativa quebra e trava
// o client até um F5). Um lock removido de vez (como tínhamos antes) evita
// o travamento mas reabre essa corrida; um lock "preso" numa aba fechada no
// meio de uma requisição trava do mesmo jeito. Por isso: mantém o lock (a
// serialização continua protegendo contra a corrida), mas com timeout —
// depois de alguns segundos sem conseguir o lock, segue sem esperar em vez
// de travar sign-in/refresh indefinidamente.
const lockWithTimeout = async (name, acquireTimeout, fn) => {
  if (typeof navigator === 'undefined' || !navigator.locks) return fn();
  const timeoutMs = acquireTimeout && acquireTimeout > 0 ? acquireTimeout : 8000;
  try {
    return await navigator.locks.request(name, { signal: AbortSignal.timeout(timeoutMs) }, fn);
  } catch (err) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      console.warn('[Auth] Lock de auth expirou (provável lock órfão de outra aba) — seguindo sem esperar.', name);
      return fn();
    }
    throw err;
  }
};

export const supabase = createBrowserClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    lock: lockWithTimeout,
  },
  cookieOptions: {
    domain: isNoratechHost ? '.noratech.com.br' : undefined,
    path: '/',
    sameSite: 'lax',
    secure: isNoratechHost,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const AVATARS_BUCKET = 'avatars';
