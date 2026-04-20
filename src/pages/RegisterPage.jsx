import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Star({ size = 12, color = 'rgba(124, 58, 237,0.3)', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, ...style }}>
      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" />
    </svg>
  );
}

function Diamond({ size = 12, color = 'rgba(124, 58, 237,0.3)', style = {} }) {
  return <div style={{ width: size, height: size, background: color, transform: 'rotate(45deg)', borderRadius: 2, flexShrink: 0, ...style }} />;
}

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
      await register(name, email, password);
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
        @keyframes float1 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(12px,-18px) rotate(3deg); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-15px,12px) rotate(-2deg); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,14px); } }
        @keyframes grain { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-5%,-10%); } 30% { transform: translate(3%,-15%); } 50% { transform: translate(12%,9%); } 70% { transform: translate(9%,4%); } 90% { transform: translate(-1%,7%); } }
        .reg-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #eeede9;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
        }
        .reg-input:focus {
          border-color: rgba(124, 58, 237,0.6);
          background: rgba(124, 58, 237,0.05);
          box-shadow: 0 0 0 4px rgba(124, 58, 237,0.12), inset 0 0 0 1px rgba(124, 58, 237,0.2);
        }
        .reg-input::placeholder { color: rgba(255,255,255,0.25); transition: color 0.3s ease; }
        .reg-input:focus::placeholder { color: rgba(255,255,255,0.45); }
        .input-wrapper {
          position: relative;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .input-wrapper:focus-within {
          transform: translateY(-2px) scale(1.01);
        }
        .input-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: color 0.3s ease, letter-spacing 0.3s ease;
        }
        .input-group:focus-within .input-label {
          color: rgba(124, 58, 237,0.9);
          letter-spacing: 0.8px;
        }
        .reg-btn {
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
        .reg-btn:hover:not(:disabled) { background: #d4ff33; transform: translateY(-1px); }
        .reg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .login-link { color: #7C3AED; font-size: 0.85rem; text-decoration: none; font-weight: 600; transition: opacity 0.2s; }
        .login-link:hover { opacity: 0.8; }
        .toggle-pass { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px; line-height: 1; display: flex; align-items: center; transition: color 0.2s; }
        .toggle-pass:hover { color: rgba(255,255,255,0.7); }
        .section-divider {
          width: 100%;
          max-width: 260px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124, 58, 237,0.35), rgba(37, 99, 235,0.3), transparent);
          margin: 28px auto 28px;
          position: relative;
        }
        .section-divider::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
          width: 6px;
          height: 6px;
          background: #7C3AED;
          border-radius: 1px;
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.7);
        }
        .back-site-btn {
          position: fixed;
          top: 24px;
          left: 24px;
          z-index: 10;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px 10px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 500;
          backdrop-filter: blur(12px);
          transition: all 0.25s ease;
        }
        .back-site-btn:hover {
          background: rgba(124, 58, 237,0.08);
          border-color: rgba(124, 58, 237,0.3);
          color: #eeede9;
          transform: translateX(-2px);
        }
        .back-site-btn svg { transition: transform 0.25s ease; }
        .back-site-btn:hover svg { transform: translateX(-3px); }
        @media (max-width: 480px) {
          .back-site-btn { top: 16px; left: 16px; padding: 8px 12px 8px 10px; font-size: 0.76rem; }
          .back-site-btn-label { display: none; }
        }
      `}</style>

      {/* ═══ ANIMATED BACKGROUND (same as home page) ═══ */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", animation: 'grain 8s steps(10) infinite' }} />
        <div style={{ position: 'absolute', width: 800, height: 800, top: '-15%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 55%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, bottom: '10%', left: '-10%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 55%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at 50% 30%, black 10%, transparent 60%)' }} />
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <Star size={14} color="rgba(124, 58, 237,0.15)" style={{ position: 'absolute', top: '12%', left: '8%', animation: 'float1 7s ease-in-out infinite' }} />
        <Star size={10} color="rgba(37, 99, 235,0.12)" style={{ position: 'absolute', top: '35%', right: '12%', animation: 'float2 9s ease-in-out infinite' }} />
        <Diamond size={10} color="rgba(255,107,157,0.15)" style={{ position: 'absolute', top: '60%', left: '5%', animation: 'float3 8s ease-in-out infinite' }} />
        <Star size={8} color="rgba(124, 58, 237,0.1)" style={{ position: 'absolute', top: '75%', right: '8%', animation: 'float1 11s ease-in-out infinite' }} />
        <Diamond size={8} color="rgba(255,138,61,0.12)" style={{ position: 'absolute', top: '20%', right: '25%', animation: 'float2 10s ease-in-out infinite' }} />
      </div>

      {/* ═══ BACK TO SITE BUTTON ═══ */}
      <Link to="/" className="back-site-btn" aria-label="Voltar ao site">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.5 19L3.5 12M3.5 12L10.5 5M3.5 12H20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="back-site-btn-label">Voltar ao site</span>
      </Link>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="nora-n-grad-r" x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7C3AED"/>
                  <stop offset="100%" stopColor="#2563EB"/>
                </linearGradient>
                <linearGradient id="nora-accent-grad-r" x1="30" y1="6" x2="42" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB"/>
                  <stop offset="100%" stopColor="#7C3AED"/>
                </linearGradient>
              </defs>
              <path d="M10 40 V10 H17 L32 30 V10 H38 V40 H31 L16 20 V40 Z" fill="url(#nora-n-grad-r)"/>
              <path d="M32 10 H38 V22 L32 16 Z" fill="url(#nora-accent-grad-r)" opacity="0.85"/>
            </svg>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1.15rem', color: '#eeede9', letterSpacing: -0.5 }}>
              Nora<span style={{ color: 'rgba(255,255,255,0.35)' }}>tech</span>
            </span>
          </Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 8, marginTop: 18 }}>
            Criar conta
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            Preencha os dados para se registrar
          </p>
        </div>

        {/* Visual divider between logo and card */}
        <div className="section-divider" />

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          padding: '32px 28px',
          backdropFilter: 'blur(12px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="input-group">
              <label className="input-label">Nome</label>
              <div className="input-wrapper">
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
            </div>

            <div className="input-group">
              <label className="input-label">E-mail</label>
              <div className="input-wrapper">
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
            </div>

            <div className="input-group">
              <label className="input-label">Senha</label>
              <div className="input-wrapper">
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

            <div className="input-group">
              <label className="input-label">Confirmar Senha</label>
              <div className="input-wrapper">
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

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            Já tem uma conta?{' '}
            <Link to="/login" className="login-link">Entrar</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
