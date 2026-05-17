import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import {
  loadXlsxFile, processAll, saveParsed, loadParsed, clearParsed,
  fmt, pct, buildChartConfigs, buildDreRows, buildBalancoRows,
} from './ademEngine';

Chart.register(...registerables);

// ── Palette context ──────────────────────────────────────────────────
const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// ── Nav / filter buttons ─────────────────────────────────────────────
function NavBtn({ active, onClick, disabled, children }) {
  const P = useP();
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 16px', borderRadius: 8, fontFamily: FONT_INTER,
      fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', opacity: disabled ? 0.45 : 1,
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>{children}</button>
  );
}

function TabBtn({ active, onClick, children }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 7, fontFamily: FONT_INTER,
      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.14s',
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>{children}</button>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────────────
function ChartBox({ title, height = 220, chartKey, configs }) {
  const P = useP();
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const cfg = configs[chartKey];
    if (!canvasRef.current || !cfg) return;
    if (instanceRef.current) instanceRef.current.destroy();
    instanceRef.current = new Chart(canvasRef.current, JSON.parse(JSON.stringify(cfg)));
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [configs, chartKey]);

  const hasCfg = Boolean(configs[chartKey]);

  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px', boxShadow: P.shadow }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 }}>{title}</div>
      {hasCfg ? (
        <div style={{ height, position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.muted2, fontSize: '0.8rem' }}>
          Dados não disponíveis
        </div>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  const P = useP();
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 18px', boxShadow: P.shadow }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || P.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── File upload slot ──────────────────────────────────────────────────
function FileSlot({ label, icon, status, fileName, onFile }) {
  const P = useP();
  const inputRef = useRef(null);
  const statusColors = { idle: P.muted2, loaded: P.green, error: P.red };
  const statusLabels = { idle: 'Pendente', loaded: 'Carregado', error: 'Erro' };

  return (
    <div style={{ background: P.surface, border: `1px solid ${status === 'loaded' ? P.border2 : P.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: P.shadow, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>{icon}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: P.text }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: status === 'loaded' ? 'rgba(52,211,153,.12)' : status === 'error' ? 'rgba(255,92,92,.12)' : P.surface2, color: statusColors[status] }}>
          {statusLabels[status]}
        </span>
      </div>
      {fileName && (
        <div style={{ fontSize: '0.76rem', color: P.muted, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
      )}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <button onClick={() => inputRef.current?.click()} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${P.border2}`, background: 'transparent', color: P.muted, fontFamily: FONT_INTER, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
        {status === 'loaded' ? 'Trocar arquivo' : 'Selecionar XLSX'}
      </button>
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────
function UploadPanel({ onProcessed, onClear, hasParsed }) {
  const P = useP();
  const [raw,     setRaw]     = useState({ dre: null, balanco: null, balancete: null });
  const [status,  setStatus]  = useState({ dre: 'idle', balanco: 'idle', balancete: 'idle' });
  const [names,   setNames]   = useState({ dre: '', balanco: '', balancete: '' });
  const [loading, setLoading] = useState(false);

  const handleFile = async (type, file) => {
    try {
      const rows = await loadXlsxFile(file);
      setRaw((r) => ({ ...r, [type]: rows }));
      setStatus((s) => ({ ...s, [type]: 'loaded' }));
      setNames((n) => ({ ...n, [type]: file.name + ' (' + rows.length + ' linhas)' }));
    } catch (err) {
      setStatus((s) => ({ ...s, [type]: 'error' }));
      setNames((n) => ({ ...n, [type]: 'Erro ao ler arquivo' }));
    }
  };

  const handleProcess = async () => {
    if (!raw.dre && !raw.balanco && !raw.balancete) return;
    setLoading(true);
    try {
      const parsed = processAll(raw);
      saveParsed(parsed);
      onProcessed(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setRaw({ dre: null, balanco: null, balancete: null });
    setStatus({ dre: 'idle', balanco: 'idle', balancete: 'idle' });
    setNames({ dre: '', balanco: '', balancete: '' });
    clearParsed();
    onClear();
  };

  const anyLoaded = Object.values(status).some((s) => s === 'loaded');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <FileSlot label="DRE"                  icon="📊" status={status.dre}       fileName={names.dre}       onFile={(f) => handleFile('dre', f)} />
        <FileSlot label="Balanço Patrimonial"  icon="⚖️" status={status.balanco}   fileName={names.balanco}   onFile={(f) => handleFile('balanco', f)} />
        <FileSlot label="Balancete"            icon="📋" status={status.balancete} fileName={names.balancete} onFile={(f) => handleFile('balancete', f)} />
      </div>

      <div style={{ background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: P.primaryText, lineHeight: 1.6 }}>
        <strong>Formato esperado:</strong> planilha XLSX com a primeira coluna contendo a descrição da linha e as demais contendo valores. Importar pelo menos um dos três arquivos.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleProcess} disabled={!anyLoaded || loading} style={{ padding: '10px 24px', borderRadius: 10, background: anyLoaded && !loading ? P.primary : P.surface2, border: 'none', color: anyLoaded && !loading ? '#fff' : P.muted, fontFamily: FONT_INTER, fontSize: '0.87rem', fontWeight: 700, cursor: anyLoaded && !loading ? 'pointer' : 'not-allowed', opacity: anyLoaded && !loading ? 1 : 0.6 }}>
          {loading ? 'Processando…' : 'Processar e gerar dashboard →'}
        </button>
        {hasParsed && (
          <button onClick={handleClear} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${P.border2}`, background: 'transparent', color: P.muted, fontFamily: FONT_INTER, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
            Limpar dados
          </button>
        )}
      </div>
    </div>
  );
}

// ── Dashboard panel ───────────────────────────────────────────────────
function DashboardPanel({ parsed, isDark }) {
  const P = useP();
  const d = parsed.dre;
  const b = parsed.balanco;
  const configs = buildChartConfigs(parsed, isDark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs DRE */}
      {d && (
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>DRE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <KpiCard label="Receita Líquida" value={fmt(d.recLiquida)} />
            <KpiCard label="Lucro Líquido"   value={fmt(d.lucroLiq)} color={d.lucroLiq < 0 ? P.red : P.green} />
            <KpiCard label="Margem Líquida"  value={pct(d.margemLiq)} color={d.margemLiq < 0 ? P.red : undefined} />
            <KpiCard label="EBITDA"          value={fmt(d.ebitda)} />
          </div>
        </div>
      )}

      {/* KPIs Balanço */}
      {b && (
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Balanço Patrimonial</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <KpiCard label="Ativo Total"      value={fmt(b.ativoTotal)} />
            <KpiCard label="Passivo Total"    value={fmt(b.passivoTotal)} />
            <KpiCard label="Patrimônio Líq."  value={fmt(b.pl)} color={b.pl < 0 ? P.red : P.green} />
            <KpiCard label="Endividamento"    value={pct(b.endividamento)} color={b.endividamento > 0.7 ? P.red : undefined} />
          </div>
        </div>
      )}

      {/* Gráficos — linha 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: d ? '1fr 1fr' : '1fr', gap: 16 }}>
        {d && <ChartBox title="Composição da DRE"      chartKey="dre"     height={260} configs={configs} />}
        {b && <ChartBox title="Estrutura Patrimonial"  chartKey="balanco" height={260} configs={configs} />}
      </div>

      {/* Gráficos — linha 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <ChartBox title="Rentabilidade (%)"    chartKey="rentab"    height={200} configs={configs} />
        <ChartBox title="Liquidez"             chartKey="liquidez"  height={200} configs={configs} />
        <ChartBox title="Análise Vertical DRE" chartKey="av"        height={200} configs={configs} />
      </div>

      {/* Gráfico balancete */}
      {parsed.balancete && (
        <ChartBox title="Top 10 Contas — Balancete" chartKey="balancete" height={240} configs={configs} />
      )}
    </div>
  );
}

// ── Details panel ─────────────────────────────────────────────────────
function DetailsPanel({ parsed }) {
  const P = useP();
  const [tab, setTab] = useState(() => parsed.dre ? 'dre' : parsed.balanco ? 'balanco' : 'balancete');

  const dreRows      = parsed.dre       ? buildDreRows(parsed.dre)         : [];
  const balancoRows  = parsed.balanco   ? buildBalancoRows(parsed.balanco)  : [];
  const balancete    = parsed.balancete ? parsed.balancete.contas           : [];

  const hasTab = { dre: Boolean(parsed.dre), balanco: Boolean(parsed.balanco), balancete: Boolean(parsed.balancete) };

  const renderValue = (row) => {
    if (row.type === 'sep')       return null;
    if (row.type === 'head')      return null;
    if (row.val === null)         return null;
    if (row.type === 'pct')       return pct(row.val);
    if (row.type === 'idx')       return row.val.toFixed(2);
    return fmt(row.val);
  };

  const renderAV = (row, recLiquida) => {
    if (!recLiquida || row.type === 'sep' || row.type === 'head' || row.val === null || row.type === 'pct' || row.type === 'idx') return '—';
    return pct(Math.abs(row.val) / recLiquida);
  };

  const rowStyle = (type) => ({
    fontWeight: (type === 'total' || type === 'highlight') ? 700 : 400,
    color: type === 'head' ? P.gold : undefined,
    paddingTop: type === 'head' ? 8 : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {hasTab.dre       && <TabBtn active={tab === 'dre'}       onClick={() => setTab('dre')}>DRE</TabBtn>}
        {hasTab.balanco   && <TabBtn active={tab === 'balanco'}   onClick={() => setTab('balanco')}>Balanço Patrimonial</TabBtn>}
        {hasTab.balancete && <TabBtn active={tab === 'balancete'} onClick={() => setTab('balancete')}>Balancete</TabBtn>}
      </div>

      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: P.shadow }}>
        <div style={{ overflowX: 'auto', maxHeight: 580, overflowY: 'auto' }}>
          {tab === 'dre' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Descrição', 'Valor', 'AV (%)'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 16px', textAlign: i > 0 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dreRows.map((row, i) => (
                  row.type === 'sep' ? (
                    <tr key={i}><td colSpan={3} style={{ padding: '4px', border: 'none' }} /></tr>
                  ) : (
                    <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
                      <td style={{ padding: '8px 16px', ...rowStyle(row.type), color: row.type === 'head' ? P.gold : P.text }}>{row.desc}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', ...rowStyle(row.type), color: row.val < 0 ? P.red : rowStyle(row.type).color || P.text }}>
                        {renderValue(row) ?? ''}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: P.muted, fontSize: '0.78rem' }}>
                        {renderAV(row, parsed.dre?.recLiquida)}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {tab === 'balanco' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Descrição', 'Valor'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 16px', textAlign: i > 0 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balancoRows.map((row, i) => (
                  row.type === 'sep' ? (
                    <tr key={i}><td colSpan={2} style={{ padding: '4px', border: 'none' }} /></tr>
                  ) : (
                    <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
                      <td style={{ padding: '8px 16px', paddingLeft: row.type === 'sub' ? 32 : 16, color: row.type === 'head' ? P.gold : P.text, fontWeight: (row.type === 'total' || row.type === 'head') ? 700 : 400, paddingTop: row.type === 'head' ? 10 : undefined }}>
                        {row.desc}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', fontWeight: row.type === 'total' ? 700 : 400, color: row.val < 0 ? P.red : P.text }}>
                        {row.val !== null ? (row.type === 'pct' ? pct(row.val) : row.type === 'idx' ? row.val.toFixed(2) : fmt(row.val)) : ''}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {tab === 'balancete' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Código', 'Descrição', 'Débito', 'Crédito', 'Saldo'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balancete.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '7px 14px', fontFamily: FONT_MONO, fontSize: '0.75rem', color: P.muted }}>{c.cod}</td>
                    <td style={{ padding: '7px 14px', color: P.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.desc}>{c.desc}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, color: P.muted }}>{fmt(c.debito)}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, color: P.muted }}>{fmt(c.credito)}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 600, color: P.text }}>{fmt(c.saldo)}</td>
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

// ── Page ─────────────────────────────────────────────────────────────
export default function AnaliseDemonstracoesPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const isDark = theme !== 'light';

  const [panel,  setPanel]  = useState('upload');
  const [parsed, setParsed] = useState(() => loadParsed());

  const handleProcessed = (p) => { setParsed(p); setPanel('dashboard'); };
  const handleClear     = () => { setParsed(null); setPanel('upload'); };

  const hasParsed = Boolean(parsed);
  const hasDRE    = Boolean(parsed?.dre);
  const hasBP     = Boolean(parsed?.balanco);

  const navItems = [
    { key: 'upload',    label: 'Importar arquivos', disabled: false },
    { key: 'dashboard', label: 'Dashboard',         disabled: !hasParsed },
    { key: 'detalhes',  label: 'Detalhamento',      disabled: !hasParsed },
  ];

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
        `}</style>

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
              Análise de Demonstrações
            </h1>
            <p style={{ fontSize: '0.88rem', color: P.muted }}>
              Importe DRE, Balanço Patrimonial e Balancete para gerar KPIs e gráficos automaticamente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {navItems.map((n) => (
              <NavBtn key={n.key} active={panel === n.key} disabled={n.disabled} onClick={() => !n.disabled && setPanel(n.key)}>
                {n.label}
              </NavBtn>
            ))}
          </div>

          {panel === 'upload'    && <UploadPanel onProcessed={handleProcessed} onClear={handleClear} hasParsed={hasParsed} />}
          {panel === 'dashboard' && parsed && <DashboardPanel parsed={parsed} isDark={isDark} />}
          {panel === 'detalhes'  && parsed && <DetailsPanel parsed={parsed} />}
        </main>
      </div>
    </PaletteCtx.Provider>
  );
}
