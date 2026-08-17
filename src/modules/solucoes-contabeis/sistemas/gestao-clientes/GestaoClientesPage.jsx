import { Chart, registerables } from 'chart.js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import SolucoesHeader from '../../components/SolucoesHeader';
import {
  TRIBUT_COLORS, TRIBUT_OPTIONS, RAMO_ATIVIDADE_OPTIONS, RAMO_LABEL_BY_ID,
  getClientes, saveCliente, deleteCliente,
  getBancos, buscarCNPJ, buscarCEP, geocode,
} from './gcService';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';

Chart.register(...registerables);

// ── SVG icon components ────────────────────────────────────────────────────────
function IUsers({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IUserCheck({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  );
}
function IGlobe({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
function ITag({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function IMapPin({ size = 16, color = '#7C3AED' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
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
function IClock({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// ── Contexts ───────────────────────────────────────────────────────────────────
const PaletteCtx = createContext(null);
const useP        = () => useContext(PaletteCtx);
const CompanyCtx  = createContext(null);
const useCompanyId = () => useContext(CompanyCtx);

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9000,
      background: '#1e1e2e', border: '1px solid rgba(139,61,255,0.4)',
      color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 13,
      fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'fadeIn .2s ease',
    }}>{msg}</div>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, accent, icon, sub, isDark }) {
  const p   = useP();
  const col = accent || '#7C3AED';
  return (
    <div style={{
      background: isDark ? p.surface : '#ffffff',
      border: isDark ? `1px solid ${p.border}` : '1px solid #e5e7eb',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: isDark ? 'none' : '0 1px 8px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: col + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: col,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: isDark ? p.muted : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: isDark ? p.muted : '#9ca3af' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Chart box ─────────────────────────────────────────────────────────────────
function ChartBox({ config, height = 200 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !config) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(canvasRef.current, config);
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [config]);

  return <canvas ref={canvasRef} style={{ maxHeight: height }} />;
}

// ── Status pill ────────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const active = status !== 'inativo';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: active ? '#15803d' : '#b91c1c' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#22c55e' : '#f87171', flexShrink: 0 }} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function TributPill({ tributacao }) {
  const color = TRIBUT_COLORS[tributacao] || TRIBUT_COLORS['Outro'];
  return (
    <span style={{
      display: 'inline-block', padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: color + '18', color, border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>{tributacao || '—'}</span>
  );
}

// ── Map card ───────────────────────────────────────────────────────────────────
function MapCard({ clientes, isDark }) {
  const p          = useP();
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const withCoords   = clientes.filter((c) => c.lat && c.lng);
  const coordKey     = withCoords.map((c) => `${c.id}:${c.lat}:${c.lng}`).join(',');

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const tiles = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const map = L.map(containerRef.current, { center: [-15.77, -47.93], zoom: 4, zoomControl: true, scrollWheelZoom: false, attributionControl: false });
    L.tileLayer(tiles, { maxZoom: 19 }).addTo(map);
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:13px;height:13px;border-radius:50%;background:#7C3AED;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
      iconSize: [13, 13], iconAnchor: [6, 6], popupAnchor: [0, -10],
    });
    const lls = [];
    withCoords.forEach((c) => {
      const ll = [c.lat, c.lng]; lls.push(ll);
      L.marker(ll, { icon }).bindPopup(`<strong style="font-size:13px">${c.name}</strong><br/><span style="color:#888;font-size:12px">${[c.cidade, c.estado].filter(Boolean).join(' / ')}</span>`).addTo(map);
    });
    if (lls.length === 1)    map.setView(lls[0], 8);
    else if (lls.length > 1) map.fitBounds(lls, { padding: [30, 30] });
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [coordKey, isDark]);

  const divider = `1px solid ${isDark ? p.border : 'rgba(0,0,0,0.07)'}`;

  return (
    <div style={{
      background: isDark ? p.surface : '#ffffff',
      border: isDark ? `1px solid ${p.border}` : '1px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      boxShadow: isDark ? 'none' : '0 2px 14px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '13px 16px', borderBottom: divider, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(124,58,237,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IMapPin size={14} /></div>
          <span style={{ fontWeight: 700, fontSize: 13, color: isDark ? p.text : '#111827' }}>Localização dos clientes</span>
        </div>
        <span style={{ fontSize: 11, color: isDark ? p.muted : '#9ca3af' }}>
          {withCoords.length}/{clientes.length} com coordenadas
        </span>
      </div>
      {withCoords.length === 0 ? (
        <div style={{ height: 236, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: isDark ? p.muted : '#9ca3af', fontSize: 13, textAlign: 'center', padding: '0 28px', gap: 8 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Salve um cliente com cidade preenchida para ver no mapa.</span>
        </div>
      ) : (
        <div ref={containerRef} style={{ height: 236, width: '100%' }} />
      )}
    </div>
  );
}

// ── Client initials avatar ─────────────────────────────────────────────────────
function ClientInitials({ name }) {
  const letters = (name || '?').split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const hue = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},45%,88%)`,
      color: `hsl(${hue},55%,36%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
    }}>{letters}</div>
  );
}

// ── Home panel ─────────────────────────────────────────────────────────────────
function HomePanel({ clientes, isDark, onGo, onRefresh }) {
  const p         = useP();
  const companyId = useCompanyId();
  const [chartTab, setChartTab] = useState('tribut');

  const ativos   = clientes.filter((c) => c.status !== 'inativo').length;
  const estados  = [...new Set(clientes.map((c) => c.estado).filter(Boolean))];
  const tcount   = {};
  clientes.forEach((c) => { const t = c.tributacao || 'Outro'; tcount[t] = (tcount[t] || 0) + 1; });
  const top      = Object.entries(tcount).sort((a, b) => b[1] - a[1])[0];

  // Background geocoding — runs when:
  //   (a) client has no coords at all, or
  //   (b) client has city-level coords but now has a street address or CEP for higher precision
  useEffect(() => {
    const hasBetterData = (c) =>
      c.logradouro || (c.cep || '').replace(/\D/g, '').length === 8;

    const queue = clientes.filter((c) => {
      if (!c.cidade && !c.cep) return false;
      if (!c.lat) return true;
      return c.geo_level === 'city' && hasBetterData(c);
    }).slice(0, 10);

    if (!queue.length) return;
    let cancelled = false;
    (async () => {
      for (const c of queue) {
        if (cancelled) break;
        await geocode(c, companyId);
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) onRefresh?.();
    })();
    return () => { cancelled = true; };
  }, [clientes.map((c) => `${c.id}:${c.geo_level ?? ''}:${c.logradouro ?? ''}:${c.cep ?? ''}`).join('|')]);

  const tributChartCfg = useMemo(() => {
    const labels = Object.keys(tcount);
    if (!labels.length) return null;
    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: Object.values(tcount), backgroundColor: labels.map((l) => TRIBUT_COLORS[l] || '#8899aa'), borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` } },
        },
      },
    };
  }, [JSON.stringify(tcount)]);

  const estadoChartCfg = useMemo(() => {
    const estCount = {};
    clientes.forEach((c) => { if (c.estado) estCount[c.estado] = (estCount[c.estado] || 0) + 1; });
    const sorted = Object.entries(estCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length) return null;
    return {
      type: 'bar',
      data: {
        labels: sorted.map(([e]) => e),
        datasets: [{ data: sorted.map(([, n]) => n), backgroundColor: sorted.map((_, i) => `hsl(${260 + i * 10},55%,${isDark ? 62 : 58}%)`), borderRadius: 4, borderWidth: 0 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: isDark ? '#8899aa' : '#9ca3af', stepSize: 1, font: { size: 11 } }, grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' }, border: { display: false } },
          y: { ticks: { color: isDark ? '#ccc' : '#374151', font: { size: 12 } }, grid: { display: false }, border: { display: false } },
        },
      },
    };
  }, [JSON.stringify(clientes), isDark]);

  const tributEntries = Object.entries(tcount).sort((a, b) => b[1] - a[1]);

  const card    = { background: isDark ? p.surface : '#ffffff', border: isDark ? `1px solid ${p.border}` : '1px solid #e5e7eb', borderRadius: 14, boxShadow: isDark ? 'none' : '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' };
  const divider = `1px solid ${isDark ? p.border : '#f3f4f6'}`;
  const txt     = isDark ? p.text  : '#111827';
  const muted   = isDark ? p.muted : '#9ca3af';
  const sub2    = isDark ? p.muted : '#6b7280';

  const now = new Date();
  const updatedAt = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ padding: '18px 22px', background: isDark ? p.bg : '#f5f4fb', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <MetricCard isDark={isDark} label="Clientes cadastrados" value={clientes.length} accent="#7C3AED" icon={<IUsers />}      sub="Total de clientes registrados" />
        <MetricCard isDark={isDark} label="Clientes ativos"      value={ativos}          accent="#16a34a" icon={<IUserCheck />} sub="Clientes com movimentação" />
        <MetricCard isDark={isDark} label="Estados"              value={estados.length}  accent="#2563eb" icon={<IGlobe />}     sub="Unidades da federação" />
        <MetricCard isDark={isDark} label="Regime predominante"  value={top ? top[0] : '—'} accent="#7C3AED" icon={<ITag />}  sub="Regime mais utilizado" />
      </div>

      {/* ── Map + Chart ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 12 }}>
        <MapCard clientes={clientes} isDark={isDark} />

        <div style={card}>
          <div style={{ padding: '13px 16px', borderBottom: divider, display: 'flex', gap: 8 }}>
            {[{ id: 'tribut', label: 'Tributação' }, { id: 'estados', label: 'Estados' }].map((t) => (
              <button key={t.id} onClick={() => setChartTab(t.id)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: chartTab === t.id ? '#7C3AED' : 'transparent',
                color: chartTab === t.id ? '#fff' : muted,
                border: `1px solid ${chartTab === t.id ? '#7C3AED' : isDark ? p.border : 'rgba(0,0,0,0.12)'}`,
                transition: 'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: '14px 16px' }}>
            {chartTab === 'tribut' && (
              tributChartCfg ? (
                <div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
                      <ChartBox config={tributChartCfg} height={148} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tributEntries.map(([t, n]) => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: TRIBUT_COLORS[t] || '#8899aa', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, flex: 1, color: isDark ? p.text : '#374151' }}>{t}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: txt, minWidth: 24, textAlign: 'right' }}>{n}</span>
                          <span style={{ fontSize: 11, color: muted, minWidth: 38, textAlign: 'right' }}>{clientes.length ? Math.round(n / clientes.length * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: divider, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: muted }}>
                    <IClock size={13} color={muted} />
                    Dados atualizados em {updatedAt}
                  </div>
                </div>
              ) : <EmptyState message="Nenhum cliente cadastrado ainda." compact />
            )}
            {chartTab === 'estados' && (
              estadoChartCfg
                ? <div style={{ position: 'relative', height: 220 }}><ChartBox config={estadoChartCfg} height={220} /></div>
                : <EmptyState message="Adicione clientes com estado preenchido." compact />
            )}
          </div>
        </div>
      </div>

      {/* ── Recent clients ── */}
      <div style={card}>
        <div style={{ padding: '13px 18px', borderBottom: divider, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(124,58,237,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IBuilding size={14} /></div>
            <span style={{ fontWeight: 700, fontSize: 13, color: txt }}>Clientes recentes</span>
          </div>
          <button
            onClick={() => onGo('clientes')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: '#7C3AED',
              border: '1px solid rgba(124,58,237,0.3)',
            }}
          >
            Ver todos os clientes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {clientes.length === 0 ? (
            <EmptyState message="Nenhum cliente cadastrado ainda." compact />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['RAZÃO SOCIAL', 'CNPJ', 'CIDADE/UF', 'TRIBUTAÇÃO', 'STATUS'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: muted, borderBottom: divider, background: isDark ? p.surface2 : '#fafafa', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.slice(0, 6).map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < Math.min(clientes.length, 6) - 1 ? divider : 'none' }}>
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ClientInitials name={c.name} />
                        <div>
                          <div style={{ fontWeight: 600, color: txt, fontSize: 13 }}>{c.name}</div>
                          {c.trade_name && <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{c.trade_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: FONT_MONO, fontSize: 12, color: sub2, verticalAlign: 'middle' }}>{c.cnpj || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: sub2, verticalAlign: 'middle' }}>{[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}</td>
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}><TributPill tributacao={c.tributacao} /></td>
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clientes panel ─────────────────────────────────────────────────────────────
function ClientesPanel({ clientes, onEdit, onDelete, onPerfil }) {
  const p = useP();
  const [search, setSearch]     = useState('');
  const [filterTrib, setFilter] = useState('');

  const lista = useMemo(() => {
    let l = clientes;
    if (search) l = l.filter((c) => `${c.name}${c.cnpj}${c.cidade}${c.trade_name}`.toLowerCase().includes(search.toLowerCase()));
    if (filterTrib) l = l.filter((c) => c.tributacao === filterTrib);
    return l;
  }, [clientes, search, filterTrib]);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CNPJ ou cidade…"
          style={{ ...inputStyle(p), maxWidth: 300 }}
        />
        <select value={filterTrib} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle(p), width: 200 }}>
          <option value="">Todas as tributações</option>
          {TRIBUT_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => onEdit(null)} style={btnStyle(p, true)}>＋ Novo Cliente</button>
      </div>

      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, overflowX: 'auto' }}>
        {lista.length === 0 ? (
          <EmptyState message={clientes.length === 0 ? 'Nenhum cliente cadastrado. Clique em + Novo Cliente para começar.' : 'Nenhum resultado para a busca.'} compact />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{['Razão Social / Fantasia', 'CNPJ', 'Tributação', 'Cidade/UF', 'Telefone', 'Status', ''].map((h) => (
                <th key={h} style={thStyle(p)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${p.border}` }}>
                  <td style={tdStyle(p)}>
                    <div style={{ fontWeight: 600, color: p.text }}>{c.name}</div>
                    {c.trade_name && <div style={{ fontSize: 11, color: p.muted, marginTop: 1 }}>{c.trade_name}</div>}
                  </td>
                  <td style={{ ...tdStyle(p), fontFamily: FONT_MONO, fontSize: 12, color: p.muted }}>{c.cnpj || '—'}</td>
                  <td style={tdStyle(p)}><TributPill tributacao={c.tributacao} /></td>
                  <td style={{ ...tdStyle(p), color: p.muted2 }}>{[c.cidade, c.estado].filter(Boolean).join('/') || '—'}</td>
                  <td style={{ ...tdStyle(p), color: p.muted }}>{c.phone || '—'}</td>
                  <td style={tdStyle(p)}><StatusPill status={c.status} /></td>
                  <td style={{ ...tdStyle(p), whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconBtn title="Ver perfil" onClick={() => onPerfil(c.id)}>👁</IconBtn>
                      <IconBtn title="Editar" onClick={() => onEdit(c.id)}>✏️</IconBtn>
                      <IconBtn title="Excluir" onClick={() => onDelete(c.id)} danger>🗑</IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  const p = useP();
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 6, border: `1px solid ${danger ? 'rgba(248,113,113,0.3)' : p.border}`,
      background: danger ? 'rgba(248,113,113,0.08)' : p.surface2,
      cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

// ── Perfil panel ───────────────────────────────────────────────────────────────
// Row fica fora do PerfilPanel de propósito: declarado dentro, virava um tipo
// de componente novo a cada render, o que faz o React desmontar e remontar
// todas as linhas em vez de atualizá-las.
function Row({ label, value }) {
  const p = useP();
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '7px 0', borderBottom: `1px solid ${p.border}`,
    }}>
      <span style={{ fontSize: 11, color: p.muted, width: 140, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: p.text, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function PerfilPanel({ cliente, onEdit, onBack }) {
  const p         = useP();
  const companyId = useCompanyId();
  const bancos    = useMemo(() => getBancos(cliente.id, companyId), [cliente.id, companyId]);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: p.text }}>{cliente.name}</h2>
          <div style={{ fontSize: 13, color: p.muted, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {cliente.cnpj && <span style={{ fontFamily: FONT_MONO }}>{cliente.cnpj}</span>}
            {cliente.tributacao && <TributPill tributacao={cliente.tributacao} />}
            <StatusPill status={cliente.status} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={btnStyle(p, false)}>← Voltar</button>
          <button onClick={() => onEdit(cliente.id)} style={btnStyle(p, true)}>✏️ Editar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Dados cadastrais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12 }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${p.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Dados cadastrais</span>
            </div>
            <div style={{ padding: '10px 18px' }}>
              <Row label="Razão Social"    value={cliente.name} />
              <Row label="Nome Fantasia"   value={cliente.trade_name} />
              <Row label="CNPJ"            value={cliente.cnpj} />
              <Row label="Tributação"      value={cliente.tributacao} />
              <Row label="Atividade/CNAE"  value={cliente.atividade} />
              <Row label="Ramo"            value={RAMO_LABEL_BY_ID[cliente.ramo_atividade]} />
              <Row label="Capital Social"  value={cliente.capital_social} />
              <Row label="E-mail"          value={cliente.email} />
              <Row label="Telefone"        value={cliente.phone} />
              <Row label="Logradouro"      value={[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(', ')} />
              <Row label="Bairro"          value={cliente.bairro} />
              <Row label="Cidade/UF"       value={[cliente.cidade, cliente.estado].filter(Boolean).join(' / ')} />
              <Row label="CEP"             value={cliente.cep} />
            </div>
          </div>

          {/* Sócios */}
          <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12 }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${p.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Quadro Societário</span>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {(cliente.socios || []).length === 0 ? (
                <span style={{ fontSize: 13, color: p.muted }}>Nenhum sócio cadastrado.</span>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>{['Nome', 'CPF', 'Quota'].map((h) => <th key={h} style={thStyle(p)}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(cliente.socios || []).map((s, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${p.border}` }}>
                        <td style={{ ...tdStyle(p), fontWeight: 500 }}>{s.nome}</td>
                        <td style={{ ...tdStyle(p), fontFamily: FONT_MONO, fontSize: 12 }}>{s.cpf || '—'}</td>
                        <td style={tdStyle(p)}>{s.quota || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Contas bancárias */}
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Contas Bancárias</span>
            <span style={{ fontSize: 11, color: p.muted }}>via Codificador de Extrato</span>
          </div>
          <div style={{ padding: '14px 18px' }}>
            {bancos.length === 0 ? (
              <div style={{ fontSize: 13, color: p.muted, lineHeight: 1.6 }}>
                Nenhuma conta cadastrada.<br />
                Adicione no <strong>Codificador de Extrato → Configurações → Contas</strong>.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Banco', 'Código contábil', 'Label'].map((h) => <th key={h} style={thStyle(p)}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {bancos.map((b) => (
                    <tr key={b.id || b.code} style={{ borderBottom: `1px solid ${p.border}` }}>
                      <td style={tdStyle(p)}>{b.bank_name || '—'}</td>
                      <td style={{ ...tdStyle(p), fontFamily: FONT_MONO, fontSize: 12 }}>{b.code || '—'}</td>
                      <td style={{ ...tdStyle(p), color: p.muted }}>{b.label || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client modal (new / edit) ──────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', trade_name: '', cnpj: '', email: '', phone: '', tributacao: '', atividade: '',
  cnae: '', ramo_atividade: '',
  capital_social: '', status: 'ativo', cep: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', socios: [],
};

function ClienteModal({ clienteId, clientes, onClose, onSaved, onToast }) {
  const p         = useP();
  const companyId = useCompanyId();
  const existing = clienteId ? clientes.find((c) => c.id === clienteId) : null;
  const [form, setForm] = useState(existing ? { ...EMPTY_FORM, ...existing } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState('');

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleCNPJ() {
    setLoading('cnpj');
    try {
      const data = await buscarCNPJ(form.cnpj);
      setForm((f) => ({ ...f, ...data }));
      onToast('Dados preenchidos pelo CNPJ!');
    } catch (e) { onToast('Erro: ' + e.message); }
    finally { setLoading(''); }
  }

  async function handleCEP() {
    if (!form.cep || form.cep.replace(/\D/g, '').length !== 8) return;
    setLoading('cep');
    try {
      const data = await buscarCEP(form.cep);
      setForm((f) => ({ ...f, ...data }));
      onToast('Endereço preenchido pelo CEP!');
    } catch { /* silent */ }
    finally { setLoading(''); }
  }

  function addSocio() { setForm((f) => ({ ...f, socios: [...f.socios, { nome: '', cpf: '', quota: '' }] })); }
  function removeSocio(i) { setForm((f) => ({ ...f, socios: f.socios.filter((_, j) => j !== i) })); }
  function setSocio(i, field, val) {
    setForm((f) => {
      const socios = [...f.socios];
      socios[i] = { ...socios[i], [field]: val };
      return { ...f, socios };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { onToast('Informe a Razão Social'); return; }
    // Regime e ramo são obrigatórios porque sistemas a jusante (Calculadora de
    // IRPJ/CSLL) escolhem alíquota a partir deles. Cadastro sem esses campos
    // vira erro de apuração, não só ficha incompleta.
    if (!form.tributacao) { onToast('Informe o Regime Tributário'); return; }
    if (!form.ramo_atividade) { onToast('Informe o Ramo de Atividade'); return; }
    const data = { ...form, socios: form.socios.filter((s) => s.nome) };
    const saved = saveCliente(data, clienteId || null, companyId);
    onSaved();
    onToast('Cliente salvo! Disponível em todos os sistemas.');
    if (saved.cidade && !saved.lat) geocode(saved, companyId).then(() => onSaved());
    onClose();
  }

  const section = (label) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: p.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 10px' }}>{label}</div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14,
        padding: 28, width: 620, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: p.text }}>
          {clienteId ? 'Editar Cliente' : 'Novo Cliente'}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: p.muted }}>Dados cadastrais da empresa</p>

        {section('Identificação')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00" style={inputStyle(p)} />
            <button onClick={handleCNPJ} disabled={loading === 'cnpj'} style={{ ...btnStyle(p, false), whiteSpace: 'nowrap' }}>
              {loading === 'cnpj' ? '…' : '🔍 Buscar'}
            </button>
          </div>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle(p)}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <input value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="Razão Social *" style={inputStyle(p)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={form.trade_name} onChange={(e) => set('trade_name', e.target.value)}
            placeholder="Nome Fantasia" style={inputStyle(p)} />
          <select value={form.tributacao} onChange={(e) => set('tributacao', e.target.value)}
            style={{ ...inputStyle(p), borderColor: form.tributacao ? p.border : p.red }}>
            <option value="">Regime Tributário *</option>
            {TRIBUT_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <input value={form.atividade} onChange={(e) => set('atividade', e.target.value)}
            placeholder="Atividade principal (CNAE)" style={inputStyle(p)} />
        </div>
        {/* Classificação fechada, separada da descrição livre do CNAE acima:
            é ela que define o percentual de presunção no Lucro Presumido. */}
        <div style={{ marginBottom: 4 }}>
          <select value={form.ramo_atividade} onChange={(e) => set('ramo_atividade', e.target.value)}
            style={{ ...inputStyle(p), borderColor: form.ramo_atividade ? p.border : p.red }}>
            <option value="">Ramo de Atividade *</option>
            {RAMO_ATIVIDADE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: p.muted2, marginBottom: 10, lineHeight: 1.45 }}>
          Define a presunção de IRPJ/CSLL no Lucro Presumido. Preenchido pelo CNAE quando o código é conclusivo.
        </div>

        {section('Contato')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={form.email} onChange={(e) => set('email', e.target.value)}
            type="email" placeholder="E-mail" style={inputStyle(p)} />
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
            placeholder="Telefone" style={inputStyle(p)} />
        </div>

        {section('Endereço')}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px', gap: 10, marginBottom: 10 }}>
          <input value={form.cep} onChange={(e) => set('cep', e.target.value)} onBlur={handleCEP}
            placeholder="CEP" style={inputStyle(p)} />
          <input value={form.logradouro} onChange={(e) => set('logradouro', e.target.value)}
            placeholder="Logradouro" style={inputStyle(p)} />
          <input value={form.numero} onChange={(e) => set('numero', e.target.value)}
            placeholder="Nº" style={inputStyle(p)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={form.complemento} onChange={(e) => set('complemento', e.target.value)}
            placeholder="Complemento" style={inputStyle(p)} />
          <input value={form.bairro} onChange={(e) => set('bairro', e.target.value)}
            placeholder="Bairro" style={inputStyle(p)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 10 }}>
          <input value={form.cidade} onChange={(e) => set('cidade', e.target.value)}
            placeholder="Cidade" style={inputStyle(p)} />
          <input value={form.estado} onChange={(e) => set('estado', e.target.value.toUpperCase())}
            placeholder="UF" maxLength={2} style={inputStyle(p)} />
        </div>

        {section('Quadro Societário')}
        <div style={{ marginBottom: 10 }}>
          <input value={form.capital_social} onChange={(e) => set('capital_social', e.target.value)}
            placeholder="Capital Social (ex: R$ 10.000,00)" style={inputStyle(p)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {form.socios.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 100px 30px', gap: 6, alignItems: 'center' }}>
              <input value={s.nome} onChange={(e) => setSocio(i, 'nome', e.target.value)}
                placeholder="Nome completo" style={inputStyle(p)} />
              <input value={s.cpf} onChange={(e) => setSocio(i, 'cpf', e.target.value)}
                placeholder="CPF" style={inputStyle(p)} />
              <input value={s.quota} onChange={(e) => setSocio(i, 'quota', e.target.value)}
                placeholder="% quota" style={inputStyle(p)} />
              <button onClick={() => removeSocio(i)} style={{
                width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(248,113,113,0.3)',
                background: 'rgba(248,113,113,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 14,
              }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={addSocio} style={{ ...btnStyle(p, false), alignSelf: 'flex-start', fontSize: 12, marginBottom: 18 }}>
          ＋ Adicionar Sócio
        </button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: `1px solid ${p.border}` }}>
          <button onClick={onClose} style={btnStyle(p, false)}>Cancelar</button>
          <button onClick={handleSave} style={btnStyle(p, true)}>Salvar cliente</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function EmptyState({ message, compact }) {
  const p = useP();
  return (
    <div style={{
      border: compact ? 'none' : `1px dashed ${p.border}`, borderRadius: compact ? 0 : 10,
      padding: compact ? '20px 18px' : '36px 20px', textAlign: 'center', color: p.muted, fontSize: 13,
    }}>{message}</div>
  );
}

function thStyle(p) {
  return {
    textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600,
    color: p.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `1px solid ${p.border}`, background: p.surface2, whiteSpace: 'nowrap',
  };
}
function tdStyle(p) { return { padding: '10px 14px', fontSize: 13, color: p.text, verticalAlign: 'middle' }; }
function btnStyle(p, primary) {
  return {
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: primary ? p.primary : p.surface2,
    color: primary ? '#fff' : p.text,
    border: `1px solid ${primary ? p.primary : p.border}`,
  };
}
function inputStyle(p) {
  return {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${p.border}`,
    background: p.inputBg, color: p.text, fontSize: 13, fontFamily: FONT_INTER,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
}

// ── Content — reutilizável na página e no modal do hub ────────────────────────
const PANELS = [
  { id: 'home',     label: 'Início' },
  { id: 'clientes', label: 'Clientes' },
];

export function GestaoClientesContent() {
  const { theme } = useTheme();
  const p         = useMemo(() => getPalette(theme), [theme]);
  const isDark    = theme === 'dark';

  const [companyId, setCompanyId] = useState(undefined); // undefined = loading; null = loaded, no org

  useEffect(() => {
    getCurrentTenantCompanyId().then(id => setCompanyId(id || null)).catch(() => setCompanyId(null));
  }, []);

  useEffect(() => {
    const id = 'gc-inter-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const [panel,  setPanel]  = useState('home');
  const [tick,   setTick]   = useState(0);
  const [modal,  setModal]  = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [toast,  setToast]  = useState('');

  const clientes = useMemo(
    () => companyId !== undefined ? getClientes(companyId) : [],
    [tick, companyId]
  );
  const refresh  = useCallback(() => setTick((t) => t + 1), []);

  function handleEdit(id)   { setModal(id || 'new'); }
  function handlePerfil(id) { setPerfil(id); setPanel('perfil'); }
  function handleBack()     { setPerfil(null); setPanel('clientes'); }

  function handleDelete(id) {
    const c = clientes.find((x) => x.id === id);
    if (!c) return;
    if (!window.confirm(`Remover "${c.name}"? Isso também o removerá dos demais sistemas.`)) return;
    deleteCliente(id, companyId);
    refresh();
    setToast('Cliente removido.');
  }

  const perfilCliente = perfil ? clientes.find((c) => c.id === perfil) : null;
  const activePanels  = [...PANELS, ...(perfilCliente ? [{ id: 'perfil', label: 'Perfil' }] : [])];

  return (
    <CompanyCtx.Provider value={companyId}>
    <PaletteCtx.Provider value={p}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
      `}</style>

      {/* Panel tabs */}
      <div style={{
        background: p.surface, borderBottom: `1px solid ${p.border}`,
        padding: '0 28px', display: 'flex', gap: 0,
      }}>
        {activePanels.map((pn) => (
          <button key={pn.id} onClick={() => setPanel(pn.id)} style={{
            padding: '12px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'none', border: 'none',
            borderBottom: panel === pn.id ? `2px solid ${p.primary}` : '2px solid transparent',
            color: panel === pn.id ? p.primary : p.muted, marginBottom: -1,
          }}>{pn.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ fontFamily: FONT_INTER }}>
        {companyId === undefined ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: p.muted, fontSize: 14 }}>
            Carregando dados da organização...
          </div>
        ) : (
          <>
            {panel === 'home' && (
              <HomePanel clientes={clientes} isDark={isDark} onGo={(pId) => setPanel(pId)} onRefresh={refresh} />
            )}
            {panel === 'clientes' && (
              <ClientesPanel
                clientes={clientes}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPerfil={handlePerfil}
              />
            )}
            {panel === 'perfil' && perfilCliente && (
              <PerfilPanel
                cliente={perfilCliente}
                onEdit={handleEdit}
                onBack={handleBack}
              />
            )}
          </>
        )}
      </div>

      {modal !== null && (
        <ClienteModal
          clienteId={modal === 'new' ? null : modal}
          clientes={clientes}
          onClose={() => setModal(null)}
          onSaved={refresh}
          onToast={setToast}
        />
      )}
      <Toast msg={toast} onDone={() => setToast('')} />
    </PaletteCtx.Provider>
    </CompanyCtx.Provider>
  );
}

// ── Page wrapper (mantém o header) ────────────────────────────────────────────
export default function GestaoClientesPage() {
  const { theme } = useTheme();
  const p         = getPalette(theme);
  return (
    <div style={{ minHeight: '100vh', background: p.bg, fontFamily: FONT_INTER }}>
      <SolucoesHeader tool="gestao-clientes" />
      <GestaoClientesContent />
    </div>
  );
}
