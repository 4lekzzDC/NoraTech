// Dashboard "Visão geral" do Admin — catálogo de widgets, layout padrão e
// a única leva de dados que alimenta os 5 KPIs fixos do topo + os 8 tipos
// de widget configuráveis. Tudo buscado de uma vez em `fetchDashboardData`
// (um Promise.all só) porque os widgets não têm loading próprio — a tela
// mostra um Spinner só até essa leva inteira voltar, depois tudo já está
// pronto pra reordenar/redimensionar sem re-buscar nada.
//
// Layout (quais widgets aparecem, em que ordem, em que tamanho) é
// persistido em `profiles.dashboard_layout` (migration_20260829d) — RLS já
// deixa cada usuário escrever a própria linha, então é update direto,
// sem RPC.
//
// Tendência dos KPIs ("↗ 12% vs. período anterior"): só existe pra quem dá
// pra reconstruir honestamente do schema atual — assinaturas ativas e MRR
// usam `started_at`/`canceled_at` das subscriptions pra saber quem estava
// ativo no início do período (mesma amount de hoje, já que não existe
// histórico de preço); acessos é contagem direta de `access_logs`. Propostas
// em aberto e faturas pendentes são fotos do AGORA (status atual, sem log de
// transição point-in-time pra propostas/faturas replayável de forma
// confiável) — em vez de inventar uma % contra um "antes" que não dá pra
// saber de verdade, mostram um número de fluxo do período (criadas/
// emitidas) como pista secundária.

import { supabase } from './supabase';
import { fetchSystems } from './systems';

// `tone: 'primary'` = bloco de destaque (superfície um pouco mais clara,
// título maior). Só a Receita/MRR nasce assim — é a métrica que manda no
// painel; o resto é leitura de apoio.
export const WIDGET_CATALOG = {
  'receita-mensal': { title: 'Receita mensal', icon: 'trending', tone: 'primary', defaultSize: 'wide', desc: 'Faturas pagas, mês a mês.' },
  'propostas-status': { title: 'Propostas por status', icon: 'pie', defaultSize: 'md', desc: 'Quantas propostas em cada etapa.' },
  'sistemas-vendidos': { title: 'Sistemas mais vendidos', icon: 'layers', defaultSize: 'md', desc: 'Assinaturas ativas por sistema.' },
  'acessos-por-dia': { title: 'Acessos por dia', icon: 'bars', defaultSize: 'md', desc: 'Logins no período, dia a dia.' },
  'faturas-pendentes': { title: 'Faturas pendentes', icon: 'card', defaultSize: 'lg', desc: 'Aguardando pagamento, por vencimento.' },
  'atividades-recentes': { title: 'Atividades recentes', icon: 'clock', defaultSize: 'lg', desc: 'Últimos eventos de propostas, faturas e assinaturas.' },
  'acessos-recentes': { title: 'Acessos recentes', icon: 'shield', defaultSize: 'lg', desc: 'Últimos logins e ações no Admin.' },
  'usuarios-recentes': { title: 'Usuários recentes', icon: 'userPlus', defaultSize: 'lg', desc: 'Últimos cadastros na plataforma.' },
};

// Colunas de uma grade de 12. "Largo" ocupa a linha inteira; o padrão abaixo
// usa só md/lg/wide, o que dá as 2–3 colunas por linha. "Pequeno" existe pra
// quem quiser empilhar 4 blocos numa linha só.
export const TAMANHOS = [
  { valor: 'sm', label: 'Pequeno', span: 3 },
  { valor: 'md', label: 'Médio', span: 4 },
  { valor: 'lg', label: 'Grande', span: 6 },
  { valor: 'wide', label: 'Largo', span: 12 },
];

export const SPAN_POR_TAMANHO = Object.fromEntries(TAMANHOS.map((t) => [t.valor, t.span]));

export const DEFAULT_LAYOUT = [
  { id: 'receita-mensal', size: 'wide' },
  { id: 'propostas-status', size: 'md' },
  { id: 'sistemas-vendidos', size: 'md' },
  { id: 'acessos-por-dia', size: 'md' },
  { id: 'faturas-pendentes', size: 'lg' },
  { id: 'atividades-recentes', size: 'lg' },
  { id: 'acessos-recentes', size: 'lg' },
  { id: 'usuarios-recentes', size: 'lg' },
];

