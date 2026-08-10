import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme }   from '../../../../contexts/ThemeContext';
import { useAuth }    from '../../../../contexts/AuthContext';
import { getPalette, FONT_INTER } from '../../theme';
import { moduleRoute, HUB_MODULES_BY_SLUG } from '../../constants';
import { getStats, logAccess, seedDemoIfEmpty } from '../../hubAnalytics';

Chart.register(...registerables);

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'agora';
  if (diff < 3_600_000)  return `há ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  const d    = new Date(ts);
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
// Tab icons
function IBank({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22"/>
      <line x1="6" y1="18" x2="6"  y2="11"/>
      <line x1="10" y1="18" x2="10" y2="11"/>
      <line x1="14" y1="18" x2="14" y2="11"/>
      <line x1="18" y1="18" x2="18" y2="11"/>
      <polygon points="12 2 20 7 4 7"/>
    </svg>
  );
}
function ITruck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function IPieChart({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  );
}

// Sidebar metric icons
function IActivity({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function ILayoutGrid({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3"  y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IClock({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// System card icons (inherit currentColor → set white on parent)
function IFileCode({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="10 13 8 15 10 17"/>
      <polyline points="14 13 16 15 14 17"/>
    </svg>
  );
}
function IArrows({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4"/>
      <path d="M4 7h16"/>
      <path d="M16 21l4-4-4-4"/>
      <path d="M20 17H4"/>
    </svg>
  );
}
function IRefreshCw({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function IBox({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  );
}
function IStar({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#7C3AED" stroke="#7C3AED" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IChevronRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function ICalendarCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
      <polyline points="9 16 11 18 15 14"/>
    </svg>
  );
}
function IBarChart2({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}
// ── Catalogue ─────────────────────────────────────────────────────────────────
const SUBCATS = [
  {
    id: 'extrato', label: 'Extrato', TabIcon: IBank,
    desc: 'Codificação, conciliação e transformação de extratos bancários.',
    items: [
      { name: 'Codificador de Arquivos',  CardIcon: IFileCode,  accent: '#3b82f6', slug: 'codificador',          desc: 'Codifique extratos bancários para importação no Domínio Contábil.' },
      { name: 'Conciliador de Extratos',  CardIcon: IArrows,    accent: '#f97316', slug: 'conciliador-extratos', desc: 'Concilie automaticamente o razão contábil com o extrato bancário.' },
      { name: 'Transformador de Extrato', CardIcon: IRefreshCw, accent: '#6366f1', slug: 'transformador-extrato', desc: 'Converta extratos em PDF para Excel com extração estruturada.' },
    ],
  },
  {
    id: 'fornecedores', label: 'Fornecedores', TabIcon: ITruck,
    desc: 'Conciliação e controle de pagamentos a fornecedores.',
    items: [
      { name: 'Conciliador de Fornecedores', CardIcon: IArrows, accent: '#10b981', slug: 'conciliador-fornecedores', desc: 'Identifique notas com pagamento pendente ou pago em excesso cruzando compras e pagamentos.' },
    ],
  },
  {
    id: 'demonstracoes', label: 'Demonstrações', TabIcon: IPieChart,
    desc: 'Análise de demonstrações contábeis e indicadores financeiros.',
    items: [
      { name: 'Análise de Demonstrações', CardIcon: IPieChart, accent: '#f59e0b', slug: 'analise-demonstracoes', desc: 'Importe DRE, Balanço e Balancete e gere dashboards com indicadores e relatórios em PDF.' },
    ],
  },
  {
    id: 'fechamento', label: 'Fechamento', TabIcon: ICalendarCheck,
    desc: 'Controle mensal do fechamento contábil por empresa.',
    items: [
      { name: 'Acompanhamento Contábil', CardIcon: IBarChart2, accent: '#7C3AED', slug: 'acompanhamento-contabil', desc: 'Status mensal por empresa: arquivos, conciliação e prazos.' },
    ],
  },
];

// ── Mini line chart (sidebar) ──────────────────────────────────────────────────
function MiniChart({ days, isDark }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !days?.length) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const accent = '#7C3AED';
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: days.map((d) => d.label),
        datasets: [{
          data: days.map((d) => d.count),
          borderColor: accent,
          backgroundColor: isDark ? 'rgba(124,58,237,0.09)' : 'rgba(124,58,237,0.07)',
          borderWidth: 1.8,
          pointRadius: 3,
          pointBackgroundColor: accent,
          pointBorderColor: isDark ? '#08080a' : '#fff',
          pointBorderWidth: 1.5,
          fill: true, tension: 0.42,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1a1820' : '#fff',
            titleColor: isDark ? '#eeede9' : '#0f1115',
            bodyColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,17,21,0.6)',
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,17,21,0.1)',
            borderWidth: 1, padding: 8, cornerRadius: 7,
            callbacks: { label: (ctx) => ` ${ctx.parsed.y} acessos` },
          },
        },
        scales: {
          x: {
            ticks: { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,17,21,0.4)', font: { size: 10 } },
            grid: { display: false }, border: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,17,21,0.4)', font: { size: 10 }, stepSize: 5 },
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            border: { display: false },
          },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [days, isDark]);

  return (
    <div style={{ position: 'relative', height: 112, width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 52 }) {
  if (user?.photoUrl) {
    return <img src={user.photoUrl} alt={user.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(124,58,237,0.25)', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(124,58,237,0.08))',
      border: '2px solid rgba(124,58,237,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.32), fontWeight: 700, color: '#7C3AED', letterSpacing: 0.5,
    }}>{initials(user?.name)}</div>
  );
}

// ── Left sidebar ───────────────────────────────────────────────────────────────
function LeftSidebar({ P, isDark, stats, user }) {
  const card = { background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, boxShadow: P.shadow };
  const METRICS = [
    { Icon: IActivity,   value: stats.totalMes,                    label: 'Acessos no mês' },
    { Icon: ILayoutGrid, value: `${stats.sistemasMes} de 8`,        label: 'Sistemas usados' },
    { Icon: IClock,      value: fmtRelative(stats.lastAccess),      label: 'Último acesso' },
  ];

  return (
    <div className="contabil-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* User + metrics */}
      <div style={{ ...card, padding: '22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <Avatar user={user} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text, letterSpacing: -0.3, lineHeight: 1.2 }}>
              {user?.name || 'Usuário'}
            </div>
            <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>
              {user?.company || 'Hub Contábil'}
            </div>
            <div style={{ fontSize: 11, color: P.muted, marginTop: 3, lineHeight: 1.45 }}>
              Bem-vindo ao seu hub de soluções contábeis.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {METRICS.map(({ Icon, value, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: isDark ? 'rgba(255,255,255,0.025)' : '#f8f8fc',
              border: `1px solid ${P.border}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'rgba(124,58,237,0.11)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED',
              }}><Icon size={13} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent accesses */}
      {stats.recent.length > 0 && (
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.text }}>Últimos acessados</span>
            <Link to="/solucoes-contabeis" style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>
              Ver todos
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.recent.slice(0, 4).map((ev, i) => {
              const mod = HUB_MODULES_BY_SLUG[ev.slug];
              if (!mod) return null;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0, fontSize: 14,
                    background: isDark ? P.surface2 : '#f5f4fb',
                    border: `1px solid ${P.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{mod.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mod.name}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: P.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtRelative(ev.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mini chart */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: P.text }}>Resumo de acessos</span>
          <span style={{ fontSize: 10, color: P.muted, fontWeight: 500 }}>Últimos 7 dias</span>
        </div>
        <MiniChart days={stats.days} isDark={isDark} />
        <Link to="/solucoes-contabeis" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: '#7C3AED', fontWeight: 600, marginTop: 12,
        }}>
          Ver todos os acessos →
        </Link>
      </div>
    </div>
  );
}

// ── System card ────────────────────────────────────────────────────────────────
function SystemCard({ item, P, isDark, onNavigate }) {
  const [hov, setHov] = useState(false);
  const soon = !!item.soon;
  const canHov = hov && !soon;
  return (
    <button
      onClick={soon ? undefined : onNavigate}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', position: 'relative',
        background: canHov ? (isDark ? 'rgba(255,255,255,0.03)' : '#fafafd') : P.surface,
        border: `1px solid ${canHov ? item.accent + '55' : P.border}`,
        borderRadius: 14, padding: '22px 20px 18px',
        cursor: soon ? 'default' : 'pointer', textAlign: 'left', fontFamily: FONT_INTER,
        color: P.text, boxShadow: canHov ? `0 4px 20px ${item.accent}18` : P.shadow,
        transition: 'all 0.18s ease',
        transform: canHov ? 'translateY(-2px)' : 'translateY(0)',
        opacity: soon ? 0.72 : 1,
      }}
    >
      {/* Em breve badge */}
      {soon && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          padding: '3px 8px', borderRadius: 20,
          background: isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.1)',
          color: '#7C3AED',
          border: '1px solid rgba(124,58,237,0.25)',
        }}>Em breve</div>
      )}

      {/* Icon box */}
      <div style={{
        width: 54, height: 54, borderRadius: 14, marginBottom: 16,
        background: item.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: `0 4px 14px ${item.accent}42`,
        transition: 'box-shadow 0.18s',
      }}>
        <item.CardIcon size={24} />
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8, letterSpacing: -0.2, lineHeight: 1.3 }}>
        {item.name}
      </div>
      <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.6, flex: 1, marginBottom: 18 }}>
        {item.desc}
      </div>

      {/* Arrow button */}
      {!soon && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: canHov ? item.accent : (isDark ? P.surface2 : '#f5f4fb'),
            border: `1px solid ${canHov ? item.accent : P.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: canHov ? '#fff' : item.accent,
            transition: 'all 0.18s',
          }}>
            <IChevronRight size={14} />
          </div>
        </div>
      )}
    </button>
  );
}

