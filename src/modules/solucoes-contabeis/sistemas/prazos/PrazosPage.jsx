import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER } from '../../theme';
import SolucoesHeader from '../../components/SolucoesHeader';
import {
  OBRIGACOES,
  getTipos, saveTipos,
  getTarefas, saveTarefas,
  getConfig, saveConfig,
  getEventos, saveEventos,
  getClientes, getUsuarios, saveUsuarios,
  fmtMes, mesLabel, navMes, currentMes,
  ensureTarefas, getTaskStatus, toggleCell, autoStatus, exportTab,
} from './prazosService';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';

// ── Palette context ────────────────────────────────────────────────────────────
const PaletteCtx   = createContext(null);
const useP         = () => useContext(PaletteCtx);
const CompanyCtx   = createContext(null);
const useCompanyId = () => useContext(CompanyCtx);

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pendente:  { label: 'Pendente',   bg: 'rgba(251,146,60,0.14)',  text: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  concluido: { label: 'Concluído',  bg: 'rgba(52,211,153,0.14)',  text: '#34d399', border: 'rgba(52,211,153,0.35)' },
  atrasado:  { label: 'Atrasado',   bg: 'rgba(248,113,113,0.14)', text: '#f87171', border: 'rgba(248,113,113,0.35)' },
  na:        { label: 'N/A',        bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.25)', border: 'transparent' },
};

const APP_CYCLE = { ativo: 'na', na: 'inativo', inativo: 'ativo' };
const APP_LABEL = { ativo: 'Ativo', na: 'N/A', inativo: 'Inativo' };

