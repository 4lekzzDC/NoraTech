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
//
// `enabledModules` vem junto porque o gate de sistema e o gate de módulo
// interno (ex.: um módulo do hub Soluções Contábeis) nascem da mesma linha —
// não faz sentido uma segunda consulta só pra isso.
export async function hasActiveSubscription(systemSlug, { legacySlugs = [] } = {}) {
  const tenantId = await getCurrentTenantCompanyId();
  if (!tenantId) return { hasAccess: false, tenantId: null, enabledModules: null };

  const slugs = [systemSlug, ...legacySlugs].filter(Boolean);
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status, enabled_modules')
    .eq('company_id', tenantId)
    .in('system_slug', slugs)
    .in('status', ['active', 'trialing'])
    .limit(1);
  if (error || !(data || []).length) return { hasAccess: false, tenantId, enabledModules: null };
  return { hasAccess: true, tenantId, enabledModules: data[0].enabled_modules || null };
}

// NULL ou array vazio em `enabled_modules` = todos os módulos liberados.
// É o comportamento padrão (assinaturas antigas nunca tiveram esse controle
// e sempre deram acesso a tudo do sistema) e também o que "nenhuma restrição
// configurada" deve significar pro admin.
export function isModuleEnabled(enabledModules, moduleSlug) {
  if (!moduleSlug) return true;
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(moduleSlug);
}
