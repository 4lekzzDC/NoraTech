import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function FeatureBullet({ icon, title }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{
        width: 32, height: 32, flexShrink: 0,
        borderRadius: 8,
        background: 'rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#b684ff',
      }}>{icon}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.85)', letterSpacing: -0.1 }}>{title}</div>
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
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 15px 16px;
          color: #eeede9;
          font-family: 'Inter', sans-serif;
          font-size: 0.98rem;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .login-input:focus {
          border-color: #7C3AED;
          background: rgba(124,58,237,0.04);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.18);
        }
        .login-input::placeholder { color: rgba(255,255,255,0.28); }

        .input-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          margin-bottom: 8px;
        }

        .login-btn {
          width: 100%;
          padding: 15px;
          background: #7C3AED;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.98rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .login-btn:hover:not(:disabled) { background: #6d2dd9; }
        .login-btn:active:not(:disabled) { transform: translateY(1px); }
        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .register-link { color: #b684ff; font-size: 0.9rem; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .register-link:hover { color: #d4b3ff; }
        .forgot-link { color: rgba(255,255,255,0.55); font-size: 0.85rem; text-decoration: none; transition: color 0.2s; font-weight: 500; }
        .forgot-link:hover { color: #b684ff; }

        .toggle-pass { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.35); padding: 4px; line-height: 1; display: flex; align-items: center; transition: color 0.2s; }
        .toggle-pass:hover { color: rgba(255,255,255,0.8); }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          transition: color 0.2s ease;
        }
        .back-link:hover { color: #eeede9; }
        .back-link svg { transition: transform 0.2s ease; }
        .back-link:hover svg { transform: translateX(-2px); }

        .wordmark {
          font-family: 'Inter', sans-serif;
          font-weight: 800;
          font-size: 1rem;
          color: #7C3AED;
          letter-spacing: 0.5px;
        }
        .wordmark-tech { color: rgba(255,255,255,0.45); font-weight: 600; }

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
        }
        .form-panel-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .form-panel-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .form-inner {
          width: 100%;
          max-width: 460px;
          position: relative;
          z-index: 1;
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
        }
      `}</style>

      {/* Subtle ambient background — minimal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 800, height: 800, top: '-20%', left: '-15%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.07) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, bottom: '-15%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.04) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      </div>

      <div className="login-split">
        {/* ═══ LEFT: Brand panel (minimal) ═══ */}
        <aside className="brand-panel">
          <Link to="/" className="fade-up fade-up-d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 8, height: 8, background: '#7C3AED', borderRadius: '50%' }} />
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

          <div className="fade-up fade-up-d4" style={{ position: 'relative', zIndex: 1, fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>
            © {new Date().getFullYear()} Noratech. Todos os direitos reservados.
          </div>
        </aside>

        {/* ═══ RIGHT: Form panel (dominant) ═══ */}
        <main className="form-panel">
          <div className="form-panel-top fade-up fade-up-d1">
            <Link to="/" className="mobile-only" style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ width: 7, height: 7, background: '#7C3AED', borderRadius: '50%' }} />
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
              <div className="fade-up fade-up-d2" style={{ marginBottom: 36 }}>
                <h1 style={{
                  fontSize: '2.25rem',
                  fontWeight: 700,
                  letterSpacing: -1.2,
                  marginBottom: 10,
                  lineHeight: 1.15,
                  color: '#eeede9',
                }}>
                  Acesse o painel
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', lineHeight: 1.55 }}>
                  Entre com suas credenciais para continuar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="fade-up fade-up-d3" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
                      style={{ paddingRight: 48 }}
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
                  <div style={{ padding: '12px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.22)', borderRadius: 10, fontSize: '0.88rem', color: '#ff8585' }}>
                    {error}
                  </div>
                )}

                <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <div className="fade-up fade-up-d4" style={{ textAlign: 'center', marginTop: 28 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
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
