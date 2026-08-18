import { supabase } from '../../../lib/supabase';
import { getCurrentTenantCompanyId } from '../../../lib/subscriptions';

// Resolve o escritório (tenant) do usuário logado e garante que ele tenha
// configurações e categorias criadas.
//
// `noradocs_bootstrap` é idempotente no banco, mas chamá-lo a cada navegação
// seria uma ida de rede sem retorno — daí o cache por sessão. Um F5 refaz a
// chamada, o que é justamente o que se quer se algo tiver sido apagado.

const bootstrapped = new Set();

export async function resolveTenant() {
  const tenantId = await getCurrentTenantCompanyId();
  if (!tenantId) return { tenantId: null, ready: false };

  if (!bootstrapped.has(tenantId)) {
    const { error } = await supabase.rpc('noradocs_bootstrap', { p_company_id: tenantId });
    // Falha aqui não impede o uso: o escritório pode não ter assinatura ativa
    // (o RPC recusa com 42501) ou a rede pode ter caído. Quem chama decide o
    // que mostrar; o cache não é marcado, então a próxima tentativa refaz.
    if (error) return { tenantId, ready: false, error };
    bootstrapped.add(tenantId);
  }

  return { tenantId, ready: true };
}
