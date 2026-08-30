// Os 8 tipos de widget do dashboard "Visão geral" + o wrapper comum
// (WidgetShell) que dá a cada um o mesmo cabeçalho, o mesmo menu "⋯" de
// tamanho/remoção no modo "Personalizar" e a mesma superfície. Cada widget
// só recebe a fatia de dados que precisa — quem busca tudo é
// `fetchDashboardData` em lib/adminDashboard.js, uma vez só.
//
// Acabamento (o que faz o painel ler como relatório, não como grade de
// cards): superfície sem borda, sem divisória sob o cabeçalho, gráficos
// baixos (130px; 190px só no bloco de destaque) e — importante — nenhum
// gráfico reserva altura quando não tem dado: cai num estado compacto de
// uma linha, pra não abrir buracos no meio do painel.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { Card } from './AdminLayout';
import { Icon } from './AdminIcons';
import { formatBRL, formatDate, formatDateTime } from '../lib/admin';
import { WIDGET_CATALOG, TAMANHOS } from '../lib/adminDashboard';

Chart.register(...registerables);

const ROXO = '#7C3AED';
const GRADE = 'rgba(255,255,255,0.05)';
const MUTED = 'rgba(255,255,255,0.42)';
const ALTURA_GRAFICO = 130;
const ALTURA_GRAFICO_DESTAQUE = 190;

/**
 * Estado vazio de uma linha — não reserva a altura do gráfico que
 * substitui. `acao` vira um CTA discreto (link de texto, não botão) pra
 * quem chegou num bloco vazio ter o próximo passo à mão.
 */
function VazioCompacto({ children, acao }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 2px', color: MUTED, fontSize: '0.8rem', flexWrap: 'wrap' }}>
      <Icon name="inbox" size={15} />
      <span>{children}</span>
      {acao && (
        <Link to={acao.to} className="admin-widget-link" style={{ marginTop: 0, marginLeft: 2 }} onClick={(e) => e.stopPropagation()}>
          {acao.label}
          <Icon name="arrowRight" size={12} />
        </Link>
      )}
    </div>
  );
}

// Tooltip escuro compartilhado — o padrão do Chart.js é claro e destoa do
// painel. `intersect: false` + `mode: index` deixa o valor aparecer ao
// passar perto do ponto, não só exatamente em cima dele.
const TOOLTIP = {
  enabled: true,
  backgroundColor: 'rgba(16,16,22,0.96)',
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  titleColor: '#eeede9',
  bodyColor: 'rgba(255,255,255,0.78)',
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  titleFont: { size: 12, weight: '700' },
  bodyFont: { size: 12 },
};

const INTERACAO_EIXO = { mode: 'index', intersect: false };

function MenuOpcoesWidget({ titulo, tamanho, onTamanho, onRemover }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button" onClick={() => setAberto((v) => !v)} aria-label={`Opções de ${titulo}`}
        className="admin-widget-icon-btn"
      >
        <Icon name="more" size={15} />
      </button>
      {aberto && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: 182,
          background: '#16161c', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 6,
          boxShadow: '0 14px 32px -10px rgba(0,0,0,0.6)',
        }}
        >
          <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: 0.7, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', padding: '3px 6px 7px' }}>Tamanho</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, padding: '0 6px 8px' }}>
            {TAMANHOS.map((t) => (
              <button
                key={t.valor} type="button" onClick={() => { onTamanho(t.valor); setAberto(false); }}
                className="admin-widget-size-btn"
                style={{
                  background: tamanho === t.valor ? 'rgba(124,58,237,0.22)' : 'transparent',
                  color: tamanho === t.valor ? '#a78bfa' : 'rgba(255,255,255,0.55)',
                  borderColor: tamanho === t.valor ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { onRemover(); setAberto(false); }} className="admin-widget-remove-btn">
            Ocultar widget
          </button>
        </div>
      )}
    </div>
  );
}

