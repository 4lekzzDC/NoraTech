import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Paleta clara/escura — a tela sempre foi fixa no escuro (o toggle só
// existia de enfeite, sem efeito nenhum). Valores injetados como CSS custom
// properties em .authx-page, referenciados no <style> abaixo via var(...).
const DARK_PALETTE = {
  pageBg: '#08080a', text: '#eeede9', shellBg: '#0c0c10', shellBorder: '#ffffff14',
  inputBg: 'rgba(0,0,0,0.28)', inputBorder: '#ffffff1f', inputBorderHover: '#ffffff33',
  placeholder: '#ffffff52', label: '#ffffffb2', subtitle: '#ffffffb2',
  toggleColor: '#ffffff66', toggleHoverBg: '#ffffff0f', forgot: '#ffffffa6',
  wordmarkSpan: '#ffffff80', backLink: '#ffffffa6', mobileSwitch: '#ffffff99',
  glow1: 'rgba(124,58,237,0.10)', glow2: 'rgba(124,58,237,0.06)',
};
const LIGHT_PALETTE = {
  pageBg: '#eef0f4', text: '#0f1115', shellBg: '#ffffff', shellBorder: 'rgba(15,17,21,0.10)',
  inputBg: '#f6f7fa', inputBorder: 'rgba(15,17,21,0.14)', inputBorderHover: 'rgba(15,17,21,0.24)',
  placeholder: 'rgba(15,17,21,0.35)', label: 'rgba(15,17,21,0.7)', subtitle: 'rgba(15,17,21,0.62)',
  toggleColor: 'rgba(15,17,21,0.45)', toggleHoverBg: 'rgba(15,17,21,0.06)', forgot: 'rgba(15,17,21,0.55)',
  wordmarkSpan: 'rgba(15,17,21,0.45)', backLink: 'rgba(15,17,21,0.55)', mobileSwitch: 'rgba(15,17,21,0.55)',
  glow1: 'rgba(124,58,237,0.06)', glow2: 'rgba(124,58,237,0.04)',
};

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OverlayMark() {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 15, background: '#ffffff24',
      border: '1px solid #ffffff47', display: 'flex', alignItems: 'center',
      justifyContent: 'center', marginBottom: 22,
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
    </div>
  );
}

