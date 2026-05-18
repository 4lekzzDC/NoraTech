import { Chart, registerables } from 'chart.js';
import {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth }    from '../../../contexts/AuthContext';
import { useTheme }   from '../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../theme';
import SolucoesHeader from '../components/SolucoesHeader';
import { moduleRoute, HUB_MODULES_BY_SLUG } from '../constants';
import { getStats, logAccess, seedDemoIfEmpty } from '../hubAnalytics';
import { GestaoClientesContent } from '../sistemas/gestao-clientes/GestaoClientesPage';

Chart.register(...registerables);

// ── SVG icon components ────────────────────────────────────────────────────────
function IBuilding({ size = 16, color = '#7C3AED' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
      <path d="M10 21v-5h4v5"/>
      <path d="M9 8h.01M12 8h.01M15 8h.01"/>
      <path d="M9 12h.01M12 12h.01M15 12h.01"/>
    </svg>
  );
}
function IBarChart({ size = 16, color = '#7C3AED' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function ISliders({ size = 16, color = '#7C3AED' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4"  y1="21" x2="4"  y2="14"/>
      <line x1="4"  y1="10" x2="4"  y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8"  x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1"  y1="14" x2="7"  y2="14"/>
      <line x1="9"  y1="8"  x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  );
}

// ── Palette context ────────────────────────────────────────────────────────────
const Ctx = createContext(null);
const useP = () => useContext(Ctx);

// ── Areas ─────────────────────────────────────────────────────────────────────
const AREAS = [
  {
    id: 'contabil', slug: 'contabil', label: 'Contábil',
    desc: 'Gestão contábil completa e análises financeiras.',
    count: 8, accent: '#7C3AED', available: true,
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={c}>
        <path d="M4 2h12l4 4v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" opacity=".15"/>
        <path d="M14 2v4h4M8 13h8M8 17h5M8 9h8" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    id: 'fiscal', slug: 'fiscal', label: 'Fiscal',
    desc: 'Apuração de impostos e obrigações fiscais.',
    count: 5, accent: '#3b82f6', available: false,
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={c}>
        <rect x="3" y="3" width="18" height="18" rx="2" opacity=".15"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="17" cy="17" r="3.5" fill={c} opacity=".2" stroke={c} strokeWidth="1.4"/>
        <path d="M15.5 17h3M17 15.5v3" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'financeiro', slug: 'financeiro', label: 'Financeiro',
    desc: 'Controle financeiro e planejamento estratégico.',
    count: 5, accent: '#10b981', available: false,
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="20" height="14" rx="3" fill={c} opacity=".15"/>
        <path d="M2 10h20" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
        <rect x="5" y="14" width="4" height="2" rx="1" fill={c}/>
        <rect x="11" y="14" width="3" height="2" rx="1" fill={c} opacity=".6"/>
      </svg>
    ),
  },
  {
    id: 'pessoal', slug: 'pessoal', label: 'Pessoal',
    desc: 'Gestão de pessoas e processos de RH.',
    count: 4, accent: '#f97316', available: false,
    icon: (c) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="4" fill={c} opacity=".2"/>
        <circle cx="9" cy="8" r="4" stroke={c} strokeWidth="1.6" fill="none"/>
        <path d="M2 20c0-3.31 3.13-6 7-6s7 2.69 7 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        <path d="M17 5c1.1.28 2 1.27 2 2.5S18.1 9.72 17 10M19.5 20c.94-.97 1.5-2.26 1.5-3.5C21 14.57 19.66 13 18 13" stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTs(ts) {
  if (!ts) return '—';
  const d   = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yesterday.toDateString();
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday)  return `Hoje, ${hhmm}`;
  if (isYest)   return `Ontem, ${hhmm}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hhmm;
}

function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'agora';
  if (diff < 3_600_000)  return `há ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  return fmtTs(ts);
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 54 }) {
  if (user?.photoUrl) {
    return (
      <img
        src={user.photoUrl} alt={user.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(124,58,237,0.25)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,rgba(124,58,237,0.22) 0%,rgba(124,58,237,0.08) 100%)',
      border: '2px solid rgba(124,58,237,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.32), fontWeight: 700, color: '#7C3AED',
    }}>{initials(user?.name)}</div>
  );
}

