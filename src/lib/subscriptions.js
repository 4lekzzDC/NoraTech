import { supabase } from './supabase';
import { fetchMyCompany } from './companies';

// Helpers genéricos do gate por assinatura, usados pelo SubscriptionRoute e
// por módulos contratados (ex.: Soluções Contábeis).

export async function getCurrentTenantCompanyId() {
  const my = await fetchMyCompany();
  return my?.company?.id || null;
}

export async function getCurrentMembership() {
  const my = await fetchMyCompany();
  if (!my?.company?.id) return null;
  return {
    tenantCompanyId: my.company.id,
    role: my.membership?.role || 'member',
    status: my.membership?.status || 'active',
  };
}

// Verifica se a empresa do usuário tem uma assinatura ativa para o slug informado.
// Aceita um array de slugs alternativos (útil em renomeações: passe o slug novo
// como principal e os legados em `legacySlugs`).
export async function hasActiveSubscription(systemSlug, { legacySlugs = [] } = {}) {
  const tenantId = await getCurrentTenantCompanyId();
  if (!tenantId) return { hasAccess: false, tenantId: null };

  const slugs = [systemSlug, ...legacySlugs].filter(Boolean);
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('company_id', tenantId)
    .in('system_slug', slugs)
    .in('status', ['active', 'trialing'])
    .limit(1);
  if (error) return { hasAccess: false, tenantId };
  return { hasAccess: (data || []).length > 0, tenantId };
}
