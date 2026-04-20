import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TABS = [
  { id: 'cockpit', num: '01', label: 'Cockpit' },
  { id: 'operacao', num: '02', label: 'Operação' },
  { id: 'financeiro', num: '03', label: 'Financeiro' },
  { id: 'oportunidades', num: '04', label: 'Oportunidades' },
  { id: 'comando', num: '05', label: 'Comando' },
];

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatMemberSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

function EmptyGauge() {
  const size = 240;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          strokeDasharray="4 8"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '3.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: -2, lineHeight: 1 }}>—</div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.35)', marginTop: 8, textTransform: 'uppercase' }}>
          Sem operação ativa
        </div>
      </div>
    </div>
  );
}

export default function AreaDoClientePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');

  const firstName = useMemo(() => (user?.name || '').split(' ')[0] || 'você', [user]);
  const initials = useMemo(
    () => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
    [user]
  );
  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user]);
  const systems = [];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .tab-btn:hover { color: rgba(255,255,255,0.9); }
        .btn-ghost:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.2) !important; }
        .btn-primary:hover { background: #d4ff33 !important; transform: translateY(-1px); }
        .system-card:hover { border-color: rgba(124, 58, 237,0.25) !important; background: rgba(255,255,255,0.03) !important; }
        @keyframes pulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.4; } }
        .live-dot { animation: pulse 1.6s ease-in-out infinite; }

        .hdr-row { padding: 0 32px; height: 72px; }
        .hdr-brand-gap { gap: 20px; }
        .hdr-actions-gap { gap: 14px; }
        .main-pad { padding: 28px 32px 96px; }
        .tabs-nav { gap: 36px; margin-bottom: 56px; }
        .hero-grid { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 56px; align-items: center; margin-bottom: 44px; }
        .gauge-wrap { width: 100%; display: flex; justify-content: center; }
        .greeting-title { font-size: clamp(2rem, 4vw, 3rem); }
        .logout-btn-label { display: inline; }

        @media (max-width: 720px) {
          .hdr-row { padding: 0 16px; height: 64px; gap: 12px; }
          .hdr-brand-gap { gap: 10px; }
          .hdr-actions-gap { gap: 8px; }
          .hdr-subtitle { display: none; }
          .hdr-brand-divider { display: none; }
          .hdr-profile-text { display: none !important; }
          .hdr-profile-pill { padding: 4px !important; }
          .logout-btn-label { display: none; }
          .main-pad { padding: 20px 16px 72px; }
          .tabs-nav { gap: 22px; margin-bottom: 32px; }
          .hero-grid { grid-template-columns: 1fr; gap: 24px; margin-bottom: 32px; text-align: center; }
          .gauge-wrap { transform: scale(0.8); transform-origin: center top; margin-bottom: -40px; }
          .greeting-title { font-size: 1.75rem; }
          .greeting-copy { margin-left: auto; margin-right: auto; }
          .empty-card { padding: 28px 18px !important; }
          .empty-cta-row { flex-direction: column; }
          .empty-cta-row > a { width: 100%; text-align: center; }
        }
      `}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="hdr-row" style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div className="hdr-brand-gap" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5, flexShrink: 0 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span className="hdr-brand-divider" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span className="hdr-subtitle" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Central de Controle
            </span>
          </div>

          <div className="hdr-actions-gap" style={{ display: 'flex', alignItems: 'center' }}>
            <Link to="/perfil" className="btn-ghost hdr-profile-pill" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px 6px 6px', borderRadius: 40, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(124, 58, 237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>
                  {initials}
                </div>
              )}
              <div className="hdr-profile-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{user?.name || 'Cliente'}</span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{user?.email}</span>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="btn-ghost"
              style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', sans-serif", fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              aria-label="Sair"
            >
              <span className="logout-btn-label">Sair</span>↗
            </button>
          </div>
        </div>
      </header>

      <main className="main-pad" style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto' }}>
        {/* Tabs */}
        <nav className="tabs-nav" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                className="tab-btn"
                onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#7C3AED' : 'rgba(255,255,255,0.45)', fontSize: '0.92rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: active ? 'rgba(124, 58, 237,0.6)' : 'rgba(255,255,255,0.25)' }}>
                  {t.num}
                </span>
                {t.label}
                {active && (
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#7C3AED', borderRadius: 2 }} />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === 'cockpit' && (
          <>
            {/* Hero row: gauge + greeting */}
            <section className="hero-grid">
              <div className="gauge-wrap" style={{ flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <EmptyGauge />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                  Aguardando ativação
                </div>
              </div>

              <div>
                {memberSince && (
                  <span style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid rgba(124, 58, 237,0.25)', background: 'rgba(124, 58, 237,0.06)', color: '#b197ff', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', fontWeight: 600, letterSpacing: 1, borderRadius: 6, marginBottom: 18 }}>
                    MEMBRO DESDE {memberSince}
                  </span>
                )}
                <h1 className="greeting-title" style={{ fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 14 }}>
                  Olá, <span style={{ color: '#7C3AED' }}>{firstName}</span>
                </h1>
                <p className="greeting-copy" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', maxWidth: 520 }}>
                  Sua Central de Controle ainda não tem sistemas ativos. Quando você contratar um serviço, a operação aparece aqui em tempo real.
                </p>
              </div>
            </section>

            {/* Systems */}
            <section>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
                    Operação
                  </span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                    Seus sistemas em tempo real
                  </h2>
                </div>
              </div>

              {systems.length === 0 ? (
                <div className="empty-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
                    Nenhum sistema contratado
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 10 }}>
                    Você ainda não tem sistemas ativos
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto 22px' }}>
                    Explore nossos serviços ou fale com a Noratech para começar sua operação.
                  </p>
                  <div className="empty-cta-row" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                      to="/servicos/sistemas-sob-medida"
                      className="btn-ghost"
                      style={{ padding: '10px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                    >
                      Ver serviços
                    </Link>
                    <Link
                      to="/#contato"
                      style={{ padding: '10px 18px', background: '#7C3AED', borderRadius: 10, color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      Falar com a Noratech
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {systems.map((s) => (
                    <div
                      key={s.name}
                      className="system-card"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px', transition: 'all 0.2s', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{s.name}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: '#7dff7d', textTransform: 'uppercase', letterSpacing: 1 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7dff7d' }} />
                          {s.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{s.desc}</p>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#7C3AED' }}>{s.metric}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab !== 'cockpit' && (
          <section style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, padding: 48 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
              Em breve
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: -0.6, marginBottom: 8 }}>
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', maxWidth: 420 }}>
              Esta seção está sendo preparada e estará disponível em breve na sua Central de Controle.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
