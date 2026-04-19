import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'noratech-secret-key-change-in-production';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@noratech.com.br').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'noratech@2024';

export async function ensureAdmin() {
  const exists = await kv.get(`email:${ADMIN_EMAIL}`);
  if (exists) return;
  const admin = {
    id: 'admin',
    name: 'Alexandre DC',
    email: ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    photoUrl: null,
    createdAt: new Date().toISOString(),
  };
  await kv.set(`user:admin`, admin);
  await kv.set(`email:${ADMIN_EMAIL}`, 'admin');
}

export async function findUserByEmail(email) {
  const userId = await kv.get(`email:${email}`);
  if (!userId) return null;
  return kv.get(`user:${userId}`);
}

export async function findUserById(id) {
  return kv.get(`user:${id}`);
}

export async function saveUser(user) {
  await kv.set(`user:${user.id}`, user);
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

export { bcrypt, kv };