// ── Shared status badge ────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendente;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, accent }) {
  const p = useP();
  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`, borderRadius: 10, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120,
    }}>
      <span style={{ fontSize: 11, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent || p.text }}>{value}</span>
    </div>
  );
}

// ── Obs modal ─────────────────────────────────────────────────────────────────
function ObsModal({ empresa, mes, onClose }) {
  const p         = useP();
  const companyId = useCompanyId();
  const initObs = useMemo(() => {
    return getTarefas(companyId).find((x) => x.empresa_id === empresa.id && x.mes === mes)?.obs || '';
  }, [empresa.id, mes, companyId]);
  const [obs, setObs] = useState(initObs);

  function save() {
    const all = getTarefas(companyId);
    const idx = all.findIndex((x) => x.empresa_id === empresa.id && x.mes === mes);
    if (idx >= 0) { all[idx].obs = obs; saveTarefas(all, companyId); }
    onClose(obs);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose(null)}>
      <div style={{
        background: p.surfaceSolid, border: `1px solid ${p.border}`, borderRadius: 14, boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
        padding: 28, width: 420, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, color: p.text }}>Observações — {empresa.name}</h3>
        <textarea
          value={obs} onChange={(e) => setObs(e.target.value)}
          rows={5} style={{
            background: p.inputBg, border: `1px solid ${p.border}`, borderRadius: 8,
            color: p.text, fontSize: 14, padding: '10px 12px', resize: 'vertical', fontFamily: FONT_INTER,
          }}
          placeholder="Anotações sobre esta empresa neste mês..."
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btnStyle(p, false)}>Cancelar</button>
          <button onClick={save} style={btnStyle(p, true)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ── Add tipo modal ─────────────────────────────────────────────────────────────
function AddTipoModal({ cat, onClose }) {
  const p         = useP();
  const companyId = useCompanyId();
  const [nome, setNome] = useState('');
  const [grupo, setGrupo] = useState('');

  function save() {
    if (!nome.trim()) return;
    const tipos = getTipos(cat, companyId);
    const id = nome.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    tipos.push({ id, nome: nome.trim(), grupo: grupo.trim() });
    saveTipos(cat, tipos, companyId);
    onClose(tipos);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose(null)}>
      <div style={{
        background: p.surfaceSolid, border: `1px solid ${p.border}`, borderRadius: 14, boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
        padding: 28, width: 380, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, color: p.text }}>
          Novo tipo — {cat === 'arquivo' ? 'Arquivos' : 'Conciliação'}
        </h3>
        <input value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da coluna" style={inputStyle(p)} />
        {cat === 'conciliacao' && (
          <input value={grupo} onChange={(e) => setGrupo(e.target.value)}
            placeholder="Grupo (ex: Codificação & Importação)" style={inputStyle(p)} />
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btnStyle(p, false)}>Cancelar</button>
          <button onClick={save} style={btnStyle(p, true)}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}

// ── Add evento modal ───────────────────────────────────────────────────────────
function AddEventoModal({ mes, onClose }) {
  const p         = useP();
  const companyId = useCompanyId();
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState('');
  const [cor, setCor] = useState('#8B3DFF');

  function save() {
    if (!titulo.trim() || !dia) return;
    const eventos = getEventos(companyId);
    eventos.push({
      id: 'ev_' + Date.now(),
      mes,
      dia: Number(dia),
      titulo: titulo.trim(),
      cor,
    });
    saveEventos(eventos, companyId);
    onClose(eventos);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose(null)}>
      <div style={{
        background: p.surfaceSolid, border: `1px solid ${p.border}`, borderRadius: 14, boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
        padding: 28, width: 380, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, color: p.text }}>Novo Evento — {mesLabel(mes)}</h3>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do evento" style={inputStyle(p)} />
        <input type="number" value={dia} onChange={(e) => setDia(e.target.value)}
          placeholder="Dia do mês" min={1} max={31} style={inputStyle(p)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: p.muted }}>Cor:</label>
          <input type="color" value={cor} onChange={(e) => setCor(e.target.value)}
            style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
          <span style={{ fontSize: 12, color: p.muted2 }}>{cor}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btnStyle(p, false)}>Cancelar</button>
          <button onClick={save} style={btnStyle(p, true)}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}

// ── Task table (shared by Arquivos + Conciliação) ──────────────────────────────
function TaskTable({ cat, mes, tarefas, tipos, configs, empresas, usuarios, onToggle, onObsChange }) {
  const p = useP();
  const [obsModal, setObsModal] = useState(null);

  const groups = cat === 'conciliacao'
    ? [...new Set(tipos.map((t) => t.grupo || ''))].filter(Boolean)
    : [];

  const totalOk   = tarefas.filter((t) => getTaskStatus(t, tipos, cat, configs) === 'concluido').length;
  const totalAt   = tarefas.filter((t) => getTaskStatus(t, tipos, cat, configs) === 'atrasado').length;
  const totalPend = tarefas.length - totalOk - totalAt;

  const colGroupStyle = {
    borderBottom: `2px solid ${p.border}`,
    padding: '4px 0',
    fontSize: 11,
    color: p.muted,
    textAlign: 'center',
    letterSpacing: '0.05em',
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <MetricCard label="Total" value={tarefas.length} />
        <MetricCard label="Concluídos" value={totalOk} accent="#34d399" />
        <MetricCard label="Pendentes" value={totalPend} accent="#fb923c" />
        <MetricCard label="Atrasados" value={totalAt} accent="#f87171" />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {cat === 'conciliacao' && groups.length > 0 && (
              <tr>
                <th colSpan={4} style={{ ...colGroupStyle, textAlign: 'left' }} />
                {groups.map((g) => {
                  const count = tipos.filter((t) => (t.grupo || '') === g).length;
                  return (
                    <th key={g} colSpan={count} style={colGroupStyle}>{g}</th>
                  );
                })}
                <th colSpan={1} style={colGroupStyle} />
              </tr>
            )}
            <tr>
              {['Empresa', 'CNPJ', 'Tributação', 'Responsável'].map((h) => (
                <th key={h} style={thStyle(p)}>{h}</th>
              ))}
              {tipos.map((tp) => (
                <th key={tp.id} style={{ ...thStyle(p), minWidth: 90, textAlign: 'center' }}>{tp.nome}</th>
              ))}
              <th style={{ ...thStyle(p), minWidth: 60, textAlign: 'center' }}>Obs</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => {
              const emp  = empresas.find((e) => e.id === t.empresa_id);
              const resp = usuarios.find((u) => u.id === t.responsavel_id);
              const cfg  = configs.find((c) => c.empresa_id === t.empresa_id) || {};
              const rowSt = getTaskStatus(t, tipos, cat, configs);

              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${p.border}`, background: rowSt === 'atrasado' ? 'rgba(248,113,113,0.04)' : undefined }}>
                  <td style={tdStyle(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusPill status={rowSt} />
                      <span style={{ color: p.text, fontWeight: 500 }}>{emp?.name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle(p), color: p.muted, fontFamily: 'monospace', fontSize: 12 }}>{emp?.cnpj || '—'}</td>
                  <td style={{ ...tdStyle(p), color: p.muted2 }}>{emp?.tributacao || '—'}</td>
                  <td style={{ ...tdStyle(p), color: p.muted }}>{resp?.nome || '—'}</td>
                  {tipos.map((tp) => {
                    const app = cfg.tipos?.[cat]?.[tp.id] || 'ativo';
                    if (app === 'inativo') {
                      return <td key={tp.id} style={{ ...tdStyle(p), textAlign: 'center' }} />;
                    }
                    if (app === 'na') {
                      return (
                        <td key={tp.id} style={{ ...tdStyle(p), textAlign: 'center' }}>
                          <span style={{ fontSize: 12, color: p.muted2 }}>N/A</span>
                        </td>
                      );
                    }
                    const cell = t[cat]?.[tp.id] || { status: 'pendente' };
                    const scfg = STATUS_CFG[cell.status] || STATUS_CFG.pendente;
                    return (
                      <td key={tp.id} style={{ ...tdStyle(p), textAlign: 'center' }}>
                        <button
                          onClick={() => onToggle(t.empresa_id, cat, tp.id)}
                          style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: scfg.bg, color: scfg.text, border: `1px solid ${scfg.border}`,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >{scfg.label}</button>
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle(p), textAlign: 'center' }}>
                    <button
                      onClick={() => setObsModal({ empresa: emp, tarefa: t })}
                      title={t.obs || 'Sem observações'}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: `1px solid ${p.border}`,
                        background: t.obs ? p.primarySoft : p.surface2, cursor: 'pointer', fontSize: 14,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: t.obs ? p.primary : p.muted,
                      }}
                    >✎</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {obsModal && (
        <ObsModal
          empresa={obsModal.empresa}
          mes={mes}
          onClose={(newObs) => {
            setObsModal(null);
            if (newObs !== null) onObsChange();
          }}
        />
      )}
    </>
  );
}

