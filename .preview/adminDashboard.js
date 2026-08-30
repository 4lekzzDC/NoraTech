// Dublê do dashboard admin — dados fixos em memória, sem banco. As
// consultas reais em fetchDashboardData tocam 8 tabelas diferentes com
// joins (subscriptions/proposals/invoices/access_logs/profiles/
// proposal_events/invoice_events/systems); reproduzir isso na faker
// genérica de .preview/supabase.js não valeria a pena — mais fácil (e mais
// parecido com o que a Propostas já fez em .preview/proposals.js) devolver
// direto o formato que fetchDashboardData produziria depois de agregar
// tudo. WIDGET_CATALOG/DEFAULT_LAYOUT/PERIODOS são reexportados do módulo
// real — são só dados estáticos, não tem por que duplicar.

import {
  WIDGET_CATALOG, DEFAULT_LAYOUT, PERIODOS, PERIODO_PADRAO, TAMANHOS, SPAN_POR_TAMANHO, resumoDoWidget,
} from '../src/lib/adminDashboard.js';

export {
  WIDGET_CATALOG, DEFAULT_LAYOUT, PERIODOS, PERIODO_PADRAO, TAMANHOS, SPAN_POR_TAMANHO, resumoDoWidget,
};

// sessionStorage em vez de uma variável de módulo: um reload da preview
// zera o módulo, e sem isso não daria pra verificar que as preferências
// sobrevivem — que é justamente o comportamento a testar. No app real quem
// guarda é profiles.dashboard_layout.
const CHAVE_PREFS = 'preview:dashboard-prefs';

function lerPrefs() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_PREFS) || 'null');
  } catch {
    return null;
  }
}

// ?dados=vazio na preview devolve uma conta recém-criada (sem histórico) —
// é o único jeito de olhar os estados compactos dos gráficos, que na conta
// cheia nunca aparecem.
const VAZIO = new URLSearchParams(location.search).get('dados') === 'vazio';

function ultimosNDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    dias.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, valor: Math.round(15 + Math.random() * 25) });
  }
  return dias;
}

// `periodoDias` afeta só os campos que o real recalcula por período
// (acessos, tendências) — o resto do dublê fica fixo, é o bastante pra
// exercitar o seletor de período sem duplicar toda a lógica real.
export async function fetchDashboardData(periodoDias = 30) {
  if (VAZIO) {
    return {
      kpis: {
        mrr: 0, trendMrr: null,
        assinaturasAtivas: 0, trendAssinaturas: null,
        propostasAbertas: 0, propostasCriadasPeriodo: 0,
        faturasPendentes: 0, faturasPendentesValor: 0,
        acessosPeriodo: 2, trendAcessos: null,
      },
      receitaMensal: [
        { label: 'mar/26', valor: 0 }, { label: 'abr/26', valor: 0 }, { label: 'mai/26', valor: 0 },
        { label: 'jun/26', valor: 0 }, { label: 'jul/26', valor: 0 }, { label: 'ago/26', valor: 890 },
      ],
      propostasPorStatus: {},
      sistemasVendidos: [],
      acessosPorDia: ultimosNDias(periodoDias).map((d) => ({ ...d, valor: 0 })),
      faturasPendentes: [],
      atividades: [],
      acessosRecentes: [],
      usuariosRecentes: [],
    };
  }
  return {
    kpis: {
      mrr: 4287.4, trendMrr: 12.4,
      assinaturasAtivas: 9, trendAssinaturas: 8.7,
      propostasAbertas: 3, propostasCriadasPeriodo: 2,
      faturasPendentes: 4, faturasPendentesValor: 1648.8,
      acessosPeriodo: periodoDias === 7 ? 9 : periodoDias === 90 ? 68 : 27, trendAcessos: 15.3,
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
      { slug: 'solucoes-contabeis', total: 5, sistema: { name: 'NoraHub', color: '#7C3AED', icon: '📊' } },
      { slug: 'whatsapp-bot', total: 3, sistema: { name: 'NoraChat', color: '#25D366', icon: '💬' } },
      { slug: 'noradocs', total: 1, sistema: { name: 'NoraDocs', color: '#7C3AED', icon: '🗂️' } },
    ],
    acessosPorDia: ultimosNDias(periodoDias),
    faturasPendentes: [
      { id: 'fp-1', description: 'Mensalidade NoraHub — Agosto/2026', amount: 499.9, due_date: '2026-09-05', profiles: { name: 'Studio Fenix' } },
      { id: 'fp-2', description: 'Mensalidade NoraChat — Agosto/2026', amount: 299, due_date: '2026-09-05', profiles: { name: 'Grupo Aurora Contabilidade' } },
      { id: 'fp-3', description: 'Implantação NoraDocs', amount: 350, due_date: '2026-09-12', profiles: { name: 'Studio Fenix' } },
      { id: 'fp-4', description: 'Mensalidade NoraHub — Setembro/2026', amount: 499.9, due_date: '2026-09-30', profiles: { name: 'Grupo Aurora Contabilidade' } },
    ],
    atividades: [
      { id: 'at-1', created_at: new Date(Date.now() - 30 * 60000).toISOString(), icone: 'check', cor: '#00d48a', titulo: 'Proposta aprovada', detalhe: '"Proposta NoraHub + NoraChat"' },
      { id: 'at-2', created_at: new Date(Date.now() - 3 * 3600000).toISOString(), icone: 'check', cor: '#00d48a', titulo: 'Fatura paga', detalhe: '"Mensalidade NoraChat — Julho/2026"' },
      { id: 'at-3', created_at: new Date(Date.now() - 8 * 3600000).toISOString(), icone: 'zap', cor: '#00d48a', titulo: 'Assinatura ativada', detalhe: 'NoraDocs' },
      { id: 'at-4', created_at: new Date(Date.now() - 26 * 3600000).toISOString(), icone: 'send', cor: '#60a5fa', titulo: 'Proposta enviada', detalhe: '"Proposta NoraDocs"' },
      { id: 'at-5', created_at: new Date(Date.now() - 50 * 3600000).toISOString(), icone: 'eye', cor: '#f0b429', titulo: 'Proposta visualizada', detalhe: '"Proposta NoraHub + NoraChat"' },
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

export async function carregarPreferencias() {
  return lerPrefs() || { widgets: DEFAULT_LAYOUT, periodo: PERIODO_PADRAO };
}

// `userId` some no dublê (só existe um "usuário" aqui) — mantido na
// assinatura pra bater com a posição real de `salvarPreferencias(user.id, prefs)`
// (a regra no-unused-vars só cobra argumentos DEPOIS do último usado).
export async function salvarPreferencias(userId, prefs) {
  sessionStorage.setItem(CHAVE_PREFS, JSON.stringify(prefs));
}
