import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, EmptyState } from '../../components/AdminLayout';

// ─────────────────────────────────────────────────────────────
// Acompanhamento Contábil — gestão operacional do depto. contábil
// Persistência local (localStorage). Visual corporativo escuro.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'noratech.accounting.tracking.v1';

const TASKS = [
  { id: 'contas_pagar',     short: 'C. Pagar',     label: 'Contas a Pagar' },
  { id: 'contas_receber',   short: 'C. Receber',   label: 'Contas a Receber' },
  { id: 'taxas_adm',        short: 'Tx. Adm.',     label: 'Taxas Administrativas' },
  { id: 'extratos',         short: 'Extratos',     label: 'Extratos' },
  { id: 'estoques',         short: 'Estoques',     label: 'Estoques' },
  { id: 'apuracao',         short: 'Apuração',     label: 'Apuração' },
  { id: 'folha',            short: 'Folha',        label: 'Folha' },
];

const STATUS = {
  nao_iniciado:        { label: 'Não iniciado',        fg: '#9aa0a6', bg: 'rgba(255,255,255,0.06)',  bd: 'rgba(255,255,255,0.14)' },
  em_andamento:        { label: 'Em andamento',        fg: '#60a5fa', bg: 'rgba(37,99,235,0.14)',    bd: 'rgba(37,99,235,0.30)'   },
  aguardando_cliente:  { label: 'Aguardando cliente',  fg: '#ff8a3d', bg: 'rgba(255,138,61,0.14)',   bd: 'rgba(255,138,61,0.30)'  },
  aguardando_revisao:  { label: 'Aguardando revisão',  fg: '#a78bfa', bg: 'rgba(124,58,237,0.16)',   bd: 'rgba(124,58,237,0.32)'  },
  concluido:           { label: 'Concluído',           fg: '#00d48a', bg: 'rgba(0,212,138,0.14)',    bd: 'rgba(0,212,138,0.30)'   },
  atrasado:            { label: 'Atrasado',            fg: '#ff6b6b', bg: 'rgba(255,107,107,0.14)',  bd: 'rgba(255,107,107,0.30)' },
};
const STATUS_ORDER = ['nao_iniciado','em_andamento','aguardando_cliente','aguardando_revisao','concluido','atrasado'];

const PRIORITY = {
  alta:   { label: 'Alta',   fg: '#ff6b6b', bg: 'rgba(255,107,107,0.14)', bd: 'rgba(255,107,107,0.28)' },
  media:  { label: 'Média',  fg: '#ff8a3d', bg: 'rgba(255,138,61,0.14)',  bd: 'rgba(255,138,61,0.28)'  },
  baixa:  { label: 'Baixa',  fg: '#60a5fa', bg: 'rgba(37,99,235,0.14)',   bd: 'rgba(37,99,235,0.28)'   },
};

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];

function currentCompetencia() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function emptyTasks(s = 'nao_iniciado') {
  return TASKS.reduce((acc, t) => ({ ...acc, [t.id]: s }), {});
}

const SEED = [
  {
    id: 'c1', nome: 'Alfa Comércio LTDA', responsavel: 'Mariana Souza',
    regime: 'Simples Nacional', prioridade: 'alta', competencia: currentCompetencia(),
    prazo: addDaysISO(2),
    observacoes: 'Cliente envia notas todo dia 5.',
    particularidades: 'Filial em SP; substituição tributária.',
    tasks: { ...emptyTasks(), contas_pagar: 'em_andamento', contas_receber: 'concluido', extratos: 'aguardando_cliente', folha: 'em_andamento', apuracao: 'nao_iniciado', taxas_adm: 'nao_iniciado', estoques: 'nao_iniciado' },
  },
  {
    id: 'c2', nome: 'Beta Engenharia S.A.', responsavel: 'Carlos Lima',
    regime: 'Lucro Real', prioridade: 'media', competencia: currentCompetencia(),
    prazo: addDaysISO(-1),
    observacoes: 'Pendente conciliação bancária Itaú.',
    particularidades: 'Apuração lucro real trimestral.',
    tasks: { ...emptyTasks(), contas_pagar: 'concluido', contas_receber: 'concluido', extratos: 'aguardando_revisao', estoques: 'em_andamento', apuracao: 'em_andamento', taxas_adm: 'concluido', folha: 'concluido' },
  },
  {
    id: 'c3', nome: 'Gama Serviços ME', responsavel: 'Mariana Souza',
    regime: 'MEI', prioridade: 'baixa', competencia: currentCompetencia(),
    prazo: addDaysISO(7),
    observacoes: '',
    particularidades: 'DAS automático.',
    tasks: { ...emptyTasks('concluido') },
  },
  {
    id: 'c4', nome: 'Delta Industrial LTDA', responsavel: 'Renata Pires',
    regime: 'Lucro Presumido', prioridade: 'alta', competencia: currentCompetencia(),
    prazo: addDaysISO(0),
    observacoes: 'Aguardando estoque do cliente.',
    particularidades: 'Operação de exportação.',
    tasks: { ...emptyTasks(), contas_pagar: 'em_andamento', contas_receber: 'em_andamento', extratos: 'em_andamento', estoques: 'aguardando_cliente', apuracao: 'nao_iniciado', taxas_adm: 'em_andamento', folha: 'aguardando_revisao' },
  },
];

