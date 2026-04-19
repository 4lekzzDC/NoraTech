import { kv, bcrypt, JWT_SECRET, ensureAdmin } from '../_lib.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  const normalizedEmail = email.trim().toLowerCase();

  await ensureAdmin();

  const userId = await kv.get(`email:${normalizedEmail}`);
  if (!userId) return res.status(401).json({ error: 'Credenciais inválidas' });

  const user = await kv.get(`user:${userId}`);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl } });
}
