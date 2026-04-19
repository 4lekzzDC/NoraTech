import { kv, authenticate, findUserById, saveUser } from './_lib.js';

export default async function handler(req, res) {
  const payload = authenticate(req, res);
  if (!payload) return;

  const user = await findUserById(payload.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (req.method === 'GET') {
    return res.json({ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl });
  }

  if (req.method === 'PATCH') {
    const { name, email } = req.body || {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Nome não pode ser vazio' });
      user.name = name.trim();
    }
    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes('@') || !trimmed.includes('.')) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      if (trimmed !== user.email) {
        const taken = await kv.get(`email:${trimmed}`);
        if (taken) return res.status(409).json({ error: 'Este email já está em uso' });
        await kv.del(`email:${user.email}`);
        await kv.set(`email:${trimmed}`, user.id);
        user.email = trimmed;
      }
    }
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
    return res.json({ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
