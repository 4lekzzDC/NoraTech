const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'noratech-secret-key-change-in-production';
const DATA_FILE = path.join(__dirname, 'data', 'user.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  const defaultUser = {
    id: '1',
    name: 'Alexandre DC',
    email: 'admin@noratech.com.br',
    passwordHash: bcrypt.hashSync('noratech@2024', 10),
    photoUrl: null,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultUser, null, 2));
  console.log('Usuário padrão criado: admin@noratech.com.br / noratech@2024');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

const readUser = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const writeUser = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  const user = readUser();
  if (user.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl },
  });
});

app.get('/api/profile', authenticate, (req, res) => {
  const user = readUser();
  res.json({ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl });
});

app.patch('/api/profile', authenticate, (req, res) => {
  const { name, email } = req.body;
  const user = readUser();
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Nome não pode ser vazio' });
    user.name = name.trim();
  }
  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    user.email = trimmed;
  }
  user.updatedAt = new Date().toISOString();
  writeUser(user);
  res.json({ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl });
});

app.patch('/api/profile/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórios' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 8 caracteres' });
  }
  const user = readUser();
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  writeUser(user);
  res.json({ message: 'Senha alterada com sucesso' });
});

app.post('/api/profile/photo', authenticate, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada' });
  const user = readUser();
  if (user.photoUrl) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(user.photoUrl));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  user.photoUrl = `/uploads/${req.file.filename}`;
  user.updatedAt = new Date().toISOString();
  writeUser(user);
  res.json({ photoUrl: user.photoUrl });
});

app.delete('/api/profile/photo', authenticate, (req, res) => {
  const user = readUser();
  if (user.photoUrl) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(user.photoUrl));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    user.photoUrl = null;
    user.updatedAt = new Date().toISOString();
    writeUser(user);
  }
  res.json({ photoUrl: null });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
