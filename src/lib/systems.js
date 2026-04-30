// Catálogo de sistemas oferecidos. O `slug` é a chave usada em
// subscriptions.system_slug para vincular uma assinatura a um sistema.

export const SYSTEMS = [
  {
    slug: 'whatsapp-bot',
    name: 'WhatsApp Bot',
    icon: '💬',
    color: '#25D366',
    description: 'Atendimento automatizado, triagem por intenção e transferência fluida para humanos.',
    url: 'https://whatsapp-mu.vercel.app',
  },
];

export const SYSTEMS_BY_SLUG = Object.fromEntries(SYSTEMS.map((s) => [s.slug, s]));

export function getSystem(slug) {
  return SYSTEMS_BY_SLUG[slug] || null;
}
