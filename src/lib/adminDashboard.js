// Dashboard "Visão geral" do Admin — catálogo de widgets, layout padrão e
// a única leva de dados que alimenta os 5 KPIs fixos do topo + os 7 tipos
// de widget configuráveis. Tudo buscado de uma vez em `fetchDashboardData`
// (um Promise.all só) porque os widgets não têm loading próprio — a tela
// mostra um Spinner só até essa leva inteira voltar, depois tudo já está
// pronto pra reordenar/redimensionar sem re-buscar nada.
//
// Layout (quais widgets aparecem, em que ordem, em que tamanho) é
// persistido em `profiles.dashboard_layout` (migration_20260829d) — RLS já
// deixa cada usuário escrever a própria linha, então é update direto,
// sem RPC.

import { supabase } from './supabase';
import { fetchSystems } from './systems';

export const WIDGET_CATALOG = {
  'receita-mensal': { title: 'Receita mensal', icon: '📈', defaultSize: 'lg', desc: 'Faturas pagas, mês a mês.' },
  'propostas-status': { title: 'Propostas por status', icon: '📄', defaultSize: 'md', desc: 'Quantas propostas em cada etapa.' },
  'sistemas-vendidos': { title: 'Sistemas mais vendidos', icon: '🧩', defaultSize: 'md', desc: 'Assinaturas ativas por sistema.' },
  'faturas-pendentes': { title: 'Faturas pendentes', icon: '💸', defaultSize: 'lg', desc: 'Aguardando pagamento, por vencimento.' },
  'atividades-recentes': { title: 'Atividades recentes', icon: '🕐', defaultSize: 'md', desc: 'Últimos eventos de propostas e faturas.' },
  'acessos-recentes': { title: 'Acessos recentes', icon: '🔐', defaultSize: 'md', desc: 'Últimos logins e ações no Admin.' },
  'usuarios-recentes': { title: 'Usuários recentes', icon: '👥', defaultSize: 'md', desc: 'Últimos cadastros na plataforma.' },
};

export const DEFAULT_LAYOUT = [
  { id: 'receita-mensal', size: 'lg' },
  { id: 'propostas-status', size: 'md' },
  { id: 'sistemas-vendidos', size: 'md' },
  { id: 'faturas-pendentes', size: 'lg' },
  { id: 'atividades-recentes', size: 'md' },
  { id: 'acessos-recentes', size: 'md' },
  { id: 'usuarios-recentes', size: 'md' },
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

export async function fetchDashboardData() {
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString();
  const seisMesesAtras = new Date(Date.now() - 6 * 30 * 86400000).toISOString();

  const [
    subsRes, proposalsRes, invoicesPendentesRes, loginsRes,
    invoicesPagasRes, acessosRecentesRes, usuariosRecentesRes,
    proposalEventsRes, invoiceEventsRes, systemsList,
  ] = await Promise.all([
    supabase.from('subscriptions').select('amount, billing_cycle, status, system_slug').eq('status', 'active'),
    supabase.from('proposals').select('status').is('superseded_by', null),
    supabase.from('invoices').select('id, description, amount, due_date, user_id, profiles:user_id(name)').eq('status', 'pending').order('due_date', { ascending: true }).limit(8),
    supabase.from('access_logs').select('id', { count: 'exact', head: true }).eq('action', 'login').gte('created_at', seteDiasAtras),
    supabase.from('invoices').select('amount, paid_at').eq('status', 'paid').gte('paid_at', seisMesesAtras),
    supabase.from('access_logs').select('id, action, device, status, created_at, profiles:user_id(name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('id, name, role, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('proposal_events').select('id, event_type, created_at, proposals:proposal_id(title)').order('created_at', { ascending: false }).limit(8),
    supabase.from('invoice_events').select('id, event_type, created_at, invoices:invoice_id(description)').order('created_at', { ascending: false }).limit(8),
    fetchSystems().catch(() => []),
  ]);

  const subs = subsRes.data || [];
  const mrr = subs.reduce((acc, s) => {
    const amount = Number(s.amount) || 0;
    if (s.billing_cycle === 'yearly') return acc + amount / 12;
    if (s.billing_cycle === 'one_time') return acc;
    return acc + amount;
  }, 0);

  const proposals = proposalsRes.data || [];
  const propostasAbertas = proposals.filter((p) => !['aceita', 'recusada', 'expirada'].includes(p.status)).length;
  const propostasPorStatus = proposals.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const sistemaPorSlug = Object.fromEntries((systemsList || []).map((s) => [s.slug, s]));
  const sistemasContagem = subs.reduce((acc, s) => {
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

  const PROPOSTA_EVENTO_LABEL = {
    criada: 'criou', editada: 'editou', nova_versao: 'criou nova versão de',
    enviada: 'enviou', visualizada: 'cliente visualizou', aceita: 'aceitou',
    recusada: 'recusou', expirada: 'expirou', envio_falhou: 'falhou ao enviar', reenviada: 'reenviou',
  };
  const FATURA_EVENTO_LABEL = {
    created_system: 'gerou automaticamente', created_manual: 'criou manualmente', recobranca: 'reenviou cobrança de',
    desconto: 'aplicou desconto em', juros: 'aplicou juros em', ajuste_valor: 'ajustou valor de',
    baixa_manual: 'deu baixa manual em', marcado_pago: 'marcou como paga', nota: 'anotou em',
  };

  const atividades = [
    ...(proposalEventsRes.data || []).map((ev) => ({
      id: `proposta-${ev.id}`, created_at: ev.created_at,
      texto: `${PROPOSTA_EVENTO_LABEL[ev.event_type] || ev.event_type} a proposta "${ev.proposals?.title || 'sem título'}"`,
    })),
    ...(invoiceEventsRes.data || []).map((ev) => ({
      id: `fatura-${ev.id}`, created_at: ev.created_at,
      texto: `${FATURA_EVENTO_LABEL[ev.event_type] || ev.event_type} a fatura "${ev.invoices?.description || 'sem descrição'}"`,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  return {
    kpis: {
      mrr,
      assinaturasAtivas: subs.length,
      propostasAbertas,
      faturasPendentes: (invoicesPendentesRes.data || []).length,
      acessos7d: loginsRes.count || 0,
    },
    receitaMensal,
    propostasPorStatus,
    sistemasVendidos,
    faturasPendentes: invoicesPendentesRes.data || [],
    atividades,
    acessosRecentes: acessosRecentesRes.data || [],
    usuariosRecentes: usuariosRecentesRes.data || [],
  };
}
