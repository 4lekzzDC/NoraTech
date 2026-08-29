// Os 7 tipos de widget do dashboard "Visão geral" + o wrapper comum
// (WidgetShell) que dá a cada um o mesmo cabeçalho, o mesmo controle de
// tamanho/remoção no modo "Personalizar" e a mesma moldura de Card. Cada
// widget só recebe a fatia de dados que precisa — quem busca tudo é
// `fetchDashboardData` em lib/adminDashboard.js, uma vez só.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { Card, EmptyState, StatusPill } from './AdminLayout';
import { formatBRL, formatDate, formatDateTime } from '../lib/admin';
import { WIDGET_CATALOG } from '../lib/adminDashboard';

Chart.register(...registerables);

const ROXO = '#7C3AED';
const GRADE_ESCURA = 'rgba(255,255,255,0.06)';
const TEXTO_MUTED = 'rgba(255,255,255,0.5)';

const TAMANHOS = [
  { valor: 'sm', label: 'P' },
  { valor: 'md', label: 'M' },
  { valor: 'lg', label: 'G' },
];

export function WidgetShell({
  tipo, tamanho, editando, arrastando, onTamanho, onRemover,
  onHandleDragStart, onHandleDragEnd, onContainerDragOver, onContainerDrop, children,
}) {
  const meta = WIDGET_CATALOG[tipo];
  if (!meta) return null;
  return (
    <Card
      onDragOver={editando ? onContainerDragOver : undefined}
      onDrop={editando ? onContainerDrop : undefined}
      style={{
        padding: 0, display: 'flex', flexDirection: 'column', height: '100%',
        opacity: arrastando ? 0.4 : 1,
        borderColor: editando ? 'rgba(124,58,237,0.25)' : undefined,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {editando && (
            <span
              draggable
              onDragStart={onHandleDragStart}
              onDragEnd={onHandleDragEnd}
              title="Arraste para reordenar"
              style={{ cursor: 'grab', color: 'rgba(255,255,255,0.35)', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
            >
              ⠿
            </span>
          )}
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{meta.icon}</span>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.title}</h3>
        </div>
        {editando && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {TAMANHOS.map((t) => (
              <button
                key={t.valor} type="button" onClick={() => onTamanho(t.valor)}
                title={t.valor === 'sm' ? 'Pequeno' : t.valor === 'md' ? 'Médio' : 'Grande'}
                style={{
                  width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                  background: tamanho === t.valor ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: tamanho === t.valor ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.6rem', fontWeight: 800, lineHeight: 1,
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button" onClick={onRemover} aria-label={`Remover ${meta.title}`}
              style={{ background: 'none', border: 'none', color: 'rgba(255,107,107,0.75)', cursor: 'pointer', fontSize: '1.05rem', marginLeft: 2, padding: 2, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
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
  const temDados = (dados || []).some((d) => d.valor > 0);
  const canvasRef = useChart({
    type: 'bar',
    data: {
      labels: (dados || []).map((d) => d.label),
      datasets: [{ data: (dados || []).map((d) => d.valor), backgroundColor: ROXO, borderRadius: 6, maxBarThickness: 40 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatBRL(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: TEXTO_MUTED, font: { size: 11 } } },
        y: { grid: { color: GRADE_ESCURA }, ticks: { color: TEXTO_MUTED, font: { size: 11 }, callback: (v) => formatBRL(v) } },
      },
    },
  });
  if (!temDados) return <EmptyState>Nenhuma fatura paga nos últimos 6 meses.</EmptyState>;
  return <div style={{ position: 'relative', flex: 1, minHeight: 200 }}><canvas ref={canvasRef} /></div>;
}

const STATUS_LABEL = { rascunho: 'Rascunho', enviada: 'Enviada', visualizada: 'Visualizada', aceita: 'Aceita', recusada: 'Recusada', expirada: 'Expirada' };
const STATUS_COR = { rascunho: '#bbbbbb', enviada: '#60a5fa', visualizada: '#f0b429', aceita: '#00d48a', recusada: '#ff6b6b', expirada: 'rgba(255,255,255,0.35)' };

export function PropostasStatusWidget({ dados }) {
  const entradas = Object.entries(dados || {}).filter(([, v]) => v > 0);
  const canvasRef = useChart({
    type: 'bar',
    data: {
      labels: entradas.map(([s]) => STATUS_LABEL[s] || s),
      datasets: [{ data: entradas.map(([, v]) => v), backgroundColor: entradas.map(([s]) => STATUS_COR[s] || ROXO), borderRadius: 6, maxBarThickness: 22 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRADE_ESCURA }, ticks: { color: TEXTO_MUTED, font: { size: 11 }, stepSize: 1, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: TEXTO_MUTED, font: { size: 11 } } },
      },
    },
  });
  if (entradas.length === 0) return <EmptyState>Nenhuma proposta ainda.</EmptyState>;
  return <div style={{ position: 'relative', flex: 1, minHeight: 180 }}><canvas ref={canvasRef} /></div>;
}

export function SistemasVendidosWidget({ dados }) {
  const lista = (dados || []).slice(0, 6);
  const canvasRef = useChart({
    type: 'bar',
    data: {
      labels: lista.map((d) => d.sistema?.name || d.slug),
      datasets: [{ data: lista.map((d) => d.total), backgroundColor: lista.map((d) => d.sistema?.color || ROXO), borderRadius: 6, maxBarThickness: 22 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRADE_ESCURA }, ticks: { color: TEXTO_MUTED, font: { size: 11 }, stepSize: 1, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: TEXTO_MUTED, font: { size: 11 } } },
      },
    },
  });
  if (lista.length === 0) return <EmptyState>Nenhuma assinatura ativa ainda.</EmptyState>;
  return <div style={{ position: 'relative', flex: 1, minHeight: 180 }}><canvas ref={canvasRef} /></div>;
}

export function FaturasPendentesWidget({ dados }) {
  if (!dados?.length) return <EmptyState>Nenhuma fatura pendente. 🎉</EmptyState>;
  return (
    <div style={{ overflowX: 'auto', margin: '-16px' }}>
      <table className="admin-table">
        <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vence</th></tr></thead>
        <tbody>
          {dados.map((f) => (
            <tr key={f.id}>
              <td>{f.profiles?.name || '—'}</td>
              <td>{f.description}</td>
              <td>{formatBRL(f.amount)}</td>
              <td>{formatDate(f.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AtividadesRecentesWidget({ dados }) {
  if (!dados?.length) return <EmptyState>Nenhuma atividade registrada ainda.</EmptyState>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.map((a) => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{a.texto}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{formatDateTime(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

export function AcessosRecentesWidget({ dados }) {
  if (!dados?.length) return <EmptyState>Nenhum acesso registrado ainda.</EmptyState>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.profiles?.name || 'Desconhecido'}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: 1 }}>{a.action}{a.device ? ` · ${a.device}` : ''}</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{formatDateTime(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

export function UsuariosRecentesWidget({ dados }) {
  if (!dados?.length) return <EmptyState>Nenhum usuário ainda.</EmptyState>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.map((u) => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {u.role === 'admin' && <span className="admin-pill" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.3)' }}>admin</span>}
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
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
    case 'faturas-pendentes':
      return (
        <>
          <FaturasPendentesWidget dados={dados.faturasPendentes} />
          <Link to="/admin/faturas" style={{ fontSize: '0.78rem', color: ROXO, textDecoration: 'none', fontWeight: 600, marginTop: 12, alignSelf: 'flex-start' }}>Ver todas →</Link>
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
          <Link to="/admin/usuarios" style={{ fontSize: '0.78rem', color: ROXO, textDecoration: 'none', fontWeight: 600, marginTop: 12, alignSelf: 'flex-start' }}>Ver todos →</Link>
        </>
      );
    default:
      return null;
  }
}
