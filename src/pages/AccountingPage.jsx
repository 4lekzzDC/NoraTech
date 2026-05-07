import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  TASKS, STATUS, STATUS_ORDER, PRIORITY, REGIMES,
  RECON_CATEGORIES, RECON_STATUS, RECON_STATUS_ORDER,
  currentCompetencia, emptyTasks, progressOf, isDelayed, alertsOf,
} from '../lib/accountingDomain';
import {
  getCurrentTenantCompanyId,
  listCompanies, upsertCompany, deleteCompany, updateCompanyTask,
  listFileRecords, upsertFileRecord,
  listReconciliations, upsertReconciliation,
} from '../lib/accounting';

// =============================================================================
// Página: /acompanhamento-contabil
// 3 abas (Dashboard | Arquivos | Conciliação) sobre os dados da empresa-tenant.
// =============================================================================

const TABS = [
  { id: 'dashboard',     num: '01', label: 'Dashboard' },
  { id: 'arquivos',      num: '02', label: 'Arquivos' },
  { id: 'conciliacao',   num: '03', label: 'Conciliação' },
];

export default function AccountingPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [tenantCompanyId, setTenantCompanyId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Carrega tenant e empresas do tenant filtradas pela competência selecionada.
  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const tid = await getCurrentTenantCompanyId();
      setTenantCompanyId(tid);
      if (!tid) { setCompanies([]); return; }
      const list = await listCompanies({ tenantCompanyId: tid, competencia });
      setCompanies(list);
    } catch (e) {
      setErrorMsg(e.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => { reload(); }, [reload]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        .acc-tab-btn { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .acc-tab-btn:hover { color: rgba(255,255,255,0.9); }
        .acc-input, .acc-select {
          padding: 9px 12px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: #eeede9; font-size: 0.88rem; outline: none; font-family: inherit;
          transition: border-color 0.18s, background 0.18s;
        }
        .acc-input:focus, .acc-select:focus { border-color: #7C3AED; background: rgba(255,255,255,0.05); }
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
        .acc-btn.primary:hover { background: #6d28d9; border-color: #6d28d9; }
        .acc-btn.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.25); }
        .acc-btn.danger:hover { background: rgba(255,107,107,0.08); }
        .acc-pill {
          display: inline-block; padding: 3px 10px; border-radius: 999px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          border: 1px solid transparent;
        }
        .acc-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
        .acc-table th { text-align: left; padding: 12px 14px; font-size: 0.7rem; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.45); border-bottom: 1px solid rgba(255,255,255,0.08); background: #0d0d12; }
        .acc-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
        .acc-table tr:hover td { background: rgba(255,255,255,0.02); }
        .system-card:hover { border-color: rgba(124, 58, 237,0.25) !important; background: rgba(255,255,255,0.03) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <Link to="/area-do-cliente" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Central</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#eeede9', whiteSpace: 'nowrap' }}>
              📊 Acompanhamento contábil
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Competência</span>
              <input className="acc-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="MM/AAAA" style={{ width: 110 }} />
            </label>
            <button onClick={handleLogout} className="acc-btn">Sair ↗</button>
          </div>
        </div>

        <nav style={{ maxWidth: 1320, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 32, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                className="acc-tab-btn"
                onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#7C3AED' : 'rgba(255,255,255,0.45)', fontSize: '0.9rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: active ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.25)' }}>{t.num}</span>
                {t.label}
                {active && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#7C3AED', borderRadius: 2 }} />}
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 80px' }}>
        {!tenantCompanyId && !loading && (
          <NoTenantWarning />
        )}
        {errorMsg && (
          <div style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff9ab4', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}
        {loading && <Spinner />}
        {!loading && tenantCompanyId && (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                tenantCompanyId={tenantCompanyId}
                competencia={competencia}
                companies={companies}
                onChange={reload}
              />
            )}
            {activeTab === 'arquivos' && (
              <FilesTab
                competencia={competencia}
                companies={companies}
              />
            )}
            {activeTab === 'conciliacao' && (
              <ReconciliationTab
                competencia={competencia}
                companies={companies}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

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
        Você precisa estar vinculado a uma empresa (membership ativa) para usar o módulo. Acesse seu perfil para criar ou entrar em uma empresa.
      </p>
    </div>
  );
}

// =============================================================================
// Componentes compartilhados
// =============================================================================

function Card({ children, style = {} }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent = '#7C3AED', hint }) {
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: accent, marginTop: 4, letterSpacing: -0.6 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

function StatusPill({ value }) {
  const c = STATUS[value] || STATUS.nao_iniciado;
  return <span className="acc-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{c.label}</span>;
}

function PriorityPill({ value }) {
  const c = PRIORITY[value] || PRIORITY.media;
  return <span className="acc-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{c.label}</span>;
}

function StatusSelect({ value, onChange, options = STATUS, order = STATUS_ORDER }) {
  const v = value || order[0];
  const c = options[v] || options[order[0]];
  return (
    <select
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className="acc-select"
      style={{ padding: '5px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: c.bg, color: c.fg, borderColor: c.bd, minWidth: 140 }}
    >
      {order.map((s) => <option key={s} value={s}>{options[s].label}</option>)}
    </select>
  );
}

function Donut({ segments, size = 160, thickness = 22 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Pré-calcula offsets cumulativos sem mutar estado durante o render.
  const offsets = segments.reduce((acc, seg) => {
    const prev = acc[acc.length - 1] ?? 0;
    acc.push(prev + (seg.value / total) * c);
    return acc;
  }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const dasharray = `${len} ${c - len}`;
        const startOffset = i === 0 ? 0 : offsets[i - 1];
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={dasharray} strokeDashoffset={c - startOffset}
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        );
      })}
    </svg>
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
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((it.value / max) * 100)}%`, height: '100%', background: it.color, borderRadius: 999, transition: 'width 0.3s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// TAB 1 — DASHBOARD
// =============================================================================

const EMPTY_FORM = {
  nome: '', responsavel: '', regime: 'Simples Nacional', prioridade: 'media',
  prazo: '', observacoes: '', particularidades: '', tasks: emptyTasks(),
};

function DashboardTab({ tenantCompanyId, competencia, companies, onChange }) {
  const [search, setSearch] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | id | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );

  const filtered = useMemo(() => companies.filter((c) => {
    if (filterResp && c.responsavel !== filterResp) return false;
    if (filterPrio && c.prioridade !== filterPrio) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [companies, filterResp, filterPrio, search]);

  const metrics = useMemo(() => {
    const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    let totalTasks = 0, doneTasks = 0, atrasados = 0;
    filtered.forEach((c) => {
      TASKS.forEach((t) => {
        const s = c.tasks?.[t.id] || 'nao_iniciado';
        counts[s] = (counts[s] || 0) + 1;
        totalTasks += 1;
        if (s === 'concluido') doneTasks += 1;
      });
      if (isDelayed(c)) atrasados += 1;
    });
    return {
      counts, totalTasks, doneTasks, atrasados,
      progresso: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    };
  }, [filtered]);

  const taskBreakdown = useMemo(() => TASKS.map((t) => {
    const done = filtered.filter((c) => c.tasks?.[t.id] === 'concluido').length;
    const total = filtered.length || 1;
    return { label: t.label, value: Math.round((done / total) * 100), suffix: '%', color: '#00d48a' };
  }), [filtered]);

  const respLoad = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      if (!c.responsavel) return;
      if (!map[c.responsavel]) map[c.responsavel] = { n: 0, p: 0 };
      map[c.responsavel].n += 1;
      map[c.responsavel].p += progressOf(c);
    });
    return Object.entries(map).map(([r, v]) => ({ label: r, value: Math.round(v.p / v.n), suffix: '%', color: '#7C3AED' }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const updateTask = async (id, taskId, status) => {
    try {
      await updateCompanyTask(id, taskId, status);
      onChange();
    } catch (e) {
      alert(e.message);
    }
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, tasks: emptyTasks() });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({
      nome: c.nome || '', responsavel: c.responsavel || '',
      regime: c.regime || 'Simples Nacional', prioridade: c.prioridade || 'media',
      prazo: c.prazo || '', observacoes: c.observacoes || '',
      particularidades: c.particularidades || '',
      tasks: { ...emptyTasks(), ...(c.tasks || {}) },
    });
    setEditing(c.id);
  };
  const closeModal = () => { setEditing(null); setSaving(false); };
  const save = async () => {
    if (!form.nome?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        tenant_company_id: tenantCompanyId,
        competencia,
        prazo: form.prazo || null,
      };
      if (editing !== 'new') payload.id = editing;
      await upsertCompany(payload);
      closeModal();
      onChange();
    } catch (e) {
      alert(e.message);
      setSaving(false);
    }
  };
  const remove = async (id) => {
    if (!confirm('Remover esta empresa do acompanhamento?')) return;
    try {
      await deleteCompany(id);
      onChange();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Kpi label="Total empresas" value={filtered.length} hint={`${TASKS.length * filtered.length} tarefas`} />
        <Kpi label="Não iniciado" value={metrics.counts.nao_iniciado} accent="#9aa0a6" />
        <Kpi label="Em andamento" value={metrics.counts.em_andamento} accent="#60a5fa" />
        <Kpi label="Aguard. cliente" value={metrics.counts.aguardando_cliente} accent="#ff8a3d" />
        <Kpi label="Aguard. revisão" value={metrics.counts.aguardando_revisao} accent="#a78bfa" />
        <Kpi label="Concluído" value={metrics.counts.concluido} accent="#00d48a" />
        <Kpi label="Atrasado" value={metrics.atrasados} accent="#ff6b6b" />
        <Kpi label="Progresso geral" value={`${metrics.progresso}%`} accent="#7C3AED" hint={`${metrics.doneTasks}/${metrics.totalTasks}`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12 }}>Distribuição de status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 160, height: 160 }}>
              <Donut segments={STATUS_ORDER.map((s) => ({ value: metrics.counts[s] || 0, color: STATUS[s].fg }))} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{metrics.progresso}%</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>concluído</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {STATUS_ORDER.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS[s].fg }} />
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)' }}>{STATUS[s].label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{metrics.counts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 14 }}>Conclusão por tarefa</div>
          <BarChart items={taskBreakdown} maxValue={100} />
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 14 }}>Carga por responsável</div>
          {respLoad.length === 0
            ? <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>Nenhum responsável atribuído.</div>
            : <BarChart items={respLoad} maxValue={100} />
          }
        </Card>
      </div>

      {/* Filters + actions */}
      <Card style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px auto', gap: 10, alignItems: 'center' }}>
          <input className="acc-input" placeholder="Buscar empresa ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="acc-select" value={filterResp} onChange={(e) => setFilterResp(e.target.value)}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="acc-select" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
            <option value="">Todas prioridades</option>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </select>
          <button className="acc-btn primary" onClick={openCreate}>+ Nova empresa</button>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="acc-table" style={{ minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Empresa</th>
                <th>Responsável</th>
                <th>Regime</th>
                <th>Prioridade</th>
                <th>Prazo</th>
                {TASKS.map((t) => <th key={t.id} title={t.label}>{t.short}</th>)}
                <th>Progresso</th>
                <th>Alertas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6 + TASKS.length + 3} style={{ padding: '28px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  Nenhuma empresa para esta competência. Clique em "+ Nova empresa" para começar.
                </td></tr>
              )}
              {filtered.map((c) => {
                const prog = progressOf(c);
                const delayed = isDelayed(c);
                const alerts = alertsOf(c);
                return (
                  <tr key={c.id}>
                    <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1, minWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: '#eeede9' }}>{c.nome}</div>
                      {c.observacoes && (
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 3, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.observacoes}>{c.observacoes}</div>
                      )}
                      {c.particularidades && (
                        <div style={{ fontSize: '0.7rem', color: 'rgba(124,58,237,0.85)', marginTop: 2, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.particularidades}>◆ {c.particularidades}</div>
                      )}
                    </td>
                    <td>{c.responsavel || <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}</td>
                    <td><span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{c.regime}</span></td>
                    <td><PriorityPill value={c.prioridade} /></td>
                    <td><span style={{ color: delayed ? '#ff6b6b' : 'rgba(255,255,255,0.7)', fontWeight: delayed ? 700 : 500 }}>{c.prazo || '—'}</span></td>
                    {TASKS.map((t) => (
                      <td key={t.id}><StatusSelect value={c.tasks?.[t.id]} onChange={(v) => updateTask(c.id, t.id, v)} /></td>
                    ))}
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${prog}%`, height: '100%', background: prog === 100 ? '#00d48a' : delayed ? '#ff6b6b' : '#7C3AED' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{prog}%</span>
                      </div>
                    </td>
                    <td>
                      {alerts.length === 0
                        ? <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>
                        : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {alerts.map((a, i) => {
                              const c2 = a.kind === 'atraso' ? STATUS.atrasado : a.kind === 'cliente' ? STATUS.aguardando_cliente : STATUS.em_andamento;
                              return (
                                <span key={i} className="acc-pill" style={{ background: c2.bg, color: c2.fg, borderColor: c2.bd, width: 'fit-content' }}>⚠ {a.text}</span>
                              );
                            })}
                          </div>
                        )
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="acc-btn" style={{ padding: '5px 10px', fontSize: '0.76rem' }} onClick={() => openEdit(c)}>Editar</button>
                        <button className="acc-btn danger" style={{ padding: '5px 10px', fontSize: '0.76rem' }} onClick={() => remove(c.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {editing !== null && (
        <Modal title={editing === 'new' ? 'Nova empresa' : 'Editar empresa'} onClose={closeModal} onSave={save} saving={saving}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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
            <Field label="Observações"><textarea className="acc-input" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Particularidades"><textarea className="acc-input" rows={2} value={form.particularidades} onChange={(e) => setForm({ ...form, particularidades: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>Status das tarefas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {TASKS.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>{t.label}</span>
                  <StatusSelect value={form.tasks[t.id]} onChange={(v) => setForm({ ...form, tasks: { ...form.tasks, [t.id]: v } })} />
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
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

function Modal({ title, onClose, onSave, saving, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#101015', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="acc-btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="acc-btn primary" onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2 — ARQUIVOS (registro de recebimento de documentos)
// =============================================================================

function FilesTab({ competencia, companies }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { companyId, docType }
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (companies.length === 0) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    try {
      const list = await listFileRecords({
        accountingCompanyIds: companies.map((c) => c.id),
        competencia,
      });
      setRecords(list);
    } finally {
      setLoading(false);
    }
  }, [companies, competencia]);

  useEffect(() => { reload(); }, [reload]);

  const recordKey = (companyId, docType) => `${companyId}::${docType}`;
  const recordsMap = useMemo(() => {
    const m = {};
    records.forEach((r) => { m[recordKey(r.accounting_company_id, r.doc_type)] = r; });
    return m;
  }, [records]);

  const totalCells = companies.length * TASKS.length;
  const receivedCells = records.filter((r) => r.received).length;
  const pct = totalCells ? Math.round((receivedCells / totalCells) * 100) : 0;

  const toggle = async (companyId, docType, current) => {
    try {
      await upsertFileRecord({
        accountingCompanyId: companyId,
        docType,
        competencia,
        received: !(current?.received),
        notes: current?.notes ?? null,
      });
      reload();
    } catch (e) { alert(e.message); }
  };

  const openNotes = (companyId, docType) => {
    const r = recordsMap[recordKey(companyId, docType)];
    setEditing({ companyId, docType });
    setEditNotes(r?.notes || '');
  };
  const saveNotes = async () => {
    setSaving(true);
    try {
      const current = recordsMap[recordKey(editing.companyId, editing.docType)];
      await upsertFileRecord({
        accountingCompanyId: editing.companyId,
        docType: editing.docType,
        competencia,
        received: current?.received || false,
        notes: editNotes,
      });
      setEditing(null);
      reload();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (companies.length === 0) {
    return <Empty>Cadastre empresas no Dashboard antes de marcar arquivos.</Empty>;
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi label="Empresas" value={companies.length} />
        <Kpi label="Documentos esperados" value={totalCells} hint={`${TASKS.length} por empresa`} />
        <Kpi label="Recebidos" value={receivedCells} accent="#00d48a" />
        <Kpi label="% recebido" value={`${pct}%`} accent="#7C3AED" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading
            ? <Spinner />
            : (
              <table className="acc-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Empresa</th>
                    {TASKS.map((t) => <th key={t.id} title={t.label}>{t.short}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1, fontWeight: 700 }}>
                        {c.nome}
                        {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                      </td>
                      {TASKS.map((t) => {
                        const r = recordsMap[recordKey(c.id, t.id)];
                        const received = !!r?.received;
                        const hasNotes = !!r?.notes;
                        return (
                          <td key={t.id}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button
                                onClick={() => toggle(c.id, t.id, r)}
                                className="acc-pill"
                                style={{
                                  cursor: 'pointer',
                                  background: received ? STATUS.concluido.bg : STATUS.nao_iniciado.bg,
                                  color: received ? STATUS.concluido.fg : STATUS.nao_iniciado.fg,
                                  borderColor: received ? STATUS.concluido.bd : STATUS.nao_iniciado.bd,
                                  width: 'fit-content',
                                }}
                              >
                                {received ? '✓ Recebido' : 'Pendente'}
                              </button>
                              {received && r?.received_at && (
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
            )
          }
        </div>
      </Card>

      {editing && (
        <Modal title="Observação" onClose={() => setEditing(null)} onSave={saveNotes} saving={saving}>
          <Field label={`${TASKS.find((t) => t.id === editing.docType)?.label || ''} — ${competencia}`}>
            <textarea className="acc-input" rows={5} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ex.: cliente enviou parcial, faltam notas de saída." />
          </Field>
        </Modal>
      )}
    </>
  );
}

function Empty({ children }) {
  return (
    <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)' }}>{children}</p>
    </Card>
  );
}

// =============================================================================
// TAB 3 — CONCILIAÇÃO
// =============================================================================

function ReconciliationTab({ competencia, companies }) {
  const [recons, setRecons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { companyId, category }
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (companies.length === 0) { setRecons([]); setLoading(false); return; }
    setLoading(true);
    try {
      const list = await listReconciliations({
        accountingCompanyIds: companies.map((c) => c.id),
        competencia,
      });
      setRecons(list);
    } finally {
      setLoading(false);
    }
  }, [companies, competencia]);

  useEffect(() => { reload(); }, [reload]);

  const reconKey = (companyId, category) => `${companyId}::${category}`;
  const reconsMap = useMemo(() => {
    const m = {};
    recons.forEach((r) => { m[reconKey(r.accounting_company_id, r.category)] = r; });
    return m;
  }, [recons]);

  const categoryStats = RECON_CATEGORIES.map((cat) => {
    const total = companies.length || 1;
    const done = recons.filter((r) => r.category === cat.id && r.status === 'conciliado').length;
    return { ...cat, pct: Math.round((done / total) * 100) };
  });

  const setStatus = async (companyId, category, status) => {
    try {
      const current = reconsMap[reconKey(companyId, category)];
      await upsertReconciliation({
        accountingCompanyId: companyId,
        category,
        competencia,
        status,
        observacoes: current?.observacoes ?? null,
      });
      reload();
    } catch (e) { alert(e.message); }
  };

  const openNotes = (companyId, category) => {
    const r = reconsMap[reconKey(companyId, category)];
    setEditing({ companyId, category });
    setEditNotes(r?.observacoes || '');
  };
  const saveNotes = async () => {
    setSaving(true);
    try {
      const current = reconsMap[reconKey(editing.companyId, editing.category)];
      await upsertReconciliation({
        accountingCompanyId: editing.companyId,
        category: editing.category,
        competencia,
        status: current?.status || 'nao_iniciado',
        observacoes: editNotes,
      });
      setEditing(null);
      reload();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (companies.length === 0) {
    return <Empty>Cadastre empresas no Dashboard antes de iniciar a conciliação.</Empty>;
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 14 }}>
        {categoryStats.map((c) => (
          <Kpi key={c.id} label={c.label} value={`${c.pct}%`} accent="#7C3AED" hint="conciliado" />
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading
            ? <Spinner />
            : (
              <table className="acc-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Empresa</th>
                    {RECON_CATEGORIES.map((c) => <th key={c.id}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td style={{ position: 'sticky', left: 0, background: '#0a0a0e', zIndex: 1, fontWeight: 700 }}>
                        {c.nome}
                        {c.responsavel && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{c.responsavel}</div>}
                      </td>
                      {RECON_CATEGORIES.map((cat) => {
                        const r = reconsMap[reconKey(c.id, cat.id)];
                        const status = r?.status || 'nao_iniciado';
                        const hasNotes = !!r?.observacoes;
                        return (
                          <td key={cat.id}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <StatusSelect
                                value={status}
                                onChange={(v) => setStatus(c.id, cat.id, v)}
                                options={RECON_STATUS}
                                order={RECON_STATUS_ORDER}
                              />
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
            )
          }
        </div>
      </Card>

      {editing && (
        <Modal title="Observação de conciliação" onClose={() => setEditing(null)} onSave={saveNotes} saving={saving}>
          <Field label={`${RECON_CATEGORIES.find((c) => c.id === editing.category)?.label || ''} — ${competencia}`}>
            <textarea className="acc-input" rows={5} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Pendências, divergências, ações em aberto..." />
          </Field>
        </Modal>
      )}
    </>
  );
}
