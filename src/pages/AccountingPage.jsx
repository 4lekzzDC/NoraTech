import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  TASKS, PRIORITY, REGIMES,
  RECON_CATEGORIES, RECON_STATUS, RECON_STATUS_ORDER,
  currentCompetencia, emptyTasks, isDelayed,
} from '../lib/accountingDomain';
import {
  getCurrentTenantCompanyId,
  listCompanies, upsertCompany, deleteCompany,
  listFileRecords, upsertFileRecord,
  listReconciliations, upsertReconciliation,
} from '../lib/accounting';

// =============================================================================
// Página: /acompanhamento-contabil
// 3 abas: Dashboard (gerencial), Arquivos, Conciliação
// =============================================================================

const TABS = [
  { id: 'dashboard',   num: '01', label: 'Dashboard' },
  { id: 'arquivos',    num: '02', label: 'Arquivos' },
  { id: 'conciliacao', num: '03', label: 'Conciliação' },
];

const FILE_STATUS = {
  pendente: { label: 'Pendente', fg: '#9aa0a6',  bg: 'rgba(255,255,255,0.05)',  bd: 'rgba(255,255,255,0.12)' },
  cobrado:  { label: 'Cobrado',  fg: '#fbbf24',  bg: 'rgba(251,191,36,0.1)',    bd: 'rgba(251,191,36,0.3)'   },
  recebido: { label: 'Recebido', fg: '#00d48a',  bg: 'rgba(0,212,138,0.12)',    bd: 'rgba(0,212,138,0.28)'   },
};
const FILE_STATUS_CYCLE = ['pendente', 'cobrado', 'recebido'];

function getFileStatus(record) {
  return record?.file_status || (record?.received ? 'recebido' : 'pendente');
}

