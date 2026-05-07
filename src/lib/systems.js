// Catálogo de sistemas oferecidos. O `slug` é a chave usada em
// subscriptions.system_slug para vincular uma assinatura a um sistema.

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
    slug: 'acompanhamento-contabil',
    name: 'Acompanhamento contábil',
    icon: '📊',
    color: '#7C3AED',
    description: 'Gestão operacional do fechamento mensal — status de tarefas, alertas de pendências e visão gerencial por empresa.',
    url: '/acompanhamento-contabil',
    internal: true,
  },
];

export const SYSTEMS_BY_SLUG = Object.fromEntries(SYSTEMS.map((s) => [s.slug, s]));

export function getSystem(slug) {
  return SYSTEMS_BY_SLUG[slug] || null;
}
