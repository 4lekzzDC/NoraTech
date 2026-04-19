import jwt from 'jsonwebtoken';
import { bcrypt, JWT_SECRET, ensureAdmin, findUserByEmail, getSupabase, toPublic } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  await ensureAdmin();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Este email já está em uso' });

  const newUser = {
    id: `u_${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    password_hash: bcrypt.hashSync(password, 10),
    photo_url: null,
  };

  const { data, error } = await getSupabase().from('users').insert(newUser).select('*').single();
  if (error) return res.status(500).json({ error: 'Erro ao criar conta' });

  const token = jwt.sign({ id: data.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: toPublic(data) });
}
