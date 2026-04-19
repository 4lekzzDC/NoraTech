import { bcrypt, authenticate, findUserById, saveUser } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const payload = authenticate(req, res);
  if (!payload) return;

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórios' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 8 caracteres' });
  }

  const user = await findUserById(payload.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  await saveUser(user);
  res.json({ message: 'Senha alterada com sucesso' });
}