function addDaysISO(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

function progressOf(company) {
  const total = TASKS.length;
  const done = TASKS.filter((t) => company.tasks?.[t.id] === 'concluido').length;
  return Math.round((done / total) * 100);
}

function isDelayed(company) {
  if (!company.prazo) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(company.prazo + 'T00:00:00');
  const allDone = TASKS.every((t) => company.tasks?.[t.id] === 'concluido');
  return !allDone && due < today;
}

function alertsOf(company) {
  const alerts = [];
  if (isDelayed(company)) alerts.push({ kind: 'atraso', text: 'Prazo vencido com pendências' });
  const aw = TASKS.filter((t) => company.tasks?.[t.id] === 'aguardando_cliente');
  if (aw.length >= 3) alerts.push({ kind: 'cliente', text: `${aw.length} itens aguardando cliente` });
  const blockedAp = company.tasks?.apuracao === 'nao_iniciado'
    && (company.tasks?.contas_pagar === 'concluido' && company.tasks?.contas_receber === 'concluido');
  if (blockedAp) alerts.push({ kind: 'apuracao', text: 'Apuração pronta para iniciar' });
  return alerts;
}

function StatusPill({ value }) {
  const c = STATUS[value] || STATUS.nao_iniciado;
  return (
    <span className="admin-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>
      {c.label}
    </span>
  );
}

function PriorityPill({ value }) {
  const c = PRIORITY[value] || PRIORITY.media;
  return (
    <span className="admin-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>
      {c.label}
    </span>
  );
}

function StatusSelect({ value, onChange }) {
  const c = STATUS[value] || STATUS.nao_iniciado;
  return (
    <select
      value={value || 'nao_iniciado'}
      onChange={(e) => onChange(e.target.value)}
      className="admin-select"
      style={{
        padding: '5px 8px', fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.5,
        background: c.bg, color: c.fg, borderColor: c.bd, width: 'auto', minWidth: 120,
      }}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>{STATUS[s].label}</option>
      ))}
    </select>
  );
}

