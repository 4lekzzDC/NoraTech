import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import {
  TASKS, REGIMES,
  RECON_CATEGORIES, RECON_STATUS, RECON_STATUS_ORDER,
  currentCompetencia, emptyTasks, isDelayed,
} from '../lib/accountingDomain';
import { useIsAdmin } from '../lib/admin';
import {
  getCurrentTenantCompanyId,
  getCurrentMembership,
  listCompanies, upsertCompany, deleteCompany,
  listFileRecords, upsertFileRecord,
  listReconciliations, upsertReconciliation,
  listAccountingParams, upsertAccountingParams,
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

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function CompetenciaPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);
  const parts = value ? value.split('/') : [];
  const curMonth = parts[0] ? parseInt(parts[0], 10) : 0;
  const curYear  = parts[1] ? parseInt(parts[1], 10) : new Date().getFullYear();
  const [pickerYear, setPickerYear] = useState(curYear);

  useEffect(() => { if (parts[1]) setPickerYear(parseInt(parts[1], 10)); }, [value]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 240);
    }
    setOpen((o) => !o);
  };

  const selectMonth = (m) => {
    onChange(`${String(m).padStart(2, '0')}/${pickerYear}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleToggle}
        className="acc-input"
        style={{ width: 108, padding: '6px 10px', fontSize: '0.83rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, userSelect: 'none' }}
      >
        <span>{value || 'MM/AAAA'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.45, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M1.5 3.5 L5 7 L8.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', [dropUp ? 'bottom' : 'top']: 'calc(100% + 6px)', right: 0,
          width: 220, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 300, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => setPickerYear((y) => y - 1)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: '1.1rem', lineHeight: 1 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#eeede9' }}>{pickerYear}</span>
            <button type="button" onClick={() => setPickerYear((y) => y + 1)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: '1.1rem', lineHeight: 1 }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: 8 }}>
            {MONTHS_SHORT.map((m, i) => {
              const sel = (i + 1) === curMonth && pickerYear === curYear;
              return (
                <button key={m} type="button" onClick={() => selectMonth(i + 1)}
                  style={{ padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: sel ? 700 : 500, background: sel ? '#7C3AED' : 'transparent', color: sel ? '#fff' : 'rgba(255,255,255,0.65)', transition: 'background 0.12s, color 0.12s' }}
                  onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
                >{m}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const { user, logout } = useAuth();
  const { isAdmin } = useIsAdmin();
  const initials = useMemo(
    () => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
    [user]
  );
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [tenantCompanyId, setTenantCompanyId] = useState(null);
  const [companyRole, setCompanyRole] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [fileRecords, setFileRecords] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [companiesView, setCompaniesView] = useState(null);
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [params, setParams] = useState(null);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const configBtnRef = useRef(null);
  const configMenuRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Filtros globais (compartilhados entre dashboard e modal Empresas)
  const [search, setSearch] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [filterRegime, setFilterRegime] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const ms = await getCurrentMembership();
      const tid = ms?.tenantCompanyId || null;
      setTenantCompanyId(tid);
      setCompanyRole(ms?.role || null);
      if (!tid) {
        setCompanies([]); setFileRecords([]); setReconciliations([]);
        return;
      }
      listAccountingParams(tid).then(setParams).catch(() => {});
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

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (
        avatarRef.current && !avatarRef.current.contains(e.target) &&
        profileMenuRef.current && !profileMenuRef.current.contains(e.target)
      ) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  useEffect(() => {
    if (!configMenuOpen) return;
    const handler = (e) => {
      if (
        configBtnRef.current && !configBtnRef.current.contains(e.target) &&
        configMenuRef.current && !configMenuRef.current.contains(e.target)
      ) setConfigMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [configMenuOpen]);

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
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,10,0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

        {/* Faixa 1 — global: home + NORATECH (esq) | atualização (centro) | admin + avatar (dir) */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 1380, margin: '0 auto', padding: '0 32px', height: 68, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexShrink: 0 }}>
            <Link to="/area-do-cliente" title="Central de Controle" aria-label="Central de Controle" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.9rem' }}>/</span>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5, flexShrink: 0 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
          </div>
          {/* Centro — Atualizado em */}
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            {lastUpdated && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                Atualizado em {lastUpdated.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            {isAdmin && (
              <Link to="/admin" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.08)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.2s' }}>
                ⚙ Admin
              </Link>
            )}
            <ThemeToggle />
            {/* Avatar button — click reveals name/email/logout */}
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              title={user?.name || 'Usuário'}
              aria-label="Menu do usuário"
              style={{ padding: 0, background: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', transition: 'border-color 0.2s' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: profileOpen ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, border: `2px solid ${profileOpen ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s' }}>
                  {initials}
                </div>
              )}
            </button>
            {profileOpen && createPortal(
              (() => {
                const rect = avatarRef.current?.getBoundingClientRect();
                const top = rect ? rect.bottom + 8 : 80;
                const right = rect ? window.innerWidth - rect.right : 32;
                return (
                  <div ref={profileMenuRef} style={{ position: 'fixed', top, right, zIndex: 9999, minWidth: 220, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                    {/* User info */}
                    <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {user?.photoUrl ? (
                          <img src={user.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                            {initials}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eeede9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Usuário'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                        </div>
                      </div>
                    </div>
                    {/* Sair */}
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sair
                    </button>
                  </div>
                );
              })(),
              document.body
            )}
          </div>
        </div>

        {/* Faixa 2 — abas (esq) + Competência/Empresas (dir) */}
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <nav style={{ display: 'flex', gap: 32 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Competência</span>
              <CompetenciaPicker value={competencia} onChange={setCompetencia} />
            </label>
            <div style={{ position: 'relative' }}>
              <button
                ref={configBtnRef}
                type="button"
                onClick={() => setConfigMenuOpen((o) => !o)}
                className="acc-btn"
                style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 7 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Configurações
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.5, transform: configMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', marginLeft: -2 }}>
                  <path d="M1.5 3.5 L5 7 L8.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {configMenuOpen && (
                <div ref={configMenuRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 180, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 300, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => { setConfigMenuOpen(false); setCompaniesView({}); }}
                    style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <rect x="2" y="7" width="20" height="15" rx="1" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    </svg>
                    Empresas
                  </button>
                  {(isAdmin || companyRole === 'owner' || companyRole === 'admin') && (
                    <button
                      type="button"
                      onClick={() => { setConfigMenuOpen(false); setParamsOpen(true); }}
                      style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Parametrização
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
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
                filterRegime={filterRegime} setFilterRegime={setFilterRegime}
                onOpenCompanies={(view) => setCompaniesView(view || {})}
                onOpenPendencias={() => setPendenciasOpen(true)}
                params={params}
              />
            )}
            {activeTab === 'arquivos' && (
              <FilesTab
                competencia={competencia}
                companies={companies}
                fileRecords={fileRecords}
                setFileRecords={setFileRecords}
              />
            )}
            {activeTab === 'conciliacao' && (
              <ReconciliationTab
                competencia={competencia}
                companies={companies}
                reconciliations={reconciliations}
                setReconciliations={setReconciliations}
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
          filterRegime={filterRegime} setFilterRegime={setFilterRegime}
          initialSort={companiesView.initialSort}
          initialFilter={companiesView.initialFilter}
          onClose={() => setCompaniesView(null)}
          onChange={reload}
          params={params}
        />
      )}
      {paramsOpen && tenantCompanyId && (
        <ParametrizacaoModal
          tenantCompanyId={tenantCompanyId}
          params={params}
          canWrite={isAdmin || companyRole === 'owner' || companyRole === 'admin'}
          onClose={() => setParamsOpen(false)}
          onSaved={(p) => { setParams(p); setParamsOpen(false); }}
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
          filterRegime={filterRegime}
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

function StatusDropdown({ value, onChange, options, statusMap }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left, width, dropUp }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const v = value || options[0];
  const c = statusMap[v] || statusMap[options[0]];

  const computePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = options.length * 32 + 16; // estimativa
    const dropUp = window.innerHeight - rect.bottom < menuHeight + 12;
    setPos({
      top: dropUp ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      dropUp,
    });
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    const handleScrollResize = () => computePos();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [open]); // eslint-disable-line

  const handleToggle = () => {
    if (!open) computePos();
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        style={{
          minWidth: 148, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
          background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
          borderRadius: 8, cursor: 'pointer', outline: 'none', userSelect: 'none',
          transition: 'filter 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.18)'; e.currentTarget.style.boxShadow = `0 0 0 2px ${c.bd}`; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.fg, flexShrink: 0, opacity: 0.85 }} />
          {c.label}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M1.5 3.5 L5 7 L8.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.dropUp ? undefined : pos.top,
            bottom: pos.dropUp ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            minWidth: pos.width,
            background: '#18181f',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            zIndex: 9999,
            padding: 4,
            overflow: 'hidden',
          }}
        >
          {options.map((s) => {
            const sc = statusMap[s];
            const selected = s === v;
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', fontSize: '0.7rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.6,
                  background: selected ? sc.bg : 'transparent',
                  color: selected ? sc.fg : 'rgba(255,255,255,0.65)',
                  border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.fg, flexShrink: 0, opacity: selected ? 1 : 0.55 }} />
                {sc.label}
                {selected && <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 'auto', opacity: 0.8 }}><path d="M1.5 5 L4 7.5 L8.5 2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

function ReconStatusSelect({ value, onChange }) {
  return <StatusDropdown value={value} onChange={onChange} options={RECON_STATUS_ORDER} statusMap={RECON_STATUS} />;
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 20px', zIndex: 120 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, margin: 'auto', background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.65)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        {onSave && (
          <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
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

// Helpers para os cards do Dashboard:
// "Concluída" (no contexto dos cards) = todas as categorias de Conciliação com status 'conciliado'.
function isReconCompleted(companyId, reconciliations) {
  return RECON_CATEGORIES.every((cat) =>
    reconciliations.some((r) =>
      r.accounting_company_id === companyId &&
      r.category === cat.id &&
      r.status === 'conciliado'
    )
  );
}

// "Em andamento" = tem pelo menos uma conciliação 'em_andamento' OU pelo menos uma 'conciliado',
// mas ainda não está 100% conciliada.
function isReconInProgress(companyId, reconciliations) {
  if (isReconCompleted(companyId, reconciliations)) return false;
  return reconciliations.some((r) =>
    r.accounting_company_id === companyId &&
    (r.status === 'em_andamento' || r.status === 'conciliado')
  );
}

// "Aguardando cliente" = tem pelo menos um arquivo com status 'cobrado'.
function hasFileCobrado(companyId, fileRecords) {
  return fileRecords.some((r) =>
    r.accounting_company_id === companyId && getFileStatus(r) === 'cobrado'
  );
}

// Retorna true se a empresa está atrasada segundo os parâmetros configuráveis.
function isDelayedByParams(companyId, fileRecords, reconciliations, params) {
  if (!params) return false;
  const today = new Date().getDate();
  const cFiles = fileRecords.filter((r) => r.accounting_company_id === companyId);
  const cRecons = reconciliations.filter((r) => r.accounting_company_id === companyId);

  // Documento "pendente" = sem registro OU registro com status 'pendente'.
  // Registro ausente significa que o arquivo ainda não foi marcado nem como cobrado nem recebido.
  if (params.dia_cobranca > 0 && today > params.dia_cobranca) {
    const hasPendente = TASKS.some((t) => {
      const r = cFiles.find((f) => f.doc_type === t.id);
      return getFileStatus(r) === 'pendente';
    });
    if (hasPendente) return true;
  }
  if (params.dia_recebimento > 0 && today > params.dia_recebimento) {
    const hasCobrado = TASKS.some((t) => {
      const r = cFiles.find((f) => f.doc_type === t.id);
      return getFileStatus(r) === 'cobrado';
    });
    if (hasCobrado) return true;
  }
  if (params.dia_extrato_aplicacoes > 0 && today > params.dia_extrato_aplicacoes) {
    if (!cRecons.some((r) => r.category === 'extrato_aplicacoes' && r.status === 'conciliado')) return true;
  }
  if (params.dia_apuracao > 0 && today > params.dia_apuracao) {
    if (!cRecons.some((r) => r.category === 'apuracao' && r.status === 'conciliado')) return true;
  }
  if (params.dia_folha > 0 && today > params.dia_folha) {
    if (!cRecons.some((r) => r.category === 'folha' && r.status === 'conciliado')) return true;
  }
  if (params.dia_demais_contas > 0 && today > params.dia_demais_contas) {
    if (!cRecons.some((r) => r.category === 'demais_contas' && r.status === 'conciliado')) return true;
  }
  if (params.dia_fornecedores > 0 && today > params.dia_fornecedores) {
    if (!cRecons.some((r) => r.category === 'fornecedores' && r.status === 'conciliado')) return true;
  }
  return false;
}

// Retorna array de motivos de atraso para exibição no modal.
function getDelayReasons(companyId, fileRecords, reconciliations, params) {
  if (!params) return [];
  const today = new Date().getDate();
  const cFiles = fileRecords.filter((r) => r.accounting_company_id === companyId);
  const cRecons = reconciliations.filter((r) => r.accounting_company_id === companyId);
  const reasons = [];

  if (params.dia_cobranca > 0 && today > params.dia_cobranca) {
    const pendentes = TASKS.filter((t) => {
      const r = cFiles.find((f) => f.doc_type === t.id);
      return getFileStatus(r) === 'pendente';
    });
    if (pendentes.length > 0)
      reasons.push(`Não cobrados até dia ${params.dia_cobranca}: ${pendentes.map((t) => t.label).join(', ')}`);
  }
  if (params.dia_recebimento > 0 && today > params.dia_recebimento) {
    const cobrados = TASKS.filter((t) => {
      const r = cFiles.find((f) => f.doc_type === t.id);
      return getFileStatus(r) === 'cobrado';
    });
    if (cobrados.length > 0)
      reasons.push(`Cobrado, não recebido até dia ${params.dia_recebimento}: ${cobrados.map((t) => t.label).join(', ')}`);
  }
  if (params.dia_extrato_aplicacoes > 0 && today > params.dia_extrato_aplicacoes && !cRecons.some((r) => r.category === 'extrato_aplicacoes' && r.status === 'conciliado'))
    reasons.push(`Extrato & Aplicações pendente (limite: dia ${params.dia_extrato_aplicacoes})`);
  if (params.dia_apuracao > 0 && today > params.dia_apuracao && !cRecons.some((r) => r.category === 'apuracao' && r.status === 'conciliado'))
    reasons.push(`Apuração pendente (limite: dia ${params.dia_apuracao})`);
  if (params.dia_folha > 0 && today > params.dia_folha && !cRecons.some((r) => r.category === 'folha' && r.status === 'conciliado'))
    reasons.push(`Folha pendente (limite: dia ${params.dia_folha})`);
  if (params.dia_demais_contas > 0 && today > params.dia_demais_contas && !cRecons.some((r) => r.category === 'demais_contas' && r.status === 'conciliado'))
    reasons.push(`Demais contas pendentes (limite: dia ${params.dia_demais_contas})`);
  if (params.dia_fornecedores > 0 && today > params.dia_fornecedores && !cRecons.some((r) => r.category === 'fornecedores' && r.status === 'conciliado'))
    reasons.push(`Fornecedores pendentes (limite: dia ${params.dia_fornecedores})`);
  return reasons;
}

// =============================================================================
// TAB 1 — DASHBOARD (gerencial, alimentado por Arquivos e Conciliação)
// =============================================================================

const EMPTY_FORM = {
  codigo: '', nome: '', responsavel: '', regime: 'Simples Nacional',
  observacoes: '', particularidades: '',
};

function DashboardTab({ competencia, companies, fileRecords, reconciliations,
  search, setSearch, filterResp, setFilterResp, filterRegime, setFilterRegime,
  onOpenCompanies, onOpenPendencias, params,
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
    if (filterRegime && c.regime !== filterRegime) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q) && !c.codigo?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [companies, filterResp, filterRegime, search]);

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

    // Cards gerenciais: estágio das empresas
    // Concluídas: todas as categorias da Conciliação como 'conciliado'.
    const concluidas = filtered.filter((c) => isReconCompleted(c.id, recs)).length;
    // Em andamento: pelo menos uma conciliação 'em_andamento' OU pelo menos uma 'conciliado',
    // mas ainda não 100% conciliada.
    const emAndamento = filtered.filter((c) => isReconInProgress(c.id, recs)).length;
    // Aguardando cliente: pelo menos um arquivo com status 'cobrado'.
    const aguardandoCliente = filtered.filter((c) => hasFileCobrado(c.id, fRecs)).length;
    // Atrasadas: usa thresholds configuráveis via Parametrização.
    const atrasadas = filtered.filter((c) => isDelayedByParams(c.id, fRecs, recs, params)).length;

    return {
      totalEmpresas, totalEsperado, totalRecebidos, totalCobrados, totalPendentes, pctRecebido,
      byDocType, byCategory, progressoMedio, empresasCompletas,
      pendenciasAbertas, docsAbertos, reconAbertos,
      reconTotal, reconConcluido, reconEmAndamento, reconPendencia, reconNaoIniciado, reconPctGeral,
      concluidas, emAndamento, aguardandoCliente, atrasadas,
    };
  }, [filtered, fileRecords, reconciliations, params]);

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

  const clearFilters = () => { setSearch(''); setFilterResp(''); setFilterRegime(''); };
  const hasFilters = !!(search || filterResp || filterRegime);

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
          <select className="acc-select" value={filterRegime} onChange={(e) => setFilterRegime(e.target.value)}>
            <option value="">Todas tributações</option>
            <option value="Lucro Real">Lucro Real</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="MEI">MEI</option>
            <option value="Associação">Associação</option>
          </select>
          {hasFilters && (
            <button className="acc-btn" onClick={clearFilters} style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Limpar filtros</button>
          )}
        </div>
      </Card>

      {/* Cards gerenciais: estágio das empresas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 28 }}>
        <Kpi
          label="Concluídas"
          value={dashMetrics.concluidas}
          accent="#00d48a"
          hint="todas conciliações concluídas"
          onClick={() => onOpenCompanies({ initialFilter: 'concluidas' })}
        />
        <Kpi
          label="Em andamento"
          value={dashMetrics.emAndamento}
          accent="#60a5fa"
          hint="conciliações iniciadas"
          onClick={() => onOpenCompanies({ initialFilter: 'em_andamento' })}
        />
        <Kpi
          label="Aguardando cliente"
          value={dashMetrics.aguardandoCliente}
          accent="#ff8a3d"
          hint="1+ arquivo cobrado"
          onClick={() => onOpenCompanies({ initialFilter: 'aguardando_cliente' })}
        />
        <Kpi
          label="Atrasadas"
          value={dashMetrics.atrasadas}
          accent={dashMetrics.atrasadas > 0 ? '#ff6b6b' : '#00d48a'}
          hint="conforme parametrização"
          onClick={() => onOpenCompanies({ initialFilter: 'atrasadas' })}
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
                Situação dos Arquivos
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
          <Card style={{ flex: 1 }}>
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
                Situação das Empresas
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
          <div className="acc-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, flex: 1, alignContent: 'start' }}>
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

const STATUS_FILTER_LABELS = {
  concluidas:        { label: '✓ Apenas concluídas (100%)',  color: '#00d48a', bg: 'rgba(0,212,138,0.12)',   bd: 'rgba(0,212,138,0.28)'   },
  em_andamento:      { label: '⟳ Em andamento',              color: '#60a5fa', bg: 'rgba(37,99,235,0.12)',   bd: 'rgba(37,99,235,0.28)'   },
  aguardando_cliente:{ label: '⏳ Aguardando cliente',        color: '#ff8a3d', bg: 'rgba(255,138,61,0.12)',  bd: 'rgba(255,138,61,0.28)'  },
  atrasadas:         { label: '⚠ Atrasadas',                 color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)', bd: 'rgba(255,107,107,0.28)' },
};

function CompaniesModal({ tenantCompanyId, competencia, companies, fileRecords, reconciliations,
  search, setSearch, filterResp, setFilterResp, filterRegime, setFilterRegime,
  initialSort, initialFilter, onClose, onChange, params,
}) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const [sortBy, setSortBy] = useState(initialSort || 'name');
  const [statusFilter, setStatusFilter] = useState(initialFilter || '');
  const [importOpen, setImportOpen] = useState(false);

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const filtered = useMemo(() => {
    const list = companies
      .map((c) => ({ ...c, progress: companyProgress(c.id, fileRecords, reconciliations) }))
      .filter((c) => {
        if (filterResp && c.responsavel !== filterResp) return false;
        if (filterRegime && c.regime !== filterRegime) return false;
        if (statusFilter === 'concluidas' && !isReconCompleted(c.id, reconciliations)) return false;
        if (statusFilter === 'em_andamento' && !isReconInProgress(c.id, reconciliations)) return false;
        if (statusFilter === 'aguardando_cliente' && !hasFileCobrado(c.id, fileRecords)) return false;
        if (statusFilter === 'atrasadas' && !isDelayedByParams(c.id, fileRecords, reconciliations, params)) return false;
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
  }, [companies, fileRecords, reconciliations, filterResp, filterRegime, search, sortBy, statusFilter, params]);

  const clearFilters = () => { setSearch(''); setFilterResp(''); setFilterRegime(''); setStatusFilter(''); setSortBy('name'); };
  const hasFilters = !!(search || filterResp || filterRegime || statusFilter || sortBy !== 'name');

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditing('new'); };
  const openEdit = (c) => {
    setForm({
      codigo: c.codigo || '', nome: c.nome || '', responsavel: c.responsavel || '',
      regime: c.regime || 'Simples Nacional',
      observacoes: c.observacoes || '',
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 20px', zIndex: 110 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, margin: 'auto', background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.08)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>🏢 Empresas cadastradas</h2>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                {filtered.length} de {companies.length}
              </span>
              {statusFilter && STATUS_FILTER_LABELS[statusFilter] && (
                <span onClick={() => setStatusFilter('')} className="acc-pill"
                  style={{ cursor: 'pointer', background: STATUS_FILTER_LABELS[statusFilter].bg, color: STATUS_FILTER_LABELS[statusFilter].color, borderColor: STATUS_FILTER_LABELS[statusFilter].bd }}>
                  {STATUS_FILTER_LABELS[statusFilter].label} ×
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
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                title="Importar empresas"
                aria-label="Importar empresas"
                className="acc-btn"
                style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>

          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 170px 170px auto', gap: 10, alignItems: 'center' }}>
              <input className="acc-input" placeholder="Buscar por nome, código ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="acc-select" value={filterResp} onChange={(e) => setFilterResp(e.target.value)}>
                <option value="">Todos responsáveis</option>
                {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="acc-select" value={filterRegime} onChange={(e) => setFilterRegime(e.target.value)}>
                <option value="">Todas tributações</option>
                <option value="Lucro Real">Lucro Real</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="MEI">MEI</option>
                <option value="Associação">Associação</option>
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
                  <th style={{ minWidth: 160 }}>Progresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
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
                      {statusFilter === 'atrasadas' && (() => {
                        const reasons = getDelayReasons(c.id, fileRecords, reconciliations, params);
                        return reasons.length > 0 ? (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {reasons.map((r) => (
                              <span key={r} style={{ fontSize: '0.68rem', color: '#ff8a8a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: '0.6rem' }}>⚠</span>{r}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.8)' }}>{c.responsavel || <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}</td>
                    <td><span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{c.regime}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar pct={c.progress} color={c.progress === 100 ? '#00d48a' : isDelayedByParams(c.id, fileRecords, reconciliations, params) ? '#ff6b6b' : '#7C3AED'} height={6} />
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

      {importOpen && (
        <ImportCompaniesModal
          tenantCompanyId={tenantCompanyId}
          competencia={competencia}
          companies={companies}
          onClose={() => setImportOpen(false)}
          onChange={onChange}
        />
      )}
    </>
  );
}

// =============================================================================
// ImportCompaniesModal — importação em massa via .csv / .xlsx
// =============================================================================

function normalizeKey(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchRegime(value) {
  const v = normalizeKey(value);
  if (!v) return '';
  if (v.includes('simples')) return 'Simples Nacional';
  if (v.includes('presumido')) return 'Lucro Presumido';
  if (v.includes('real')) return 'Lucro Real';
  if (v === 'mei' || v.startsWith('mei ')) return 'MEI';
  // tenta match exato pelo label original
  const exact = REGIMES.find((r) => normalizeKey(r) === v);
  return exact || value.trim();
}

function ImportCompaniesModal({ tenantCompanyId, competencia, companies, onClose, onChange }) {
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null);
  const fileRef = useRef(null);

  const codeMap = useMemo(() => {
    const m = new Map();
    companies.forEach((c) => {
      if (c.codigo) m.set(String(c.codigo).trim().toLowerCase(), c);
    });
    return m;
  }, [companies]);

  const handleFile = async (file) => {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Nenhuma planilha encontrada no arquivo.');
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (json.length === 0) throw new Error('A planilha está vazia.');

      const seenCodes = new Set();
      const parsed = json.map((r) => {
        const norm = {};
        Object.keys(r).forEach((k) => { norm[normalizeKey(k)] = String(r[k] ?? '').trim(); });
        const codigo = norm['cod'] || norm['codigo'] || '';
        const nome = norm['empresa'] || norm['nome'] || '';
        const tributacao = norm['tributacao'] || norm['regime'] || '';
        const responsavel = norm['responsavel'] || '';
        const regime = matchRegime(tributacao);

        let error = null;
        if (!codigo) error = 'Código vazio';
        else if (!nome) error = 'Empresa vazia';
        else if (!tributacao) error = 'Tributação vazia';
        else if (!responsavel) error = 'Responsável vazio';
        else if (seenCodes.has(codigo.toLowerCase())) error = 'Código duplicado no arquivo';
        if (codigo) seenCodes.add(codigo.toLowerCase());

        const existing = !error ? codeMap.get(codigo.toLowerCase()) : null;
        return {
          codigo, nome, regime, responsavel,
          action: error ? 'error' : (existing ? 'update' : 'create'),
          error,
          existingId: existing?.id ?? null,
        };
      });
      setRows(parsed);
      setStep('preview');
    } catch (e) {
      setParseError('Falha ao ler arquivo: ' + (e.message || e));
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const doImport = async () => {
    setStep('importing');
    setProgress(0);
    let created = 0, updated = 0;
    const errors = [];
    const validRows = rows.filter((r) => r.action !== 'error');
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        const payload = {
          tenant_company_id: tenantCompanyId,
          competencia,
          codigo: r.codigo,
          nome: r.nome,
          regime: r.regime,
          responsavel: r.responsavel,
          tasks: emptyTasks(),
        };
        if (r.action === 'update') payload.id = r.existingId;
        await upsertCompany(payload);
        if (r.action === 'create') created++; else updated++;
      } catch (e) {
        errors.push({ codigo: r.codigo, nome: r.nome, error: e.message });
      }
      setProgress(i + 1);
    }
    setSummary({ created, updated, errors, skipped: rows.filter((r) => r.action === 'error').length });
    setStep('done');
    onChange();
  };

  const counts = useMemo(() => {
    const c = { create: 0, update: 0, error: 0 };
    rows.forEach((r) => { c[r.action]++; });
    return c;
  }, [rows]);

  const validToImport = counts.create + counts.update;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 20px', zIndex: 130 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, margin: 'auto', background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>Importar empresas</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 22 }}>
          {step === 'upload' && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = 'rgba(124,58,237,0.06)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onDrop={(e) => { onDrop(e); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: '0.96rem', fontWeight: 700, marginBottom: 6 }}>Arraste o arquivo aqui ou clique para selecionar</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>Formatos aceitos: <strong>.xlsx</strong> ou <strong>.csv</strong></div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ marginTop: 22, padding: 16, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 10 }}>
                <div className="acc-section-eyebrow" style={{ marginBottom: 8, color: '#a78bfa' }}>Layout esperado</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', fontSize: '0.78rem' }}>
                  {['Cód', 'Empresa', 'Tributação', 'Responsável'].map((h) => (
                    <div key={h} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{h}</div>
                  ))}
                  {['001', 'Empresa Exemplo Ltda', 'Simples Nacional', 'João Silva'].map((c, i) => (
                    <div key={i} style={{ background: '#0a0a0e', padding: '8px 10px', color: 'rgba(255,255,255,0.55)' }}>{c}</div>
                  ))}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', marginTop: 10, lineHeight: 1.5 }}>
                  Todos os campos são obrigatórios. Se o <strong style={{ color: '#a78bfa' }}>código</strong> já existir, o cadastro será atualizado. Caso contrário, uma nova empresa é criada.
                </div>
              </div>

              {parseError && (
                <div style={{ marginTop: 14, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff9ab4', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem' }}>
                  {parseError}
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                  <strong style={{ color: '#eeede9' }}>{fileName}</strong> · {rows.length} linha{rows.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {counts.create > 0 && <span className="acc-pill" style={{ background: 'rgba(0,212,138,0.12)', color: '#00d48a', borderColor: 'rgba(0,212,138,0.28)' }}>+ {counts.create} novas</span>}
                  {counts.update > 0 && <span className="acc-pill" style={{ background: 'rgba(124,58,237,0.14)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.30)' }}>↻ {counts.update} atualizar</span>}
                  {counts.error > 0 && <span className="acc-pill" style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.30)' }}>⚠ {counts.error} com erro</span>}
                </div>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'auto', maxHeight: 380 }}>
                <table className="acc-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Cód</th><th>Empresa</th><th>Tributação</th><th>Responsável</th><th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ background: r.action === 'error' ? 'rgba(255,107,107,0.04)' : undefined }}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>{r.codigo || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</td>
                        <td>{r.nome || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</td>
                        <td>{r.regime || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</td>
                        <td>{r.responsavel || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</td>
                        <td>
                          {r.action === 'create' && <span className="acc-pill" style={{ background: 'rgba(0,212,138,0.12)', color: '#00d48a', borderColor: 'rgba(0,212,138,0.28)' }}>Novo</span>}
                          {r.action === 'update' && <span className="acc-pill" style={{ background: 'rgba(124,58,237,0.14)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.30)' }}>Atualizar</span>}
                          {r.action === 'error' && <span className="acc-pill" title={r.error} style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.30)' }}>{r.error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spinner />
              <div style={{ marginTop: 16, fontSize: '0.88rem', fontWeight: 700 }}>Importando…</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{progress} de {validToImport}</div>
            </div>
          )}

          {step === 'done' && summary && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
                <Kpi label="Criadas" value={summary.created} accent="#00d48a" />
                <Kpi label="Atualizadas" value={summary.updated} accent="#7C3AED" />
                <Kpi label="Com erro" value={summary.errors.length + summary.skipped} accent={(summary.errors.length + summary.skipped) > 0 ? '#ff6b6b' : '#00d48a'} />
              </div>
              {summary.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="acc-section-eyebrow" style={{ marginBottom: 8 }}>Falhas durante a importação</div>
                  <div style={{ border: '1px solid rgba(255,107,107,0.18)', borderRadius: 10, overflow: 'auto', maxHeight: 240 }}>
                    <table className="acc-table" style={{ width: '100%' }}>
                      <thead><tr><th>Cód</th><th>Empresa</th><th>Erro</th></tr></thead>
                      <tbody>
                        {summary.errors.map((e, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>{e.codigo}</td>
                            <td>{e.nome}</td>
                            <td style={{ color: '#ff9ab4' }}>{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          {step === 'upload' && (
            <button type="button" className="acc-btn" onClick={onClose}>Cancelar</button>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="acc-btn" onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}>Voltar</button>
              <button type="button" className="acc-btn primary" disabled={validToImport === 0} onClick={doImport} style={{ opacity: validToImport === 0 ? 0.5 : 1, cursor: validToImport === 0 ? 'not-allowed' : 'pointer' }}>
                Importar {validToImport} empresa{validToImport !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" className="acc-btn primary" onClick={onClose}>Concluir</button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PendenciasModal — detalhe de pendências agrupado por empresa
// =============================================================================

function PendenciasModal({ competencia, companies, fileRecords, reconciliations, search, filterResp, filterRegime, onClose }) {
  const filteredCompanies = useMemo(() => companies.filter((c) => {
    if (filterResp && c.responsavel !== filterResp) return false;
    if (filterRegime && c.regime !== filterRegime) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.nome?.toLowerCase().includes(q) &&
        !c.responsavel?.toLowerCase().includes(q) &&
        !c.codigo?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }), [companies, filterResp, filterRegime, search]);

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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 20px', zIndex: 115 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, margin: 'auto', background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,138,61,0.1)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.02rem', fontWeight: 700 }}>⚠ Pendências abertas</h2>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
              {groups.length} empresa{groups.length !== 1 ? 's' : ''} · competência {competencia}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flexShrink: 0 }}>
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

function FilesTab({ competencia, companies, fileRecords, setFileRecords }) {
  const [editing, setEditing] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [fSearch, setFSearch] = useState('');
  const [fResp, setFResp] = useState('');
  const [fRegime, setFRegime] = useState('');
  const [fDoc, setFDoc] = useState('');
  const [fStatus, setFStatus] = useState('');

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const recordsMap = useMemo(() => {
    const m = {};
    fileRecords.forEach((r) => { m[`${r.accounting_company_id}::${r.doc_type}`] = r; });
    return m;
  }, [fileRecords]);

  const visibleTasks = useMemo(
    () => fDoc ? TASKS.filter((t) => t.id === fDoc) : TASKS,
    [fDoc]
  );

  const filteredCompanies = useMemo(() => companies.filter((c) => {
    if (fResp && c.responsavel !== fResp) return false;
    if (fRegime && c.regime !== fRegime) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q) && !c.codigo?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [companies, fResp, fRegime, fSearch]);

  const filteredRows = useMemo(() => {
    if (!fStatus) return filteredCompanies;
    return filteredCompanies.filter((c) =>
      visibleTasks.some((t) => getFileStatus(recordsMap[`${c.id}::${t.id}`]) === fStatus)
    );
  }, [filteredCompanies, fStatus, visibleTasks, recordsMap]);

  const kpiData = useMemo(() => {
    const total = filteredRows.length * visibleTasks.length;
    const received = filteredRows.reduce((s, c) =>
      s + visibleTasks.filter((t) => getFileStatus(recordsMap[`${c.id}::${t.id}`]) === 'recebido').length, 0);
    const cobrado = filteredRows.reduce((s, c) =>
      s + visibleTasks.filter((t) => getFileStatus(recordsMap[`${c.id}::${t.id}`]) === 'cobrado').length, 0);
    return { total, received, cobrado, pending: Math.max(0, total - received - cobrado), pct: total ? Math.round((received / total) * 100) : 0 };
  }, [filteredRows, visibleTasks, recordsMap]);

  const hasFilters = !!(fSearch || fResp || fRegime || fDoc || fStatus);
  const clearFilters = () => { setFSearch(''); setFResp(''); setFRegime(''); setFDoc(''); setFStatus(''); };

  // Aplica um registro (insert/replace) na lista local — optimistic update.
  const applyLocal = (rec) => setFileRecords((prev) => {
    const idx = prev.findIndex((r) =>
      r.accounting_company_id === rec.accounting_company_id &&
      r.doc_type === rec.doc_type &&
      r.competencia === rec.competencia
    );
    if (idx >= 0) { const next = prev.slice(); next[idx] = rec; return next; }
    return [...prev, rec];
  });

  const cycle = async (companyId, docType) => {
    const current = recordsMap[`${companyId}::${docType}`];
    const cur = getFileStatus(current);
    const next = FILE_STATUS_CYCLE[(FILE_STATUS_CYCLE.indexOf(cur) + 1) % FILE_STATUS_CYCLE.length];
    const snapshot = fileRecords;
    const optimistic = {
      ...(current || { accounting_company_id: companyId, doc_type: docType, competencia, notes: null }),
      file_status: next,
      received: next === 'recebido',
      received_at: next === 'recebido' ? new Date().toISOString() : null,
    };
    applyLocal(optimistic);
    try {
      const saved = await upsertFileRecord({
        accountingCompanyId: companyId,
        docType,
        competencia,
        fileStatus: next,
        notes: current?.notes ?? null,
      });
      applyLocal(saved);
    } catch (e) {
      setFileRecords(snapshot);
      alert(e.message);
    }
  };

  const openNotes = (companyId, docType) => {
    const r = recordsMap[`${companyId}::${docType}`];
    setEditing({ companyId, docType });
    setEditNotes(r?.notes || '');
  };
  const saveNotes = async () => {
    const current = recordsMap[`${editing.companyId}::${editing.docType}`];
    const snapshot = fileRecords;
    const optimistic = {
      ...(current || { accounting_company_id: editing.companyId, doc_type: editing.docType, competencia, file_status: 'pendente', received: false, received_at: null }),
      notes: editNotes,
    };
    applyLocal(optimistic);
    setEditing(null);
    setSaving(true);
    try {
      const saved = await upsertFileRecord({
        accountingCompanyId: editing.companyId,
        docType: editing.docType,
        competencia,
        fileStatus: getFileStatus(current),
        notes: editNotes,
      });
      applyLocal(saved);
    } catch (e) {
      setFileRecords(snapshot);
      alert(e.message);
    } finally { setSaving(false); }
  };

  if (companies.length === 0) return <Empty>Cadastre empresas no Dashboard antes de marcar arquivos.</Empty>;

  return (
    <>
      {/* Barra de filtros */}
      <Card style={{ padding: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input className="acc-input" placeholder="Buscar por empresa, código ou responsável" value={fSearch} onChange={(e) => setFSearch(e.target.value)} style={{ flex: '2 1 220px', minWidth: 0 }} />
          <select className="acc-select" value={fResp} onChange={(e) => setFResp(e.target.value)} style={{ flex: '1 1 175px', minWidth: 175 }}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="acc-select" value={fRegime} onChange={(e) => setFRegime(e.target.value)} style={{ flex: '1 1 175px', minWidth: 175 }}>
            <option value="">Todas tributações</option>
            <option value="Lucro Real">Lucro Real</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="MEI">MEI</option>
            <option value="Associação">Associação</option>
          </select>
          <select className="acc-select" value={fDoc} onChange={(e) => setFDoc(e.target.value)} style={{ flex: '1 1 185px', minWidth: 185 }}>
            <option value="">Todos documentos</option>
            {TASKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className="acc-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ flex: '1 1 145px', minWidth: 145 }}>
            <option value="">Todos status</option>
            <option value="recebido">Recebido</option>
            <option value="cobrado">Cobrado</option>
            <option value="pendente">Pendente</option>
          </select>
          {hasFilters
            ? <button type="button" className="acc-btn" onClick={clearFilters} style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Limpar filtros</button>
            : <span className="acc-count-badge">{filteredRows.length} empresa{filteredRows.length !== 1 ? 's' : ''}</span>
          }
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Kpi label="Esperados" value={kpiData.total} hint={`${visibleTasks.length} por empresa`} />
        <Kpi label="Recebidos" value={kpiData.received} accent="#00d48a" />
        <Kpi label="Cobrados" value={kpiData.cobrado} accent="#fbbf24" />
        <Kpi label="Pendentes" value={kpiData.pending} accent={kpiData.pending > 0 ? '#ff8a3d' : '#00d48a'} />
        <Kpi label="% recebido" value={`${kpiData.pct}%`} accent="#7C3AED" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="acc-table" style={{ minWidth: visibleTasks.length < 4 ? 600 : 1000 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: 220 }}>Empresa</th>
                {visibleTasks.map((t) => <th key={t.id} title={t.label}>{t.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0
                ? <tr><td colSpan={visibleTasks.length + 1} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '32px 0', fontSize: '0.85rem' }}>Nenhuma empresa encontrada com os filtros atuais.</td></tr>
                : filteredRows.map((c) => (
                <tr key={c.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1 }}>
                    {c.codigo && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>#{c.codigo}</div>}
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                  </td>
                  {visibleTasks.map((t) => {
                    const r = recordsMap[`${c.id}::${t.id}`];
                    const status = getFileStatus(r);
                    const s = FILE_STATUS[status];
                    const hasNotes = !!r?.notes;
                    const dimmed = fStatus && status !== fStatus;
                    return (
                      <td key={t.id} style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.15s' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
                          <button
                            type="button"
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
                            type="button"
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

function ReconciliationTab({ competencia, companies, reconciliations, setReconciliations }) {
  const [editing, setEditing] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [rSearch, setRSearch] = useState('');
  const [rResp, setRResp] = useState('');
  const [rRegime, setRRegime] = useState('');
  const [rCat, setRCat] = useState('');
  const [rStatus, setRStatus] = useState('');

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const reconsMap = useMemo(() => {
    const m = {};
    reconciliations.forEach((r) => { m[`${r.accounting_company_id}::${r.category}`] = r; });
    return m;
  }, [reconciliations]);

  const visibleCategories = useMemo(
    () => rCat ? RECON_CATEGORIES.filter((c) => c.id === rCat) : RECON_CATEGORIES,
    [rCat]
  );

  const filteredCompanies = useMemo(() => companies.filter((c) => {
    if (rResp && c.responsavel !== rResp) return false;
    if (rRegime && c.regime !== rRegime) return false;
    if (rSearch) {
      const q = rSearch.toLowerCase();
      if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q) && !c.codigo?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [companies, rResp, rRegime, rSearch]);

  const filteredRows = useMemo(() => {
    if (!rStatus) return filteredCompanies;
    return filteredCompanies.filter((c) =>
      visibleCategories.some((cat) => (reconsMap[`${c.id}::${cat.id}`]?.status || 'nao_iniciado') === rStatus)
    );
  }, [filteredCompanies, rStatus, visibleCategories, reconsMap]);

  const categoryStats = useMemo(() => visibleCategories.map((cat) => {
    const total = filteredRows.length || 1;
    const done = filteredRows.filter((c) => reconsMap[`${c.id}::${cat.id}`]?.status === 'conciliado').length;
    return { ...cat, pct: Math.round((done / total) * 100) };
  }), [filteredRows, visibleCategories, reconsMap]);

  const hasFilters = !!(rSearch || rResp || rRegime || rCat || rStatus);
  const clearFilters = () => { setRSearch(''); setRResp(''); setRRegime(''); setRCat(''); setRStatus(''); };

  const applyLocal = (rec) => setReconciliations((prev) => {
    const idx = prev.findIndex((r) =>
      r.accounting_company_id === rec.accounting_company_id &&
      r.category === rec.category &&
      r.competencia === rec.competencia
    );
    if (idx >= 0) { const next = prev.slice(); next[idx] = rec; return next; }
    return [...prev, rec];
  });

  const setStatus = async (companyId, category, status) => {
    const current = reconsMap[`${companyId}::${category}`];
    const snapshot = reconciliations;
    const optimistic = {
      ...(current || { accounting_company_id: companyId, category, competencia, observacoes: null }),
      status,
    };
    applyLocal(optimistic);
    try {
      const saved = await upsertReconciliation({
        accountingCompanyId: companyId,
        category,
        competencia,
        status,
        observacoes: current?.observacoes ?? null,
      });
      applyLocal(saved);
    } catch (e) {
      setReconciliations(snapshot);
      alert(e.message);
    }
  };

  const openNotes = (companyId, category) => {
    const r = reconsMap[`${companyId}::${category}`];
    setEditing({ companyId, category });
    setEditNotes(r?.observacoes || '');
  };
  const saveNotes = async () => {
    const current = reconsMap[`${editing.companyId}::${editing.category}`];
    const snapshot = reconciliations;
    const optimistic = {
      ...(current || { accounting_company_id: editing.companyId, category: editing.category, competencia, status: 'nao_iniciado' }),
      observacoes: editNotes,
    };
    applyLocal(optimistic);
    setEditing(null);
    setSaving(true);
    try {
      const saved = await upsertReconciliation({
        accountingCompanyId: editing.companyId,
        category: editing.category,
        competencia,
        status: current?.status || 'nao_iniciado',
        observacoes: editNotes,
      });
      applyLocal(saved);
    } catch (e) {
      setReconciliations(snapshot);
      alert(e.message);
    } finally { setSaving(false); }
  };

  if (companies.length === 0) return <Empty>Cadastre empresas no Dashboard antes de iniciar a conciliação.</Empty>;

  return (
    <>
      {/* Barra de filtros */}
      <Card style={{ padding: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input className="acc-input" placeholder="Buscar por empresa, código ou responsável" value={rSearch} onChange={(e) => setRSearch(e.target.value)} style={{ flex: '2 1 220px', minWidth: 0 }} />
          <select className="acc-select" value={rResp} onChange={(e) => setRResp(e.target.value)} style={{ flex: '1 1 175px', minWidth: 175 }}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="acc-select" value={rRegime} onChange={(e) => setRRegime(e.target.value)} style={{ flex: '1 1 175px', minWidth: 175 }}>
            <option value="">Todas tributações</option>
            <option value="Lucro Real">Lucro Real</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="MEI">MEI</option>
            <option value="Associação">Associação</option>
          </select>
          <select className="acc-select" value={rCat} onChange={(e) => setRCat(e.target.value)} style={{ flex: '1 1 180px', minWidth: 180 }}>
            <option value="">Todas categorias</option>
            {RECON_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="acc-select" value={rStatus} onChange={(e) => setRStatus(e.target.value)} style={{ flex: '1 1 155px', minWidth: 155 }}>
            <option value="">Todos status</option>
            {RECON_STATUS_ORDER.map((s) => <option key={s} value={s}>{RECON_STATUS[s].label}</option>)}
          </select>
          {hasFilters
            ? <button type="button" className="acc-btn" onClick={clearFilters} style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Limpar filtros</button>
            : <span className="acc-count-badge">{filteredRows.length} empresa{filteredRows.length !== 1 ? 's' : ''}</span>
          }
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
        {categoryStats.map((c) => (
          <Kpi key={c.id} label={c.label} value={`${c.pct}%`} accent={c.pct === 100 ? '#00d48a' : '#7C3AED'} hint="conciliado" />
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="acc-table" style={{ minWidth: visibleCategories.length < 3 ? 600 : 900 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: 220 }}>Empresa</th>
                {visibleCategories.map((c) => <th key={c.id}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0
                ? <tr><td colSpan={visibleCategories.length + 1} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '32px 0', fontSize: '0.85rem' }}>Nenhuma empresa encontrada com os filtros atuais.</td></tr>
                : filteredRows.map((c) => (
                <tr key={c.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1 }}>
                    {c.codigo && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>#{c.codigo}</div>}
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                  </td>
                  {visibleCategories.map((cat) => {
                    const r = reconsMap[`${c.id}::${cat.id}`];
                    const status = r?.status || 'nao_iniciado';
                    const hasNotes = !!r?.observacoes;
                    const dimmed = rStatus && status !== rStatus;
                    return (
                      <td key={cat.id} style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.15s' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <ReconStatusSelect value={status} onChange={(v) => setStatus(c.id, cat.id, v)} />
                          <button
                            type="button"
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

// =============================================================================
// ParametrizacaoModal — categorias + abas para configurar parâmetros
// =============================================================================

const PRAZOS_TABS = [
  {
    id: 'arquivos',
    label: 'Arquivos',
    description: 'Limites para cobrança e recebimento de documentos do cliente.',
    fields: [
      { key: 'dia_cobranca',    label: 'Arquivos ainda não foram cobrados até o dia' },
      { key: 'dia_recebimento', label: 'Arquivos cobrados ainda não foram recebidos até o dia' },
    ],
  },
  {
    id: 'conciliacao',
    label: 'Conciliação',
    description: 'Limites para conclusão das categorias da aba Conciliação.',
    fields: [
      { key: 'dia_extrato_aplicacoes', label: 'Extrato & Aplicações não conciliado até o dia' },
      { key: 'dia_apuracao',           label: 'Apuração não codificada e conciliada até o dia' },
      { key: 'dia_folha',              label: 'Folha não importada e conciliada até o dia' },
      { key: 'dia_demais_contas',      label: 'Demais contas não conciliadas até o dia' },
      { key: 'dia_fornecedores',       label: 'Fornecedores não conciliados até o dia' },
    ],
  },
  {
    id: 'impostos',
    label: 'Impostos',
    description: 'Reservado para regras futuras de impostos. (Em breve)',
    fields: [],
  },
];

const ALL_PRAZO_KEYS = PRAZOS_TABS.flatMap((t) => t.fields.map((f) => f.key));

const PARAM_CATEGORIES = [
  { id: 'prazos', label: 'Prazos', icon: '⏱', description: 'Dias-limite para classificar empresas como atrasadas.' },
];

function ParametrizacaoModal({ tenantCompanyId, params, canWrite, onClose, onSaved }) {
  const defaultValues = { dia_cobranca: 0, dia_recebimento: 0, dia_extrato_aplicacoes: 0, dia_apuracao: 0, dia_folha: 0, dia_demais_contas: 0, dia_fornecedores: 0 };
  const [form, setForm] = useState({ ...defaultValues, ...(params || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('prazos');
  const [activeTab, setActiveTab] = useState('arquivos');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) { setError('Apenas o dono ou administrador da empresa pode salvar.'); return; }
    for (const k of ALL_PRAZO_KEYS) {
      const v = Number(form[k]);
      if (v < 0 || v > 31) { setError(`Dia inválido. Use 0 (desabilitado) a 31.`); return; }
    }
    setSaving(true);
    setError('');
    try {
      const saved = await upsertAccountingParams(tenantCompanyId, {
        dia_cobranca: Number(form.dia_cobranca),
        dia_recebimento: Number(form.dia_recebimento),
        dia_extrato_aplicacoes: Number(form.dia_extrato_aplicacoes),
        dia_apuracao: Number(form.dia_apuracao),
        dia_folha: Number(form.dia_folha),
        dia_demais_contas: Number(form.dia_demais_contas),
        dia_fornecedores: Number(form.dia_fornecedores),
      });
      onSaved(saved);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const currentTab = PRAZOS_TABS.find((t) => t.id === activeTab) || PRAZOS_TABS[0];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.82)', backdropFilter: 'blur(14px) saturate(0.85)', WebkitBackdropFilter: 'blur(14px) saturate(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 20px', zIndex: 120 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="acc-params-modal"
        style={{ width: '100%', maxWidth: 880, background: '#101015', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>⚙ Parametrização</h2>
            <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Configure as regras do módulo Acompanhamento Contábil.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>

        {/* Body: sidebar + content */}
        <div className="acc-params-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <aside className="acc-params-sidebar" style={{ width: 200, borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
              Categorias
            </div>
            {PARAM_CATEGORIES.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className="acc-params-cat"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: 'none',
                    background: active ? 'rgba(124,58,237,0.14)' : 'transparent',
                    color: active ? '#c4b3ff' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', fontSize: '0.86rem', fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <section className="acc-params-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {activeCategory === 'prazos' && (
              <>
                {/* Tabs */}
                <div className="acc-params-tabs" style={{ display: 'flex', gap: 4, padding: '12px 22px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                  {PRAZOS_TABS.map((t) => {
                    const active = t.id === activeTab;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className="acc-params-tab"
                        style={{
                          padding: '10px 14px', border: 'none', background: 'transparent',
                          color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                          fontSize: '0.83rem', fontWeight: active ? 700 : 500,
                          cursor: 'pointer', fontFamily: 'inherit',
                          borderBottom: active ? '2px solid #7C3AED' : '2px solid transparent',
                          marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Form */}
                <form id="params-form" onSubmit={handleSave} className="acc-params-form" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, color: '#ff8a8a', fontSize: '0.82rem' }}>
                      {error}
                    </div>
                  )}
                  {!canWrite && (
                    <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, color: '#a78bfa', fontSize: '0.78rem' }}>
                      Apenas o <strong>dono</strong> ou um <strong>administrador / gestor</strong> da empresa pode editar a parametrização.
                    </div>
                  )}
                  {params?._missing && (
                    <div style={{ padding: '10px 14px', background: 'rgba(255,184,107,0.08)', border: '1px solid rgba(255,184,107,0.25)', borderRadius: 10, color: '#ffb86b', fontSize: '0.78rem' }}>
                      Tabela <code>accounting_params</code> ainda não existe. Aplique a migração <code>migration_20260509_params_and_roles.sql</code> no Supabase.
                    </div>
                  )}

                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    {currentTab.description}
                  </p>

                  {currentTab.fields.length === 0 ? (
                    <div style={{ padding: '32px 18px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                      Em breve: parâmetros de impostos (DAS, DARFs, vencimentos por regime, etc.).
                    </div>
                  ) : (
                    currentTab.fields.map((f) => (
                      <label key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.75)' }}>{f.label}</span>
                        <input
                          className="acc-input"
                          type="number"
                          min="0"
                          max="31"
                          value={form[f.key]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          disabled={!canWrite}
                          style={{ width: '100%', textAlign: 'center', fontWeight: 700, opacity: canWrite ? 1 : 0.6, cursor: canWrite ? 'text' : 'not-allowed' }}
                        />
                      </label>
                    ))
                  )}

                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                    Use <strong style={{ color: 'rgba(255,255,255,0.6)' }}>0</strong> para desabilitar uma regra. Hoje é dia <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{new Date().getDate()}</strong>.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" className="acc-btn" onClick={onClose} disabled={saving}>{canWrite ? 'Cancelar' : 'Fechar'}</button>
          {canWrite && currentTab.fields.length > 0 && (
            <button type="submit" form="params-form" className="acc-btn primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