export function WidgetShell({
  tipo, tamanho, editando, arrastando, resumo, onTamanho, onRemover, onAbrir,
  onHandleDragStart, onHandleDragEnd, onContainerDragOver, onContainerDrop, children,
}) {
  const meta = WIDGET_CATALOG[tipo];
  if (!meta) return null;
  const destaque = meta.tone === 'primary';
  // Clicável só fora da edição: durante a edição o card é alvo de arraste, e
  // um clique ali é pra pegar o bloco, não pra sair da tela.
  const navegavel = !editando && !!meta.destino;

  const classes = ['admin-widget'];
  if (editando) classes.push('admin-widget-editando');
  if (arrastando) classes.push('admin-widget-arrastando');
  if (navegavel) classes.push('admin-widget-navegavel');

  return (
    <Card
      onDragOver={editando ? onContainerDragOver : undefined}
      onDrop={editando ? onContainerDrop : undefined}
      className={classes.join(' ')}
      role={navegavel ? 'link' : undefined}
      tabIndex={navegavel ? 0 : undefined}
      aria-label={navegavel ? `${meta.title} — abrir área correspondente` : undefined}
      onClick={navegavel ? onAbrir : undefined}
      onKeyDown={navegavel ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); }
      } : undefined}
      style={{
        padding: destaque ? '18px 20px 16px' : '15px 17px 14px',
        display: 'flex', flexDirection: 'column',
        background: destaque ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${editando ? 'rgba(124,58,237,0.28)' : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: destaque ? 14 : 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {editando && (
            <span
              draggable
              onDragStart={onHandleDragStart}
              onDragEnd={onHandleDragEnd}
              title="Arraste para reordenar"
              className="admin-widget-grip"
            >
              <Icon name="grip" size={14} />
            </span>
          )}
          <Icon name={meta.icon} size={destaque ? 16 : 14} style={{ color: destaque ? '#a78bfa' : MUTED }} />
          <h3 style={{
            fontSize: destaque ? '0.95rem' : '0.84rem', fontWeight: destaque ? 700 : 600, margin: 0,
            color: destaque ? '#eeede9' : 'rgba(255,255,255,0.78)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          >
            {meta.title}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {resumo && !editando && (
            <span style={{ fontSize: '0.74rem', color: MUTED, whiteSpace: 'nowrap' }}>{resumo}</span>
          )}
          {editando && (
            <MenuOpcoesWidget titulo={meta.title} tamanho={tamanho} onTamanho={onTamanho} onRemover={onRemover} />
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

function useChart(config) {
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (instanceRef.current) instanceRef.current.destroy();
    instanceRef.current = new Chart(canvasRef.current, config);
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);
  return canvasRef;
}

export function ReceitaMensalWidget({ dados }) {
  const meses = dados || [];
  const comValor = meses.filter((d) => d.valor > 0).length;
  const canvasRef = useChart({
    type: 'bar',
    data: {
      labels: meses.map((d) => d.label),
      datasets: [{ data: meses.map((d) => d.valor), backgroundColor: ROXO, borderRadius: 5, maxBarThickness: 34 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: INTERACAO_EIXO,
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => `Recebido: ${formatBRL(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: MUTED, font: { size: 10 } } },
        y: { grid: { color: GRADE }, border: { display: false }, ticks: { color: MUTED, font: { size: 10 }, maxTicksLimit: 5, callback: (v) => formatBRL(v) } },
      },
    },
  });
  // Um mês só não é histórico — vira número, não gráfico de uma barra.
  if (comValor === 0) return <VazioCompacto acao={{ to: '/admin/faturas', label: 'Ver faturas' }}>Nenhuma fatura paga nos últimos 6 meses.</VazioCompacto>;
  if (comValor === 1) {
    const unico = meses.find((d) => d.valor > 0);
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0 2px' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#eeede9' }}>{formatBRL(unico.valor)}</span>
        <span style={{ fontSize: '0.78rem', color: MUTED }}>em {unico.label} — histórico insuficiente para o gráfico</span>
      </div>
    );
  }
  return <div style={{ position: 'relative', height: ALTURA_GRAFICO_DESTAQUE }}><canvas ref={canvasRef} /></div>;
}

const STATUS_LABEL = { rascunho: 'Rascunho', enviada: 'Enviada', visualizada: 'Visualizada', aceita: 'Aceita', recusada: 'Recusada', expirada: 'Expirada' };
const STATUS_COR = { rascunho: '#8b8b95', enviada: '#60a5fa', visualizada: '#f0b429', aceita: '#00d48a', recusada: '#ff6b6b', expirada: 'rgba(255,255,255,0.3)' };

export function PropostasStatusWidget({ dados }) {
  const entradas = Object.entries(dados || {}).filter(([, v]) => v > 0);
  const total = entradas.reduce((acc, [, v]) => acc + v, 0);
  const canvasRef = useChart({
    type: 'doughnut',
    data: {
      labels: entradas.map(([s]) => STATUS_LABEL[s] || s),
      datasets: [{ data: entradas.map(([, v]) => v), backgroundColor: entradas.map(([s]) => STATUS_COR[s] || ROXO), borderWidth: 0, hoverOffset: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            label: (ctx) => {
              const soma = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return `${ctx.parsed} proposta${ctx.parsed === 1 ? '' : 's'} (${Math.round((ctx.parsed / soma) * 100)}%)`;
            },
          },
        },
      },
    },
  });
  if (entradas.length === 0) return <VazioCompacto acao={{ to: '/admin/propostas/novo', label: 'Criar proposta' }}>Nenhuma proposta ainda.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <canvas ref={canvasRef} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: '0.56rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>Total</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {entradas.map(([status, v]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COR[status] || ROXO, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{STATUS_LABEL[status] || status}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            <span style={{ color: MUTED, fontSize: '0.7rem', width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round((v / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SistemasVendidosWidget({ dados }) {
  const lista = (dados || []).slice(0, 5);
  const maior = Math.max(1, ...lista.map((d) => d.total));
  if (lista.length === 0) return <VazioCompacto acao={{ to: '/admin/empresas', label: 'Ver empresas' }}>Nenhuma assinatura ativa ainda.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {lista.map((d) => (
        <div key={d.slug}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', marginBottom: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: d.sistema?.color || ROXO, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.78)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.sistema?.name || d.slug}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.total}</span>
          </div>
          <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.total / maior) * 100}%`, background: d.sistema?.color || ROXO, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AcessosPorDiaWidget({ dados }) {
  const dias = dados || [];
  const totalAcessos = dias.reduce((acc, d) => acc + d.valor, 0);
  const canvasRef = useChart({
    type: 'line',
    data: {
      labels: dias.map((d) => d.label),
      datasets: [{
        data: dias.map((d) => d.valor), borderColor: ROXO, backgroundColor: 'rgba(124,58,237,0.13)',
        fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 3, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: INTERACAO_EIXO,
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => `${ctx.parsed.y} acesso${ctx.parsed.y === 1 ? '' : 's'}` } },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: MUTED, font: { size: 10 }, maxTicksLimit: 6 } },
        y: { grid: { color: GRADE }, border: { display: false }, ticks: { color: MUTED, font: { size: 10 }, maxTicksLimit: 4, precision: 0 }, beginAtZero: true },
      },
    },
  });
  if (totalAcessos === 0) return <VazioCompacto>Nenhum acesso registrado no período.</VazioCompacto>;
  return <div style={{ position: 'relative', height: ALTURA_GRAFICO }}><canvas ref={canvasRef} /></div>;
}

export function FaturasPendentesWidget({ dados }) {
  if (!dados?.length) return <VazioCompacto acao={{ to: '/admin/faturas', label: 'Ver faturas' }}>Nenhuma fatura pendente.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {dados.slice(0, 5).map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: '0.8rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.profiles?.name || '—'}</div>
            <div style={{ color: MUTED, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</div>
          </div>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBRL(f.amount)}</span>
          <span style={{ color: MUTED, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 62, textAlign: 'right' }}>{formatDate(f.due_date)}</span>
        </div>
      ))}
    </div>
  );
}

export function AtividadesRecentesWidget({ dados }) {
  if (!dados?.length) return <VazioCompacto>Nenhuma atividade registrada ainda.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.slice(0, 6).map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1,
            background: `${a.cor}1f`, color: a.cor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          >
            <Icon name={a.icone} size={13} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{a.titulo}</span>
              <span style={{ color: MUTED, whiteSpace: 'nowrap', fontSize: '0.68rem', flexShrink: 0 }}>{formatDateTime(a.created_at)}</span>
            </div>
            {a.detalhe && <div style={{ fontSize: '0.74rem', color: MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalhe}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AcessosRecentesWidget({ dados }) {
  if (!dados?.length) return <VazioCompacto>Nenhum acesso registrado ainda.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {dados.slice(0, 5).map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.profiles?.name || 'Desconhecido'}</div>
            <div style={{ color: MUTED, fontSize: '0.72rem', marginTop: 1 }}>{a.action}{a.device ? ` · ${a.device}` : ''}</div>
          </div>
          <span style={{ color: MUTED, whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{formatDateTime(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

export function UsuariosRecentesWidget({ dados }) {
  if (!dados?.length) return <VazioCompacto acao={{ to: '/admin/usuarios', label: 'Ver usuários' }}>Nenhum usuário ainda.</VazioCompacto>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {dados.slice(0, 5).map((u) => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {u.role === 'admin' && <span className="admin-pill" style={{ background: 'rgba(124,58,237,0.14)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.28)' }}>admin</span>}
            <span style={{ color: MUTED, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// stopPropagation porque o card inteiro também é clicável — sem isso o
// clique no link dispararia as duas navegações.
function LinkRodape({ to, children }) {
  return (
    <Link to={to} className="admin-widget-link" onClick={(e) => e.stopPropagation()}>
      {children}
      <Icon name="arrowRight" size={12} />
    </Link>
  );
}

/** Escolhe qual widget renderizar e já passa a fatia certa de `dados` — um switch em vez de um objeto de componentes, só pra manter este arquivo só-exportando-componentes (fast refresh exige isso). */
export function WidgetConteudo({ tipo, dados }) {
  switch (tipo) {
    case 'receita-mensal':
      return <ReceitaMensalWidget dados={dados.receitaMensal} />;
    case 'propostas-status':
      return <PropostasStatusWidget dados={dados.propostasPorStatus} />;
    case 'sistemas-vendidos':
      return <SistemasVendidosWidget dados={dados.sistemasVendidos} />;
    case 'acessos-por-dia':
      return <AcessosPorDiaWidget dados={dados.acessosPorDia} />;
    case 'faturas-pendentes':
      return (
        <>
          <FaturasPendentesWidget dados={dados.faturasPendentes} />
          {dados.faturasPendentes?.length > 0 && <LinkRodape to="/admin/faturas">Ver todas</LinkRodape>}
        </>
      );
    case 'atividades-recentes':
      return <AtividadesRecentesWidget dados={dados.atividades} />;
    case 'acessos-recentes':
      return <AcessosRecentesWidget dados={dados.acessosRecentes} />;
    case 'usuarios-recentes':
      return (
        <>
          <UsuariosRecentesWidget dados={dados.usuariosRecentes} />
          {dados.usuariosRecentes?.length > 0 && <LinkRodape to="/admin/usuarios">Ver todos</LinkRodape>}
        </>
      );
    default:
      return null;
  }
}
