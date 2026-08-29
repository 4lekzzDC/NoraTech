// Visão geral do Admin — dashboard gerencial modular. 5 KPIs fixos no topo
// (MRR, assinaturas ativas, propostas em aberto, faturas pendentes,
// acessos), com tendência vs. o período anterior onde dá pra calcular
// honestamente (ver lib/adminDashboard.js) — e, abaixo, uma grade de
// widgets que o admin escolhe, reordena (arrastar pelo ⠿), redimensiona
// (P/M/G) e remove no modo "Personalizar dashboard", com uma barra
// flutuante pra concluir/cancelar a edição. Layout persistido em
// profiles.dashboard_layout por usuário. Os dados de TODOS os widgets vêm
// de uma leva só (fetchDashboardData) — não tem loading por widget, só o
// Spinner da tela inteira no primeiro carregamento; trocar o período
// depois disso atualiza em segundo plano, sem esconder o que já está na
// tela (pra não interromper uma edição de layout em andamento).

import { useEffect, useRef, useState } from 'react';
import AdminLayout, { Card, EmptyState, Spinner } from '../../components/AdminLayout';
import { WidgetShell, WidgetConteudo } from '../../components/AdminDashboardWidgets';
import { useAuth } from '../../contexts/AuthContext';
import { formatBRL } from '../../lib/admin';
import {
  WIDGET_CATALOG, DEFAULT_LAYOUT, PERIODOS, carregarLayout, salvarLayout, fetchDashboardData,
} from '../../lib/adminDashboard';

const SPAN = { sm: 4, md: 6, lg: 12 };

function Tendencia({ pct }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const positivo = pct >= 0;
  return (
    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: positivo ? '#00d48a' : '#ff6b6b' }}>
      {positivo ? '↗' : '↘'} {Math.abs(pct).toFixed(1)}%
      <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: 5 }}>vs. período anterior</span>
    </span>
  );
}

function KpiCard({ label, value, icon, accent, trendPct, secondaryHint }) {
  return (
    <Card style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>{label}</span>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0, fontSize: '0.95rem',
          background: `${accent}22`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        >
          {icon}
        </span>
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -1, marginTop: 10, color: '#eeede9' }}>{value}</div>
      <div style={{ marginTop: 8, minHeight: 18 }}>
        {trendPct !== undefined ? <Tendencia pct={trendPct} /> : (
          secondaryHint && <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)' }}>{secondaryHint}</span>
        )}
      </div>
    </Card>
  );
}

