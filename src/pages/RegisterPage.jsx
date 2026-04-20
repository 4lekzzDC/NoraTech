import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      const result = await register(name, email, password);
      if (result?.pendingConfirmation) {
        navigate('/login', { state: { message: 'Conta criada! Confirme seu e-mail para entrar.' } });
      } else {
        navigate('/area-do-cliente');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08080a',
      color: '#eeede9',
      fontFamily: "'Manrope', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        .reg-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #eeede9;
          font-family: 'Manrope', sans-serif;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .reg-input:focus {
          border-color: rgba(200,255,0,0.4);
          background: rgba(200,255,0,0.03);
        }
        .reg-input::placeholder { color: rgba(255,255,255,0.25); }
        .reg-btn {
          width: 100%;
          padding: 15px;
          background: #c8ff00;
          color: #08080a;
          border: none;
          border-radius: 12px;
          font-family: 'Manrope', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.3px;
        }
        .reg-btn:hover:not(:disabled) { background: #d4ff33; transform: translateY(-1px); }
        .reg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .back-link { color: rgba(255,255,255,0.35); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
        .back-link:hover { color: rgba(255,255,255,0.7); }
        .login-link { color: #c8ff00; font-size: 0.85rem; text-decoration: none; font-weight: 600; transition: opacity 0.2s; }
        .login-link:hover { opacity: 0.8; }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle, rgba(200,255,0,0.04) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, bottom: '5%', left: '-5%', background: 'radial-gradient(circle, rgba(77,159,255,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: 24 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1.1rem', color: '#c8ff00', letterSpacing: -0.5 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </span>
          </Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 8 }}>
            Criar conta
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Preencha os dados para se registrar
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          padding: '32px 28px',
          backdropFilter: 'blur(12px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Nome
              </label>
              <input
                className="reg-input"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                E-mail
              </label>
              <input
                className="reg-input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="reg-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: '1rem', padding: 2, lineHeight: 1 }}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Confirmar Senha
              </label>
              <input
                className="reg-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, fontSize: '0.85rem', color: '#ff6b6b' }}>
                {error}
              </div>
            )}

            <button className="reg-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            Já tem uma conta?{' '}
            <Link to="/login" className="login-link">Entrar</Link>
          </span>
          <Link to="/" className="back-link">← Voltar ao site</Link>
        </div>
      </div>
    </div>
  );
}
