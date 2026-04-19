import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export { bcrypt };
export const JWT_SECRET = process.env.JWT_SECRET || 'noratech-secret-key-change-in-production';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@noratech.com.br').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'noratech@2024';

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function ensureAdmin() {
  const sb = getSupabase();
  const { data } = await sb.from('users').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
  if (data) return;
  await sb.from('users').insert({
    email: ADMIN_EMAIL,
    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
  });
}

export async function findUserByEmail(email) {
  const { data } = await getSupabase().from('users').select('*').eq('email', email).maybeSingle();
  return data;
}

export async function findUserById(id) {
  const { data } = await getSupabase().from('users').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function updateUser(id, fields) {
  const { data } = await getSupabase()
    .from('users')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single();
  return data;
}

export function toPublic(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.email.split('@')[0],
    photoUrl: null,
  };
}

export function authenticate(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autorizado' });
    return null;
  }
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return null;
  }
}