function MenuAdicionarWidget({ disponiveis, onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  if (disponiveis.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="admin-btn" type="button" onClick={() => setAberto((v) => !v)}>+ Adicionar widget</button>
      {aberto && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, width: 270,
          background: '#15151a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 6,
          boxShadow: '0 16px 36px -10px rgba(0,0,0,0.55)',
        }}
        >
          {disponiveis.map((id) => (
            <button
              key={id} type="button" onClick={() => { onEscolher(id); setAberto(false); }}
              className="admin-dashboard-add-item"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', textAlign: 'left',
                padding: '9px 11px', borderRadius: 8, border: 'none', background: 'none', color: '#eeede9', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{WIDGET_CATALOG[id].icon} {WIDGET_CATALOG[id].title}</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{WIDGET_CATALOG[id].desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [periodo, setPeriodo] = useState(30);
  const primeiraCargaRef = useRef(true);

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutSalvo, setLayoutSalvo] = useState(DEFAULT_LAYOUT);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastandoId, setArrastandoId] = useState(null);

  // Layout só depende do usuário — nunca recarrega ao trocar o período, pra
  // não pisar numa edição de layout em andamento com o que está salvo.
  useEffect(() => {
    if (!user) return undefined;
    let ativo = true;
    (async () => {
      try {
        const layoutRes = await carregarLayout(user.id);
        if (!ativo) return;
        setLayout(layoutRes);
        setLayoutSalvo(layoutRes);
      } catch (e) {
        if (ativo) setErro(e.message);
      }
    })();
    return () => { ativo = false; };
  }, [user]);

  // Dados dos KPIs/widgets — recarrega ao trocar o período. Só mostra o
  // Spinner de tela cheia na primeira vez; depois disso atualiza "quieto",
  // mantendo o dashboard já carregado visível até os novos dados chegarem.
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(primeiraCargaRef.current);
      setErro('');
      try {
        const dadosRes = await fetchDashboardData(periodo);
        if (!ativo) return;
        setDados(dadosRes);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) { setLoading(false); primeiraCargaRef.current = false; }
      }
    })();
    return () => { ativo = false; };
  }, [periodo]);

  function handleTamanho(id, size) {
    setLayout((atual) => atual.map((w) => (w.id === id ? { ...w, size } : w)));
  }
  function handleRemover(id) {
    setLayout((atual) => atual.filter((w) => w.id !== id));
  }
  function handleAdicionar(id) {
    setLayout((atual) => [...atual, { id, size: WIDGET_CATALOG[id].defaultSize }]);
    setEditando(true);
  }
  function handleDragStart(id) {
    return (e) => { e.dataTransfer.effectAllowed = 'move'; setArrastandoId(id); };
  }
  function handleDragEnd() { setArrastandoId(null); }
  function handleContainerDragOver(targetId) {
    return (e) => {
      e.preventDefault();
      if (!arrastandoId || arrastandoId === targetId) return;
      setLayout((atual) => {
        const origem = atual.findIndex((w) => w.id === arrastandoId);
        const destino = atual.findIndex((w) => w.id === targetId);
        if (origem === -1 || destino === -1 || origem === destino) return atual;
        const copia = [...atual];
        const [item] = copia.splice(origem, 1);
        copia.splice(destino, 0, item);
        return copia;
      });
    };
  }
  function handleContainerDrop(e) { e.preventDefault(); }

  async function handleSalvarLayout() {
    if (!user) { setErro('Sessão ainda carregando — aguarde um instante e tente salvar de novo.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await salvarLayout(user.id, layout);
      setLayoutSalvo(layout);
      setEditando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }
  function handleCancelar() {
    setLayout(layoutSalvo);
    setEditando(false);
  }

  const idsPresentes = new Set(layout.map((w) => w.id));
  const disponiveisParaAdicionar = Object.keys(WIDGET_CATALOG).filter((id) => !idsPresentes.has(id));

  return (
    <AdminLayout
      title="Visão geral"
      subtitle="Acompanhe os principais indicadores e o desempenho da operação."
      actions={!loading && (
        <>
          <select
            className="admin-select" style={{ width: 168 }} value={periodo}
            onChange={(e) => setPeriodo(Number(e.target.value))}
          >
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
          </select>
          <MenuAdicionarWidget disponiveis={disponiveisParaAdicionar} onEscolher={handleAdicionar} />
          {!editando && (
            <button className="admin-btn primary" type="button" onClick={() => setEditando(true)}>⚙ Personalizar dashboard</button>
          )}
        </>
      )}
    >
      {erro && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {erro}
        </div>
      )}

      {loading || !dados ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            <KpiCard label="MRR" value={formatBRL(dados.kpis.mrr)} icon="💲" accent="#00d48a" trendPct={dados.kpis.trendMrr} />
            <KpiCard label="Assinaturas ativas" value={dados.kpis.assinaturasAtivas} icon="👥" accent="#60a5fa" trendPct={dados.kpis.trendAssinaturas} />
            <KpiCard label="Propostas em aberto" value={dados.kpis.propostasAbertas} icon="📄" accent="#a78bfa" secondaryHint={`${dados.kpis.propostasCriadasPeriodo} criadas no período`} />
            <KpiCard label="Faturas pendentes" value={dados.kpis.faturasPendentes} icon="💸" accent="#ff8a3d" secondaryHint={`${formatBRL(dados.kpis.faturasPendentesValor)} em aberto`} />
            <KpiCard label="Acessos" value={dados.kpis.acessosPeriodo} icon="📈" accent="#f472b6" trendPct={dados.kpis.trendAcessos} />
          </div>

          {layout.length === 0 ? (
            <EmptyState>
              Nenhum bloco no dashboard.{' '}
              {editando ? 'Adicione um pelo botão "+ Adicionar widget" acima.' : 'Clique em "Personalizar dashboard" para adicionar.'}
            </EmptyState>
          ) : (
            <div className="admin-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, paddingBottom: editando ? 90 : 0 }}>
              {layout.map((w) => {
                if (!WIDGET_CATALOG[w.id]) return null;
                return (
                  <div key={w.id} style={{ gridColumn: `span ${SPAN[w.size] || 6}`, minWidth: 0 }}>
                    <WidgetShell
                      tipo={w.id} tamanho={w.size} editando={editando} arrastando={arrastandoId === w.id}
                      onTamanho={(size) => handleTamanho(w.id, size)}
                      onRemover={() => handleRemover(w.id)}
                      onHandleDragStart={handleDragStart(w.id)}
                      onHandleDragEnd={handleDragEnd}
                      onContainerDragOver={handleContainerDragOver(w.id)}
                      onContainerDrop={handleContainerDrop}
                    >
                      <WidgetConteudo tipo={w.id} dados={dados} />
                    </WidgetShell>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editando && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 16,
          background: '#15151a', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 16,
          padding: '12px 16px 12px 16px', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.6)',
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, background: 'rgba(124,58,237,0.18)', color: '#a78bfa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
            }}
            >
              ⠿
            </span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Modo de edição ativo</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>Arraste os widgets para reorganizar</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn" type="button" onClick={() => setLayout(DEFAULT_LAYOUT)}>Restaurar padrão</button>
            <button className="admin-btn" type="button" onClick={handleCancelar} disabled={salvando}>Cancelar</button>
            <button className="admin-btn primary" type="button" onClick={handleSalvarLayout} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Concluir edição'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .admin-dashboard-grid > * { grid-column: span 12 !important; }
        }
        .admin-dashboard-add-item:hover { background: rgba(255,255,255,0.05) !important; }
      `}
      </style>
    </AdminLayout>
  );
}