// ── Arquivos panel ─────────────────────────────────────────────────────────────
function ArquivosPanel({ mes, tarefas, tipos, configs, empresas, usuarios, onRefresh }) {
  const p         = useP();
  const companyId = useCompanyId();

  function handleToggle(empresa_id, cat, tipo_id) {
    toggleCell(empresa_id, cat, tipo_id, mes, companyId);
    onRefresh();
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: p.text, fontWeight: 700 }}>Recebimento de Arquivos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: p.muted }}>
            Controle de envio de documentos pelos clientes — {mesLabel(mes)}
          </p>
        </div>
        <button
          onClick={() => exportTab('arquivo', mes, companyId)}
          style={btnStyle(p, true)}
        >Exportar XLSX</button>
      </div>

      {tarefas.length === 0 ? (
        <EmptyState message="Nenhuma empresa cadastrada. Adicione clientes em Gestão de Clientes." />
      ) : (
        <TaskTable
          cat="arquivo" mes={mes} tarefas={tarefas} tipos={tipos}
          configs={configs} empresas={empresas} usuarios={usuarios}
          onToggle={(eid, cat, tid) => handleToggle(eid, cat, tid)}
          onObsChange={onRefresh}
        />
      )}
    </div>
  );
}

// ── Conciliação panel ──────────────────────────────────────────────────────────
function ConciliacaoPanel({ mes, tarefas, tipos, configs, empresas, usuarios, onRefresh }) {
  const p         = useP();
  const companyId = useCompanyId();

  function handleToggle(empresa_id, cat, tipo_id) {
    toggleCell(empresa_id, cat, tipo_id, mes, companyId);
    onRefresh();
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: p.text, fontWeight: 700 }}>Conciliação Contábil</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: p.muted }}>
            Codificação, importação e conciliação por empresa — {mesLabel(mes)}
          </p>
        </div>
        <button onClick={() => exportTab('conciliacao', mes, companyId)} style={btnStyle(p, true)}>Exportar XLSX</button>
      </div>

      {tarefas.length === 0 ? (
        <EmptyState message="Nenhuma empresa cadastrada. Adicione clientes em Gestão de Clientes." />
      ) : (
        <TaskTable
          cat="conciliacao" mes={mes} tarefas={tarefas} tipos={tipos}
          configs={configs} empresas={empresas} usuarios={usuarios}
          onToggle={(eid, cat, tid) => handleToggle(eid, cat, tid)}
          onObsChange={onRefresh}
        />
      )}
    </div>
  );
}

