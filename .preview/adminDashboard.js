// Dublê do dashboard admin — dados fixos em memória, sem banco. As
// consultas reais em fetchDashboardData tocam 8 tabelas diferentes com
// joins (subscriptions/proposals/invoices/access_logs/profiles/
// proposal_events/invoice_events/systems); reproduzir isso na faker
// genérica de .preview/supabase.js não valeria a pena — mais fácil (e mais
// parecido com o que a Propostas já fez em .preview/proposals.js) devolver
// direto o formato que fetchDashboardData produziria depois de agregar
// tudo. WIDGET_CATALOG/DEFAULT_LAYOUT são reexportados do módulo real —
// são só dados estáticos, não tem por que duplicar.

import { WIDGET_CATALOG, DEFAULT_LAYOUT } from '../src/lib/adminDashboard.js';

export { WIDGET_CATALOG, DEFAULT_LAYOUT };

let layoutSalvo = null; // null = ainda não personalizou, usa o padrão

export async function fetchDashboardData() {
  return {
    kpis: {
      mrr: 4287.4,
      assinaturasAtivas: 9,
      propostasAbertas: 3,
      faturasPendentes: 4,
      acessos7d: 27,
    },
    receitaMensal: [
      { label: 'mar/26', valor: 3120 },
      { label: 'abr/26', valor: 3480 },
      { label: 'mai/26', valor: 3210 },
      { label: 'jun/26', valor: 3890 },
      { label: 'jul/26', valor: 4050 },
      { label: 'ago/26', valor: 4287.4 },
    ],
    propostasPorStatus: { rascunho: 2, enviada: 1, visualizada: 2, aceita: 5, recusada: 1, expirada: 0 },
    sistemasVendidos: [
      { slug: 'solucoes-contabeis', total: 5, sistema: { name: 'NoraHub', color: '#7C3AED' } },
      { slug: 'whatsapp-bot', total: 3, sistema: { name: 'NoraChat', color: '#25D366' } },
      { slug: 'noradocs', total: 1, sistema: { name: 'NoraDocs', color: '#7C3AED' } },
    ],
    faturasPendentes: [
      { id: 'fp-1', description: 'Mensalidade NoraHub — Agosto/2026', amount: 499.9, due_date: '2026-09-05', profiles: { name: 'Studio Fenix' } },
      { id: 'fp-2', description: 'Mensalidade NoraChat — Agosto/2026', amount: 299, due_date: '2026-09-05', profiles: { name: 'Grupo Aurora Contabilidade' } },
      { id: 'fp-3', description: 'Implantação NoraDocs', amount: 350, due_date: '2026-09-12', profiles: { name: 'Studio Fenix' } },
      { id: 'fp-4', description: 'Mensalidade NoraHub — Setembro/2026', amount: 499.9, due_date: '2026-09-30', profiles: { name: 'Grupo Aurora Contabilidade' } },
    ],
    atividades: [
      { id: 'at-1', created_at: new Date(Date.now() - 30 * 60000).toISOString(), texto: 'aceitou a proposta "Proposta NoraHub + NoraChat"' },
      { id: 'at-2', created_at: new Date(Date.now() - 3 * 3600000).toISOString(), texto: 'marcou como paga a fatura "Mensalidade NoraChat — Julho/2026"' },
      { id: 'at-3', created_at: new Date(Date.now() - 26 * 3600000).toISOString(), texto: 'enviou a proposta "Proposta NoraDocs"' },
      { id: 'at-4', created_at: new Date(Date.now() - 50 * 3600000).toISOString(), texto: 'cliente visualizou a proposta "Proposta NoraHub + NoraChat"' },
    ],
    acessosRecentes: [
      { id: 'ac-1', action: 'login', device: 'Chrome · macOS', status: 'success', created_at: new Date(Date.now() - 15 * 60000).toISOString(), profiles: { name: 'Admin NoraTech' } },
      { id: 'ac-2', action: 'login', device: 'Safari · iPhone', status: 'success', created_at: new Date(Date.now() - 5 * 3600000).toISOString(), profiles: { name: 'Studio Fenix' } },
      { id: 'ac-3', action: 'open_admin_user', device: 'Chrome · Windows', status: 'success', created_at: new Date(Date.now() - 8 * 3600000).toISOString(), profiles: { name: 'Admin NoraTech' } },
    ],
    usuariosRecentes: [
      { id: 'u-1', name: 'Studio Fenix', role: 'user', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'u-2', name: 'Grupo Aurora Contabilidade', role: 'user', created_at: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: 'u-3', name: 'Admin NoraTech', role: 'admin', created_at: new Date(Date.now() - 40 * 86400000).toISOString() },
    ],
  };
}

export async function carregarLayout() {
  return layoutSalvo || DEFAULT_LAYOUT;
}

// `userId` some no dublê (só existe um "usuário" aqui) — mantido na
// assinatura pra bater com a posição real de `salvarLayout(user.id, layout)`
// (a regra no-unused-vars só cobra argumentos DEPOIS do último usado).
export async function salvarLayout(userId, widgets) {
  layoutSalvo = widgets;
}