export default function AccountingPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [tenantCompanyId, setTenantCompanyId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [fileRecords, setFileRecords] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [companiesView, setCompaniesView] = useState(null); // null | { initialSort?, initialOnlyCompleted? }
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Filtros globais (compartilhados entre dashboard e modal Empresas)
  const [search, setSearch] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [filterPrio, setFilterPrio] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const tid = await getCurrentTenantCompanyId();
      setTenantCompanyId(tid);
      if (!tid) {
        setCompanies([]); setFileRecords([]); setReconciliations([]);
        return;
      }
      const list = await listCompanies({ tenantCompanyId: tid, competencia });
      setCompanies(list);
      const ids = list.map((c) => c.id);
      if (ids.length === 0) {
        setFileRecords([]); setReconciliations([]);
        return;
      }
      const [files, recons] = await Promise.all([
        listFileRecords({ accountingCompanyIds: ids, competencia }),
        listReconciliations({ accountingCompanyIds: ids, competencia }),
      ]);
      setFileRecords(files);
      setReconciliations(recons);
      setLastUpdated(new Date());
    } catch (e) {
      setErrorMsg(e.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => { reload(); }, [reload]);

  const handleLogout = async () => { await logout(); navigate('/'); };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        .acc-tab { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .acc-tab:hover { color: rgba(255,255,255,0.9); }
        .acc-input, .acc-select {
          padding: 9px 12px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: #eeede9; font-size: 0.88rem; outline: none; font-family: inherit;
          transition: border-color 0.18s, background 0.18s;
        }
        .acc-input:focus, .acc-select:focus { border-color: #7C3AED; background: rgba(255,255,255,0.05); }
        .acc-input::placeholder { color: rgba(255,255,255,0.3); }
        .acc-select option { background: #15151a; color: #eeede9; }
        .acc-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02); color: #eeede9;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          transition: all 0.18s; font-family: inherit;
        }
        .acc-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }
        .acc-btn.primary { background: #7C3AED; border-color: #7C3AED; color: #fff; }
        .acc-btn.primary:hover { background: #6d28d9; }
        .acc-btn.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.25); }
        .acc-btn.danger:hover { background: rgba(255,107,107,0.08); }
        .acc-btn.view { color: #60a5fa; border-color: rgba(37,99,235,0.25); }
        .acc-btn.view:hover { background: rgba(37,99,235,0.08); }
        .acc-pill {
          display: inline-block; padding: 3px 10px; border-radius: 999px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          border: 1px solid transparent;
        }
        .acc-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
        .acc-table th { text-align: left; padding: 12px 16px; font-size: 0.69rem; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.45); border-bottom: 1px solid rgba(255,255,255,0.08); background: #0d0d12; }
        .acc-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); vertical-align: middle; }
        .acc-table tr:last-child td { border-bottom: none; }
        .acc-table tr:hover td { background: rgba(255,255,255,0.02); }
        .acc-section-eyebrow { font-size: 0.68rem; font-weight: 700; letter-spacing: 1.6px; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 10px; }
        .acc-count-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 0.73rem; font-weight: 600; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); white-space: nowrap; }
        @media (max-width: 1100px) { .acc-cat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        @media (max-width: 760px)  { .acc-cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.94)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: '0 32px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.93rem', color: '#7C3AED', letterSpacing: -0.5 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <Link to="/area-do-cliente" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Central</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#eeede9', whiteSpace: 'nowrap' }}>📊 Acompanhamento contábil</span>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Última atualização: {lastUpdated.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Competência</span>
              <input className="acc-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="MM/AAAA" style={{ width: 108 }} />
            </label>
            <button onClick={() => setCompaniesView({})} className="acc-btn" style={{ fontSize: '0.82rem' }}>🏢 Empresas</button>
            <button onClick={handleLogout} className="acc-btn" style={{ fontSize: '0.82rem' }}>Sair ↗</button>
          </div>
        </div>

        <nav style={{ maxWidth: 1380, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 32, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} className="acc-tab" onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#7C3AED' : 'rgba(255,255,255,0.45)', fontSize: '0.88rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', color: active ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.25)' }}>{t.num}</span>
                {t.label}
                {active && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#7C3AED', borderRadius: 2 }} />}
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ maxWidth: 1380, margin: '0 auto', padding: '24px 32px 80px' }}>
        {errorMsg && (
          <div style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff9ab4', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}
        {!tenantCompanyId && !loading && <NoTenantWarning />}
        {loading ? <Spinner /> : tenantCompanyId && (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                competencia={competencia}
                companies={companies}
                fileRecords={fileRecords}
                reconciliations={reconciliations}
                search={search} setSearch={setSearch}
                filterResp={filterResp} setFilterResp={setFilterResp}
                filterPrio={filterPrio} setFilterPrio={setFilterPrio}
                onOpenCompanies={(view) => setCompaniesView(view || {})}
                onOpenPendencias={() => setPendenciasOpen(true)}
              />
            )}
            {activeTab === 'arquivos' && (
              <FilesTab
                competencia={competencia}
                companies={companies}
                fileRecords={fileRecords}
                onChange={reload}
              />
            )}
            {activeTab === 'conciliacao' && (
              <ReconciliationTab
                competencia={competencia}
                companies={companies}
                reconciliations={reconciliations}
                onChange={reload}
              />
            )}
          </>
        )}
      </main>

      {companiesView && tenantCompanyId && (
        <CompaniesModal
          tenantCompanyId={tenantCompanyId}
          competencia={competencia}
          companies={companies}
          fileRecords={fileRecords}
          reconciliations={reconciliations}
          search={search} setSearch={setSearch}
          filterResp={filterResp} setFilterResp={setFilterResp}
          filterPrio={filterPrio} setFilterPrio={setFilterPrio}
          initialSort={companiesView.initialSort}
          initialOnlyCompleted={companiesView.initialOnlyCompleted}
          onClose={() => setCompaniesView(null)}
          onChange={reload}
        />
      )}
      {pendenciasOpen && (
        <PendenciasModal
          competencia={competencia}
          companies={companies}
          fileRecords={fileRecords}
          reconciliations={reconciliations}
          search={search}
          filterResp={filterResp}
          filterPrio={filterPrio}
          onClose={() => setPendenciasOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Shared UI primitives
// =============================================================================

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function NoTenantWarning() {
  return (
    <div style={{ background: 'rgba(255,138,61,0.06)', border: '1px solid rgba(255,138,61,0.25)', borderRadius: 14, padding: '24px 26px', marginBottom: 18 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 6, color: '#ffb27a' }}>Nenhuma empresa vinculada</h3>
      <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)' }}>
        Você precisa estar vinculado a uma empresa (membership ativa) para usar o módulo.
      </p>
    </div>
  );
}

function Card({ children, style = {}, ...rest }) {
  return (
    <div {...rest} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent = '#7C3AED', hint, small = false, onClick }) {
  const [hover, setHover] = useState(false);
  const interactive = !!onClick;
  return (
    <Card
      onClick={onClick}
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={{
        padding: small ? '14px 16px' : '16px 18px',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'transform 0.18s, border-color 0.18s, background 0.18s',
        transform: interactive && hover ? 'translateY(-1px)' : 'none',
        background: interactive && hover ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
        borderColor: interactive && hover ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</div>
        {interactive && <span style={{ fontSize: '0.78rem', color: hover ? '#7C3AED' : 'rgba(255,255,255,0.25)', transition: 'color 0.18s' }}>›</span>}
      </div>
      <div style={{ fontSize: small ? '1.5rem' : '1.75rem', fontWeight: 800, color: accent, marginTop: 4, letterSpacing: -0.6 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

function ProgressBar({ pct, color = '#7C3AED', height = 6 }) {
  return (
    <div style={{ height, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s' }} />
    </div>
  );
}

function BarChart({ items, maxValue }) {
  const max = maxValue || Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{it.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{it.value}{it.suffix || ''}</span>
          </div>
          <ProgressBar pct={Math.round((it.value / max) * 100)} color={it.color} />
        </div>
      ))}
    </div>
  );
}

function PriorityPill({ value }) {
  const c = PRIORITY[value] || PRIORITY.media;
  return <span className="acc-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{c.label}</span>;
}

function ReconStatusSelect({ value, onChange }) {
  const v = value || 'nao_iniciado';
  const c = RECON_STATUS[v] || RECON_STATUS.nao_iniciado;
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="acc-select"
      style={{ padding: '5px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: c.bg, color: c.fg, borderColor: c.bd, minWidth: 140 }}>
      {RECON_STATUS_ORDER.map((s) => <option key={s} value={s}>{RECON_STATUS[s].label}</option>)}
    </select>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, onSave, saving, width = 640, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, background: '#101015', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
        {onSave && (
          <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="acc-btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="acc-btn primary" onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)' }}>{children}</p>
    </Card>
  );
}

function DonutChart({ data, size = 120, thickness = 24 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offsets = data.reduce((acc, d) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + (d.value / total) * circ);
    return acc;
  }, []);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const len = (d.value / total) * circ;
        const dashOffset = i === 0 ? 0 : offsets[i - 1];
        if (d.value === 0) return null;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-dashOffset}
          />
        );
      })}
    </svg>
  );
}

function CompactStat({ label, value, color, hint, divider }) {
  return (
    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderLeft: divider ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || '#eeede9', letterSpacing: -0.3, lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function LegendItem({ color, label, value, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        cursor: onClick ? 'pointer' : 'default',
        padding: '4px 8px', margin: '-4px -8px', borderRadius: 7,
        background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
        opacity: active === false ? 0.35 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        outline: active ? `1px solid rgba(255,255,255,0.12)` : 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      {value !== undefined && <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginLeft: 'auto' }}>{value}</span>}
    </div>
  );
}

function StackedBar({ data, height = 10 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ height, borderRadius: 999, overflow: 'hidden', display: 'flex', gap: 1 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: d.value / total, background: d.color, minWidth: d.value > 0 ? 2 : 0 }} />
      ))}
    </div>
  );
}

// Computes per-company progress from file records and reconciliations.
function companyProgress(companyId, fileRecords, reconciliations) {
  const files = fileRecords.filter((r) => r.accounting_company_id === companyId);
  const recons = reconciliations.filter((r) => r.accounting_company_id === companyId);
  const filesReceived = files.filter((r) => getFileStatus(r) === 'recebido').length;
  const reconDone = recons.filter((r) => r.status === 'conciliado').length;
  const filesPct = TASKS.length ? Math.round((filesReceived / TASKS.length) * 100) : 0;
  const reconPct = RECON_CATEGORIES.length ? Math.round((reconDone / RECON_CATEGORIES.length) * 100) : 0;
  return Math.round((filesPct + reconPct) / 2);
}

// =============================================================================
// TAB 1 — DASHBOARD (gerencial, alimentado por Arquivos e Conciliação)
// =============================================================================

const EMPTY_FORM = {
  codigo: '', nome: '', responsavel: '', regime: 'Simples Nacional', prioridade: 'media',
  prazo: '', observacoes: '', particularidades: '',
};