// ── Calendar panel ─────────────────────────────────────────────────────────────
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CalendarioPanel({ mes, configs, empresas }) {
  const p         = useP();
  const companyId = useCompanyId();
  const [eventos, setEventos] = useState([]);
  const [addModal, setAddModal] = useState(false);

  useEffect(() => {
    if (companyId === undefined) return;
    setEventos(getEventos(companyId));
  }, [companyId]);

  const [y, m] = mes.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const regimes = new Set(empresas.map((e) => e.tributacao).filter(Boolean));
  regimes.add('todos');

  const obsByDay = {};
  OBRIGACOES.forEach((ob) => {
    if (ob.regime === 'todos' || regimes.has(ob.regime)) {
      if (!obsByDay[ob.dia]) obsByDay[ob.dia] = [];
      obsByDay[ob.dia].push(ob);
    }
  });

  const evByDay = {};
  eventos.filter((ev) => ev.mes === mes).forEach((ev) => {
    if (!evByDay[ev.dia]) evByDay[ev.dia] = [];
    evByDay[ev.dia].push(ev);
  });

  function deleteEvento(id) {
    const updated = getEventos(companyId).filter((ev) => ev.id !== id);
    saveEventos(updated, companyId);
    setEventos(updated);
  }

  const today = new Date();
  const todayDay = today.getFullYear() === y && today.getMonth() + 1 === m ? today.getDate() : null;

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: p.text, fontWeight: 700 }}>Calendário Fiscal</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: p.muted }}>
            Obrigações e eventos — {mesLabel(mes)}
          </p>
        </div>
        <button onClick={() => setAddModal(true)} style={btnStyle(p, true)}>+ Evento</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[
          { cor: '#8B3DFF', label: 'Evento personalizado' },
          { cor: '#4a9eff', label: 'FGTS/eSocial' },
          { cor: '#f0b429', label: 'DCTF' },
          { cor: '#34d399', label: 'DAS/MEI' },
          { cor: '#f87171', label: 'DARF PIS/COFINS' },
          { cor: '#e879f9', label: 'IRPJ/CSLL' },
          { cor: '#fb923c', label: 'Folha' },
          { cor: '#60a5fa', label: 'GPS' },
        ].map((l) => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: p.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: l.cor, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600, color: p.muted,
            padding: '6px 0', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} style={{
            minHeight: 80, borderRadius: 8, padding: 6,
            background: day ? (day === todayDay ? p.primarySoft : p.surface) : 'transparent',
            border: day ? `1px solid ${day === todayDay ? p.primaryBorder : p.border}` : 'none',
          }}>
            {day && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: day === todayDay ? p.primary : p.text, marginBottom: 3 }}>
                  {day}
                </div>
                {(obsByDay[day] || []).map((ob, j) => (
                  <div key={j} style={{
                    fontSize: 9, fontWeight: 600, color: '#fff', background: ob.cor,
                    borderRadius: 3, padding: '1px 4px', marginBottom: 2, lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={ob.nome + (ob.regime !== 'todos' ? ' (' + ob.regime + ')' : '')}>
                    {ob.nome}
                  </div>
                ))}
                {(evByDay[day] || []).map((ev) => (
                  <div key={ev.id} style={{
                    fontSize: 9, fontWeight: 600, color: '#fff', background: ev.cor || '#8B3DFF',
                    borderRadius: 3, padding: '1px 4px', marginBottom: 2, lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  }} title={ev.titulo}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</span>
                    <button
                      onClick={() => deleteEvento(ev.id)}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 9, lineHeight: 1, opacity: 0.7 }}
                    >✕</button>
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      {addModal && (
        <AddEventoModal
          mes={mes}
          onClose={(updated) => {
            setAddModal(false);
            if (updated) setEventos(updated);
          }}
        />
      )}
    </div>
  );
}

// ── Config panel ───────────────────────────────────────────────────────────────
function ConfigPanel({ onRefresh }) {
  const p         = useP();
  const companyId = useCompanyId();
  const [tab, setTab] = useState('tipos');
  const [tiposArq,  setTiposArq]  = useState([]);
  const [tiposConc, setTiposConc] = useState([]);
  const [configs,   setConfigs]   = useState([]);
  const [usuarios,  setUsuarios]  = useState([]);
  const [empresas,  setEmpresas]  = useState([]);
  const [addTipoModal, setAddTipoModal] = useState(null);
  const [newUserNome, setNewUserNome] = useState('');

  useEffect(() => {
    if (companyId === undefined) return;
    setTiposArq(getTipos('arquivo', companyId));
    setTiposConc(getTipos('conciliacao', companyId));
    setConfigs(getConfig(companyId));
    setUsuarios(getUsuarios(companyId));
    setEmpresas(getClientes(companyId));
  }, [companyId]);

  function removeTipo(cat, id) {
    if (cat === 'arquivo') {
      const updated = tiposArq.filter((t) => t.id !== id);
      saveTipos('arquivo', updated, companyId); setTiposArq(updated);
    } else {
      const updated = tiposConc.filter((t) => t.id !== id);
      saveTipos('conciliacao', updated, companyId); setTiposConc(updated);
    }
    onRefresh();
  }

  function getCfg(empresa_id) {
    return configs.find((c) => c.empresa_id === empresa_id) || { empresa_id };
  }

  function setCfgField(empresa_id, field, value) {
    const updated = [...configs];
    let idx = updated.findIndex((c) => c.empresa_id === empresa_id);
    if (idx < 0) { updated.push({ empresa_id }); idx = updated.length - 1; }
    updated[idx] = { ...updated[idx], [field]: value };
    setConfigs(updated); saveConfig(updated, companyId); onRefresh();
  }

  function setCfgTipoApp(empresa_id, cat, tipo_id) {
    const updated = [...configs];
    let idx = updated.findIndex((c) => c.empresa_id === empresa_id);
    if (idx < 0) { updated.push({ empresa_id }); idx = updated.length - 1; }
    const cfg = { ...updated[idx] };
    if (!cfg.tipos) cfg.tipos = {};
    if (!cfg.tipos[cat]) cfg.tipos[cat] = {};
    const current = cfg.tipos[cat][tipo_id] || 'ativo';
    cfg.tipos[cat][tipo_id] = APP_CYCLE[current] || 'ativo';
    updated[idx] = cfg;
    setConfigs(updated); saveConfig(updated, companyId); onRefresh();
  }

  function addUser() {
    if (!newUserNome.trim()) return;
    const updated = [...usuarios, { id: 'u_' + Date.now(), nome: newUserNome.trim() }];
    saveUsuarios(updated, companyId); setUsuarios(updated); setNewUserNome('');
  }

  function removeUser(id) {
    const updated = usuarios.filter((u) => u.id !== id);
    saveUsuarios(updated, companyId); setUsuarios(updated);
  }

  const configTabs = [
    { id: 'tipos', label: 'Tipos de Coluna' },
    { id: 'empresas', label: 'Empresas' },
    { id: 'usuarios', label: 'Usuários' },
  ];

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, color: p.text, fontWeight: 700 }}>Configurações</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: p.muted }}>Tipos de coluna, prazos e responsáveis por empresa</p>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {configTabs.map((ct) => (
          <button key={ct.id} onClick={() => setTab(ct.id)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: tab === ct.id ? p.primary : p.surface2,
            color: tab === ct.id ? '#fff' : p.muted,
            border: `1px solid ${tab === ct.id ? p.primary : p.border}`,
          }}>{ct.label}</button>
        ))}
      </div>

      {/* Tipos de coluna */}
      {tab === 'tipos' && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[{ cat: 'arquivo', label: 'Arquivos', tipos: tiposArq }, { cat: 'conciliacao', label: 'Conciliação', tipos: tiposConc }].map(({ cat, label, tipos }) => (
            <div key={cat} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{label}</span>
                <button onClick={() => setAddTipoModal(cat)} style={btnStyle(p, true)}>+ Adicionar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tipos.map((t) => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: p.surface2, borderRadius: 8, padding: '8px 12px', border: `1px solid ${p.border}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, color: p.text }}>{t.nome}</span>
                      {t.grupo && <span style={{ fontSize: 11, color: p.muted, marginLeft: 8 }}>{t.grupo}</span>}
                    </div>
                    <button
                      onClick={() => removeTipo(cat, t.id)}
                      style={{ background: 'none', border: 'none', color: p.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empresas config */}
      {tab === 'empresas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {empresas.length === 0 ? (
            <EmptyState message="Nenhuma empresa cadastrada em Gestão de Clientes." />
          ) : (
            empresas.map((emp) => {
              const cfg = getCfg(emp.id);
              const resp = usuarios.find((u) => u.id === cfg.resp_id);
              return (
                <div key={emp.id} style={{
                  background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{emp.name}</span>
                    <span style={{ fontSize: 11, color: p.muted2 }}>{emp.tributacao}</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {/* Prazo recebimento */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prazo Arquivos (dia)</label>
                      <input type="number" min={1} max={31}
                        value={cfg.prazo_rec || 10}
                        onChange={(e) => setCfgField(emp.id, 'prazo_rec', Number(e.target.value))}
                        style={{ ...inputStyle(p), width: 80 }}
                      />
                    </div>
                    {/* Prazo conciliação */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prazo Conciliação (dia)</label>
                      <input type="number" min={1} max={31}
                        value={cfg.prazo_conc || 25}
                        onChange={(e) => setCfgField(emp.id, 'prazo_conc', Number(e.target.value))}
                        style={{ ...inputStyle(p), width: 80 }}
                      />
                    </div>
                    {/* Responsável */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</label>
                      <select
                        value={cfg.resp_id || ''}
                        onChange={(e) => setCfgField(emp.id, 'resp_id', e.target.value)}
                        style={{ ...inputStyle(p), minWidth: 160 }}
                      >
                        <option value="">— Sem responsável —</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Applicability matrix */}
                  {[{ cat: 'arquivo', label: 'Arquivos', tipos: tiposArq }, { cat: 'conciliacao', label: 'Conciliação', tipos: tiposConc }].map(({ cat, label, tipos }) => (
                    <div key={cat}>
                      <div style={{ fontSize: 12, color: p.muted, marginBottom: 6, fontWeight: 600 }}>Aplicabilidade — {label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {tipos.map((tp) => {
                          const app = cfg.tipos?.[cat]?.[tp.id] || 'ativo';
                          const colors = {
                            ativo:   { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
                            na:      { bg: 'rgba(255,255,255,0.06)', text: p.muted, border: p.border },
                            inativo: { bg: 'rgba(248,113,113,0.12)', text: '#f87171', border: 'rgba(248,113,113,0.3)' },
                          }[app];
                          return (
                            <button
                              key={tp.id}
                              onClick={() => setCfgTipoApp(emp.id, cat, tp.id)}
                              title="Clique para alternar: Ativo → N/A → Inativo"
                              style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                              }}
                            >
                              {tp.nome} · {APP_LABEL[app]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Usuários */}
      {tab === 'usuarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newUserNome}
              onChange={(e) => setNewUserNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUser()}
              placeholder="Nome do usuário"
              style={inputStyle(p)}
            />
            <button onClick={addUser} style={btnStyle(p, true)}>Adicionar</button>
          </div>
          {usuarios.length === 0 ? (
            <EmptyState message="Nenhum usuário cadastrado. Adicione acima para atribuir responsáveis." />
          ) : (
            usuarios.map((u) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: p.surface2, borderRadius: 8, padding: '8px 14px', border: `1px solid ${p.border}`,
              }}>
                <span style={{ fontSize: 13, color: p.text }}>{u.nome}</span>
                <button
                  onClick={() => removeUser(u.id)}
                  style={{ background: 'none', border: 'none', color: p.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                >×</button>
              </div>
            ))
          )}
        </div>
      )}

      {addTipoModal && (
        <AddTipoModal
          cat={addTipoModal}
          onClose={(updated) => {
            setAddTipoModal(null);
            if (updated) {
              if (addTipoModal === 'arquivo') setTiposArq(updated);
              else setTiposConc(updated);
              onRefresh();
            }
          }}
        />
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ message }) {
  const p = useP();
  return (
    <div style={{
      border: `1px dashed ${p.border}`, borderRadius: 10, padding: '32px 20px',
      textAlign: 'center', color: p.muted, fontSize: 14,
    }}>{message}</div>
  );
}

// ── Shared style helpers ───────────────────────────────────────────────────────
function thStyle(p) {
  return {
    textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600,
    color: p.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `1px solid ${p.border}`, background: p.surface2, whiteSpace: 'nowrap',
  };
}
function tdStyle(p) {
  return { padding: '10px 14px', fontSize: 13, color: p.text, verticalAlign: 'middle' };
}
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
    padding: '7px 12px', borderRadius: 8, border: `1px solid ${p.border}`,
    background: p.inputBg, color: p.text, fontSize: 13, fontFamily: FONT_INTER,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
}

// ── Main page ──────────────────────────────────────────────────────────────────
const PANELS = [
  { id: 'arquivo',     label: 'Arquivos' },
  { id: 'conciliacao', label: 'Conciliação' },
  { id: 'calendario',  label: 'Calendário' },
  { id: 'config',      label: 'Configurações' },
];

export default function PrazosPage() {
  const { theme } = useTheme();
  const p = useMemo(() => getPalette(theme), [theme]);

  const [companyId, setCompanyId] = useState(undefined); // undefined = loading; null = loaded, no org
  useEffect(() => {
    getCurrentTenantCompanyId().then(id => setCompanyId(id || null)).catch(() => setCompanyId(null));
  }, []);

  const [panel, setPanel]   = useState('arquivo');
  const [mes, setMes]       = useState(currentMes);
  const [tick, setTick]     = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const tarefas   = useMemo(() => companyId !== undefined ? ensureTarefas(mes, companyId)     : [], [mes, tick, companyId]);
  const configs   = useMemo(() => companyId !== undefined ? getConfig(companyId)               : [], [tick, companyId]);
  const empresas  = useMemo(() => companyId !== undefined ? getClientes(companyId)             : [], [tick, companyId]);
  const usuarios  = useMemo(() => companyId !== undefined ? getUsuarios(companyId)             : [], [tick, companyId]);
  const tiposArq  = useMemo(() => companyId !== undefined ? getTipos('arquivo', companyId)     : [], [tick, companyId]);
  const tiposConc = useMemo(() => companyId !== undefined ? getTipos('conciliacao', companyId) : [], [tick, companyId]);

  // Auto-mark atrasados on load
  useEffect(() => {
    if (companyId === undefined) return;
    const { changed } = autoStatus(mes, companyId);
    if (changed) setTick((t) => t + 1);
  }, [mes, companyId]);

  return (
    <CompanyCtx.Provider value={companyId}>
    <PaletteCtx.Provider value={p}>
      <div style={{ minHeight: '100vh', background: p.bg, fontFamily: FONT_INTER }}>
        <SolucoesHeader tool="prazos" />

        {/* Month nav */}
        <div style={{
          background: p.surface, borderBottom: `1px solid ${p.border}`,
          padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <button
            onClick={() => setMes((m) => navMes(m, -1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${p.border}`,
              background: p.surface2, color: p.text, cursor: 'pointer', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: p.text, minWidth: 180, textAlign: 'center' }}>
            {mesLabel(mes)}
          </span>
          <button
            onClick={() => setMes((m) => navMes(m, 1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${p.border}`,
              background: p.surface2, color: p.text, cursor: 'pointer', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >›</button>
          <button
            onClick={() => setMes(currentMes())}
            style={{ ...btnStyle(p, false), padding: '5px 12px', fontSize: 12 }}
          >Mês atual</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { autoStatus(mes, companyId); refresh(); }}
            style={{ ...btnStyle(p, false), fontSize: 12, padding: '5px 12px' }}
          >Auto-marcar atrasados</button>
        </div>

        {/* Panel tabs */}
        <div style={{
          background: p.surface, borderBottom: `1px solid ${p.border}`,
          padding: '0 28px', display: 'flex', gap: 0,
        }}>
          {PANELS.map((pn) => (
            <button key={pn.id} onClick={() => setPanel(pn.id)} style={{
              padding: '12px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: panel === pn.id ? `2px solid ${p.primary}` : '2px solid transparent',
              color: panel === pn.id ? p.primary : p.muted,
              marginBottom: -1,
            }}>{pn.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {companyId === undefined ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: p.muted, fontSize: 14, fontFamily: FONT_INTER }}>
              Carregando dados da organização...
            </div>
          ) : (
            <>
              {panel === 'arquivo' && (
                <ArquivosPanel
                  mes={mes} tarefas={tarefas} tipos={tiposArq}
                  configs={configs} empresas={empresas} usuarios={usuarios}
                  onRefresh={refresh}
                />
              )}
              {panel === 'conciliacao' && (
                <ConciliacaoPanel
                  mes={mes} tarefas={tarefas} tipos={tiposConc}
                  configs={configs} empresas={empresas} usuarios={usuarios}
                  onRefresh={refresh}
                />
              )}
              {panel === 'calendario' && (
                <CalendarioPanel mes={mes} configs={configs} empresas={empresas} />
              )}
              {panel === 'config' && (
                <ConfigPanel onRefresh={refresh} />
              )}
            </>
          )}
        </div>
      </div>
    </PaletteCtx.Provider>
    </CompanyCtx.Provider>
  );
}
