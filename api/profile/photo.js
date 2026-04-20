import { authenticate, findUserById, updateUser, getSupabase, toPublic } from '../_lib.js';

const BUCKET = 'photos';

export default async function handler(req, res) {
  const payload = authenticate(req, res);
  if (!payload) return;

  const user = await findUserById(payload.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (req.method === 'DELETE') {
    if (user.photo_url) {
      const sb = getSupabase();
      const segment = user.photo_url.split(`/object/public/${BUCKET}/`)[1];
      if (segment) await sb.storage.from(BUCKET).remove([decodeURIComponent(segment)]);
    }
    const updated = await updateUser(user.id, { photo_url: null });
    return res.json(toPublic(updated));
  }

  if (req.method === 'POST') {
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

    const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const path = `${user.id}/photo_${Date.now()}.${ext}`;

    const sb = getSupabase();
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(path, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);

    const updated = await updateUser(user.id, { photo_url: publicUrl });
    return res.json(toPublic(updated));
  }

  res.status(405).json({ error: 'Method not allowed' });
}
