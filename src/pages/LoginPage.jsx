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

function FeatureBullet({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 36, height: 36, flexShrink: 0,
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(37,99,235,0.1))',
        border: '1px solid rgba(124,58,237,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#b684ff',
        boxShadow: '0 4px 14px -4px rgba(124,58,237,0.3)',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#eeede9', marginBottom: 2, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{desc}</div>
      </div>
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        @keyframes float1 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(12px,-18px) rotate(3deg); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-15px,12px) rotate(-2deg); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,14px); } }
        @keyframes grain { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-5%,-10%); } 30% { transform: translate(3%,-15%); } 50% { transform: translate(12%,9%); } 70% { transform: translate(9%,4%); } 90% { transform: translate(-1%,7%); } }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          80%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes bar-grow {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to { transform: scaleY(1); opacity: 1; }
        }
        .fade-up { animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-d1 { animation-delay: 0.05s; }
        .fade-up-d2 { animation-delay: 0.15s; }
        .fade-up-d3 { animation-delay: 0.25s; }
        .fade-up-d4 { animation-delay: 0.35s; }
        .fade-up-d5 { animation-delay: 0.45s; }

        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          color: #eeede9;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
        }
        .login-input:focus {
          border-color: rgba(124, 58, 237,0.65);
          background: rgba(124, 58, 237,0.05);
          box-shadow: 0 0 0 4px rgba(124, 58, 237,0.12);
        }
        .login-input::placeholder { color: rgba(255,255,255,0.25); transition: color 0.3s ease; }
        .login-input:focus::placeholder { color: rgba(255,255,255,0.45); }
        .input-wrapper { position: relative; }
        .input-label {
          display: block;
          font-size: 0.76rem;
          font-weight: 600;
          color: rgba(255,255,255,0.55);
          margin-bottom: 8px;
          letter-spacing: 0.2px;
          transition: color 0.3s ease;
        }
        .input-group:focus-within .input-label {
          color: #b684ff;
        }
        .login-btn {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #7C3AED 0%, #6028c8 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.3px;
          box-shadow: 0 8px 24px -8px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.15);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 32px -10px rgba(124,58,237,0.7), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
        .login-btn .arrow { transition: transform 0.25s ease; display: inline-flex; }
        .login-btn:hover:not(:disabled) .arrow { transform: translateX(3px); }

        .register-link { color: #b684ff; font-size: 0.85rem; text-decoration: none; font-weight: 600; transition: color 0.2s; }
        .register-link:hover { color: #d4b3ff; }
        .forgot-link { color: rgba(255,255,255,0.5); font-size: 0.78rem; text-decoration: none; transition: color 0.2s; font-weight: 500; }
        .forgot-link:hover { color: #b684ff; }

        .toggle-pass { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px; line-height: 1; display: flex; align-items: center; transition: color 0.2s; }
        .toggle-pass:hover { color: rgba(255,255,255,0.75); }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px 8px 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 0.78rem;
          font-weight: 500;
          backdrop-filter: blur(12px);
          transition: all 0.25s ease;
        }
        .back-link:hover {
          background: rgba(124, 58, 237,0.1);
          border-color: rgba(124, 58, 237,0.35);
          color: #eeede9;
        }
        .back-link svg { transition: transform 0.25s ease; }
        .back-link:hover svg { transform: translateX(-3px); }

        /* Split-screen layout */
        .login-split { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; }
        .brand-panel {
          flex: 1.1;
          position: relative;
          padding: 44px 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
          gap: 32px;
        }
        .form-panel {
          flex: 0.9;
          position: relative;
          padding: 44px 56px;
          display: flex;
          flex-direction: column;
        }
        .form-panel-top {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }
        .form-panel-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .form-inner { width: 100%; max-width: 400px; position: relative; z-index: 1; }

        .form-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.012) 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 36px 32px;
          backdrop-filter: blur(14px);
          box-shadow: 0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
          position: relative;
        }
        .form-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, rgba(124,58,237,0.35), transparent 40%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .form-card-glow {
          position: absolute;
          inset: -40px -40px auto -40px;
          height: 200px;
          background: radial-gradient(ellipse at center top, rgba(124,58,237,0.18) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .brand-stat-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.4rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 0%, #b684ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .brand-stat-label {
          font-size: 0.66rem;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 1.4px;
          margin-top: 4px;
          font-weight: 600;
        }

        /* Decorative dashboard preview card */
        .preview-card {
          position: relative;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(12,12,14,0.95) 100%);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 18px 20px;
          box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }
        .preview-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top right, rgba(124,58,237,0.08), transparent 60%);
          pointer-events: none;
        }
        .preview-bar {
          width: 14px;
          background: linear-gradient(180deg, #7C3AED, #4f1ec9);
          border-radius: 3px 3px 0 0;
          transform-origin: bottom;
          animation: bar-grow 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }

        .form-mobile-header { display: none; }

        @media (max-width: 1080px) {
          .brand-panel { padding: 40px 44px; }
          .form-panel { padding: 40px 44px; }
        }
        @media (max-width: 960px) {
          .brand-panel { display: none; }
          .form-panel { flex: 1; padding: 32px 24px; }
          .form-mobile-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        }
        @media (max-width: 480px) {
          .form-panel { padding: 24px 16px; }
          .form-card { padding: 28px 22px; }
        }
      `}</style>

      {/* Animated background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.025, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", animation: 'grain 8s steps(10) infinite' }} />
        <div style={{ position: 'absolute', width: 900, height: 900, top: '-25%', left: '-15%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.09) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 700, height: 700, bottom: '-20%', left: '15%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.06) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, top: '20%', right: '-15%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.04) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at 30% 40%, black 10%, transparent 65%)' }} />
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <Star size={14} color="rgba(124, 58, 237,0.18)" style={{ position: 'absolute', top: '14%', left: '6%', animation: 'float1 7s ease-in-out infinite' }} />
        <Star size={10} color="rgba(37, 99, 235,0.15)" style={{ position: 'absolute', top: '38%', left: '40%', animation: 'float2 9s ease-in-out infinite' }} />
        <Diamond size={10} color="rgba(255,107,157,0.18)" style={{ position: 'absolute', top: '72%', left: '5%', animation: 'float3 8s ease-in-out infinite' }} />
        <Star size={8} color="rgba(124, 58, 237,0.14)" style={{ position: 'absolute', top: '82%', left: '36%', animation: 'float1 11s ease-in-out infinite' }} />
        <Diamond size={8} color="rgba(255,138,61,0.14)" style={{ position: 'absolute', top: '22%', left: '50%', animation: 'float2 10s ease-in-out infinite' }} />
      </div>

      <div className="login-split">
        {/* ═══ LEFT: Brand panel ═══ */}
        <aside className="brand-panel">
          {/* Top: wordmark */}
          <div className="fade-up fade-up-d1" style={{ position: 'relative', zIndex: 1 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ position: 'relative', width: 8, height: 8 }}>
                <div style={{ width: 8, height: 8, background: '#7C3AED', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px solid #7C3AED', animation: 'pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite' }} />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1rem', color: '#7C3AED', letterSpacing: -0.5 }}>
                NORA<span style={{ color: 'rgba(255,255,255,0.35)' }}>TECH</span>
              </span>
            </Link>
          </div>

          {/* Middle: marketing copy */}
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
            <div className="fade-up fade-up-d1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', marginBottom: 22,
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 100,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', boxShadow: '0 0 8px #7C3AED' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b684ff', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Painel do cliente
              </span>
            </div>

            <h2 className="fade-up fade-up-d2" style={{
              fontSize: 'clamp(2rem, 3.2vw, 2.9rem)',
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1.4,
              marginBottom: 18,
            }}>
              Sua operação <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600, color: '#7C3AED' }}>inteira</span>,
              <br />em um só lugar.
            </h2>

            <p className="fade-up fade-up-d3" style={{
              fontSize: '0.98rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)', marginBottom: 32, maxWidth: 460,
            }}>
              Acompanhe projetos, automações e integrações em tempo real. Tudo o que sua equipe construiu com a Noratech ao alcance de um clique.
            </p>

            <div className="fade-up fade-up-d4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FeatureBullet
                title="Projetos em tempo real"
                desc="Status, entregas e métricas atualizadas direto do nosso pipeline."
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12l2-2 4 4 8-8 4 4" /><path d="M21 16v4H3v-4" />
                  </svg>
                }
              />
              <FeatureBullet
                title="Suporte direto com o time"
                desc="Abra solicitações, acompanhe respostas e tickets sem sair do painel."
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                }
              />
              <FeatureBullet
                title="Acesso seguro"
                desc="Criptografia em todas as etapas e autenticação dedicada por conta."
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Bottom: stats + decorative preview */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Decorative dashboard widget */}
            <div className="fade-up fade-up-d5 preview-card" style={{ maxWidth: 520 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>
                    Automações · últimos 7 dias
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', fontWeight: 700, color: '#eeede9', letterSpacing: -0.5 }}>2.847</span>
                    <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 10h-5v6h-6v-6H4z"/></svg>
                      12,4%
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', boxShadow: '0 0 8px #7C3AED' }} />
                  <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Ao vivo</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 50 }}>
                {[42, 58, 38, 72, 55, 88, 95, 64, 78, 92, 70, 84].map((h, i) => (
                  <div key={i} className="preview-bar" style={{
                    height: `${h}%`,
                    flex: 1,
                    opacity: 0.55 + (i / 24),
                    animationDelay: `${0.5 + i * 0.04}s`,
                  }} />
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="fade-up fade-up-d5" style={{
              display: 'flex', gap: 28, paddingTop: 18,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexWrap: 'wrap',
            }}>
              {[['50+', 'Clientes'], ['200+', 'Automações'], ['99.9%', 'Uptime'], ['24/7', 'Suporte']].map(([val, label]) => (
                <div key={label}>
                  <div className="brand-stat-num">{val}</div>
                  <div className="brand-stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ═══ RIGHT: Form panel ═══ */}
        <main className="form-panel">
          {/* Top bar with mobile wordmark + back link (desktop shows only back link, right-aligned) */}
          <div className="form-panel-top fade-up fade-up-d1">
            <div className="form-mobile-header" style={{ flex: 1 }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5 }}>
                  NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
                </span>
              </Link>
            </div>
            <Link to="/" className="back-link" aria-label="Voltar ao site">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 19L3.5 12M3.5 12L10.5 5M3.5 12H20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Voltar ao site</span>
            </Link>
          </div>

          <div className="form-panel-body">
            <div className="form-inner">
              <div className="fade-up fade-up-d2" style={{ marginBottom: 24, textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -1, marginBottom: 8, lineHeight: 1.15 }}>
                  Bem-vindo de{' '}
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600, color: '#7C3AED' }}>volta</span>
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                  Entre com suas credenciais para acessar o painel.
                </p>
              </div>

              <div className="fade-up fade-up-d3" style={{ position: 'relative' }}>
                <div className="form-card-glow" />
                <div className="form-card">
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="input-group">
                      <label className="input-label">E-mail</label>
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

                    <div className="input-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label className="input-label" style={{ marginBottom: 0 }}>Senha</label>
                        <Link to="/recuperar-senha" className="forgot-link">Esqueci minha senha</Link>
                      </div>
                      <div className="input-wrapper">
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
                      <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, fontSize: '0.85rem', color: '#ff6b6b' }}>
                        {error}
                      </div>
                    )}

                    <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                      {loading ? (
                        'Entrando...'
                      ) : (
                        <>
                          Entrar
                          <span className="arrow" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              <div className="fade-up fade-up-d4" style={{ textAlign: 'center', marginTop: 24 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
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