function Kpi({ label, value, accent = '#7C3AED', hint }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.85rem', fontWeight: 800, color: accent, marginTop: 6, letterSpacing: -0.6 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

function Donut({ segments, size = 160, thickness = 22 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const dasharray = `${len} ${c - len}`;
        const dashoffset = c - offset;
        offset += len;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={dasharray} strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size/2} ${size/2})`} strokeLinecap="butt" />
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

const EMPTY_FORM = {
  nome: '', responsavel: '', regime: 'Simples Nacional', prioridade: 'media',
  competencia: currentCompetencia(), prazo: addDaysISO(7),
  observacoes: '', particularidades: '',
  tasks: emptyTasks(),
};

export default function AdminAccountingTrackingPage() {
  const [companies, setCompanies] = useState(loadStored);
  const [filterResp, setFilterResp] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCompetencia, setFilterCompetencia] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(companies)); } catch { /* noop */ }
  }, [companies]);

  const responsaveis = useMemo(
    () => Array.from(new Set(companies.map((c) => c.responsavel).filter(Boolean))).sort(),
    [companies]
  );
  const competencias = useMemo(
    () => Array.from(new Set(companies.map((c) => c.competencia).filter(Boolean))).sort(),
    [companies]
  );

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (filterResp && c.responsavel !== filterResp) return false;
      if (filterPrio && c.prioridade !== filterPrio) return false;
      if (filterCompetencia && c.competencia !== filterCompetencia) return false;
      if (filterStatus) {
        if (filterStatus === 'atrasado') return isDelayed(c);
        const has = TASKS.some((t) => c.tasks?.[t.id] === filterStatus);
        if (!has) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!c.nome?.toLowerCase().includes(q) && !c.responsavel?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [companies, filterResp, filterPrio, filterStatus, filterCompetencia, search]);

  const metrics = useMemo(() => {
    const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    let totalTasks = 0;
    let doneTasks = 0;
    let atrasados = 0;
    filtered.forEach((c) => {
      TASKS.forEach((t) => {
        const s = c.tasks?.[t.id] || 'nao_iniciado';
        counts[s] = (counts[s] || 0) + 1;
        totalTasks += 1;
        if (s === 'concluido') doneTasks += 1;
      });
      if (isDelayed(c)) atrasados += 1;
    });
    const progresso = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
    return { counts, totalTasks, doneTasks, progresso, atrasados };
  }, [filtered]);

  const respLoad = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      if (!c.responsavel) return;
      if (!map[c.responsavel]) map[c.responsavel] = { empresas: 0, prog: 0 };
      map[c.responsavel].empresas += 1;
      map[c.responsavel].prog += progressOf(c);
    });
    return Object.entries(map).map(([resp, v]) => ({
      label: resp,
      value: Math.round(v.prog / v.empresas),
      suffix: '%',
      color: '#7C3AED',
    })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const taskBreakdown = useMemo(() => {
    return TASKS.map((t) => {
      const done = filtered.filter((c) => c.tasks?.[t.id] === 'concluido').length;
      const total = filtered.length || 1;
      return { label: t.label, value: Math.round((done / total) * 100), suffix: '%', color: '#00d48a' };
    });
  }, [filtered]);

  const totalAlerts = useMemo(() => filtered.reduce((sum, c) => sum + alertsOf(c).length, 0), [filtered]);

  const updateTask = (companyId, taskId, status) => {
    setCompanies((prev) => prev.map((c) => c.id === companyId
      ? { ...c, tasks: { ...c.tasks, [taskId]: status } }
      : c));
  };

  const updateField = (companyId, field, value) => {
    setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, [field]: value } : c));
  };

  const openCreate = () => {
    setEditing('new');
    setForm({ ...EMPTY_FORM, tasks: emptyTasks() });
  };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      nome: c.nome || '', responsavel: c.responsavel || '',
      regime: c.regime || 'Simples Nacional', prioridade: c.prioridade || 'media',
      competencia: c.competencia || currentCompetencia(), prazo: c.prazo || addDaysISO(7),
      observacoes: c.observacoes || '', particularidades: c.particularidades || '',
      tasks: { ...emptyTasks(), ...(c.tasks || {}) },
    });
  };
  const closeModal = () => setEditing(null);
  const saveModal = () => {
    if (!form.nome?.trim()) return;
    if (editing === 'new') {
      const id = `c${Date.now()}`;
      setCompanies((prev) => [...prev, { id, ...form }]);
    } else {
      setCompanies((prev) => prev.map((c) => c.id === editing ? { ...c, ...form } : c));
    }
    setEditing(null);
  };
  const removeCompany = (id) => {
    if (!confirm('Remover esta empresa do acompanhamento?')) return;
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  };

  const resetSeed = () => {
    if (!confirm('Restaurar dados de exemplo? Os dados atuais serão substituídos.')) return;
    setCompanies(SEED);
  };

  const headerActions = (
    <>
      <button className="admin-btn" onClick={resetSeed}>Restaurar exemplo</button>
      <button className="admin-btn primary" onClick={openCreate}>+ Nova empresa</button>
    </>
  );

  return (
    <AdminLayout
      title="Acompanhamento contábil"
      subtitle="Gestão operacional do fechamento mensal — status por empresa, responsável e tarefa."
      actions={headerActions}
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Kpi label="Total empresas" value={filtered.length} hint={`${TASKS.length * filtered.length} tarefas no ciclo`} />
        <Kpi label="Não iniciado" value={metrics.counts.nao_iniciado} accent="#9aa0a6" />
        <Kpi label="Em andamento" value={metrics.counts.em_andamento} accent="#60a5fa" />
        <Kpi label="Aguardando cliente" value={metrics.counts.aguardando_cliente} accent="#ff8a3d" />
        <Kpi label="Aguardando revisão" value={metrics.counts.aguardando_revisao} accent="#a78bfa" />
        <Kpi label="Concluído" value={metrics.counts.concluido} accent="#00d48a" />
        <Kpi label="Atrasado" value={metrics.atrasados} accent="#ff6b6b" hint={`${totalAlerts} alertas ativos`} />
        <Kpi label="Progresso geral" value={`${metrics.progresso}%`} accent="#7C3AED" hint={`${metrics.doneTasks}/${metrics.totalTasks} tarefas`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12 }}>
            Distribuição de status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 160, height: 160 }}>
              <Donut segments={STATUS_ORDER.map((s) => ({ value: metrics.counts[s] || 0, color: STATUS[s].fg }))} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{metrics.progresso}%</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>concluído</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STATUS_ORDER.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS[s].fg }} />
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)' }}>{STATUS[s].label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{metrics.counts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 14 }}>
            Conclusão por tarefa
          </div>
          <BarChart items={taskBreakdown} maxValue={100} />
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 14 }}>
            Carga por responsável (progresso médio)
          </div>
          {respLoad.length === 0
            ? <EmptyState>Nenhum responsável atribuído.</EmptyState>
            : <BarChart items={respLoad} maxValue={100} />
          }
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <input className="admin-input" placeholder="Buscar empresa ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="admin-select" value={filterResp} onChange={(e) => setFilterResp(e.target.value)}>
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="admin-select" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
            <option value="">Todas prioridades</option>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </select>
          <select className="admin-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos status</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            <option value="atrasado">Empresas atrasadas</option>
          </select>
          <select className="admin-select" value={filterCompetencia} onChange={(e) => setFilterCompetencia(e.target.value)}>
            <option value="">Todas competências</option>
            {competencias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#0d0d12', zIndex: 2 }}>Empresa</th>
                <th>Responsável</th>
                <th>Regime</th>
                <th>Prioridade</th>
                <th>Competência</th>
                <th>Prazo</th>
                {TASKS.map((t) => <th key={t.id} title={t.label}>{t.short}</th>)}
                <th>Progresso</th>
                <th>Alertas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7 + TASKS.length + 3}><EmptyState>Nenhuma empresa encontrada com os filtros atuais.</EmptyState></td></tr>
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
                        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', marginTop: 3, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.observacoes}>
                          {c.observacoes}
                        </div>
                      )}
                      {c.particularidades && (
                        <div style={{ fontSize: '0.7rem', color: 'rgba(124,58,237,0.85)', marginTop: 2, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.particularidades}>
                          ◆ {c.particularidades}
                        </div>
                      )}
                    </td>
                    <td>{c.responsavel || <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}</td>
                    <td><span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{c.regime}</span></td>
                    <td><PriorityPill value={c.prioridade} /></td>
                    <td>{c.competencia}</td>
                    <td>
                      <span style={{ color: delayed ? '#ff6b6b' : 'rgba(255,255,255,0.7)', fontWeight: delayed ? 700 : 500 }}>
                        {c.prazo || '—'}
                      </span>
                    </td>
                    {TASKS.map((t) => (
                      <td key={t.id}>
                        <StatusSelect value={c.tasks?.[t.id]} onChange={(v) => updateTask(c.id, t.id, v)} />
                      </td>
                    ))}
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{
                            width: `${prog}%`, height: '100%',
                            background: prog === 100 ? '#00d48a' : delayed ? '#ff6b6b' : '#7C3AED',
                            transition: 'width 0.25s',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{prog}%</span>
                      </div>
                    </td>
                    <td>
                      {alerts.length === 0
                        ? <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>
                        : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {alerts.map((a, i) => (
                              <span key={i} className="admin-pill" style={{
                                background: a.kind === 'atraso' ? STATUS.atrasado.bg : a.kind === 'cliente' ? STATUS.aguardando_cliente.bg : STATUS.em_andamento.bg,
                                color:      a.kind === 'atraso' ? STATUS.atrasado.fg : a.kind === 'cliente' ? STATUS.aguardando_cliente.fg : STATUS.em_andamento.fg,
                                borderColor:a.kind === 'atraso' ? STATUS.atrasado.bd : a.kind === 'cliente' ? STATUS.aguardando_cliente.bd : STATUS.em_andamento.bd,
                                width: 'fit-content',
                              }}>
                                ⚠ {a.text}
                              </span>
                            ))}
                          </div>
                        )
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => openEdit(c)}>Editar</button>
                        <button className="admin-btn danger" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => removeCompany(c.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={closeModal}
        title={editing === 'new' ? 'Nova empresa no acompanhamento' : 'Editar empresa'}
        width={680}
        footer={(
          <>
            <button className="admin-btn" onClick={closeModal}>Cancelar</button>
            <button className="admin-btn primary" onClick={saveModal}>Salvar</button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Empresa">
            <input className="admin-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Responsável">
            <input className="admin-input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </Field>
          <Field label="Regime tributário">
            <select className="admin-select" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })}>
              {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Prioridade">
            <select className="admin-select" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
              <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
            </select>
          </Field>
          <Field label="Competência (MM/AAAA)">
            <input className="admin-input" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="05/2026" />
          </Field>
          <Field label="Prazo">
            <input className="admin-input" type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Observações">
            <textarea className="admin-input" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Field label="Particularidades da empresa">
            <textarea className="admin-input" rows={2} value={form.particularidades} onChange={(e) => setForm({ ...form, particularidades: e.target.value })} />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>
            Status das tarefas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {TASKS.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>{t.label}</span>
                <StatusSelect
                  value={form.tasks[t.id]}
                  onChange={(v) => setForm({ ...form, tasks: { ...form.tasks, [t.id]: v } })}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </AdminLayout>
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
