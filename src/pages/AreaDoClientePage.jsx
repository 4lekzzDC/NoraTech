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

const STATUS_CARDS = [
  {
    id: 'ok',
    icon: '✓',
    title: 'FUNCIONANDO',
    count: 3,
    color: '#7dff7d',
    bg: 'rgba(125,255,125,0.08)',
    border: 'rgba(125,255,125,0.2)',
    items: [
      'Finzo online — 99.98% uptime',
      'WhatsApp Bot ativo — 892 conversas',
      'Site publicado — 3.2k visitas',
    ],
  },
  {
    id: 'warn',
    icon: '!',
    title: 'ATENÇÃO',
    count: 1,
    color: '#ffb347',
    bg: 'rgba(255,179,71,0.08)',
    border: 'rgba(255,179,71,0.22)',
    items: ['Certificado SSL vence em 12 dias'],
  },
  {
    id: 'grow',
    icon: '↗',
    title: 'EXPANSÃO',
    count: 2,
    color: '#4d9fff',
    bg: 'rgba(77,159,255,0.08)',
    border: 'rgba(77,159,255,0.22)',
    items: ['Upgrade Bot → multicanal disponível', 'Dashboard financeiro recomendado'],
  },
];

const ACTIVITY = [
  { when: 'agora', color: '#7dff7d', text: 'WhatsApp Bot respondeu 3 clientes simultâneos' },
  { when: '2min', color: '#7dff7d', text: 'Finzo sincronizou 12 transações bancárias' },
  { when: '15min', color: '#4d9fff', text: 'Site recebeu 47 visitas orgânicas' },
  { when: '1h', color: '#ffb347', text: 'Certificado SSL — renovação em 12 dias' },
  { when: '3h', color: '#7dff7d', text: 'Backup automático concluído com sucesso' },
];

const SYSTEMS = [
  { name: 'Finzo', desc: 'Gestão financeira integrada', status: 'online', metric: '99.98% uptime' },
  { name: 'WhatsApp Bot', desc: 'Atendimento automatizado', status: 'online', metric: '892 conversas/mês' },
  { name: 'Site institucional', desc: 'Vitrine e captação', status: 'online', metric: '3.2k visitas/mês' },
];

function Gauge({ value }) {
  const size = 240;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(200,255,0,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#c8ff00"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 12px rgba(200,255,0,0.4))', transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '3.6rem', fontWeight: 800, color: '#c8ff00', letterSpacing: -2, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', marginTop: 8, textTransform: 'uppercase' }}>
          Saúde da operação
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Manrope', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Manrope', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .tab-btn:hover { color: rgba(255,255,255,0.9); }
        .tabs-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .tabs-nav::-webkit-scrollbar { display: none; }
        .btn-ghost:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.2) !important; }
        .btn-primary:hover { background: #d4ff33 !important; transform: translateY(-1px); }
        .system-card:hover { border-color: rgba(200,255,0,0.25) !important; background: rgba(255,255,255,0.03) !important; }
        @keyframes pulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.4; } }
        .live-dot { animation: pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(200,255,0,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(77,159,255,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#c8ff00', letterSpacing: -0.5, flexShrink: 0 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Central de Controle
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/perfil" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px 6px 6px', borderRadius: 40, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }} className="btn-ghost">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(200,255,0,0.15)', color: '#c8ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>
                  {initials}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user?.name || 'Cliente'}</span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{user?.email}</span>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="btn-ghost"
              style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontFamily: "'Manrope', sans-serif", fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Sair ↗
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '28px 32px 96px' }}>
        {/* Tabs */}
        <nav className="tabs-nav" style={{ display: 'flex', gap: 36, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 56, overflowX: 'auto' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                className="tab-btn"
                onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#c8ff00' : 'rgba(255,255,255,0.45)', fontSize: '0.92rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: active ? 'rgba(200,255,0,0.6)' : 'rgba(255,255,255,0.25)' }}>
                  {t.num}
                </span>
                {t.label}
                {active && (
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#c8ff00', borderRadius: 2 }} />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === 'cockpit' && (
          <>
            {/* Hero row: gauge + greeting */}
            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 56, alignItems: 'center', marginBottom: 44 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <Gauge value={98} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(125,255,125,0.9)' }}>
                  <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#7dff7d', boxShadow: '0 0 8px rgba(125,255,125,0.6)' }} />
                  Tudo operando
                </div>
              </div>

              <div>
                <span style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid rgba(125,255,125,0.25)', background: 'rgba(125,255,125,0.06)', color: '#7dff7d', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', fontWeight: 600, letterSpacing: 1, borderRadius: 6, marginBottom: 18 }}>
                  CLIENTE DESDE MAR/2024
                </span>
                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 14 }}>
                  Olá, <span style={{ color: '#c8ff00' }}>{firstName}</span>
                </h1>
                <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', maxWidth: 520 }}>
                  Visão em tempo real da sua operação na Noratech.
                </p>
              </div>
            </section>

            {/* Status cards */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 44 }}>
              {STATUS_CARDS.map((card) => (
                <div
                  key={card.id}
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${card.border}`, borderRadius: 16, padding: '22px 24px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 6, background: card.bg, color: card.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                        {card.icon}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: card.color, textTransform: 'uppercase' }}>
                        {card.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color }}>{card.count}</span>
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {card.items.map((item, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, fontSize: '0.88rem', color: 'rgba(255,255,255,0.78)' }}>
                        <span style={{ color: card.color, flexShrink: 0 }}>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {/* Activity feed */}
            <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 28px', marginBottom: 56 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#7dff7d', boxShadow: '0 0 8px rgba(125,255,125,0.6)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Atividade ao vivo
                </span>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {ACTIVITY.map((a, i) => (
                  <li key={i} style={{ display: 'grid', gridTemplateColumns: '14px 80px 1fr', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {a.when}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{a.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Systems */}
            <section>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#c8ff00', textTransform: 'uppercase' }}>
                    Operação
                  </span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                    Seus sistemas em tempo real
                  </h2>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontFamily: "'Manrope', sans-serif", fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  + Novo sistema
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {SYSTEMS.map((s) => (
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
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#c8ff00' }}>{s.metric}</p>
                  </div>
                ))}
              </div>
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
