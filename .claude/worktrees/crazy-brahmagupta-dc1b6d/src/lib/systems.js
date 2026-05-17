// Catálogo de sistemas oferecidos. O `slug` é a chave usada em
// subscriptions.system_slug para vincular uma assinatura a um sistema.
// `aliases` cobre slugs legados após renomeações: getSystem(alias) também resolve.

import {
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  SOLUCOES_CONTABEIS_NAME,
} from '../modules/solucoes-contabeis';

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
];

export const SYSTEMS_BY_SLUG = SYSTEMS.reduce((acc, sys) => {
  acc[sys.slug] = sys;
  (sys.aliases || []).forEach((alias) => { acc[alias] = sys; });
  return acc;
}, {});

export function getSystem(slug) {
  return SYSTEMS_BY_SLUG[slug] || null;
}
