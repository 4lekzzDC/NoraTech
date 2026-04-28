import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function FeatureBullet({ icon, title }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ flexShrink: 0, color: '#b684ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', letterSpacing: -0.1 }}>{title}</div>
    </div>
  );
}

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

    const TIMEOUT_MS = 30000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('A conexão demorou demais. Verifique sua internet, desative extensões do navegador e tente novamente.');
    }, TIMEOUT_MS);

    try {
      await login(email, password);
      clearTimeout(timeoutId);
      setError('');
      navigate('/area-do-cliente');
    } catch (err) {
      clearTimeout(timeoutId);
      if (!timedOut) {
        setError(err.message);
      }
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
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-d1 { animation-delay: 0.05s; }
        .fade-up-d2 { animation-delay: 0.12s; }
        .fade-up-d3 { animation-delay: 0.2s; }
        .fade-up-d4 { animation-delay: 0.28s; }

        .login-input {
          width: 100%;
          height: 54px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 0 18px;
          color: #eeede9;
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          line-height: 1.4;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
          transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }
        .login-input:hover:not(:focus) {
          border-color: rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.035);
        }
        .login-input:focus {
          border-color: #7C3AED;
          background: rgba(124,58,237,0.05);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .login-input::placeholder { color: rgba(255,255,255,0.3); }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #eeede9;
          -webkit-box-shadow: 0 0 0 1000px rgba(20,20,22,0.98) inset, 0 0 0 4px rgba(124,58,237,0.18);
          caret-color: #eeede9;
          transition: background-color 9999s ease-in-out 0s;
        }

        .input-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: rgba(255,255,255,0.75);
          margin-bottom: 10px;
          letter-spacing: -0.05px;
        }

        .login-btn {
          width: 100%;
          height: 54px;
          padding: 0 20px;
          background: #7C3AED;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.1px;
          cursor: pointer;
          transition: background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .login-btn:hover:not(:disabled) { background: #6d2dd9; }
        .login-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(124,58,237,0.35);
        }
        .login-btn:active:not(:disabled) { transform: translateY(1px); }
        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .register-link { color: #b684ff; font-size: 0.9rem; text-decoration: none; font-weight: 500; border-radius: 4px; transition: color 0.2s; }
        .register-link:hover { color: #d4b3ff; }
        .register-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(124,58,237,0.32); }
        .forgot-link { color: rgba(255,255,255,0.7); font-size: 0.85rem; text-decoration: none; transition: color 0.2s; font-weight: 500; border-radius: 4px; }
        .forgot-link:hover { color: #b684ff; }
        .forgot-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(124,58,237,0.32); }

        .toggle-pass {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 38px;
          height: 38px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: rgba(255,255,255,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.18s ease, background 0.18s ease;
        }
        .toggle-pass:hover { color: #eeede9; background: rgba(255,255,255,0.06); }
        .toggle-pass:focus-visible { outline: none; color: #eeede9; box-shadow: 0 0 0 3px rgba(124,58,237,0.32); }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          transition: color 0.2s ease;
        }
        .back-link:hover { color: #eeede9; }

        .wordmark {
          font-family: 'Inter', sans-serif;
          font-weight: 800;
          font-size: 1rem;
          color: #7C3AED;
          letter-spacing: 0.5px;
        }
        .wordmark-tech { color: rgba(255,255,255,0.55); font-weight: 600; }

        .login-split { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; }
        .brand-panel {
          flex: 0.85;
          position: relative;
          padding: 48px 64px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .form-panel {
          flex: 1.15;
          position: relative;
          padding: 48px 64px;
          display: flex;
          flex-direction: column;
          isolation: isolate;
        }
        .form-panel-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 65% 55% at 50% 50%, rgba(124,58,237,0.07) 0%, rgba(124,58,237,0.02) 40%, transparent 75%);
          pointer-events: none;
          z-index: 0;
        }
        .form-panel-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .form-panel-body {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .page-noise {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .form-inner {
          width: 100%;
          max-width: 460px;
          position: relative;
          z-index: 1;
        }
        .login-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 36px 36px 32px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 50px -20px rgba(0,0,0,0.55);
        }

        .mobile-only { display: none; }

        @media (max-width: 1080px) {
          .brand-panel { padding: 40px 44px; }
          .form-panel { padding: 40px 44px; }
        }
        @media (max-width: 960px) {
          .brand-panel { display: none; }
          .form-panel { padding: 32px 24px; }
          .mobile-only { display: flex; }
        }
        @media (max-width: 480px) {
          .form-panel { padding: 24px 18px; }
          .login-card { padding: 28px 24px 24px; border-radius: 14px; }
        }
      `}</style>

      <div className="page-noise" aria-hidden="true" />

      <div className="login-split">
        {/* ═══ LEFT: Brand panel (minimal) ═══ */}
        <aside className="brand-panel">
          <Link to="/" className="fade-up fade-up-d1" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', position: 'relative', zIndex: 1 }}>
            <span className="wordmark">
              NORA<span className="wordmark-tech">TECH</span>
            </span>
          </Link>

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            <h2 className="fade-up fade-up-d2" style={{
              fontSize: 'clamp(2rem, 3vw, 2.6rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1.2,
              marginBottom: 32,
              color: '#eeede9',
            }}>
              Sua operação inteira, em um só lugar.
            </h2>

            <div className="fade-up fade-up-d3" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FeatureBullet
                title="Acompanhe projetos e automações em tempo real"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12l2-2 4 4 8-8 4 4" /><path d="M21 16v4H3v-4" />
                  </svg>
                }
              />
              <FeatureBullet
                title="Suporte direto com o time, sem sair do painel"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="fade-up fade-up-d4" style={{ position: 'relative', zIndex: 1, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} Noratech. Todos os direitos reservados.
          </div>
        </aside>

        {/* ═══ RIGHT: Form panel (dominant) ═══ */}
        <main className="form-panel">
          <div className="form-panel-glow" aria-hidden="true" />
          <div className="form-panel-top fade-up fade-up-d1">
            <Link to="/" className="mobile-only" style={{ alignItems: 'center', textDecoration: 'none' }}>
              <span className="wordmark" style={{ fontSize: '0.92rem' }}>
                NORA<span className="wordmark-tech">TECH</span>
              </span>
            </Link>

            <Link to="/" className="back-link" style={{ marginLeft: 'auto' }} aria-label="Voltar ao site">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 19L3.5 12M3.5 12L10.5 5M3.5 12H20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Voltar ao site</span>
            </Link>
          </div>

          <div className="form-panel-body">
            <div className="form-inner">
              <div className="login-card fade-up fade-up-d2">
                <div style={{ marginBottom: 28 }}>
                  <h1 style={{
                    fontSize: '1.85rem',
                    fontWeight: 700,
                    letterSpacing: -1,
                    marginBottom: 8,
                    lineHeight: 1.2,
                    color: '#eeede9',
                  }}>
                    Acesse o painel
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                    Entre com suas credenciais para continuar.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div>
                  <label className="input-label" htmlFor="login-email">E-mail</label>
                  <input
                    id="login-email"
                    className="login-input"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label className="input-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Senha</label>
                    <Link to="/recuperar-senha" className="forgot-link">Esqueci minha senha</Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      className="login-input"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: 52 }}
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="toggle-pass" aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}>
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
                  <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.24)', borderRadius: 12, fontSize: '0.9rem', color: '#ff8585', lineHeight: 1.45 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 6 }}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
                </form>
              </div>

              <div className="fade-up fade-up-d4" style={{ textAlign: 'center', marginTop: 24 }}>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem' }}>
                  Não tem uma conta?{' '}
                  <Link to="/registro" className="register-link">Criar conta</Link>
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
