import jwt from 'jsonwebtoken';
import { bcrypt, JWT_SECRET, ensureAdmin, findUserByEmail, toPublic } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  const normalizedEmail = email.trim().toLowerCase();
  await ensureAdmin();

  const user = await findUserByEmail(normalizedEmail);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: toPublic(user) });
}
