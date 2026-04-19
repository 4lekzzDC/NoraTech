import jwt from 'jsonwebtoken';
import { bcrypt, JWT_SECRET, ensureAdmin, findUserByEmail, getSupabase, toPublic } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try { await ensureAdmin(); } catch (_) {}

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Este email já está em uso' });

  const { data, error } = await getSupabase()
    .from('users')
    .insert({ email: normalizedEmail, password: bcrypt.hashSync(password, 10) })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const token = jwt.sign({ id: data.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: toPublic(data) });
}
