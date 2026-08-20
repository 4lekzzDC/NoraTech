export const getCurrentTenantCompanyId = async () => 't1';
export const getCurrentMembership = async () => ({ tenantCompanyId: 't1', role: 'owner', status: 'active' });
export const hasActiveSubscription = async () => ({ hasAccess: true, tenantId: 't1', enabledModules: null });
export const isModuleEnabled = () => true;