function DashboardTab({ competencia, companies, fileRecords, reconciliations,
  search, setSearch, filterResp, setFilterResp, filterPrio, setFilterPrio,
  onOpenCompanies, onOpenPendencias,
}) {
  const [chartFilter, setChartFilter] = useState(null);

  const toggleFilter = (chart, status) =>
    setChartFilter((prev) => (prev?.chart === chart && prev?.status === status ? null : { chart, status }));

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const filtered = useMemo(() => companies.filter((c) => {
    if (filterResp && c.responsavel !== filterResp) return false;
    if (filterPrio && c.prioridade !== filterPrio) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q) && !c.codigo?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [companies, filterResp, filterPrio, search]);

  const dashMetrics = useMemo(() => {
    const filteredIds = new Set(filtered.map((c) => c.id));
    const fRecs = fileRecords.filter((r) => filteredIds.has(r.accounting_company_id));
    const recs = reconciliations.filter((r) => filteredIds.has(r.accounting_company_id));

    const totalEmpresas = filtered.length;
    const totalEsperado = totalEmpresas * TASKS.length;
    const totalRecebidos = fRecs.filter((r) => getFileStatus(r) === 'recebido').length;
    const totalCobrados = fRecs.filter((r) => getFileStatus(r) === 'cobrado').length;
    const totalPendentes = Math.max(0, totalEsperado - totalRecebidos - totalCobrados);
    const pctRecebido = totalEsperado ? Math.round((totalRecebidos / totalEsperado) * 100) : 0;

    const byDocType = TASKS.map((t) => {
      const rcv = fRecs.filter((r) => r.doc_type === t.id && r.received).length;
      return { label: t.label, value: Math.round((rcv / (totalEmpresas || 1)) * 100), suffix: '%', color: '#00d48a' };
    });

    const byCategory = RECON_CATEGORIES.map((cat) => {
      const concluido = recs.filter((r) => r.category === cat.id && r.status === 'conciliado').length;
      const emAndamento = recs.filter((r) => r.category === cat.id && r.status === 'em_andamento').length;
      const pendencia = recs.filter((r) => r.category === cat.id && r.status === 'pendencia').length;
      const pct = Math.round((concluido / (totalEmpresas || 1)) * 100);
      return { ...cat, pct, concluido, emAndamento, pendencia };
    });

    const perCompany = filtered.map((c) => ({
      ...c,
      progress: companyProgress(c.id, fileRecords, reconciliations),
    }));

    const progressoMedio = totalEmpresas
      ? Math.round(perCompany.reduce((s, c) => s + c.progress, 0) / totalEmpresas)
      : 0;
    const empresasCompletas = perCompany.filter((c) => c.progress === 100).length;

    const reconTotal = totalEmpresas * RECON_CATEGORIES.length;
    const reconConcluido = recs.filter((r) => r.status === 'conciliado').length;
    const reconEmAndamento = recs.filter((r) => r.status === 'em_andamento').length;
    const reconPendencia = recs.filter((r) => r.status === 'pendencia').length;
    const reconNaoIniciado = Math.max(0, reconTotal - reconConcluido - reconEmAndamento - reconPendencia);
    const reconPctGeral = reconTotal ? Math.round((reconConcluido / reconTotal) * 100) : 0;

    const docsAbertos = Math.max(0, totalEsperado - totalRecebidos);
    const reconAbertos = Math.max(0, reconTotal - reconConcluido);
    const pendenciasAbertas = docsAbertos + reconAbertos;

    return {
      totalEmpresas, totalEsperado, totalRecebidos, totalCobrados, totalPendentes, pctRecebido,
      byDocType, byCategory, progressoMedio, empresasCompletas,
      pendenciasAbertas, docsAbertos, reconAbertos,
      reconTotal, reconConcluido, reconEmAndamento, reconPendencia, reconNaoIniciado, reconPctGeral,
    };
  }, [filtered, fileRecords, reconciliations]);

  const filterDetails = useMemo(() => {
    if (!chartFilter) return [];
    if (chartFilter.chart === 'arquivos') {
      return filtered.map((company) => {
        const items = TASKS.filter((t) => {
          const r = fileRecords.find((r) => r.accounting_company_id === company.id && r.doc_type === t.id);
          return getFileStatus(r) === chartFilter.status;
        }).map((t) => t.label);
        return { company, items };
      }).filter((x) => x.items.length > 0);
    }
    return filtered.map((company) => {
      const items = RECON_CATEGORIES.filter((cat) => {
        const r = reconciliations.find((r) => r.accounting_company_id === company.id && r.category === cat.id);
        return (r?.status || 'nao_iniciado') === chartFilter.status;
      }).map((cat) => cat.label);
      return { company, items };
    }).filter((x) => x.items.length > 0);
  }, [chartFilter, filtered, fileRecords, reconciliations]);

  const clearFilters = () => { setSearch(''); setFilterResp(''); setFilterPrio(''); };
  const hasFilters = !!(search || filterResp || filterPrio);

  return (
    <>
      {/* Barra de filtros globais */}
      <Card style={{ padding: 12, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px auto', gap: 10, alignItems: 'center' }}>
          <input
            className="acc-input"
            placeholder="Buscar por empresa, código ou responsável"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="acc-select" value={filterResp} onChange={(e) => setFilterResp(e.target.value)}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="acc-select" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
            <option value="">Todas prioridades</option>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </select>
          {hasFilters
            ? <button className="acc-btn" onClick={clearFilters} style={{ fontSize: '0.78rem' }}>Limpar filtros</button>
            : <span className="acc-count-badge">{filtered.length} empresa{filtered.length !== 1 ? 's' : ''}</span>
          }
        </div>
      </Card>

      {/* Seção Visão Geral */}
      <div className="acc-section-eyebrow">Visão geral</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 28 }}>
        <Kpi
          label="Total empresas"
          value={dashMetrics.totalEmpresas}
          hint={`competência ${competencia}`}
          onClick={() => onOpenCompanies({})}
        />
        <Kpi
          label="Progresso médio"
          value={`${dashMetrics.progressoMedio}%`}
          accent="#7C3AED"
          hint="files + conciliação"
          onClick={() => onOpenCompanies({ initialSort: 'progress_asc' })}
        />
        <Kpi
          label="Empresas concluídas"
          value={dashMetrics.empresasCompletas}
          accent="#00d48a"
          hint="100% do fechamento"
          onClick={() => onOpenCompanies({ initialOnlyCompleted: true })}
        />
        <Kpi
          label="Pendências abertas"
          value={dashMetrics.pendenciasAbertas}
          accent={dashMetrics.pendenciasAbertas > 0 ? '#ff8a3d' : '#00d48a'}
          hint={`${dashMetrics.docsAbertos} documentos + ${dashMetrics.reconAbertos} conciliações`}
          onClick={() => onOpenPendencias()}
        />
      </div>

      {/* Painel de detalhes do filtro (full width acima das colunas) */}
      {chartFilter && (
        <Card style={{ padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: filterDetails.length > 0 ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: chartFilter.chart === 'arquivos'
                ? (FILE_STATUS[chartFilter.status]?.fg || '#aaa')
                : (RECON_STATUS[chartFilter.status]?.fg || '#aaa'), flexShrink: 0 }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eeede9' }}>
                {chartFilter.chart === 'arquivos'
                  ? `Arquivos — ${FILE_STATUS[chartFilter.status]?.label}`
                  : `Conciliação — ${RECON_STATUS[chartFilter.status]?.label}`}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                {filterDetails.length === 0 ? 'Nenhuma empresa neste status' : `${filterDetails.length} empresa${filterDetails.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <button onClick={() => setChartFilter(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          {filterDetails.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filterDetails.map(({ company, items }) => (
                <div key={company.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ minWidth: 160, fontWeight: 700, fontSize: '0.88rem', color: '#eeede9' }}>{company.nome}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {items.map((item) => {
                      const fg = chartFilter.chart === 'arquivos'
                        ? (FILE_STATUS[chartFilter.status]?.fg || '#aaa')
                        : (RECON_STATUS[chartFilter.status]?.fg || '#aaa');
                      const bg = chartFilter.chart === 'arquivos'
                        ? (FILE_STATUS[chartFilter.status]?.bg || 'rgba(255,255,255,0.05)')
                        : (RECON_STATUS[chartFilter.status]?.bg || 'rgba(255,255,255,0.05)');
                      const bd = chartFilter.chart === 'arquivos'
                        ? (FILE_STATUS[chartFilter.status]?.bd || 'rgba(255,255,255,0.12)')
                        : (RECON_STATUS[chartFilter.status]?.bd || 'rgba(255,255,255,0.12)');
                      return (
                        <span key={item} className="acc-pill" style={{ background: bg, color: fg, borderColor: bd }}>
                          {item}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Duas colunas: esquerda = arquivos, direita = conciliação */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 28 }}>

        {/* COLUNA ESQUERDA: arquivos / documentos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: '22px 24px', display: 'flex', gap: 22, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <DonutChart
                data={[
                  { value: dashMetrics.totalRecebidos, color: '#00d48a' },
                  { value: dashMetrics.totalCobrados,  color: '#fbbf24' },
                  { value: dashMetrics.totalPendentes,  color: 'rgba(255,255,255,0.08)' },
                ]}
                size={130} thickness={26}
              />
              <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: -0.8, color: '#eeede9', lineHeight: 1 }}>{dashMetrics.pctRecebido}%</div>
                <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>recebidos</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1.3, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 12 }}>
                Situação da chegada de arquivos
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.25)', fontWeight: 400, letterSpacing: 0 }}>clique para filtrar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { status: 'recebido', color: '#00d48a', label: 'Recebidos', value: dashMetrics.totalRecebidos },
                  { status: 'cobrado',  color: '#fbbf24', label: 'Cobrados',  value: dashMetrics.totalCobrados },
                  { status: 'pendente', color: 'rgba(255,255,255,0.2)', label: 'Pendentes', value: dashMetrics.totalPendentes },
                ].map(({ status, color, label, value }) => (
                  <LegendItem key={status} color={color} label={label} value={value}
                    onClick={() => toggleFilter('arquivos', status)}
                    active={chartFilter?.chart === 'arquivos' ? chartFilter.status === status : undefined}
                  />
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>{dashMetrics.totalEsperado} docs ({TASKS.length} × {dashMetrics.totalEmpresas} emp.)</div>
                <ProgressBar pct={dashMetrics.pctRecebido} color="#00d48a" height={4} />
              </div>
            </div>
          </Card>

          <div className="acc-section-eyebrow" style={{ marginBottom: 0 }}>Documentos</div>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <CompactStat label="Esperado" value={dashMetrics.totalEsperado} hint={`${TASKS.length}×emp`} />
              <CompactStat label="Recebidos" value={dashMetrics.totalRecebidos} color="#00d48a" divider />
              <CompactStat label="Cobrados" value={dashMetrics.totalCobrados} color="#fbbf24" divider />
              <CompactStat label="Pendentes" value={dashMetrics.totalPendentes} color={dashMetrics.totalPendentes > 0 ? '#ff8a3d' : '#00d48a'} divider />
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', marginTop: 12 }}>
                <div style={{ flex: dashMetrics.totalRecebidos, background: '#00d48a' }} />
                <div style={{ flex: dashMetrics.totalCobrados, background: '#fbbf24' }} />
                <div style={{ flex: dashMetrics.totalPendentes, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA: conciliação / categorias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: '22px 24px', display: 'flex', gap: 22, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <DonutChart
                data={[
                  { value: dashMetrics.reconConcluido,    color: '#00d48a' },
                  { value: dashMetrics.reconEmAndamento,   color: '#7C3AED' },
                  { value: dashMetrics.reconPendencia,     color: '#ff6b6b' },
                  { value: dashMetrics.reconNaoIniciado,   color: 'rgba(255,255,255,0.08)' },
                ]}
                size={130} thickness={26}
              />
              <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: -0.8, color: '#eeede9', lineHeight: 1 }}>{dashMetrics.reconPctGeral}%</div>
                <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>conciliado</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1.3, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 12 }}>
                Situação da conciliação das empresas
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.25)', fontWeight: 400, letterSpacing: 0 }}>clique para filtrar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { status: 'conciliado',    color: '#00d48a', label: 'Conciliado',    value: dashMetrics.reconConcluido },
                  { status: 'em_andamento',  color: '#7C3AED', label: 'Em andamento',  value: dashMetrics.reconEmAndamento },
                  { status: 'pendencia',     color: '#ff6b6b', label: 'Pendência',     value: dashMetrics.reconPendencia },
                  { status: 'nao_iniciado',  color: 'rgba(255,255,255,0.2)', label: 'Não iniciado', value: dashMetrics.reconNaoIniciado },
                ].map(({ status, color, label, value }) => (
                  <LegendItem key={status} color={color} label={label} value={value}
                    onClick={() => toggleFilter('conciliacao', status)}
                    active={chartFilter?.chart === 'conciliacao' ? chartFilter.status === status : undefined}
                  />
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>{dashMetrics.reconTotal} cat. ({RECON_CATEGORIES.length} × {dashMetrics.totalEmpresas} emp.)</div>
                <ProgressBar pct={dashMetrics.reconPctGeral} color="#00d48a" height={4} />
              </div>
            </div>
          </Card>

          <div className="acc-section-eyebrow" style={{ marginBottom: 0 }}>Conciliação por categoria</div>
          <div className="acc-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
            {dashMetrics.byCategory.map((cat) => (
              <Card key={cat.id} style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 8, lineHeight: 1.4, minHeight: '1.8em' }}>{cat.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: cat.pct === 100 ? '#00d48a' : cat.pct > 0 ? '#7C3AED' : 'rgba(255,255,255,0.5)', letterSpacing: -0.8, marginBottom: 8 }}>
                  {cat.pct}%
                </div>
                <ProgressBar pct={cat.pct} color={cat.pct === 100 ? '#00d48a' : '#7C3AED'} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {cat.concluido > 0 && <span style={{ fontSize: '0.68rem', color: '#00d48a' }}>✓ {cat.concluido}</span>}
                  {cat.emAndamento > 0 && <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>◎ {cat.emAndamento}</span>}
                  {cat.pendencia > 0 && <span style={{ fontSize: '0.68rem', color: '#ff6b6b' }}>⚠ {cat.pendencia}</span>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}

// =============================================================================
// Company Drawer — slide-in from the right
// =============================================================================

function CompanyDrawer({ company, fileRecords, reconciliations, competencia, onClose }) {
  // Pendências
  const pendingFiles = TASKS.filter((t) => {
    const r = fileRecords.find((r) => r.doc_type === t.id);
    return !r || !r.received;
  });
  const pendingRecon = RECON_CATEGORIES.filter((cat) => {
    const r = reconciliations.find((r) => r.category === cat.id);
    return !r || r.status === 'nao_iniciado' || r.status === 'pendencia';
  });

  // Alertas
  const alerts = [];
  const isLate = isDelayed(company) && (pendingFiles.length > 0 || pendingRecon.length > 0);
  if (isLate) alerts.push({ fg: '#ff6b6b', text: 'Prazo vencido com pendências em aberto' });
  if (pendingFiles.length >= 5) alerts.push({ fg: '#ff8a3d', text: `${pendingFiles.length} documentos ainda não recebidos` });
  const extratoOk = fileRecords.some((r) => r.doc_type === 'extratos' && r.received);
  if (!extratoOk) alerts.push({ fg: '#ff8a3d', text: 'Extrato bancário não recebido' });
  const reconsWithPendency = reconciliations.filter((r) => r.status === 'pendencia');
  if (reconsWithPendency.length > 0) alerts.push({ fg: '#a78bfa', text: `${reconsWithPendency.length} categoria(s) com pendência de conciliação` });

  // Histórico
  const history = [
    ...fileRecords
      .filter((r) => r.received && r.received_at)
      .map((r) => ({
        date: r.received_at,
        text: `Documento "${TASKS.find((t) => t.id === r.doc_type)?.label}" recebido`,
        color: '#00d48a',
      })),
    ...reconciliations
      .filter((r) => r.status !== 'nao_iniciado' && r.updated_at)
      .map((r) => ({
        date: r.updated_at,
        text: `Conciliação "${RECON_CATEGORIES.find((c) => c.id === r.category)?.label}" → ${RECON_STATUS[r.status]?.label}`,
        color: RECON_STATUS[r.status]?.fg || '#aaa',
      })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const prog = companyProgress(company.id, fileRecords, reconciliations);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
        background: '#0e0e14', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 201, overflowY: 'auto', overflowX: 'hidden',
        animation: 'drawerIn 0.22s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 4 }}>
              Empresa{company.codigo && <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", color: '#7C3AED', letterSpacing: 0, fontWeight: 600 }}>#{company.codigo}</span>}
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.3, marginBottom: 6 }}>{company.nome}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <PriorityPill value={company.prioridade} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120 }}>
                <ProgressBar pct={prog} color={prog === 100 ? '#00d48a' : isDelayed(company) ? '#ff6b6b' : '#7C3AED'} height={5} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', minWidth: 34 }}>{prog}%</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', lineHeight: 1, marginTop: 2 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Informações */}
          <DrawerSection title="Informações">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {company.codigo && <InfoItem label="Código / ID" value={`#${company.codigo}`} accent="#7C3AED" />}
              <InfoItem label="Responsável" value={company.responsavel} />
              <InfoItem label="Regime" value={company.regime} />
              <InfoItem label="Competência" value={competencia} />
              <InfoItem label="Prazo" value={company.prazo || '—'} accent={isDelayed(company) ? '#ff6b6b' : undefined} />
            </div>
          </DrawerSection>

          {/* Particularidades */}
          {company.particularidades && (
            <DrawerSection title="Particularidades da empresa">
              <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 10, padding: '12px 14px', fontSize: '0.86rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                {company.particularidades}
              </div>
            </DrawerSection>
          )}

          {/* Observações */}
          {company.observacoes && (
            <DrawerSection title="Observações">
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', fontSize: '0.86rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                {company.observacoes}
              </div>
            </DrawerSection>
          )}

          {/* Pendências */}
          <DrawerSection title={`Pendências (${pendingFiles.length + pendingRecon.length})`}>
            {pendingFiles.length === 0 && pendingRecon.length === 0
              ? <div style={{ fontSize: '0.84rem', color: '#00d48a', display: 'flex', alignItems: 'center', gap: 8 }}>✓ Sem pendências para esta competência</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pendingFiles.map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,138,61,0.06)', border: '1px solid rgba(255,138,61,0.2)', borderRadius: 9 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8a3d', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)' }}>{t.label}</span>
                      <span className="acc-pill" style={{ marginLeft: 'auto', background: 'rgba(255,138,61,0.1)', color: '#ff8a3d', borderColor: 'rgba(255,138,61,0.25)' }}>Doc. pendente</span>
                    </div>
                  ))}
                  {pendingRecon.map((cat) => {
                    const r = reconciliations.find((r) => r.category === cat.id);
                    const isPendency = r?.status === 'pendencia';
                    return (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isPendency ? 'rgba(255,107,107,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPendency ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 9 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isPendency ? '#ff6b6b' : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)' }}>{cat.label}</span>
                        <span className="acc-pill" style={{ marginLeft: 'auto', background: isPendency ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.05)', color: isPendency ? '#ff6b6b' : '#9aa0a6', borderColor: isPendency ? 'rgba(255,107,107,0.25)' : 'rgba(255,255,255,0.1)' }}>
                          {isPendency ? 'Pendência' : 'Não iniciado'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </DrawerSection>

          {/* Alertas */}
          <DrawerSection title="Alertas automáticos">
            {alerts.length === 0
              ? <div style={{ fontSize: '0.84rem', color: '#00d48a' }}>✓ Nenhum alerta ativo</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,107,107,0.04)', border: `1px solid ${a.fg}33`, borderRadius: 9 }}>
                      <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠</span>
                      <span style={{ fontSize: '0.84rem', color: a.fg }}>{a.text}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </DrawerSection>

          {/* Informações complementares do fechamento */}
          <DrawerSection title="Informações complementares do fechamento">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Documentos</div>
              {TASKS.map((t) => {
                const r = fileRecords.find((r) => r.doc_type === t.id);
                const ok = r?.received;
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(255,255,255,0.015)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.75)' }}>{t.label}</span>
                    <span className="acc-pill" style={{ background: ok ? 'rgba(0,212,138,0.12)' : 'rgba(255,255,255,0.05)', color: ok ? '#00d48a' : '#9aa0a6', borderColor: ok ? 'rgba(0,212,138,0.25)' : 'rgba(255,255,255,0.1)' }}>
                      {ok ? `✓ ${r.received_at ? new Date(r.received_at).toLocaleDateString('pt-BR') : 'Recebido'}` : 'Pendente'}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Conciliação</div>
              {RECON_CATEGORIES.map((cat) => {
                const r = reconciliations.find((r) => r.category === cat.id);
                const status = r?.status || 'nao_iniciado';
                const c = RECON_STATUS[status];
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(255,255,255,0.015)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.75)' }}>{cat.label}</span>
                    <span className="acc-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{c.label}</span>
                  </div>
                );
              })}
            </div>
          </DrawerSection>

          {/* Histórico */}
          <DrawerSection title="Histórico">
            {history.length === 0
              ? <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.4)' }}>Nenhuma movimentação registrada nesta competência.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                        {i < history.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.06)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>{h.text}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          {new Date(h.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </DrawerSection>
        </div>
      </div>
    </>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.3, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoItem({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: accent || 'rgba(255,255,255,0.85)' }}>{value || '—'}</div>
    </div>
  );
}

// =============================================================================
// CompaniesModal — gerenciamento de empresas (cadastro/CRUD)
// =============================================================================

function CompaniesModal({ tenantCompanyId, competencia, companies, fileRecords, reconciliations,
  search, setSearch, filterResp, setFilterResp, filterPrio, setFilterPrio,
  initialSort, initialOnlyCompleted, onClose, onChange,
}) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const [sortBy, setSortBy] = useState(initialSort || 'name');
  const [onlyCompleted, setOnlyCompleted] = useState(!!initialOnlyCompleted);

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const filtered = useMemo(() => {
    const list = companies
      .map((c) => ({ ...c, progress: companyProgress(c.id, fileRecords, reconciliations) }))
      .filter((c) => {
        if (filterResp && c.responsavel !== filterResp) return false;
        if (filterPrio && c.prioridade !== filterPrio) return false;
        if (onlyCompleted && c.progress !== 100) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !c.nome?.toLowerCase().includes(q) &&
            !c.responsavel?.toLowerCase().includes(q) &&
            !c.codigo?.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      });
    if (sortBy === 'progress_asc') list.sort((a, b) => a.progress - b.progress || (a.nome || '').localeCompare(b.nome || ''));
    else if (sortBy === 'progress_desc') list.sort((a, b) => b.progress - a.progress || (a.nome || '').localeCompare(b.nome || ''));
    else list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    return list;
  }, [companies, fileRecords, reconciliations, filterResp, filterPrio, search, sortBy, onlyCompleted]);

  const clearFilters = () => { setSearch(''); setFilterResp(''); setFilterPrio(''); setOnlyCompleted(false); setSortBy('name'); };
  const hasFilters = !!(search || filterResp || filterPrio || onlyCompleted || sortBy !== 'name');

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditing('new'); };
  const openEdit = (c) => {
    setForm({
      codigo: c.codigo || '', nome: c.nome || '', responsavel: c.responsavel || '',
      regime: c.regime || 'Simples Nacional', prioridade: c.prioridade || 'media',
      prazo: c.prazo || '', observacoes: c.observacoes || '',
      particularidades: c.particularidades || '',
    });
    setEditing(c.id);
  };
  const closeEdit = () => { setEditing(null); setSaving(false); };
  const save = async () => {
    if (!form.nome?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        codigo: form.codigo?.trim() || null,
        tenant_company_id: tenantCompanyId,
        competencia,
        prazo: form.prazo || null,
        tasks: emptyTasks(),
      };
      if (editing !== 'new') payload.id = editing;
      await upsertCompany(payload);
      closeEdit();
      onChange();
    } catch (e) { alert(e.message); setSaving(false); }
  };
  const remove = async (id) => {
    if (!confirm('Remover esta empresa do acompanhamento?')) return;
    try { await deleteCompany(id); onChange(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 90 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.08)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>🏢 Empresas cadastradas</h2>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                {filtered.length} de {companies.length}
              </span>
              {onlyCompleted && (
                <span onClick={() => setOnlyCompleted(false)} className="acc-pill"
                  style={{ cursor: 'pointer', background: 'rgba(0,212,138,0.12)', color: '#00d48a', borderColor: 'rgba(0,212,138,0.28)' }}>
                  ✓ Apenas concluídas (100%) ×
                </span>
              )}
              {sortBy === 'progress_asc' && (
                <span className="acc-pill" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.28)' }}>
                  ↑ Menor progresso primeiro
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="acc-btn primary" style={{ fontSize: '0.82rem' }} onClick={openCreate}>+ Nova empresa</button>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>

          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 170px 170px auto', gap: 10, alignItems: 'center' }}>
              <input className="acc-input" placeholder="Buscar por nome, código ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="acc-select" value={filterResp} onChange={(e) => setFilterResp(e.target.value)}>
                <option value="">Todos responsáveis</option>
                {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="acc-select" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
                <option value="">Todas prioridades</option>
                <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
              </select>
              <select className="acc-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Ordenar: A → Z</option>
                <option value="progress_asc">Ordenar: progresso ↑</option>
                <option value="progress_desc">Ordenar: progresso ↓</option>
              </select>
              {hasFilters
                ? <button className="acc-btn" onClick={clearFilters} style={{ fontSize: '0.78rem' }}>Limpar</button>
                : <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
              }
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table className="acc-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 80 }}>ID</th>
                  <th style={{ minWidth: 220 }}>Empresa</th>
                  <th>Responsável</th>
                  <th>Regime</th>
                  <th>Prioridade</th>
                  <th style={{ minWidth: 160 }}>Progresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '40px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {companies.length === 0
                      ? 'Nenhuma empresa cadastrada. Clique em "+ Nova empresa" para começar.'
                      : 'Nenhuma empresa corresponde aos filtros.'}
                  </td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.codigo
                        ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', fontWeight: 600, color: '#7C3AED' }}>#{c.codigo}</span>
                        : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#eeede9' }}>{c.nome}</div>
                      {c.prazo && (
                        <div style={{ fontSize: '0.72rem', color: isDelayed(c) ? '#ff6b6b' : 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                          {isDelayed(c) ? '⚠ ' : ''}Prazo: {c.prazo}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.8)' }}>{c.responsavel || <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}</td>
                    <td><span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{c.regime}</span></td>
                    <td><PriorityPill value={c.prioridade} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar pct={c.progress} color={c.progress === 100 ? '#00d48a' : isDelayed(c) ? '#ff6b6b' : '#7C3AED'} height={6} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: 36, textAlign: 'right', color: c.progress === 100 ? '#00d48a' : 'rgba(255,255,255,0.8)' }}>
                          {c.progress}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="acc-btn view" style={{ padding: '5px 12px', fontSize: '0.76rem' }} onClick={() => setViewCompany(c)}>Ver</button>
                        <button className="acc-btn" style={{ padding: '5px 10px', fontSize: '0.76rem' }} onClick={() => openEdit(c)}>Editar</button>
                        <button className="acc-btn danger" style={{ padding: '5px 10px', fontSize: '0.76rem' }} onClick={() => remove(c.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Nova empresa' : 'Editar empresa'} onClose={closeEdit} onSave={save} saving={saving}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Código / ID">
              <input className="acc-input" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex.: 001, CLI-42" style={{ fontFamily: "'JetBrains Mono', monospace" }} />
            </Field>
            <Field label="Empresa"><input className="acc-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
            <Field label="Responsável"><input className="acc-input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></Field>
            <Field label="Regime tributário">
              <select className="acc-select" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })}>
                {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select className="acc-select" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
              </select>
            </Field>
            <Field label="Prazo"><input className="acc-input" type="date" value={form.prazo || ''} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Observações"><textarea className="acc-input" rows={2} style={{ width: '100%', resize: 'vertical' }} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Particularidades da empresa"><textarea className="acc-input" rows={2} style={{ width: '100%', resize: 'vertical' }} value={form.particularidades} onChange={(e) => setForm({ ...form, particularidades: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {viewCompany && (
        <CompanyDrawer
          company={viewCompany}
          fileRecords={fileRecords.filter((r) => r.accounting_company_id === viewCompany.id)}
          reconciliations={reconciliations.filter((r) => r.accounting_company_id === viewCompany.id)}
          competencia={competencia}
          onClose={() => setViewCompany(null)}
        />
      )}
    </>
  );
}

// =============================================================================
// PendenciasModal — detalhe de pendências agrupado por empresa
// =============================================================================

function PendenciasModal({ competencia, companies, fileRecords, reconciliations, search, filterResp, filterPrio, onClose }) {
  const filteredCompanies = useMemo(() => companies.filter((c) => {
    if (filterResp && c.responsavel !== filterResp) return false;
    if (filterPrio && c.prioridade !== filterPrio) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.nome?.toLowerCase().includes(q) &&
        !c.responsavel?.toLowerCase().includes(q) &&
        !c.codigo?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }), [companies, filterResp, filterPrio, search]);

  const groups = useMemo(() => filteredCompanies.map((company) => {
    const cFiles = fileRecords.filter((r) => r.accounting_company_id === company.id);
    const cRecs = reconciliations.filter((r) => r.accounting_company_id === company.id);

    const pendingDocs = TASKS.map((t) => {
      const r = cFiles.find((r) => r.doc_type === t.id);
      const status = getFileStatus(r);
      return status !== 'recebido' ? { id: t.id, label: t.label, status } : null;
    }).filter(Boolean);

    const pendingRecons = RECON_CATEGORIES.map((cat) => {
      const r = cRecs.find((r) => r.category === cat.id);
      const status = r?.status || 'nao_iniciado';
      return status !== 'conciliado' ? { id: cat.id, label: cat.label, status } : null;
    }).filter(Boolean);

    return { company, pendingDocs, pendingRecons, total: pendingDocs.length + pendingRecons.length };
  }).filter((g) => g.total > 0).sort((a, b) => b.total - a.total),
  [filteredCompanies, fileRecords, reconciliations]);

  const totalDocs = groups.reduce((s, g) => s + g.pendingDocs.length, 0);
  const totalRecons = groups.reduce((s, g) => s + g.pendingRecons.length, 0);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,138,61,0.1)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>⚠ Pendências abertas</h2>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
              {groups.length} empresa{groups.length !== 1 ? 's' : ''} · competência {competencia}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <CompactStat label="Empresas com pendência" value={groups.length} />
          <CompactStat label="Documentos pendentes" value={totalDocs} color="#ff8a3d" divider />
          <CompactStat label="Conciliações pendentes" value={totalRecons} color="#ff6b6b" divider />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#00d48a', fontSize: '0.9rem' }}>
              ✓ Nenhuma pendência aberta para os filtros atuais
            </div>
          )}
          {groups.map(({ company, pendingDocs, pendingRecons, total }) => (
            <Card key={company.id} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {company.codigo && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.74rem', fontWeight: 600, color: '#7C3AED' }}>#{company.codigo}</span>
                  )}
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#eeede9' }}>{company.nome}</span>
                  {company.responsavel && (
                    <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)' }}>· {company.responsavel}</span>
                  )}
                </div>
                <span className="acc-pill" style={{ background: 'rgba(255,138,61,0.1)', color: '#ff8a3d', borderColor: 'rgba(255,138,61,0.25)' }}>
                  {total} pendente{total !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,138,61,0.85)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Documentos pendentes ({pendingDocs.length})
                  </div>
                  {pendingDocs.length === 0
                    ? <div style={{ fontSize: '0.78rem', color: 'rgba(0,212,138,0.7)' }}>✓ Todos recebidos</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pendingDocs.map((d) => {
                          const s = FILE_STATUS[d.status];
                          return (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'rgba(255,138,61,0.05)', borderRadius: 7, border: '1px solid rgba(255,138,61,0.15)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{d.label}</span>
                              <span className="acc-pill" style={{ background: s.bg, color: s.fg, borderColor: s.bd, fontSize: '0.62rem' }}>{s.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }
                </div>

                <div>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,107,107,0.85)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Conciliações pendentes ({pendingRecons.length})
                  </div>
                  {pendingRecons.length === 0
                    ? <div style={{ fontSize: '0.78rem', color: 'rgba(0,212,138,0.7)' }}>✓ Todas conciliadas</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pendingRecons.map((d) => {
                          const s = RECON_STATUS[d.status];
                          return (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'rgba(255,107,107,0.05)', borderRadius: 7, border: '1px solid rgba(255,107,107,0.15)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{d.label}</span>
                              <span className="acc-pill" style={{ background: s.bg, color: s.fg, borderColor: s.bd, fontSize: '0.62rem' }}>{s.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2 — ARQUIVOS
// =============================================================================

function FilesTab({ competencia, companies, fileRecords, onChange }) {
  const [editing, setEditing] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const recordsMap = useMemo(() => {
    const m = {};
    fileRecords.forEach((r) => { m[`${r.accounting_company_id}::${r.doc_type}`] = r; });
    return m;
  }, [fileRecords]);

  const totalCells = companies.length * TASKS.length;
  const receivedCells = fileRecords.filter((r) => getFileStatus(r) === 'recebido').length;
  const cobradoCells = fileRecords.filter((r) => getFileStatus(r) === 'cobrado').length;
  const pendenteCells = Math.max(0, totalCells - receivedCells - cobradoCells);
  const pct = totalCells ? Math.round((receivedCells / totalCells) * 100) : 0;

  const cycle = async (companyId, docType) => {
    const current = recordsMap[`${companyId}::${docType}`];
    const cur = getFileStatus(current);
    const next = FILE_STATUS_CYCLE[(FILE_STATUS_CYCLE.indexOf(cur) + 1) % FILE_STATUS_CYCLE.length];
    try {
      await upsertFileRecord({
        accountingCompanyId: companyId,
        docType,
        competencia,
        fileStatus: next,
        notes: current?.notes ?? null,
      });
      onChange();
    } catch (e) { alert(e.message); }
  };

  const openNotes = (companyId, docType) => {
    const r = recordsMap[`${companyId}::${docType}`];
    setEditing({ companyId, docType });
    setEditNotes(r?.notes || '');
  };
  const saveNotes = async () => {
    setSaving(true);
    try {
      const current = recordsMap[`${editing.companyId}::${editing.docType}`];
      await upsertFileRecord({
        accountingCompanyId: editing.companyId,
        docType: editing.docType,
        competencia,
        fileStatus: getFileStatus(current),
        notes: editNotes,
      });
      setEditing(null);
      onChange();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (companies.length === 0) return <Empty>Cadastre empresas no Dashboard antes de marcar arquivos.</Empty>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Kpi label="Esperados" value={totalCells} hint={`${TASKS.length} por empresa`} />
        <Kpi label="Recebidos" value={receivedCells} accent="#00d48a" />
        <Kpi label="Cobrados" value={cobradoCells} accent="#fbbf24" />
        <Kpi label="Pendentes" value={pendenteCells} accent={pendenteCells > 0 ? '#ff8a3d' : '#00d48a'} />
        <Kpi label="% recebido" value={`${pct}%`} accent="#7C3AED" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="acc-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: 220 }}>Empresa</th>
                {TASKS.map((t) => <th key={t.id} title={t.label}>{t.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                  </td>
                  {TASKS.map((t) => {
                    const r = recordsMap[`${c.id}::${t.id}`];
                    const status = getFileStatus(r);
                    const s = FILE_STATUS[status];
                    const hasNotes = !!r?.notes;
                    return (
                      <td key={t.id}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
                          <button
                            onClick={() => cycle(c.id, t.id)}
                            className="acc-pill"
                            style={{ cursor: 'pointer', background: s.bg, color: s.fg, borderColor: s.bd, width: 'fit-content' }}
                          >
                            {status === 'recebido' ? '✓ ' : status === 'cobrado' ? '◎ ' : ''}{s.label}
                          </button>
                          {status === 'recebido' && r?.received_at && (
                            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                              {new Date(r.received_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          <button
                            onClick={() => openNotes(c.id, t.id)}
                            style={{ background: 'transparent', border: 'none', color: hasNotes ? '#a78bfa' : 'rgba(255,255,255,0.3)', fontSize: '0.7rem', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                          >
                            {hasNotes ? '◧ ver obs.' : '+ obs.'}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Modal title="Observação" onClose={() => setEditing(null)} onSave={saveNotes} saving={saving} width={500}>
          <Field label={`${TASKS.find((t) => t.id === editing.docType)?.label || ''} — ${competencia}`}>
            <textarea className="acc-input" rows={5} style={{ width: '100%', resize: 'vertical' }} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ex.: cliente enviou parcial, faltam notas de saída." />
          </Field>
        </Modal>
      )}
    </>
  );
}

// =============================================================================
// TAB 3 — CONCILIAÇÃO
// =============================================================================

function ReconciliationTab({ competencia, companies, reconciliations, onChange }) {
  const [editing, setEditing] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reconsMap = useMemo(() => {
    const m = {};
    reconciliations.forEach((r) => { m[`${r.accounting_company_id}::${r.category}`] = r; });
    return m;
  }, [reconciliations]);

  const categoryStats = RECON_CATEGORIES.map((cat) => {
    const total = companies.length || 1;
    const done = reconciliations.filter((r) => r.category === cat.id && r.status === 'conciliado').length;
    return { ...cat, pct: Math.round((done / total) * 100) };
  });

  const setStatus = async (companyId, category, status) => {
    const current = reconsMap[`${companyId}::${category}`];
    try {
      await upsertReconciliation({
        accountingCompanyId: companyId,
        category,
        competencia,
        status,
        observacoes: current?.observacoes ?? null,
      });
      onChange();
    } catch (e) { alert(e.message); }
  };

  const openNotes = (companyId, category) => {
    const r = reconsMap[`${companyId}::${category}`];
    setEditing({ companyId, category });
    setEditNotes(r?.observacoes || '');
  };
  const saveNotes = async () => {
    setSaving(true);
    try {
      const current = reconsMap[`${editing.companyId}::${editing.category}`];
      await upsertReconciliation({
        accountingCompanyId: editing.companyId,
        category: editing.category,
        competencia,
        status: current?.status || 'nao_iniciado',
        observacoes: editNotes,
      });
      setEditing(null);
      onChange();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (companies.length === 0) return <Empty>Cadastre empresas no Dashboard antes de iniciar a conciliação.</Empty>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
        {categoryStats.map((c) => (
          <Kpi key={c.id} label={c.label} value={`${c.pct}%`} accent={c.pct === 100 ? '#00d48a' : '#7C3AED'} hint="conciliado" />
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="acc-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: 220 }}>Empresa</th>
                {RECON_CATEGORIES.map((c) => <th key={c.id}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                  </td>
                  {RECON_CATEGORIES.map((cat) => {
                    const r = reconsMap[`${c.id}::${cat.id}`];
                    const status = r?.status || 'nao_iniciado';
                    const hasNotes = !!r?.observacoes;
                    return (
                      <td key={cat.id}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <ReconStatusSelect value={status} onChange={(v) => setStatus(c.id, cat.id, v)} />
                          <button
                            onClick={() => openNotes(c.id, cat.id)}
                            style={{ background: 'transparent', border: 'none', color: hasNotes ? '#a78bfa' : 'rgba(255,255,255,0.3)', fontSize: '0.7rem', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                          >
                            {hasNotes ? '◧ ver obs.' : '+ obs.'}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Modal title="Observação de conciliação" onClose={() => setEditing(null)} onSave={saveNotes} saving={saving} width={500}>
          <Field label={`${RECON_CATEGORIES.find((c) => c.id === editing.category)?.label || ''} — ${competencia}`}>
            <textarea className="acc-input" rows={5} style={{ width: '100%', resize: 'vertical' }} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Pendências, divergências, ações em aberto..." />
          </Field>
        </Modal>
      )}
    </>
  );
}