// ── Line chart ─────────────────────────────────────────────────────────────────
function ActivityChart({ days, isDark }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !days?.length) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const accent = isDark ? '#7C3AED' : '#6d28d9';
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: days.map((d) => d.label),
        datasets: [{
          data: days.map((d) => d.count),
          borderColor: accent,
          backgroundColor: isDark ? 'rgba(124,58,237,0.10)' : 'rgba(109,40,217,0.07)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: accent,
          pointBorderColor: isDark ? '#0c0c12' : '#fff',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.4,
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
            borderWidth: 1, padding: 10, cornerRadius: 8,
            callbacks: { label: (ctx) => ` ${ctx.parsed.y} acessos` },
          },
        },
        scales: {
          x: {
            ticks: { color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,17,21,0.45)', font: { size: 11 } },
            grid: { display: false }, border: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,17,21,0.45)', font: { size: 11 }, stepSize: 5 },
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,17,21,0.05)' },
            border: { display: false },
          },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [days, isDark]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 160, minHeight: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

// ── Carousel ───────────────────────────────────────────────────────────────────
const CAROUSEL_VISIBLE = 5;
const GAP = 12;

function CarouselItem({ event, onClick }) {
  const p    = useP();
  const mod  = HUB_MODULES_BY_SLUG[event.slug];
  const [hov, setHov] = useState(false);
  if (!mod) return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
        padding: '14px 14px 12px',
        borderRadius: 12,
        background: hov ? p.rowHover : p.surface2,
        border: `1px solid ${hov ? 'rgba(124,58,237,0.28)' : p.border}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: p.surface, border: `1px solid ${p.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{mod.icon}</div>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: p.text, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{mod.name}</div>
        <div style={{ fontSize: 10, color: p.muted, marginTop: 3, fontFamily: FONT_MONO }}>{fmtTs(event.ts)}</div>
      </div>
    </button>
  );
}