// Tela de autenticação combinada — login e cadastro no mesmo shell, com o
// painel colorido deslizando de um lado para o outro ao trocar de modo
// (padrão clássico de "sliding auth panel"). A lógica de auth em si (login,
// register, timeout, validação) é a mesma que já existia em cada página
// separada — só a apresentação virou uma só peça.
//
// /login e /registro apontam para este MESMO componente (ver main.jsx) —
// de propósito: se cada rota tivesse seu próprio componente-wrapper, trocar
// de URL faria o React desmontar e remontar tudo, cortando a animação de
// troca de modo no meio (o "turn" nunca chegava a rodar). Com uma única
// instância sobrevivendo à navegação, o modo inicial só precisa ser lido da
// URL uma vez, no primeiro render.
export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(location.pathname === '/registro' ? 'register' : 'login');
  const P = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

  // ── Login state ──
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);

  // ── Register state ──
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  const switchTo = (next) => {
    if (next === mode) return;
    setMode(next);
    navigate(next === 'login' ? '/login' : '/registro', { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const TIMEOUT_MS = 30000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoginLoading(false);
      setLoginError('A conexão demorou demais. Verifique sua internet, desative extensões do navegador e tente novamente.');
    }, TIMEOUT_MS);

    try {
      await login(loginEmail, loginPassword);
      clearTimeout(timeoutId);
      setLoginError('');
      navigate('/area-do-cliente');
    } catch (err) {
      clearTimeout(timeoutId);
      if (!timedOut) setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== confirmPassword) {
      setRegError('As senhas não coincidem');
      return;
    }
    setRegLoading(true);
    try {
      await register(name, regEmail, regPassword);
      navigate('/area-do-cliente');
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="authx-page" style={{
      '--auth-page-bg': P.pageBg, '--auth-text': P.text, '--auth-shell-bg': P.shellBg,
      '--auth-shell-border': P.shellBorder, '--auth-input-bg': P.inputBg, '--auth-input-border': P.inputBorder,
      '--auth-input-border-hover': P.inputBorderHover, '--auth-placeholder': P.placeholder,
      '--auth-label': P.label, '--auth-toggle-color': P.toggleColor, '--auth-toggle-hover-bg': P.toggleHoverBg,
      '--auth-forgot': P.forgot, '--auth-wordmark-span': P.wordmarkSpan, '--auth-back-link': P.backLink,
      '--auth-mobile-switch': P.mobileSwitch, '--auth-glow-1': P.glow1, '--auth-glow-2': P.glow2,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }

        .authx-page {
          min-height: 100vh;
          background: var(--auth-page-bg);
          color: var(--auth-text);
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          position: relative;
          overflow: hidden;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .authx-glow {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 45% at 18% 15%, var(--auth-glow-1) 0%, transparent 60%),
            radial-gradient(ellipse 55% 45% at 85% 90%, var(--auth-glow-2) 0%, transparent 60%);
        }
        .authx-top { position: fixed; top: 22px; left: 0; right: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; }
        .authx-wordmark { font-weight: 800; font-size: 1rem; color: #7C3AED; letter-spacing: 0.5px; text-decoration: none; }
        .authx-wordmark span { color: var(--auth-wordmark-span); font-weight: 600; }
        .authx-back {
          display: inline-flex; align-items: center; gap: 6px; color: var(--auth-back-link);
          text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: color 0.2s ease;
        }
        .authx-back:hover { color: var(--auth-text); }

        .authx-shell {
          position: relative;
          width: 100%;
          max-width: 940px;
          min-height: 600px;
          margin-top: 32px;
          border-radius: 22px;
          overflow: hidden;
          background: var(--auth-shell-bg);
          border: 1px solid var(--auth-shell-border);
          box-shadow: 0 30px 80px -24px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06);
          z-index: 1;
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .authx-input {
          width: 100%; height: 50px; background: var(--auth-input-bg);
          border: 1px solid var(--auth-input-border); border-radius: 12px; padding: 0 16px;
          color: var(--auth-text); font-family: 'Inter', sans-serif; font-size: 0.95rem; outline: none;
          transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }
        .authx-input:hover:not(:focus) { border-color: var(--auth-input-border-hover); }
        .authx-input:focus { border-color: #7C3AED; background: rgba(124,58,237,0.08); box-shadow: 0 0 0 4px rgba(124,58,237,0.18); }
        .authx-input::placeholder { color: var(--auth-placeholder); }
        .authx-label { display: block; font-size: 0.82rem; font-weight: 500; color: var(--auth-label); margin-bottom: 8px; }
        .authx-btn {
          width: 100%; height: 50px; background: #7C3AED; color: #fff; border: none; border-radius: 12px;
          font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 700; cursor: pointer;
          transition: background 0.18s ease, transform 0.12s ease;
        }
        .authx-btn:hover:not(:disabled) { background: #6d2dd9; }
        .authx-btn:active:not(:disabled) { transform: translateY(1px); }
        .authx-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .authx-toggle-pass {
          position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px;
          background: transparent; border: none; border-radius: 8px; cursor: pointer; color: var(--auth-toggle-color);
          display: flex; align-items: center; justify-content: center; transition: color 0.18s ease, background 0.18s ease;
        }
        .authx-toggle-pass:hover { color: var(--auth-text); background: var(--auth-toggle-hover-bg); }
        .authx-forgot { color: var(--auth-forgot); font-size: 0.82rem; text-decoration: none; font-weight: 500; }
        .authx-forgot:hover { color: #7C3AED; }
        .authx-error {
          display: flex; gap: 9px; padding: 12px 14px; background: rgba(255,80,80,0.08);
          border: 1px solid rgba(255,80,80,0.24); border-radius: 10px; font-size: 0.85rem; color: #ff8585; line-height: 1.4;
        }

        /* ── Forms: two absolutely-positioned halves, sharing the same slot ──
           !important nas transitions: a regra global de tema em index.css
           (html[data-theme] *) tem mais especificidade que uma classe simples
           e reescreve o shorthand transition inteiro (sem transform nela),
           anulando a nossa e deixando o transform pular direto pro valor
           final sem animar. */
        .authx-form-container {
          position: absolute; top: 0; width: 50%; height: 100%;
          display: flex; align-items: center; padding: 46px 52px;
          transition: opacity 0.55s ease !important;
        }
        .authx-signin { left: 0; z-index: 2; opacity: 1; }
        .authx-signup { left: 50%; z-index: 1; opacity: 0; pointer-events: none; }
        .authx-shell.is-register .authx-signin { opacity: 0; pointer-events: none; z-index: 1; }
        .authx-shell.is-register .authx-signup { opacity: 1; z-index: 2; pointer-events: auto; }

        /* ── Overlay: colored panel that slides to the opposite side ── */
        .authx-overlay-container {
          position: absolute; top: 0; left: 50%; width: 50%; height: 100%; overflow: hidden;
          will-change: transform;
          transition: transform 0.85s cubic-bezier(0.22,1,0.36,1) !important; z-index: 10;
        }
        .authx-shell.is-register .authx-overlay-container { transform: translateX(-100%); }
        .authx-overlay {
          position: relative; left: -100%; width: 200%; height: 100%;
          background: radial-gradient(ellipse 90% 70% at 30% 20%, rgba(180,132,255,0.35) 0%, transparent 60%), linear-gradient(135deg, #7C3AED 0%, #4c1d95 100%);
          transform: translateX(0); transition: transform 0.85s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .authx-shell.is-register .authx-overlay { transform: translateX(50%); }
        .authx-overlay-panel {
          position: absolute; top: 0; width: 50%; height: 100%; padding: 0 48px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
          transition: opacity 0.55s ease !important;
        }
        .authx-overlay-left { left: 0; opacity: 0; }
        .authx-shell.is-register .authx-overlay-left { opacity: 1; }
        .authx-overlay-right { right: 0; opacity: 1; }
        .authx-shell.is-register .authx-overlay-right { opacity: 0; }
        .authx-overlay-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; color: #fff; margin-bottom: 12px; }
        .authx-overlay-text { font-size: 0.92rem; color: #ffffffd1; line-height: 1.6; margin-bottom: 28px; max-width: 300px; }
        .authx-overlay-btn {
          padding: 11px 30px; border-radius: 11px; border: 1.5px solid #ffffffb2;
          background: transparent; color: #fff; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; transition: background 0.2s ease, color 0.2s ease;
        }
        .authx-overlay-btn:hover { background: #fff; color: #4c1d95; }

        .authx-form-inner { width: 100%; max-width: 380px; margin: 0 auto; }

        @media (max-width: 860px) {
          /* Sem o overlay colorido, os forms ocupam a largura toda,
             empilhados no mesmo lugar — a troca é um fade puro. */
          .authx-shell { min-height: 620px; }
          .authx-overlay-container { display: none; }
          .authx-form-container { left: 0; width: 100%; padding: 34px 24px; }
          .authx-mobile-switch { display: block !important; }
        }
      `}</style>

      <div className="authx-glow" aria-hidden="true" />

      <div className="authx-top">
        <Link to="/" className="authx-wordmark">NORA<span>TECH</span></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="authx-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 19L3.5 12M3.5 12L10.5 5M3.5 12H20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Voltar ao site</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className={`authx-shell ${isRegister ? 'is-register' : ''}`}>
        {/* ═══ Login form ═══ */}
        <div className="authx-form-container authx-signin">
          <div className="authx-form-inner">
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 8 }}>Bem-vindo de volta</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', marginBottom: 28 }}>Entre com suas credenciais para continuar.</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="authx-label" htmlFor="authx-login-email">E-mail</label>
                <input
                  id="authx-login-email"
                  className="authx-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="authx-label" htmlFor="authx-login-password" style={{ marginBottom: 0 }}>Senha</label>
                  <Link to="/recuperar-senha" className="authx-forgot">Esqueci minha senha</Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="authx-login-password"
                    className="authx-input"
                    type={showLoginPass ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowLoginPass((v) => !v)} className="authx-toggle-pass" aria-label={showLoginPass ? 'Ocultar senha' : 'Mostrar senha'}>
                    <EyeIcon open={showLoginPass} />
                  </button>
                </div>
              </div>

              {loginError && (
                <div role="alert" className="authx-error">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{loginError}</span>
                </div>
              )}

              <button className="authx-btn" type="submit" disabled={loginLoading}>
                {loginLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 22, display: 'none' }} className="authx-mobile-switch">
              <span style={{ color: P.mobileSwitch, fontSize: '0.88rem' }}>
                Não tem uma conta?{' '}
                <button type="button" onClick={() => switchTo('register')} style={{ background: 'none', border: 'none', color: '#b684ff', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Criar conta</button>
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Register form ═══ */}
        <div className="authx-form-container authx-signup">
          <div className="authx-form-inner">
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 8 }}>Criar conta</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', marginBottom: 24 }}>Preencha os dados para começar.</p>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="authx-label" htmlFor="authx-reg-name">Nome</label>
                <input
                  id="authx-reg-name"
                  className="authx-input"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="authx-label" htmlFor="authx-reg-email">E-mail</label>
                <input
                  id="authx-reg-email"
                  className="authx-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="authx-label" htmlFor="authx-reg-password">Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="authx-reg-password"
                    className="authx-input"
                    type={showRegPass ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    style={{ paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowRegPass((v) => !v)} className="authx-toggle-pass" aria-label={showRegPass ? 'Ocultar senha' : 'Mostrar senha'}>
                    <EyeIcon open={showRegPass} />
                  </button>
                </div>
              </div>

              <div>
                <label className="authx-label" htmlFor="authx-reg-confirm">Confirmar senha</label>
                <input
                  id="authx-reg-confirm"
                  className="authx-input"
                  type={showRegPass ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {regError && (
                <div role="alert" className="authx-error">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{regError}</span>
                </div>
              )}

              <button className="authx-btn" type="submit" disabled={regLoading} style={{ marginTop: 2 }}>
                {regLoading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18, display: 'none' }} className="authx-mobile-switch">
              <span style={{ color: P.mobileSwitch, fontSize: '0.88rem' }}>
                Já tem uma conta?{' '}
                <button type="button" onClick={() => switchTo('login')} style={{ background: 'none', border: 'none', color: '#b684ff', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Entrar</button>
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Sliding overlay ═══ */}
        <div className="authx-overlay-container">
          <div className="authx-overlay">
            <div className="authx-overlay-panel authx-overlay-left">
              <OverlayMark />
              <div className="authx-overlay-title">Já tem uma conta?</div>
              <p className="authx-overlay-text">Entre com suas credenciais e continue de onde parou.</p>
              <button type="button" className="authx-overlay-btn" onClick={() => switchTo('login')}>Entrar</button>
            </div>
            <div className="authx-overlay-panel authx-overlay-right">
              <OverlayMark />
              <div className="authx-overlay-title">Novo por aqui?</div>
              <p className="authx-overlay-text">Crie sua conta e organize toda a operação da sua empresa em um só lugar.</p>
              <button type="button" className="authx-overlay-btn" onClick={() => switchTo('register')}>Criar conta</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
