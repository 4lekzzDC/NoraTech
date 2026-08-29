// Visão geral do Admin — dashboard gerencial modular. 5 KPIs fixos no topo
// (MRR, assinaturas ativas, propostas em aberto, faturas pendentes,
// acessos) e, abaixo, uma grade de widgets que o admin escolhe, reordena
// (arrastar pelo ⠿) e redimensiona (P/M/G) no modo "Personalizar
// dashboard" — persistido em profiles.dashboard_layout por usuário (ver
// src/lib/adminDashboard.js). Os dados de TODOS os widgets vêm de uma
// leva só (fetchDashboardData) — não tem loading por widget, só o
// Spinner da tela inteira até essa leva voltar.

import { useEffect, useRef, useState } from 'react';
import AdminLayout, { Card, EmptyState, Spinner } from '../../components/AdminLayout';
import { WidgetShell, WidgetConteudo } from '../../components/AdminDashboardWidgets';
import { useAuth } from '../../contexts/AuthContext';
import { formatBRL } from '../../lib/admin';
import { WIDGET_CATALOG, DEFAULT_LAYOUT, carregarLayout, salvarLayout, fetchDashboardData } from '../../lib/adminDashboard';

const ROXO = '#7C3AED';
const SPAN = { sm: 4, md: 6, lg: 12 };

function StatCard({ label, value, hint, accent = ROXO }) {
  return (
    <Card style={{ padding: '22px 24px' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: -1, marginTop: 8, color: accent }}>{value}</div>
      {hint && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{hint}</div>}
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
      <button className="admin-btn" type="button" onClick={() => setAberto((v) => !v)}>+ Adicionar bloco</button>
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

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutSalvo, setLayoutSalvo] = useState(DEFAULT_LAYOUT);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastandoId, setArrastandoId] = useState(null);

  // Os KPIs/widgets não dependem do usuário (RLS já resolve isso pela sessão
  // do client, não pelo objeto `user` do React) — só o layout salvo
  // depende, então só ele fica atrás do `user ? ... : DEFAULT_LAYOUT`. Isso
  // evita a tela travar num spinner infinito se `user` demorar a resolver.
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const [dadosRes, layoutRes] = await Promise.all([
          fetchDashboardData(),
          user ? carregarLayout(user.id) : Promise.resolve(DEFAULT_LAYOUT),
        ]);
        if (!ativo) return;
        setDados(dadosRes);
        setLayout(layoutRes);
        setLayoutSalvo(layoutRes);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [user]);

  function handleTamanho(id, size) {
    setLayout((atual) => atual.map((w) => (w.id === id ? { ...w, size } : w)));
  }
  function handleRemover(id) {
    setLayout((atual) => atual.filter((w) => w.id !== id));
  }
  function handleAdicionar(id) {
    setLayout((atual) => [...atual, { id, size: WIDGET_CATALOG[id].defaultSize }]);
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
      subtitle="Resumo da operação — personalize os blocos abaixo do jeito que faz sentido pra você."
      actions={!loading && (
        editando ? (
          <>
            <MenuAdicionarWidget disponiveis={disponiveisParaAdicionar} onEscolher={handleAdicionar} />
            <button className="admin-btn" type="button" onClick={() => setLayout(DEFAULT_LAYOUT)}>Restaurar padrão</button>
            <button className="admin-btn" type="button" onClick={handleCancelar} disabled={salvando}>Cancelar</button>
            <button className="admin-btn primary" type="button" onClick={handleSalvarLayout} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar layout'}
            </button>
          </>
        ) : (
          <button className="admin-btn" type="button" onClick={() => setEditando(true)}>✎ Personalizar dashboard</button>
        )
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
            <StatCard label="MRR" value={formatBRL(dados.kpis.mrr)} hint="Receita mensal recorrente" accent={ROXO} />
            <StatCard label="Assinaturas ativas" value={dados.kpis.assinaturasAtivas} accent="#00d48a" />
            <StatCard label="Propostas em aberto" value={dados.kpis.propostasAbertas} accent="#60a5fa" />
            <StatCard label="Faturas pendentes" value={dados.kpis.faturasPendentes} accent="#ff8a3d" />
            <StatCard label="Acessos" value={dados.kpis.acessos7d} hint="Logins nos últimos 7 dias" accent="#a78bfa" />
          </div>

          {editando && (
            <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, marginBottom: 18, color: '#a78bfa', fontSize: '0.82rem' }}>
              Modo personalização: arraste pelo ⠿ pra reordenar, escolha o tamanho (P/M/G) ou remova um bloco com ×. As mudanças só ficam pra valer depois de "Salvar layout".
            </div>
          )}

          {layout.length === 0 ? (
            <EmptyState>
              Nenhum bloco no dashboard.{' '}
              {editando ? 'Adicione um pelo botão "+ Adicionar bloco" acima.' : 'Clique em "Personalizar dashboard" para adicionar.'}
            </EmptyState>
          ) : (
            <div className="admin-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
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