export const PERIODOS = [
  { dias: 7, label: 'Últimos 7 dias' },
  { dias: 30, label: 'Últimos 30 dias' },
  { dias: 90, label: 'Últimos 90 dias' },
];

export async function carregarLayout(userId) {
  const { data, error } = await supabase.from('profiles').select('dashboard_layout').eq('id', userId).maybeSingle();
  if (error || !data?.dashboard_layout?.widgets) return DEFAULT_LAYOUT;
  // Filtra qualquer id de widget que não exista mais no catálogo (ex.: uma versão antiga salvou algo removido depois).
  return data.dashboard_layout.widgets.filter((w) => WIDGET_CATALOG[w.id]);
}

export async function salvarLayout(userId, widgets) {
  const { error } = await supabase.from('profiles').update({ dashboard_layout: { widgets } }).eq('id', userId);
  if (error) throw new Error(error.message);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function ultimosNMeses(n) {
  const hoje = new Date();
  const meses = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
  }
  return meses;
}

function ultimosNDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    dias.push({ chave: d.toISOString().slice(0, 10), label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  return dias;
}

function mrrDoConjunto(lista) {
  return lista.reduce((acc, s) => {
    const amount = Number(s.amount) || 0;
    if (s.billing_cycle === 'yearly') return acc + amount / 12;
    if (s.billing_cycle === 'one_time') return acc;
    return acc + amount;
  }, 0);
}

/** Quem estava ativo numa data passada, reconstruído de started_at/canceled_at — não existe histórico de status, então isso é o mais preciso que dá pra saber. */
function ativosEmData(subs, data) {
  return subs.filter((s) => new Date(s.started_at) <= data && (!s.canceled_at || new Date(s.canceled_at) > data));
}

function variacaoPct(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

export async function fetchDashboardData(periodoDias = 30) {
  const agora = new Date();
  const inicioAtual = new Date(agora.getTime() - periodoDias * 86400000);
  const inicioAnterior = new Date(agora.getTime() - 2 * periodoDias * 86400000);
  const seisMesesAtras = new Date(Date.now() - 6 * 30 * 86400000).toISOString();

  const [
    subsRes, proposalsRes, invoicesPendentesRes, loginsPeriodoRes,
    invoicesPagasRes, acessosRecentesRes, usuariosRecentesRes,
    proposalEventsRes, invoiceEventsRes, systemsList,
  ] = await Promise.all([
    supabase.from('subscriptions').select('amount, billing_cycle, status, system_slug, started_at, canceled_at'),
    supabase.from('proposals').select('status, created_at').is('superseded_by', null),
    supabase.from('invoices').select('id, description, amount, due_date, user_id, profiles:user_id(name)').eq('status', 'pending').order('due_date', { ascending: true }).limit(8),
    supabase.from('access_logs').select('created_at').eq('action', 'login').gte('created_at', inicioAnterior.toISOString()),
    supabase.from('invoices').select('amount, paid_at').eq('status', 'paid').gte('paid_at', seisMesesAtras),
    supabase.from('access_logs').select('id, action, device, status, created_at, profiles:user_id(name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('id, name, role, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('proposal_events').select('id, event_type, created_at, proposals:proposal_id(title)').order('created_at', { ascending: false }).limit(12),
    supabase.from('invoice_events').select('id, event_type, created_at, invoices:invoice_id(description)').order('created_at', { ascending: false }).limit(12),
    fetchSystems().catch(() => []),
  ]);

  const subsTodas = subsRes.data || [];
  const subsAtivas = subsTodas.filter((s) => s.status === 'active');
  const mrr = mrrDoConjunto(subsAtivas);

  const ativasInicioAtual = ativosEmData(subsTodas, inicioAtual);
  const trendAssinaturas = variacaoPct(subsAtivas.length, ativasInicioAtual.length);
  const trendMrr = variacaoPct(mrr, mrrDoConjunto(ativasInicioAtual));

  const proposals = proposalsRes.data || [];
  const propostasAbertas = proposals.filter((p) => !['aceita', 'recusada', 'expirada'].includes(p.status)).length;
  const propostasCriadasPeriodo = proposals.filter((p) => new Date(p.created_at) >= inicioAtual).length;
  const propostasPorStatus = proposals.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const sistemaPorSlug = Object.fromEntries((systemsList || []).map((s) => [s.slug, s]));
  const sistemasContagem = subsAtivas.reduce((acc, s) => {
    if (!s.system_slug) return acc;
    acc[s.system_slug] = (acc[s.system_slug] || 0) + 1;
    return acc;
  }, {});
  const sistemasVendidos = Object.entries(sistemasContagem)
    .map(([slug, total]) => ({ slug, total, sistema: sistemaPorSlug[slug] }))
    .sort((a, b) => b.total - a.total);

  const meses = ultimosNMeses(6);
  const receitaPorMes = Object.fromEntries(meses.map((m) => [m.chave, 0]));
  (invoicesPagasRes.data || []).forEach((inv) => {
    if (!inv.paid_at) return;
    const d = new Date(inv.paid_at);
    const chave = `${d.getFullYear()}-${d.getMonth()}`;
    if (chave in receitaPorMes) receitaPorMes[chave] += Number(inv.amount) || 0;
  });
  const receitaMensal = meses.map((m) => ({ label: m.label, valor: receitaPorMes[m.chave] }));

  const logins = loginsPeriodoRes.data || [];
  const loginsAtual = logins.filter((l) => new Date(l.created_at) >= inicioAtual).length;
  const loginsAnterior = logins.filter((l) => new Date(l.created_at) < inicioAtual).length;
  const trendAcessos = variacaoPct(loginsAtual, loginsAnterior);

  const dias = ultimosNDias(periodoDias);
  const loginsPorDia = Object.fromEntries(dias.map((d) => [d.chave, 0]));
  logins.forEach((l) => {
    const chave = new Date(l.created_at).toISOString().slice(0, 10);
    if (chave in loginsPorDia) loginsPorDia[chave] += 1;
  });
  const acessosPorDia = dias.map((d) => ({ label: d.label, valor: loginsPorDia[d.chave] }));

  const PROPOSTA_EVENTO = {
    criada: { label: 'Nova proposta criada', icone: 'file', cor: '#a78bfa' },
    editada: { label: 'Proposta editada', icone: 'pencil', cor: 'rgba(255,255,255,0.5)' },
    nova_versao: { label: 'Nova versão de proposta', icone: 'refresh', cor: '#a78bfa' },
    enviada: { label: 'Proposta enviada', icone: 'send', cor: '#60a5fa' },
    visualizada: { label: 'Proposta visualizada', icone: 'eye', cor: '#f0b429' },
    aceita: { label: 'Proposta aprovada', icone: 'check', cor: '#00d48a' },
    recusada: { label: 'Proposta recusada', icone: 'xCircle', cor: '#ff6b6b' },
    expirada: { label: 'Proposta expirada', icone: 'clock', cor: 'rgba(255,255,255,0.5)' },
    envio_falhou: { label: 'Falha no envio', icone: 'alert', cor: '#ff6b6b' },
    reenviada: { label: 'Proposta reenviada', icone: 'refresh', cor: '#60a5fa' },
  };
  const FATURA_EVENTO = {
    created_system: { label: 'Fatura emitida', icone: 'card', cor: '#a78bfa' },
    created_manual: { label: 'Fatura criada', icone: 'card', cor: '#a78bfa' },
    recobranca: { label: 'Cobrança reenviada', icone: 'refresh', cor: '#60a5fa' },
    desconto: { label: 'Desconto aplicado', icone: 'dollar', cor: '#f0b429' },
    juros: { label: 'Juros aplicados', icone: 'dollar', cor: '#ff8a3d' },
    ajuste_valor: { label: 'Valor ajustado', icone: 'dollar', cor: '#f0b429' },
    baixa_manual: { label: 'Baixa manual', icone: 'check', cor: '#00d48a' },
    marcado_pago: { label: 'Fatura paga', icone: 'check', cor: '#00d48a' },
    nota: { label: 'Nota adicionada', icone: 'note', cor: 'rgba(255,255,255,0.5)' },
  };

  const atividades = [
    ...(proposalEventsRes.data || []).map((ev) => {
      const meta = PROPOSTA_EVENTO[ev.event_type] || { label: ev.event_type, icone: 'file', cor: '#a78bfa' };
      return {
        id: `proposta-${ev.id}`, created_at: ev.created_at, icone: meta.icone, cor: meta.cor,
        titulo: meta.label, detalhe: `"${ev.proposals?.title || 'sem título'}"`,
      };
    }),
    ...(invoiceEventsRes.data || []).map((ev) => {
      const meta = FATURA_EVENTO[ev.event_type] || { label: ev.event_type, icone: 'card', cor: '#a78bfa' };
      return {
        id: `fatura-${ev.id}`, created_at: ev.created_at, icone: meta.icone, cor: meta.cor,
        titulo: meta.label, detalhe: `"${ev.invoices?.description || 'sem descrição'}"`,
      };
    }),
    ...subsTodas.filter((s) => s.started_at && new Date(s.started_at) >= inicioAnterior).map((s, i) => ({
      id: `assinatura-${s.system_slug}-${s.started_at}-${i}`, created_at: s.started_at, icone: 'zap', cor: '#00d48a',
      titulo: 'Assinatura ativada', detalhe: sistemaPorSlug[s.system_slug]?.name || s.system_slug || '—',
    })),
    ...(usuariosRecentesRes.data || []).filter((u) => new Date(u.created_at) >= inicioAnterior).map((u) => ({
      id: `usuario-${u.id}`, created_at: u.created_at, icone: 'userPlus', cor: '#60a5fa',
      titulo: 'Novo usuário cadastrado', detalhe: u.name || '—',
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  return {
    kpis: {
      mrr, trendMrr,
      assinaturasAtivas: subsAtivas.length, trendAssinaturas,
      propostasAbertas, propostasCriadasPeriodo,
      faturasPendentes: (invoicesPendentesRes.data || []).length,
      faturasPendentesValor: (invoicesPendentesRes.data || []).reduce((acc, f) => acc + (Number(f.amount) || 0), 0),
      acessosPeriodo: loginsAtual, trendAcessos,
    },
    receitaMensal,
    propostasPorStatus,
    sistemasVendidos,
    acessosPorDia,
    faturasPendentes: invoicesPendentesRes.data || [],
    atividades,
    acessosRecentes: acessosRecentesRes.data || [],
    usuariosRecentes: usuariosRecentesRes.data || [],
  };
}

const BRL_COMPACTO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Uma linha curta no cabeçalho do widget, à direita do título — o número que
 * o gráfico/lista não diz sozinho (total da janela, média, soma em aberto).
 * Serve à densidade: informação a mais sem ocupar linha a mais.
 */
export function resumoDoWidget(tipo, dados) {
  if (!dados) return null;
  switch (tipo) {
    case 'receita-mensal': {
      const total = (dados.receitaMensal || []).reduce((acc, m) => acc + m.valor, 0);
      return total > 0 ? `${BRL_COMPACTO.format(total)} em 6 meses` : null;
    }
    case 'acessos-por-dia': {
      const dias = dados.acessosPorDia || [];
      if (!dias.length) return null;
      const media = dias.reduce((acc, d) => acc + d.valor, 0) / dias.length;
      return media > 0 ? `${media.toFixed(1)}/dia em média` : null;
    }
    case 'sistemas-vendidos': {
      const total = (dados.sistemasVendidos || []).reduce((acc, s) => acc + s.total, 0);
      return total > 0 ? `${total} assinaturas` : null;
    }
    case 'faturas-pendentes':
      return dados.kpis?.faturasPendentesValor > 0 ? `${BRL_COMPACTO.format(dados.kpis.faturasPendentesValor)} em aberto` : null;
    default:
      return null;
  }
}
