import { kv, bcrypt, JWT_SECRET, ensureAdmin, findUserByEmail } from '../_lib.js';
import jwt from 'jsonwebtoken';

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

  const existing = await kv.get(`email:${normalizedEmail}`);
  if (existing) return res.status(409).json({ error: 'Este email já está em uso' });

  const newUser = {
    id: `u_${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    photoUrl: null,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`user:${newUser.id}`, newUser);
  await kv.set(`email:${normalizedEmail}`, newUser.id);

  const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, photoUrl: newUser.photoUrl },
  });
}
