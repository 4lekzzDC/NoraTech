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

export const supabase = createBrowserClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  cookieOptions: {
    domain: isNoratechHost ? '.noratech.com.br' : undefined,
    path: '/',
    sameSite: 'lax',
    secure: isNoratechHost,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const AVATARS_BUCKET = 'avatars';
