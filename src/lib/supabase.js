import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    '[Noratech] Variáveis de ambiente Supabase não configuradas.\n' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Vercel (Settings → Environment Variables) ' +
    'para os ambientes Production E Preview, depois faça um novo deploy.'
  )
}

export const supabase = createClient(url, key)
