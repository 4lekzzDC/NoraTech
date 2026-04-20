import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/area-do-cliente');
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
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #eeede9;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .login-input:focus {
          border-color: rgba(124, 58, 237,0.5);
          background: rgba(124, 58, 237,0.03);
          box-shadow: 0 0 0 3px rgba(124, 58, 237,0.08), inset 0 0 0 1px rgba(124, 58, 237,0.15);
        }
        .login-input::placeholder { color: rgba(255,255,255,0.25); }
        .input-wrapper {
          position: relative;
          transition: transform 0.2s ease;
        }
        .input-wrapper:focus-within {
          transform: translateY(-1px);
        }
        .login-btn {
          width: 100%;
          padding: 15px;
          background: #7C3AED;
          color: #08080a;
          border: none;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.3px;
        }
        .login-btn:hover:not(:disabled) { background: #d4ff33; transform: translateY(-1px); }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .back-link { color: rgba(255,255,255,0.35); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
        .back-link:hover { color: rgba(255,255,255,0.7); }
        .register-link { color: #7C3AED; font-size: 0.85rem; text-decoration: none; font-weight: 600; transition: opacity 0.2s; }
        .register-link:hover { opacity: 0.8; }
        .forgot-link { color: rgba(255,255,255,0.35); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
        .forgot-link:hover { color: rgba(124, 58, 237,0.7); }
        .toggle-pass { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px; line-height: 1; display: flex; align-items: center; transition: color 0.2s; }
        .toggle-pass:hover { color: rgba(255,255,255,0.7); }
        .logo-divider {
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124, 58, 237,0.4), transparent);
          margin: 20px auto 0;
        }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
      `}</style>

      {/* Background glows */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.04) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, bottom: '5%', left: '-5%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: 16 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1.1rem', color: '#7C3AED', letterSpacing: -0.5 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </span>
          </Link>
          <div className="logo-divider" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 8, marginTop: 24 }}>
            Acesso ao painel
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Entre com suas credenciais para continuar
          </p>
        </div>

        {/* Card */}
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
                E-mail
              </label>
              <div className="input-wrapper">
                <input
                  className="login-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Senha
                </label>
                <Link to="/recuperar-senha" className="forgot-link">Esqueci minha senha</Link>
              </div>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <input
                  className="login-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 48 }}
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="toggle-pass">
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, fontSize: '0.85rem', color: '#ff6b6b' }}>
                {error}
              </div>
            )}

            <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            Não tem uma conta?{' '}
            <Link to="/registro" className="register-link">Criar conta</Link>
          </span>
          <Link to="/" className="back-link">← Voltar ao site</Link>
        </div>
      </div>
    </div>
  );
}
