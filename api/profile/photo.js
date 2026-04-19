import { put } from '@vercel/blob';
import { authenticate, findUserById, saveUser } from '../_lib.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const payload = authenticate(req, res);
    if (!payload) return;
    const user = await findUserById(payload.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    user.photoUrl = null;
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
    return res.json({ photoUrl: null });
  }

  if (req.method === 'POST') {
    const payload = authenticate(req, res);
    if (!payload) return;

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const bodyStr = buffer.toString('binary');
    const parts = bodyStr.split(`--${boundary}`);
    let fileBuffer = null;
    let mimeType = 'image/jpeg';

    for (const part of parts) {
      if (!part.includes('filename=')) continue;
      const mimeMatch = part.match(/Content-Type: ([^\r\n]+)/);
      if (mimeMatch) mimeType = mimeMatch[1].trim();
      const bodyStart = part.indexOf('\r\n\r\n') + 4;
      const bodyEnd = part.lastIndexOf('\r\n');
      fileBuffer = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
      break;
    }

    if (!fileBuffer) return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const ext = mimeType.split('/')[1] || 'jpg';
    const blob = await put(`photos/photo_${Date.now()}.${ext}`, fileBuffer, {
      access: 'public',
      contentType: mimeType,
    });

    const user = await findUserById(payload.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    user.photoUrl = blob.url;
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
    return res.json({ photoUrl: blob.url });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
