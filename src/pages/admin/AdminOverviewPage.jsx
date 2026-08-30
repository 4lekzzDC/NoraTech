// Visão geral do Admin — painel gerencial modular, com cara de relatório
// executivo e não de grade de cards.
//
// Estrutura: uma FAIXA densa de 5 KPIs no topo (uma superfície só, dividida
// por filetes — não cinco cartões), e abaixo uma grade de 12 colunas onde
// Receita/MRR ocupa a linha inteira como bloco de destaque e o resto entra
// como leitura de apoio, em blocos silenciosos (sem borda, fundo levemente
// elevado).
//
// Fora do modo de edição a tela não mostra nenhuma alça: sem ⠿, sem ⋯, sem
// borda de widget. Entrar em "Personalizar dashboard" é o que revela tudo
// isso, mais a barra flutuante de conclusão. Layout persistido em
// profiles.dashboard_layout por usuário.
//
// Os dados de TODOS os widgets vêm de uma leva só (fetchDashboardData) — o
// Spinner de tela cheia só aparece no primeiro carregamento; trocar o
// período atualiza em segundo plano, sem esconder o que já está na tela
// (pra não interromper uma edição de layout em andamento).

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner } from '../../components/AdminLayout';
import { WidgetShell, WidgetConteudo } from '../../components/AdminDashboardWidgets';
import { Icon } from '../../components/AdminIcons';
import { useAuth } from '../../contexts/AuthContext';
import { formatBRL } from '../../lib/admin';
import {
  WIDGET_CATALOG, DEFAULT_LAYOUT, PERIODOS, PERIODO_PADRAO, SPAN_POR_TAMANHO,
  carregarPreferencias, salvarPreferencias, fetchDashboardData, resumoDoWidget,
} from '../../lib/adminDashboard';

const MUTED = 'rgba(255,255,255,0.42)';

// Cada KPI e para onde ele leva, já com o filtro que corresponde ao número
// mostrado. "Propostas em aberto" usa `status=abertas`, um atalho que a
// própria tela de propostas entende como "as três etapas antes da decisão".
const KPIS = [
  {
    label: 'MRR', icon: 'dollar', destaque: true, destino: '/admin/empresas',
    valor: (k) => formatBRL(k.mrr), trend: (k) => k.trendMrr, nota: () => 'Receita recorrente',
  },
  {
    label: 'Assinaturas ativas', icon: 'users', destino: '/admin/empresas',
    valor: (k) => k.assinaturasAtivas, trend: (k) => k.trendAssinaturas, nota: () => 'Sem base anterior',
  },
  {
    label: 'Propostas em aberto', icon: 'file', destino: '/admin/propostas?status=abertas',
    valor: (k) => k.propostasAbertas, nota: (k) => `${k.propostasCriadasPeriodo} criadas no período`,
  },
  {
    label: 'Faturas pendentes', icon: 'card', destino: '/admin/faturas?status=pending',
    valor: (k) => k.faturasPendentes, nota: (k) => `${formatBRL(k.faturasPendentesValor)} em aberto`,
  },
  {
    label: 'Acessos', icon: 'trending', destino: '/admin/usuarios',
    valor: (k) => k.acessosPeriodo, trend: (k) => k.trendAcessos, nota: () => 'Logins no período',
  },
];

function pct(n) {
  return `${Math.abs(n).toFixed(1).replace('.', ',')}%`;
}