function RecentCarousel({ recent, onNavigate }) {
  const p    = useP();
  const items = useMemo(() => recent.slice(0, 7), [recent]);
  const [idx, setIdx] = useState(0);
  const containerRef  = useRef(null);
  const [cw, setCw]   = useState(0);

  const maxIdx   = Math.max(0, items.length - CAROUSEL_VISIBLE);
  const dotsCount = maxIdx + 1;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const itemW   = cw > 0 ? (cw - GAP * (CAROUSEL_VISIBLE - 1)) / CAROUSEL_VISIBLE : 0;
  const step    = itemW + GAP;
  const translateX = cw > 0 ? -(idx * step) : 0;

  function prev() { setIdx((i) => Math.max(0, i - 1)); }
  function next() { setIdx((i) => Math.min(maxIdx, i + 1)); }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: p.text }}>Sistemas acessados recentemente</span>
        <Link to="/solucoes-contabeis/contabil" style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, textDecoration: 'none' }}>
          Ver todos →
        </Link>
      </div>

      {/* Track wrapper */}
      <div style={{ position: 'relative', padding: '0 36px' }}>
        {/* Prev arrow */}
        {idx > 0 && (
          <button onClick={prev} style={arrowBtnStyle(p, 'left')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}

        {/* Overflow container */}
        <div ref={containerRef} style={{ overflow: 'hidden', width: '100%' }}>
          {items.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: p.muted, fontSize: 13 }}>
              Nenhum acesso registrado ainda.
            </div>
          ) : (
            <div style={{
              display: 'flex', gap: GAP,
              transform: `translateX(${translateX}px)`,
              transition: 'transform 0.38s cubic-bezier(0.25,0.1,0.25,1)',
            }}>
              {items.map((ev, i) => (
                <div key={i} style={{ flexShrink: 0, width: itemW || 'auto' }}>
                  <CarouselItem
                    event={ev}
                    onClick={() => { logAccess(ev.slug); onNavigate(ev.slug); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next arrow */}
        {idx < maxIdx && (
          <button onClick={next} style={arrowBtnStyle(p, 'right')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}
      </div>

      {/* Dots */}
      {dotsCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {Array.from({ length: dotsCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                width: i === idx ? 18 : 6,
                background: i === idx ? '#7C3AED' : p.border2 || p.border,
                transition: 'all 0.25s cubic-bezier(0.25,0.1,0.25,1)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function arrowBtnStyle(p, dir) {
  return {
    position: 'absolute',
    top: '50%',
    [dir === 'left' ? 'left' : 'right']: 4,
    transform: 'translateY(-50%)',
    width: 28, height: 28, borderRadius: '50%',
    background: p.surfaceSolid || p.surface,
    border: `1px solid ${p.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: p.text,
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    zIndex: 2,
  };
}

// ── Clientes chip-button ───────────────────────────────────────────────────────
function ClientesChip({ onClick }) {
  const p = useP();
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: '1 1 0', padding: '13px 14px', borderRadius: 10,
        background: hov ? 'rgba(124,58,237,0.1)' : p.surface2,
        border: `1px solid ${hov ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.22)'}`,
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(124,58,237,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><IBuilding size={17} color="#7C3AED" /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#7C3AED', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Clientes</div>
        <div style={{ fontSize: 11, color: p.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gestão de clientes</div>
      </div>
    </button>
  );
}

// ── Clientes modal ─────────────────────────────────────────────────────────────
function ClientesModal({ onClose, isDark }) {
  const p = useP();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.28s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 1440px)', height: '88vh',
          background: isDark ? p.bg : '#f5f4fb',
          borderRadius: 20,
          border: isDark ? `1px solid ${p.border}` : '1px solid rgba(0,0,0,0.07)',
          boxShadow: isDark ? '0 25px 80px rgba(0,0,0,0.55)' : '0 20px 70px rgba(0,0,0,0.14)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.97)',
          transition: 'transform 0.32s cubic-bezier(0.25,0.1,0.25,1)',
          fontFamily: FONT_INTER,
        }}
      >
        {/* Modal header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 26px',
          borderBottom: isDark ? `1px solid ${p.border}` : '1px solid #e5e7eb',
          flexShrink: 0,
          background: isDark ? p.surface : '#ffffff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11, flexShrink: 0,
              background: 'rgba(124,58,237,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><IBuilding size={20} color="#7C3AED" /></div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: isDark ? p.text : '#111827', fontFamily: FONT_INTER, letterSpacing: -0.3, lineHeight: 1.2 }}>
                Gestão de Clientes
              </div>
              <div style={{ fontSize: 12, color: isDark ? p.muted : '#9ca3af', marginTop: 2 }}>Gerencie e visualize sua base de clientes</div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'transparent',
              border: isDark ? `1px solid ${p.border}` : '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: isDark ? p.muted : '#6b7280', fontSize: 20, lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >×</button>
        </div>

        {/* Content — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <GestaoClientesContent />
        </div>
      </div>
    </div>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value }) {
  const p = useP();
  return (
    <div style={{
      flex: '1 1 0', padding: '13px 14px', borderRadius: 10,
      background: p.surface2, border: `1px solid ${p.border}`,
      display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(124,58,237,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: p.text, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        <div style={{ fontSize: 11, color: p.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      </div>
    </div>
  );
}

// ── Left card ──────────────────────────────────────────────────────────────────
function LeftCard({ user, stats, isDark, onNavigate, onOpenClientes }) {
  const p = useP();
  const deltaUp   = stats.delta !== null && stats.delta >= 0;
  const deltaColor = deltaUp ? '#34d399' : '#f87171';

  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 18, padding: '28px 28px 24px',
      boxShadow: p.shadow,
      display: 'flex', flexDirection: 'column', gap: 22,
      minWidth: 0, overflow: 'hidden',
    }}>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <Avatar user={user} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: p.text, letterSpacing: -0.4, lineHeight: 1.1 }}>
            {user?.name || 'Usuário'}
          </div>
          <div style={{ fontSize: 13, color: '#7C3AED', fontWeight: 600, marginTop: 3 }}>
            {user?.company || 'Hub Contábil'}
          </div>
          <div style={{ fontSize: 12, color: p.muted, marginTop: 2 }}>
            Bem-vindo ao seu hub de soluções contábeis.
          </div>
        </div>
        {stats.delta !== null && (
          <div style={{
            padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: deltaUp ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
            color: deltaColor,
            border: `1px solid ${deltaUp ? 'rgba(52,211,153,0.28)' : 'rgba(248,113,113,0.28)'}`,
          }}>
            {deltaUp ? '↑' : '↓'} {Math.abs(stats.delta)}% vs mês ant.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="hub-chips-row">
        <StatChip icon={<IBarChart size={17} color="#7C3AED" />} label="Acessos no mês"  value={stats.totalMes} />
        <StatChip icon={<ISliders size={17} color="#7C3AED" />} label="Sistemas usados" value={`${stats.sistemasMes} de 8`} />
        <ClientesChip onClick={onOpenClientes} />
      </div>

      {/* Chart */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Resumo de acessos</span>
          <span style={{ fontSize: 11, color: p.muted, fontFamily: FONT_MONO }}>Últimos 7 dias</span>
        </div>
        <ActivityChart days={stats.days} isDark={isDark} />
      </div>

      {/* Carousel */}
      <div style={{ paddingTop: 4 }}>
        <RecentCarousel recent={stats.recent} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// ── Area card ──────────────────────────────────────────────────────────────────
function AreaCard({ area, onClick }) {
  const p = useP();
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '20px 22px', borderRadius: 16, width: '100%', textAlign: 'left',
        background: hov ? (p.surface2) : p.surface,
        border: `1px solid ${hov ? (area.available ? area.accent + '44' : p.border2 || p.border) : p.border}`,
        cursor: 'pointer',
        transition: 'background 0.16s, border-color 0.16s',
        boxShadow: p.shadow,
        flex: '1 1 0',
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
        background: area.accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.16s',
      }}>
        {area.icon(area.accent)}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: p.text, letterSpacing: -0.2, marginBottom: 4 }}>
          {area.label}
        </div>
        <div style={{ fontSize: 12, color: p.muted, lineHeight: 1.45, marginBottom: 8 }}>
          {area.desc}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600,
          color: area.available ? area.accent : p.muted2,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: area.available ? area.accent : p.muted2,
          }} />
          {area.available
            ? `${area.count} sistemas disponíveis`
            : `${area.count} sistemas · em breve`}
        </div>
      </div>

      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={area.available ? area.accent : p.muted2}
        strokeWidth="2" strokeLinecap="round"
        style={{ flexShrink: 0, opacity: area.available ? 1 : 0.45 }}
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// ── Main hub ───────────────────────────────────────────────────────────────────
export default function SolucoesContabeisHub() {
  const { theme } = useTheme();
  const p         = useMemo(() => getPalette(theme), [theme]);
  const isDark    = theme === 'dark';
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [stats, setStats] = useState(() => {
    seedDemoIfEmpty();
    return getStats();
  });
  const [clientesOpen, setClientesOpen] = useState(false);

  useEffect(() => { setStats(getStats()); }, []);

  const handleNavigate = useCallback((slug) => navigate(moduleRoute(slug)), [navigate]);

  const handleArea = useCallback((area) => navigate(moduleRoute(area.slug)), [navigate]);

  return (
    <Ctx.Provider value={p}>
      <div style={{ minHeight: '100vh', background: p.bg, fontFamily: FONT_INTER, color: p.text }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
          button { font-family: inherit; }
          .hub-outer { max-width: 1300px; margin: 0 auto; padding: 32px 32px 48px; position: relative; z-index: 1; }
          .hub-grid { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 20px; align-items: stretch; }
          .hub-chips-row { display: flex; gap: 10px; }
          @media (max-width: 960px) { .hub-grid { grid-template-columns: 1fr !important; } }
          @media (max-width: 640px) { .hub-outer { padding: 16px 16px 48px !important; } .hub-chips-row { flex-wrap: wrap !important; } }
        `}</style>

        {/* Ambient glow */}
        {isDark && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 700, height: 700, top: '-15%', right: '-8%', background: 'radial-gradient(circle,rgba(124,58,237,0.04) 0%,transparent 60%)', filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', width: 500, height: 500, bottom: '-12%', left: '-6%', background: 'radial-gradient(circle,rgba(59,130,246,0.025) 0%,transparent 60%)', filter: 'blur(60px)' }} />
          </div>
        )}

        <SolucoesHeader />

        <div className="hub-outer">
          <div className="hub-grid">
            {/* Left — main dashboard card */}
            <LeftCard
              user={user}
              stats={stats}
              isDark={isDark}
              onNavigate={handleNavigate}
              onOpenClientes={() => setClientesOpen(true)}
            />

            {/* Right — area cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {AREAS.map((area) => (
                <AreaCard key={area.id} area={area} onClick={() => handleArea(area)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {clientesOpen && <ClientesModal onClose={() => setClientesOpen(false)} isDark={isDark} />}
    </Ctx.Provider>
  );
}
