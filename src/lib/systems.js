// Catálogo de sistemas oferecidos. O `slug` é a chave usada em
// subscriptions.system_slug para vincular uma assinatura a um sistema.
// `aliases` cobre slugs legados após renomeações: getSystem(alias) também resolve.
//
// A tabela `systems` no Supabase é a fonte de verdade para nome, logo,
// descrição e valor padrão (editáveis em /admin/sistemas). O catálogo estático
// abaixo continua mandando em `internal` e na rota dos sistemas internos —
// o roteamento e o gate de assinatura dependem do slug em código.

import { supabase } from './supabase';
import {
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  SOLUCOES_CONTABEIS_NAME,
} from '../modules/solucoes-contabeis';
import {
  NORADOCS_SLUG,
  NORADOCS_NAME,
  NORADOCS_ROUTE,
} from '../modules/noradocs';

export const SYSTEM_LOGOS_BUCKET = 'system-logos';

export const SYSTEMS = [
  {
    slug: 'whatsapp-bot',
    name: 'WhatsApp Bot',
    icon: '💬',
    color: '#25D366',
    description: 'Atendimento automatizado, triagem por intenção e transferência fluida para humanos.',
    url: 'https://falahub.noratech.com.br',
  },
  {
    slug: SOLUCOES_CONTABEIS_SLUG,
    aliases: SOLUCOES_CONTABEIS_LEGACY_SLUGS,
    name: SOLUCOES_CONTABEIS_NAME,
    icon: '📊',
    color: '#7C3AED',
    description: 'Gestão operacional do fechamento mensal — status de tarefas, alertas de pendências e visão gerencial por empresa.',
    url: SOLUCOES_CONTABEIS_ROUTE,
    internal: true,
  },
  {
    slug: NORADOCS_SLUG,
    name: NORADOCS_NAME,
    icon: '🗂️',
    color: '#7C3AED',
    description: 'Recebimento e organização automática de documentos: identifica cliente, competência e categoria e arquiva no Google Drive do escritório.',
    url: NORADOCS_ROUTE,
    internal: true,
  },
];

export const SYSTEMS_BY_SLUG = SYSTEMS.reduce((acc, sys) => {
  acc[sys.slug] = sys;
  (sys.aliases || []).forEach((alias) => { acc[alias] = sys; });
  return acc;
}, {});

export function getSystem(slug) {
  return SYSTEMS_BY_SLUG[slug] || null;
}

// Mescla uma linha da tabela `systems` com o catálogo estático: sistemas
// internos mantêm `internal` e a rota vindos do código, o resto vem do banco.
function mergeWithStatic(row) {
  const base = SYSTEMS_BY_SLUG[row.slug] || null;
  const internal = base?.internal ?? false;
  return {
    ...row,
    aliases: row.aliases || [],
    internal,
    url: internal ? base.url : (row.url || null),
  };
}

/**
 * Catálogo vindo do banco, já mesclado com o estático.
 * Cai para o catálogo estático se a consulta falhar (ex.: sem sessão),
 * para que o cockpit nunca fique sem metadados dos sistemas.
 */
export async function fetchSystems({ includeInactive = false } = {}) {
  let query = supabase.from('systems').select('*').order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error || !data) return SYSTEMS.map((s) => ({ ...s, default_amount: 0, logo_url: null, active: true }));
  return data.map(mergeWithStatic);
}

/** Índice slug → sistema, incluindo aliases, a partir de uma lista já carregada. */
export function indexSystems(list) {
  return (list || []).reduce((acc, sys) => {
    acc[sys.slug] = sys;
    (sys.aliases || []).forEach((alias) => { acc[alias] = sys; });
    return acc;
  }, {});
}