// Cada KPI leva para a área que o originou, já filtrada — clicar em
// "Faturas pendentes" cai na lista de faturas com o filtro "pendente"
// aplicado, não na lista crua.
function Kpi({ label, value, icon, destaque, trendPct, nota, destino, onAbrir }) {
  const temTrend = trendPct !== null && trendPct !== undefined && Number.isFinite(trendPct);
  const positivo = temTrend && trendPct >= 0;
  return (
    <div
      className={destino ? 'admin-kpi admin-kpi-navegavel' : 'admin-kpi'}
      role={destino ? 'link' : undefined}
      tabIndex={destino ? 0 : undefined}
      aria-label={destino ? `${label}: ${value} — abrir área correspondente` : undefined}
      onClick={destino ? onAbrir : undefined}
      onKeyDown={destino ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } } : undefined}
      style={{ flex: '1 1 168px', minWidth: 0, padding: '4px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED, marginBottom: 7 }}>
        <Icon name={icon} size={13} />
        <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: destaque ? '1.6rem' : '1.4rem', fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.1,
        color: destaque ? '#a78bfa' : '#eeede9', fontVariantNumeric: 'tabular-nums',
      }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.72rem', minHeight: 16, whiteSpace: 'nowrap' }}>
        {temTrend ? (
          <span style={{ color: positivo ? '#00d48a' : '#ff6b6b', fontWeight: 700 }} title={`${positivo ? 'Alta' : 'Queda'} de ${pct(trendPct)} em relação ao período anterior`}>
            {positivo ? '▲' : '▼'} {pct(trendPct)}
            <span style={{ color: MUTED, fontWeight: 400, marginLeft: 5 }}>vs. anterior</span>
          </span>
        ) : (
          nota && <span style={{ color: MUTED }}>{nota}</span>
        )}
      </div>
    </div>
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

  // O botão fica sempre visível na edição — some quando não há nada a
  // adicionar era pior: o admin procurava um botão que existia antes. Com
  // tudo já no painel, o menu abre explicando isso.
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="admin-btn" type="button" onClick={() => setAberto((v) => !v)}>
        <Icon name="plus" size={14} /> Adicionar widget
      </button>
      {aberto && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 40, width: 278,
          background: '#16161c', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: 6,
          boxShadow: '0 16px 36px -10px rgba(0,0,0,0.6)',
        }}
        >
          {disponiveis.length === 0 && (
            <div style={{ padding: '10px 11px', fontSize: '0.78rem', color: MUTED, lineHeight: 1.5 }}>
              Todos os widgets já estão no painel. Oculte um pelo menu <strong style={{ color: 'rgba(255,255,255,0.7)' }}>⋯</strong> para poder trazê-lo de volta aqui.
            </div>
          )}
          {disponiveis.map((id) => (
            <button
              key={id} type="button" onClick={() => { onEscolher(id); setAberto(false); }}
              className="admin-dashboard-add-item"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 600 }}>
                <Icon name={WIDGET_CATALOG[id].icon} size={14} style={{ color: '#a78bfa' }} />
                {WIDGET_CATALOG[id].title}
              </span>
              <span style={{ fontSize: '0.71rem', color: MUTED, paddingLeft: 22 }}>{WIDGET_CATALOG[id].desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [periodo, setPeriodo] = useState(PERIODO_PADRAO);
  const primeiraCargaRef = useRef(true);
  // Só depois das preferências carregarem é que uma troca de período pode
  // ser gravada — senão a primeira renderização salvaria o padrão por cima
  // do que o admin já tinha escolhido.
  const prefsCarregadasRef = useRef(false);

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutSalvo, setLayoutSalvo] = useState(DEFAULT_LAYOUT);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastandoId, setArrastandoId] = useState(null);
  const [confirmandoRestauro, setConfirmandoRestauro] = useState(false);

  // Preferências (layout + período) só dependem do usuário — nunca
  // recarregam ao trocar o período, pra não pisar numa edição de layout em
  // andamento com o que está salvo.
  useEffect(() => {
    if (!user) return undefined;
    let ativo = true;
    (async () => {
      try {
        const prefs = await carregarPreferencias(user.id);
        if (!ativo) return;
        setLayout(prefs.widgets);
        setLayoutSalvo(prefs.widgets);
        setPeriodo(prefs.periodo);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) prefsCarregadasRef.current = true;
      }
    })();
    return () => { ativo = false; };
  }, [user]);

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

  // Trocar o período grava na hora (não espera "Concluir edição") — mas
  // grava o layout JÁ SALVO, não o que está em edição, pra não persistir
  // mudanças de blocos que o admin ainda não confirmou.
  function handlePeriodo(dias) {
    setPeriodo(dias);
    if (!user || !prefsCarregadasRef.current) return;
    salvarPreferencias(user.id, { widgets: layoutSalvo, periodo: dias })
      .catch(() => { /* preferência de exibição: não vale interromper a tela por causa disso */ });
  }

  function handleAbrir(destino) {
    return () => navigate(destino);
  }

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
      await salvarPreferencias(user.id, { widgets: layout, periodo });
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
          <div className="admin-periodo">
            <Icon name="calendar" size={14} style={{ color: MUTED }} />
            <select value={periodo} onChange={(e) => handlePeriodo(Number(e.target.value))} aria-label="Período">
              {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
            </select>
          </div>
          {editando && <MenuAdicionarWidget disponiveis={disponiveisParaAdicionar} onEscolher={handleAdicionar} />}
          {!editando && (
            <button className="admin-btn" type="button" onClick={() => setEditando(true)}>
              <Icon name="sliders" size={14} /> Personalizar dashboard
            </button>
          )}
        </>
      )}
    >
      {erro && (
        <div style={{ padding: '11px 15px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.84rem' }}>
          {erro}
        </div>
      )}

      {loading || !dados ? <Spinner /> : (
        <>
          <Card className="admin-kpi-strip" style={{ padding: '16px 4px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.055)' }}>
            {KPIS.map((k) => (
              <Kpi
                key={k.label} label={k.label} icon={k.icon} destaque={k.destaque}
                value={k.valor(dados.kpis)} trendPct={k.trend?.(dados.kpis)} nota={k.nota?.(dados.kpis)}
                destino={k.destino} onAbrir={handleAbrir(k.destino)}
              />
            ))}
          </Card>

          {layout.length === 0 ? (
            <div style={{ padding: '34px 20px', textAlign: 'center', color: MUTED, fontSize: '0.86rem' }}>
              Nenhum bloco no dashboard.{' '}
              {editando ? 'Adicione um pelo botão "Adicionar widget" acima.' : 'Clique em "Personalizar dashboard" para adicionar.'}
            </div>
          ) : (
            <div
              className="admin-dashboard-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, alignItems: 'start', paddingBottom: editando ? 92 : 0 }}
            >
              {layout.map((w) => {
                if (!WIDGET_CATALOG[w.id]) return null;
                return (
                  <div key={w.id} style={{ gridColumn: `span ${SPAN_POR_TAMANHO[w.size] || 6}`, minWidth: 0 }}>
                    <WidgetShell
                      tipo={w.id} tamanho={w.size} editando={editando} arrastando={arrastandoId === w.id}
                      resumo={resumoDoWidget(w.id, dados)}
                      onTamanho={(size) => handleTamanho(w.id, size)}
                      onRemover={() => handleRemover(w.id)}
                      onHandleDragStart={handleDragStart(w.id)}
                      onHandleDragEnd={handleDragEnd}
                      onContainerDragOver={handleContainerDragOver(w.id)}
                      onContainerDrop={handleContainerDrop}
                      onAbrir={WIDGET_CATALOG[w.id].destino ? handleAbrir(WIDGET_CATALOG[w.id].destino) : undefined}
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
        <div className="admin-edit-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 9, background: 'rgba(124,58,237,0.18)', color: '#a78bfa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            >
              <Icon name="grip" size={15} />
            </span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Modo de edição</div>
              <div style={{ fontSize: '0.71rem', color: MUTED }}>Arraste pelo ⠿ para reorganizar · ⋯ para tamanho</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn" type="button" onClick={() => setConfirmandoRestauro(true)}>Restaurar padrão</button>
            <button className="admin-btn" type="button" onClick={handleCancelar} disabled={salvando}>Cancelar</button>
            <button className="admin-btn primary" type="button" onClick={handleSalvarLayout} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Concluir edição'}
            </button>
          </div>
        </div>
      )}

      <Modal
        open={confirmandoRestauro}
        onClose={() => setConfirmandoRestauro(false)}
        title="Restaurar layout padrão"
        footer={
          <>
            <button className="admin-btn" type="button" onClick={() => setConfirmandoRestauro(false)}>Cancelar</button>
            <button
              className="admin-btn primary" type="button"
              onClick={() => { setLayout(DEFAULT_LAYOUT); setConfirmandoRestauro(false); }}
            >
              Restaurar padrão
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.87rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
          Isso descarta a organização atual dos blocos e volta ao layout padrão do NoraTech.
          Nada é salvo até você clicar em <strong style={{ color: '#eeede9' }}>Concluir edição</strong> —
          até lá dá pra desfazer em Cancelar.
        </p>
      </Modal>

      <style>{`
        /* Faixa de KPIs: uma superfície só, segmentos separados por filete. */
        .admin-kpi-strip { display: flex; flex-wrap: wrap; }
        .admin-kpi-strip > * + * { border-left: 1px solid rgba(255,255,255,0.06); }

        .admin-kpi { border-radius: 10px; transition: background 120ms ease-out; }
        .admin-kpi-navegavel { cursor: pointer; }
        .admin-kpi-navegavel:hover { background: rgba(255,255,255,0.03); }
        .admin-kpi-navegavel:focus-visible { outline: 2px solid #7C3AED; outline-offset: -2px; }

        /* Bloco silencioso: sem moldura em repouso; a borda só aparece na edição. */
        .admin-widget { border-radius: 14px; transition: border-color 140ms ease-out, background 140ms ease-out; }
        .admin-widget-editando:hover { border-color: rgba(124,58,237,0.5) !important; }
        .admin-widget-navegavel { cursor: pointer; }
        .admin-widget-navegavel:hover { background: rgba(255,255,255,0.042) !important; }
        .admin-widget-navegavel:focus-visible { outline: 2px solid #7C3AED; outline-offset: 2px; }

        /* Placeholder de posição: o bloco arrastado vira um contorno tracejado
           no lugar onde vai cair, mantendo a altura pra grade não pular. */
        .admin-widget-arrastando {
          background: rgba(124,58,237,0.07) !important;
          border-style: dashed !important;
          border-color: rgba(124,58,237,0.6) !important;
        }
        .admin-widget-arrastando > * { opacity: 0; }

        .admin-widget-grip {
          cursor: grab; color: rgba(255,255,255,0.3); display: flex; flex-shrink: 0;
          transition: color 120ms ease-out;
        }
        .admin-widget-grip:hover { color: rgba(255,255,255,0.6); }
        .admin-widget-grip:active { cursor: grabbing; }

        .admin-widget-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; padding: 0; border: none; border-radius: 7px;
          background: transparent; color: rgba(255,255,255,0.4); cursor: pointer;
          transition: background 120ms ease-out, color 120ms ease-out;
        }
        .admin-widget-icon-btn:hover { background: rgba(255,255,255,0.06); color: #eeede9; }

        .admin-widget-size-btn {
          padding: 7px 4px; border-radius: 7px; border: 1px solid; cursor: pointer;
          font-size: 0.72rem; font-weight: 600; font-family: inherit;
          transition: background 120ms ease-out, color 120ms ease-out;
        }
        .admin-widget-size-btn:hover { background: rgba(255,255,255,0.06); }

        .admin-widget-remove-btn {
          display: block; width: 100%; text-align: left; padding: 8px 6px; border-radius: 7px;
          border: none; border-top: 1px solid rgba(255,255,255,0.07); background: none;
          color: #ff6b6b; cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: inherit;
          transition: background 120ms ease-out;
        }
        .admin-widget-remove-btn:hover { background: rgba(255,107,107,0.09); }

        .admin-widget-link {
          display: inline-flex; align-items: center; gap: 4px; align-self: flex-start;
          margin-top: 11px; font-size: 0.75rem; font-weight: 600; color: #a78bfa; text-decoration: none;
          transition: gap 120ms ease-out, color 120ms ease-out;
        }
        .admin-widget-link:hover { gap: 7px; color: #c4b5fd; }

        .admin-dashboard-add-item {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2; width: 100%;
          text-align: left; padding: 9px 10px; border-radius: 8px; border: none;
          background: none; color: #eeede9; cursor: pointer; font-family: inherit;
          transition: background 120ms ease-out;
        }
        .admin-dashboard-add-item:hover { background: rgba(255,255,255,0.05); }

        /* Seletor de período: o ícone mora dentro da moldura, o select fica sem a própria. */
        .admin-periodo {
          display: flex; align-items: center; gap: 7px; padding: 0 11px; height: 36px;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; background: rgba(255,255,255,0.02);
          transition: border-color 120ms ease-out;
        }
        .admin-periodo:hover { border-color: rgba(255,255,255,0.2); }
        .admin-periodo select {
          background: transparent; border: none; outline: none; color: #eeede9;
          font-size: 0.85rem; font-weight: 600; font-family: inherit; cursor: pointer; padding-right: 2px;
        }
        .admin-periodo select option { background: #16161c; color: #eeede9; }

        .admin-edit-bar {
          position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 60;
          display: flex; align-items: center; gap: 18px;
          background: #16161c; border: 1px solid rgba(124,58,237,0.32); border-radius: 15px;
          padding: 11px 14px; box-shadow: 0 18px 44px -14px rgba(0,0,0,0.7);
        }

        /* Foco visível para navegação por teclado (o hover não cobre isso). */
        .admin-widget-icon-btn:focus-visible,
        .admin-widget-size-btn:focus-visible,
        .admin-widget-remove-btn:focus-visible,
        .admin-dashboard-add-item:focus-visible,
        .admin-periodo select:focus-visible {
          outline: 2px solid #7C3AED; outline-offset: 2px;
        }

        @media (max-width: 1180px) {
          .admin-dashboard-grid > * { grid-column: span 6 !important; }
        }
        @media (max-width: 820px) {
          .admin-dashboard-grid > * { grid-column: span 12 !important; }
          .admin-kpi-strip > * + * { border-left: none; }
          .admin-edit-bar { left: 12px; right: 12px; transform: none; flex-wrap: wrap; justify-content: space-between; }
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-widget, .admin-widget-grip, .admin-widget-icon-btn,
          .admin-widget-size-btn, .admin-widget-remove-btn, .admin-widget-link,
          .admin-dashboard-add-item, .admin-periodo { transition: none; }
        }
      `}
      </style>
    </AdminLayout>
  );
}