// ── Right panel ────────────────────────────────────────────────────────────────
function RightPanel({ P, isDark, active, activeId, onSelect, onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

      {/* Tab strip */}
      <nav style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 14, padding: 5, boxShadow: P.shadow,
      }}>
        {SUBCATS.map((sc) => {
          const on = sc.id === activeId;
          return (
            <button
              key={sc.id}
              onClick={() => onSelect(sc.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 15px', borderRadius: 10,
                background: on ? P.primarySoft : 'transparent',
                border: `1px solid ${on ? P.primaryBorder : 'transparent'}`,
                color: on ? P.primaryText : P.muted,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: FONT_INTER, transition: 'all 0.15s',
              }}
            >
              <sc.TabIcon size={15} />
              {sc.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                background: on ? P.primarySoft : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,17,21,0.06)'),
                color: on ? P.primaryText : P.muted2,
              }}>{sc.items.length}</span>
            </button>
          );
        })}
      </nav>

      {/* Category banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '26px 30px', borderRadius: 16,
        background: isDark
          ? 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(99,102,241,0.06))'
          : 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.04) 100%)',
        border: `1px solid ${P.primaryBorder}`,
        position: 'relative', overflow: 'hidden',
        boxShadow: P.shadow,
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -24, right: 130, width: 120, height: 120, borderRadius: '50%', background: 'rgba(124,58,237,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 14, right: 54,  width: 72,  height: 72,  borderRadius: '50%', background: 'rgba(99,102,241,0.08)',  pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
          <div style={{
            width: 62, height: 62, borderRadius: 16, flexShrink: 0,
            background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.primaryText,
          }}>
            <active.TabIcon size={26} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: P.text, marginBottom: 6, lineHeight: 1.1 }}>
              {active.label}
            </div>
            <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.55, maxWidth: 460 }}>
              {active.desc}
            </div>
          </div>
        </div>

        {/* Ghost illustration */}
        <div className="contabil-banner-ghost" style={{ color: P.primaryText, opacity: 0.12, flexShrink: 0, zIndex: 1, pointerEvents: 'none' }}>
          <active.TabIcon size={86} />
        </div>
      </div>

      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.primaryText,
        }}><IBox size={14} /></div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.text, lineHeight: 1.2 }}>
            Sistemas de {active.label}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 1 }}>
            {(() => {
              const avail = active.items.filter((it) => !it.soon).length;
              const total = active.items.length;
              if (avail === total) return `${total} ${total === 1 ? 'sistema disponível' : 'sistemas disponíveis'}`;
              return `${avail} de ${total} ${total === 1 ? 'sistema disponível' : 'sistemas disponíveis'}`;
            })()}
          </div>
        </div>
      </div>

      {/* System cards grid */}
      <div className="contabil-sys-grid">
        {active.items.map((item, i) => (
          <SystemCard
            key={item.slug ?? `soon-${i}`}
            item={item}
            P={P}
            isDark={isDark}
            onNavigate={item.soon ? undefined : () => { logAccess(item.slug); onNavigate(item.slug); }}
          />
        ))}
      </div>

      {/* Tip strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 12, boxShadow: P.shadow,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: P.primarySoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IStar size={15} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Dica rápida</span>
          <span style={{ fontSize: 13, color: P.muted, marginLeft: 8 }}>
            Utilize os sistemas em sequência para um fluxo contábil mais eficiente e seguro.
          </span>
        </div>
        <Link to="/solucoes-contabeis" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          fontSize: 12, color: '#7C3AED', fontWeight: 600,
        }}>
          Saiba mais sobre o fluxo <IChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ContabilPage() {
  const navigate     = useNavigate();
  const [params, setParams] = useSearchParams();
  const { theme }    = useTheme();
  const { user }     = useAuth();
  const P            = useMemo(() => getPalette(theme), [theme]);
  const isDark       = theme === 'dark';

  const [stats, setStats] = useState(() => { seedDemoIfEmpty(); return getStats(); });
  useEffect(() => { setStats(getStats()); }, []);

  const initial  = params.get('sub') || SUBCATS[0].id;
  const [activeId, setActiveId] = useState(SUBCATS.some((s) => s.id === initial) ? initial : SUBCATS[0].id);
  const active   = useMemo(() => SUBCATS.find((s) => s.id === activeId) || SUBCATS[0], [activeId]);

  const handleSelect = (id) => {
    setActiveId(id);
    const next = new URLSearchParams(params);
    next.set('sub', id);
    setParams(next, { replace: true });
  };

  const handleNavigate = (slug) => navigate(moduleRoute(slug));

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; }
        .contabil-layout { display: grid; grid-template-columns: 282px 1fr; gap: 20px; align-items: start; }
        @media (max-width: 900px) { .contabil-layout { grid-template-columns: 1fr; } .contabil-sidebar { display: none !important; } }
        .contabil-sys-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 860px) { .contabil-sys-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { .contabil-sys-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .contabil-banner-ghost { display: none !important; } .contabil-banner { padding: 18px 20px !important; } }
        @media (max-width: 560px) { .contabil-main { padding: 16px 16px 64px !important; } }
      `}</style>

      {isDark && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 700, height: 700, top: '-15%', right: '-8%', background: 'radial-gradient(circle,rgba(124,58,237,0.04) 0%,transparent 60%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', width: 500, height: 500, bottom: '-12%', left: '-6%', background: 'radial-gradient(circle,rgba(59,130,246,0.025) 0%,transparent 60%)', filter: 'blur(60px)' }} />
        </div>
      )}

      <SolucoesHeader />

      <main className="contabil-main" style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 28px 64px', position: 'relative', zIndex: 1 }}>
        <div className="contabil-layout">
          <LeftSidebar P={P} isDark={isDark} stats={stats} user={user} />
          <RightPanel
            P={P} isDark={isDark}
            active={active} activeId={activeId}
            onSelect={handleSelect}
            onNavigate={handleNavigate}
          />
        </div>
      </main>
    </div>
  );
}
