import { authenticate, findUserById, findUserByEmail, updateUser, toPublic } from './_lib.js';

export default async function handler(req, res) {
  const payload = authenticate(req, res);
  if (!payload) return;

  const user = await findUserById(payload.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (req.method === 'GET') {
    return res.json(toPublic(user));
  }

  if (req.method === 'PATCH') {
    const { name, email } = req.body || {};
    const fields = {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Nome não pode ser vazio' });
      fields.name = name.trim();
    }

    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes('@') || !trimmed.includes('.')) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      if (trimmed !== user.email) {
        const taken = await findUserByEmail(trimmed);
        if (taken) return res.status(409).json({ error: 'Este email já está em uso' });
        fields.email = trimmed;
      }
    }

    if (Object.keys(fields).length === 0) return res.json(toPublic(user));
    const updated = await updateUser(user.id, fields);
    return res.json(toPublic(updated));
  }

  res.status(405).json({ error: 'Method not allowed' });
}
