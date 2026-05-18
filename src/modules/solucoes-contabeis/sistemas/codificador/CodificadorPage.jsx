import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import {
  listEmpresas, listContas, listRegras, listLogs, pushLog,
  upsertConta, deleteConta,
  upsertRegra, toggleRegra, deleteRegra,
  seedDemoIfEmpty,
} from '../../services/codificador.service';
import { parseXlsxFile, applyRules, exportDominio, timeAgo } from './codEngine';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';

// =============================================================================
// Página: /solucoes-contabeis/codificador
// Migração funcional do Codificador de Arquivos do Autonomy v9.0.
// Sub-painéis: Início (métricas + histórico) · Codificar (upload XLSX +
// regras + export Domínio) · Configurações (CRUD regras + contas).
// =============================================================================

// ── SVG icons ─────────────────────────────────────────────────────────────────
function IHome({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IUpload({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function IGear({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function ICodIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="10 13 8 15 10 17"/>
      <polyline points="14 13 16 15 14 17"/>
    </svg>
  );
}
function IFileClock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="18" cy="18" r="4"/>
      <polyline points="18 16 18 18 19.5 19.5"/>
    </svg>
  );
}
function IUsersMetric({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IShield({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}
function IBankMetric({ size = 20 }) {
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
function IPlus({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5"  y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function ISlidersIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
function IChevRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

const PANELS = [
  { id: 'home',           label: 'Início',         Icon: IHome },
  { id: 'upload',         label: 'Codificar',      Icon: IUpload },
  { id: 'configuracoes',  label: 'Configurações',  Icon: IGear },
];

const PANEL_SUB = {
  home: 'Visão geral do módulo.',
  upload: 'Selecione o cliente, conta e envie o extrato (XLSX).',
  configuracoes: 'Gerencie regras de codificação e contas bancárias.',
};

const PaletteCtx   = createContext(null);
const useP         = () => useContext(PaletteCtx);
const CompanyCtx   = createContext(null);
const useCompanyId = () => useContext(CompanyCtx);

// =============================================================================
// Página
// =============================================================================

export default function CodificadorPage() {
  const { theme } = useTheme();
  const P = useMemo(() => getPalette(theme), [theme]);
  const [panel, setPanel] = useState('home');
  const [toast, setToast] = useState(null);

  const [companyId, setCompanyId] = useState(undefined); // undefined = loading; null = loaded, no org
  useEffect(() => {
    getCurrentTenantCompanyId().then(id => setCompanyId(id || null)).catch(() => setCompanyId(null));
  }, []);

  useEffect(() => {
    if (companyId !== undefined && companyId !== null) seedDemoIfEmpty(companyId);
  }, [companyId]);

  const showToast = useCallback((msg) => setToast({ id: Date.now(), msg }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <CompanyCtx.Provider value={companyId}>
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          .cod-tab-btn { transition: all 0.18s ease; }
          .cod-tab-btn:hover { background: ${P.primarySoft}; color: ${P.primaryText}; }
          .cod-card { transition: all 0.18s ease; }
          .cod-card:hover { border-color: ${P.primaryBorder}; }
          .cod-dropzone { transition: all 0.18s ease; }
          .cod-dropzone.over { border-color: ${P.primary} !important; background: ${P.primarySoft} !important; }
          .cod-btn-primary { transition: all 0.15s ease; }
          .cod-btn-primary:hover { filter: brightness(1.1); }
          .cod-btn-ghost { transition: all 0.15s ease; }
          .cod-btn-ghost:hover { background: ${P.surface2} !important; border-color: ${P.border2} !important; }
          .cod-row:hover { background: ${P.rowHover}; }
          @keyframes cod-toast-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
          @media (max-width: 640px) { .cod-main { padding: 20px 16px 64px !important; } .cod-two-col { grid-template-columns: 1fr !important; } }
        `}</style>

        {theme === 'dark' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
            <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37,99,235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
          </div>
        )}

        <SolucoesHeader />

        <main className="cod-main" style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px', position: 'relative', zIndex: 1 }}>
          <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.primaryText,
              }}>
                <ICodIcon size={26} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 3, color: P.text, lineHeight: 1.15 }}>
                  Codificador de Arquivos
                </h1>
                <p style={{ fontSize: '0.84rem', color: P.muted }}>
                  {PANEL_SUB[panel]}
                </p>
              </div>
            </div>

            <nav style={{ display: 'flex', gap: 5, padding: 5, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, flexShrink: 0, boxShadow: P.shadow }}>
              {PANELS.map((p) => {
                const active = p.id === panel;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPanel(p.id)}
                    className="cod-tab-btn"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 14px', borderRadius: 8,
                      background: active ? P.primarySoft : 'transparent',
                      border: `1px solid ${active ? P.primaryBorder : 'transparent'}`,
                      color: active ? P.primaryText : P.muted,
                      fontSize: '0.84rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <p.Icon size={15} /> {p.label}
                  </button>
                );
              })}
            </nav>
          </header>

          {companyId === undefined ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: P.muted, fontSize: 14 }}>
              Carregando dados da organização...
            </div>
          ) : (
            <>
              {panel === 'home' && <HomePanel onNavigate={setPanel} />}
              {panel === 'upload' && <UploadPanel showToast={showToast} />}
              {panel === 'configuracoes' && <ConfigPanel showToast={showToast} />}
            </>
          )}
        </main>

        {toast && (
          <div
            style={{
              position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200,
              background: P.surfaceSolid,
              border: `1px solid ${P.primaryBorder}`,
              color: P.text,
              padding: '12px 20px', borderRadius: 10,
              fontSize: '0.86rem', fontWeight: 500,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              animation: 'cod-toast-in 0.2s ease',
            }}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </PaletteCtx.Provider>
    </CompanyCtx.Provider>
  );
}

// =============================================================================
// Panel: Início
// =============================================================================

function HomePanel({ onNavigate }) {
  const P         = useP();
  const companyId = useCompanyId();
  const empresas  = useMemo(() => listEmpresas(companyId), [companyId]);
  const regras    = useMemo(() => listRegras(companyId),   [companyId]);
  const contas    = useMemo(() => listContas(companyId),   [companyId]);
  const logs      = useMemo(() => listLogs(companyId),     [companyId]);

  const regrasAtivas = regras.filter((r) => r.is_active).length;
  const totalLinhas  = logs.reduce((s, l) => s + (l.total   || 0), 0);
  const totalCod     = logs.reduce((s, l) => s + (l.coded   || 0), 0);
  const totalPend    = logs.reduce((s, l) => s + (l.pending || 0), 0);
  const ultima       = logs[0] ? timeAgo(logs[0].time) : '—';

  const card = { background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, boxShadow: P.shadow };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <MetricCard Icon={IFileClock}   accent="#7C3AED" value={logs.length}     label="Codificações realizadas" sub={logs.length ? 'Última: ' + ultima : 'Nenhuma ainda'} />
        <MetricCard Icon={IUsersMetric} accent="#10b981" value={empresas.length} label="Clientes cadastrados"    sub={empresas.length ? (empresas.length === 1 ? empresas[0].name : empresas.length + ' clientes') : 'Cadastre em Gestão de Clientes'} />
        <MetricCard Icon={IShield}      accent="#7C3AED" value={regrasAtivas}    label="Regras ativas"           sub={regras.length ? regrasAtivas + '/' + regras.length + ' ativas' : 'Nenhuma cadastrada'} />
        <MetricCard Icon={IBankMetric}  accent="#3b82f6" value={contas.length}   label="Contas bancárias"        sub={contas.length ? (contas.length === 1 ? contas[0].label : contas.length + ' contas') : 'Nenhuma cadastrada'} />
      </div>

      {/* Central block */}
      <div className="cod-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16 }}>

        {/* Resumo do módulo */}
        <div style={card}>
          <div style={{ padding: '15px 20px', borderBottom: `1px solid ${P.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Resumo do módulo</h3>
          </div>
          <div style={{ padding: 20 }}>
            {logs.length === 0 ? (
              <Empty icon="📊" text="Sem dados ainda" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <ProgressStat label="Codificados" value={totalCod}  total={totalLinhas} color="#10b981" />
                <ProgressStat label="Pendentes"   value={totalPend} total={totalLinhas} color={P.red} />
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 2,
                  padding: '10px 12px', borderRadius: 9,
                  background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 800,
                    background: 'rgba(124,58,237,0.18)', color: '#7C3AED',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>i</div>
                  <p style={{ fontSize: 11, color: P.muted, lineHeight: 1.55 }}>
                    Os gráficos serão adicionados em etapa posterior, junto com a integração de Chart.js.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Atividade recente */}
        <div style={card}>
          <div style={{ padding: '15px 20px', borderBottom: `1px solid ${P.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Atividade recente</h3>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '0 20px' }}>
                <Empty icon="📋" text="Nenhuma codificação realizada ainda." />
              </div>
            ) : logs.slice(0, 8).map((l) => {
              const pct = l.total ? Math.round((l.coded / l.total) * 100) : 0;
              const pctColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : P.red;
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 20px', borderBottom: `1px solid ${P.border}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: '#10b98115',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                  }}>
                    <IFileClock size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.empresa}</span>
                      <span style={{ fontSize: 11, color: P.muted, flexShrink: 0, marginLeft: 8 }}>{timeAgo(l.time)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: P.muted, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.conta} · <span style={{ fontFamily: FONT_MONO }}>{l.filename}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ color: P.muted }}>{l.total} linhas</span>
                      <span style={{ color: P.muted }}>|</span>
                      <span style={{ color: '#10b981' }}>↑ {l.coded}</span>
                      <span style={{ color: P.red }}>↓ {l.pending}</span>
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 9px', borderRadius: 20, flexShrink: 0, alignSelf: 'center',
                    background: pctColor + '18', color: pctColor,
                    fontSize: 11, fontWeight: 700, border: `1px solid ${pctColor}30`,
                  }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="cod-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ActionCard Icon={IPlus}        title="Nova codificação" desc="Inicie uma nova codificação de arquivo."           onClick={() => onNavigate('upload')} />
        <ActionCard Icon={ISlidersIcon} title="Gerenciar regras" desc="Crie, edite e ative regras de codificação."        onClick={() => onNavigate('configuracoes')} />
      </div>
    </div>
  );
}

// =============================================================================
// Panel: Upload / Codificar
// =============================================================================

function UploadPanel({ showToast }) {
  const P         = useP();
  const companyId = useCompanyId();
  const empresas  = useMemo(() => listEmpresas(companyId), [companyId]);
  const allContas = useMemo(() => listContas(companyId),   [companyId]);

  const [empresaId, setEmpresaId] = useState(empresas[0]?.id || '');
  const contasEmpresa = useMemo(() => allContas.filter((c) => c.company_id === empresaId), [allContas, empresaId]);
  const [contaId, setContaId] = useState(contasEmpresa[0]?.id || '');

  useEffect(() => {
    setContaId(contasEmpresa[0]?.id || '');
  }, [contasEmpresa]);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ coded: 0, pending: 0 });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const empresa = empresas.find((e) => e.id === empresaId);
  const conta = allContas.find((c) => c.id === contaId);

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      showToast('⚠️ PDF ainda não suportado — em breve. Use .xlsx por enquanto.');
      return;
    }
    if (ext !== 'xlsx' && ext !== 'xls') {
      showToast('⚠️ Formato não suportado. Use .xlsx');
      return;
    }
    if (!empresa || !conta) {
      showToast('⚠️ Selecione empresa e conta antes de processar.');
      return;
    }

    setFile(f);
    setLoading(true);
    try {
      const parsed = await parseXlsxFile(f);
      if (!parsed.length) {
        showToast('⚠️ Nenhuma linha válida encontrada no arquivo.');
        setLoading(false);
        return;
      }
      const regras = listRegras(companyId).filter((r) => r.company_id === empresa.id && r.is_active);
      const { coded, rows: out } = applyRules(parsed, regras, '9999');
      const pending = out.length - coded;
      setRows(out);
      setCounts({ coded, pending });
      pushLog({
        empresa: empresa.name,
        conta: conta.label,
        filename: f.name,
        total: out.length,
        coded,
        pending,
      }, companyId);
      showToast(`✅ ${coded} codificados, ${pending} pendentes`);
    } catch (err) {
      console.error(err);
      showToast('❌ Erro ao ler arquivo: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, conta, showToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleExport = useCallback(() => {
    if (!rows.length) {
      showToast('⚠️ Nenhum dado para exportar.');
      return;
    }
    try {
      const fname = exportDominio(rows, {
        bankCode: String(conta?.code || ''),
        empresaName: empresa?.name,
      });
      showToast('✅ Arquivo exportado: ' + fname);
    } catch (err) {
      showToast('❌ Erro ao exportar: ' + err.message);
    }
  }, [rows, conta, empresa, showToast]);

  if (!empresas.length) {
    return (
      <Card title="Cliente necessário">
        <Empty icon="🏢" text="Cadastre um cliente em Gestão de Clientes para começar a codificar arquivos." />
      </Card>
    );
  }

  return (
    <>
      <div className="cod-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16, marginBottom: 16 }}>
        <Card title="1. Selecione a empresa">
          <Field label="Empresa">
            <Select value={empresaId} onChange={(v) => setEmpresaId(v)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Conta bancária">
            <Select value={contaId} onChange={(v) => setContaId(v)}>
              {contasEmpresa.length === 0 && <option value="">— Nenhuma conta cadastrada —</option>}
              {contasEmpresa.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.code})</option>)}
            </Select>
          </Field>
        </Card>

        <Card title="2. Envie o extrato">
          <div
            className={'cod-dropzone' + (dragOver ? ' over' : '')}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${P.border2}`,
              borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer',
              background: P.surface2,
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Clique ou arraste o arquivo aqui</div>
            <div style={{ color: P.muted, fontSize: '0.8rem' }}>
              Suporte: <b>.xlsx</b> (planilha). <span style={{ color: P.muted2 }}>PDF em breve.</span>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {file && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: P.surface2, borderRadius: 8, fontSize: '0.83rem' }}>
              <span>📄</span>
              <span style={{ fontWeight: 600 }}>{file.name}</span>
              <span style={{ color: P.muted, marginLeft: 'auto' }}>{rows.length ? rows.length + ' linhas' : ''}</span>
            </div>
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: 20, marginTop: 10 }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
              <div style={{ fontWeight: 600 }}>Processando…</div>
            </div>
          )}
        </Card>
      </div>

      {rows.length > 0 && (
        <Card
          title="3. Pré-visualização e exportação"
          actions={
            <>
              <Pill color={P.green}>{counts.coded} codificados</Pill>
              <Pill color={P.red}>{counts.pending} pendentes</Pill>
              <PrimaryBtn onClick={handleExport}>⬇ Exportar Domínio (.xlsx)</PrimaryBtn>
            </>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: P.surfaceSolid, zIndex: 1 }}>
                  {['#', 'Data', 'Descrição', 'Valor', 'Nat.', 'Conta', 'Histórico', 'Status'].map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="cod-row" style={{ background: r.coded ? 'transparent' : (P.red + '0d') }}>
                    <Td muted>{i + 1}</Td>
                    <Td nowrap>{r.date}</Td>
                    <Td style={{ maxWidth: 260 }}>{r.description}</Td>
                    <Td mono align="right" style={{ color: r.nature === 'C' ? P.green : P.red }}>
                      {r.nature === 'C' ? '+' : '-'}{Math.abs(parseFloat(r.value) || 0).toFixed(2)}
                    </Td>
                    <Td><Pill color={r.nature === 'C' ? P.green : P.red}>{r.nature}</Pill></Td>
                    <Td mono>{r.contra_account}</Td>
                    <Td muted style={{ maxWidth: 200 }}>{r.history_out}</Td>
                    <Td>
                      {r.coded
                        ? <Pill color={P.green}>✓ cod.</Pill>
                        : <Pill color={P.red}>pendente</Pill>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// =============================================================================
// Panel: Configurações (Regras + Contas)
// =============================================================================

function ConfigPanel({ showToast }) {
  const P = useP();
  const [tab, setTab] = useState('regras');
  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${P.border}` }}>
        <ConfigTab active={tab === 'regras'}  onClick={() => setTab('regras')}>⚙️ Regras de Codificação</ConfigTab>
        <ConfigTab active={tab === 'contas'}  onClick={() => setTab('contas')}>💳 Contas Bancárias</ConfigTab>
      </div>
      {tab === 'regras' && <RegrasPanel showToast={showToast} />}
      {tab === 'contas' && <ContasPanel showToast={showToast} />}
    </>
  );
}

function RegrasPanel({ showToast }) {
  const companyId = useCompanyId();
  const empresas  = useMemo(() => listEmpresas(companyId), [companyId]);
  const [filterEmp, setFilterEmp] = useState('');
  const [regras, setRegras] = useState([]);
  useEffect(() => { setRegras(listRegras(companyId)); }, [companyId]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = filterEmp ? regras.filter((r) => r.company_id === filterEmp) : regras;
  const empName = (id) => empresas.find((e) => e.id === id)?.name || '—';

  const handleOpen = (rule) => {
    if (!empresas.length) {
      showToast('⚠️ Cadastre uma empresa primeiro.');
      return;
    }
    setEditing(rule || null);
    setShowModal(true);
  };

  const handleSave = (values) => {
    const next = upsertRegra(editing ? { ...values, id: editing.id } : values, companyId);
    setRegras(next);
    setShowModal(false);
    showToast('✅ Regra salva!');
  };

  const handleToggle = (id, val) => {
    setRegras(toggleRegra(id, val, companyId));
    showToast(val ? '✅ Regra ativada' : '🔕 Regra desativada');
  };

  const handleDelete = (id) => {
    if (!window.confirm('Remover esta regra?')) return;
    setRegras(deleteRegra(id, companyId));
    showToast('🗑 Regra removida');
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <Select value={filterEmp} onChange={setFilterEmp} style={{ width: 240 }}>
          <option value="">Todos os clientes</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <PrimaryBtn onClick={() => handleOpen(null)}>＋ Nova Regra</PrimaryBtn>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>{['Cliente', 'Nome', 'Padrão', 'Tipo', 'Conta', 'Histórico', 'Status', ''].map((h) => <Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><Td colSpan={8}><Empty icon="⚙️" text="Nenhuma regra cadastrada." /></Td></tr>
              ) : filtered.map((r) => (
                <RegraRow
                  key={r.id}
                  rule={r}
                  empName={empName(r.company_id)}
                  onToggle={handleToggle}
                  onEdit={() => handleOpen(r)}
                  onDelete={() => handleDelete(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <RegraModal
          rule={editing}
          empresas={empresas}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function RegraRow({ rule, empName, onToggle, onEdit, onDelete }) {
  const P = useP();
  return (
    <tr className="cod-row">
      <Td>{empName}</Td>
      <Td style={{ fontWeight: 600 }}>{rule.name}</Td>
      <Td mono>{rule.pattern}</Td>
      <Td><Pill color={P.primary}>{rule.match_type}</Pill></Td>
      <Td mono>{rule.account}</Td>
      <Td muted>{rule.history_template || '—'}</Td>
      <Td>
        <input
          type="checkbox"
          checked={!!rule.is_active}
          onChange={(e) => onToggle(rule.id, e.target.checked)}
          style={{ accentColor: P.primary, width: 16, height: 16, cursor: 'pointer' }}
        />
      </Td>
      <Td>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn onClick={onEdit} title="Editar">✏️</IconBtn>
          <IconBtn onClick={onDelete} title="Remover" danger>🗑</IconBtn>
        </div>
      </Td>
    </tr>
  );
}

function ContasPanel({ showToast }) {
  const companyId = useCompanyId();
  const empresas  = useMemo(() => listEmpresas(companyId), [companyId]);
  const [filterEmp, setFilterEmp] = useState('');
  const [contas, setContas] = useState([]);
  useEffect(() => { setContas(listContas(companyId)); }, [companyId]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = filterEmp ? contas.filter((c) => c.company_id === filterEmp) : contas;
  const empName = (id) => empresas.find((e) => e.id === id)?.name || '—';

  const handleOpen = (conta) => {
    if (!empresas.length) {
      showToast('⚠️ Cadastre uma empresa primeiro.');
      return;
    }
    setEditing(conta || null);
    setShowModal(true);
  };

  const handleSave = (values) => {
    const next = upsertConta(editing ? { ...values, id: editing.id } : values, companyId);
    setContas(next);
    setShowModal(false);
    showToast('✅ Conta salva!');
  };

  const handleDelete = (id) => {
    if (!window.confirm('Remover esta conta?')) return;
    setContas(deleteConta(id, companyId));
    showToast('🗑 Conta removida');
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <Select value={filterEmp} onChange={setFilterEmp} style={{ width: 240 }}>
          <option value="">Todos os clientes</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <PrimaryBtn onClick={() => handleOpen(null)}>＋ Nova Conta</PrimaryBtn>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>{['Cliente', 'Banco', 'Código', 'Label', ''].map((h) => <Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><Td colSpan={5}><Empty icon="💳" text="Nenhuma conta cadastrada." /></Td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="cod-row">
                  <Td>{empName(c.company_id)}</Td>
                  <Td>{c.bank_name || '—'}</Td>
                  <Td mono>{c.code}</Td>
                  <Td style={{ fontWeight: 600 }}>{c.label}</Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <IconBtn onClick={() => handleOpen(c)} title="Editar">✏️</IconBtn>
                      <IconBtn onClick={() => handleDelete(c.id)} title="Remover" danger>🗑</IconBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <ContaModal
          conta={editing}
          empresas={empresas}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// =============================================================================
// Modais
// =============================================================================

function RegraModal({ rule, empresas, onClose, onSave }) {
  const [companyId, setCompanyId] = useState(rule?.company_id || empresas[0]?.id || '');
  const [name, setName] = useState(rule?.name || '');
  const [pattern, setPattern] = useState(rule?.pattern || '');
  const [matchType, setMatchType] = useState(rule?.match_type || 'contains');
  const [account, setAccount] = useState(rule?.account || '');
  const [historyTpl, setHistoryTpl] = useState(rule?.history_template || '');

  const submit = () => {
    if (!name.trim() || !pattern.trim() || !account.trim()) return;
    onSave({
      company_id: companyId,
      name: name.trim(),
      pattern: pattern.trim(),
      match_type: matchType,
      account: account.trim(),
      history_template: historyTpl.trim(),
      is_active: rule?.is_active ?? 1,
    });
  };

  return (
    <ModalShell title={rule ? 'Editar Regra' : 'Nova Regra'} subtitle="Configure como o padrão será identificado e codificado." onClose={onClose}>
      <Field label="Empresa">
        <Select value={companyId} onChange={setCompanyId}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Field>
      <Field label="Nome da regra"><Input value={name} onChange={setName} placeholder="Ex: Pagamento fornecedor" /></Field>
      <FieldRow>
        <Field label="Padrão de busca"><Input value={pattern} onChange={setPattern} placeholder="Ex: PAGTO FORN" /></Field>
        <Field label="Tipo de match">
          <Select value={matchType} onChange={setMatchType}>
            <option value="contains">Contém</option>
            <option value="startswith">Começa com</option>
            <option value="regex">Regex</option>
          </Select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Conta contábil (contrapartida)"><Input value={account} onChange={setAccount} placeholder="Ex: 2.1.01" /></Field>
        <Field label="Modelo de histórico (opcional)"><Input value={historyTpl} onChange={setHistoryTpl} placeholder="Ex: Pgto fornecedor" /></Field>
      </FieldRow>
      <ModalActions onCancel={onClose} onSave={submit} disabled={!name.trim() || !pattern.trim() || !account.trim()} />
    </ModalShell>
  );
}

function ContaModal({ conta, empresas, onClose, onSave }) {
  const [companyId, setCompanyId] = useState(conta?.company_id || empresas[0]?.id || '');
  const [code, setCode] = useState(conta?.code || '');
  const [bankName, setBankName] = useState(conta?.bank_name || '');
  const [label, setLabel] = useState(conta?.label || '');

  const submit = () => {
    if (!code.trim() || !label.trim()) return;
    onSave({
      company_id: companyId,
      code: code.trim(),
      bank_name: bankName.trim(),
      label: label.trim(),
    });
  };

  return (
    <ModalShell title={conta ? 'Editar Conta' : 'Nova Conta Bancária'} subtitle="Configure a conta bancária e seu código contábil." onClose={onClose}>
      <Field label="Empresa">
        <Select value={companyId} onChange={setCompanyId}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Field>
      <FieldRow>
        <Field label="Código contábil da conta"><Input value={code} onChange={setCode} placeholder="Ex: 1.1.01" /></Field>
        <Field label="Nome do banco"><Input value={bankName} onChange={setBankName} placeholder="Ex: Banco do Brasil" /></Field>
      </FieldRow>
      <Field label="Label / identificação"><Input value={label} onChange={setLabel} placeholder="Ex: Conta Corrente BB 1234-5" /></Field>
      <ModalActions onCancel={onClose} onSave={submit} disabled={!code.trim() || !label.trim()} />
    </ModalShell>
  );
}

// =============================================================================
// Building blocks (tema-aware via PaletteCtx)
// =============================================================================

function Card({ title, hint, actions, children }) {
  const P = useP();
  return (
    <section className="cod-card" style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 14, marginBottom: 14, boxShadow: P.shadow,
    }}>
      {(title || actions) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${P.border}`,
          gap: 12, flexWrap: 'wrap',
        }}>
          {title && (
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, letterSpacing: -0.2 }}>
              {title}
              {hint && <span style={{ marginLeft: 10, fontSize: '0.76rem', color: P.muted, fontWeight: 500 }}>{hint}</span>}
            </h3>
          )}
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
        </header>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function MetricCard({ Icon, accent, value, label, sub }) {
  const P = useP();
  return (
    <div className="cod-card" style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: P.shadow,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        <Icon size={20} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: P.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: P.text, fontWeight: 600, marginTop: 5, lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 11, color: P.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
    </div>
  );
}

function ActionCard({ Icon, title, desc, onClick }) {
  const P = useP();
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 22px',
        background: hov ? (P.primarySoft) : P.surface,
        border: `1px solid ${hov ? P.primaryBorder : P.border}`,
        borderRadius: 14, cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', color: P.text,
        boxShadow: P.shadow, transition: 'all 0.17s ease',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: hov ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#7C3AED', transition: 'background 0.17s',
      }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: P.muted }}>{desc}</div>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: hov ? '#7C3AED' : (P.primarySoft),
        border: `1px solid ${hov ? '#7C3AED' : P.primaryBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? '#fff' : '#7C3AED', transition: 'all 0.17s',
      }}>
        <IChevRight size={14} />
      </div>
    </button>
  );
}

function ProgressStat({ label, value, total, color }) {
  const P = useP();
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
        <span style={{ color: P.muted, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontFamily: FONT_MONO }}>{value} <span style={{ color: P.muted2 }}>· {pct}%</span></span>
      </div>
      <div style={{ height: 6, background: P.border, borderRadius: 3 }}>
        <div style={{ height: 6, background: color, borderRadius: 3, width: pct + '%', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  const P = useP();
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center', color: P.muted2 }}>
      <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      <p style={{ fontSize: '0.85rem' }}>{text}</p>
    </div>
  );
}

function ConfigTab({ active, onClick, children }) {
  const P = useP();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
        color: active ? P.primaryText : P.muted,
        fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: active ? 700 : 500,
        borderBottom: `2px solid ${active ? P.primary : 'transparent'}`,
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 700,
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}

function IconBtn({ onClick, title, danger, children }) {
  const P = useP();
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="cod-btn-ghost"
      style={{
        padding: '5px 9px', borderRadius: 6,
        background: 'transparent',
        border: `1px solid ${danger ? (P.red + '55') : P.border}`,
        color: danger ? P.red : P.text,
        cursor: 'pointer', fontSize: '0.85rem',
      }}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ onClick, disabled, children }) {
  const P = useP();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cod-btn-primary"
      style={{
        padding: '8px 16px', borderRadius: 8,
        background: P.primary, color: '#fff',
        border: 'none', fontSize: '0.83rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children }) {
  const P = useP();
  return (
    <th style={{
      padding: '10px 12px', textAlign: 'left',
      fontSize: '0.72rem', fontWeight: 700, color: P.muted,
      textTransform: 'uppercase', letterSpacing: 0.6,
      borderBottom: `1px solid ${P.border}`,
      whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}

function Td({ children, mono, muted, align, nowrap, colSpan, style }) {
  const P = useP();
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: '9px 12px',
        borderBottom: `1px solid ${P.border}`,
        fontFamily: mono ? FONT_MONO : 'inherit',
        color: muted ? P.muted : P.text,
        textAlign: align || 'left',
        whiteSpace: nowrap ? 'nowrap' : 'normal',
        fontSize: '0.8rem',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function Field({ label, children }) {
  const P = useP();
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.74rem', color: P.muted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{children}</div>;
}

function Input({ value, onChange, placeholder }) {
  const P = useP();
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '9px 12px',
        background: P.inputBg,
        border: `1px solid ${P.border2}`,
        borderRadius: 8, color: P.text,
        fontFamily: 'inherit', fontSize: '0.85rem',
        outline: 'none',
      }}
    />
  );
}

function Select({ value, onChange, children, style }) {
  const P = useP();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 12px',
        background: P.inputBg,
        border: `1px solid ${P.border2}`,
        borderRadius: 8, color: P.text,
        fontFamily: 'inherit', fontSize: '0.85rem',
        outline: 'none', cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  const P = useP();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540,
          background: P.surfaceSolid, border: `1px solid ${P.border2}`,
          borderRadius: 14, padding: 24,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>{title}</h3>
        {subtitle && <p style={{ color: P.muted, fontSize: '0.82rem', marginBottom: 20 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, disabled }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
      <button type="button" onClick={onCancel} className="cod-btn-ghost" style={{
        padding: '8px 16px', borderRadius: 8,
        background: 'transparent', border: `1px solid ${P.border2}`,
        color: P.text, fontFamily: 'inherit', fontSize: '0.83rem', cursor: 'pointer',
      }}>Cancelar</button>
      <PrimaryBtn onClick={onSave} disabled={disabled}>💾 Salvar</PrimaryBtn>
    </div>
  );
}
