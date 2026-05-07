import { supabase } from './supabase';
import { fetchMyCompany } from './companies';
import { emptyTasks } from './accountingDomain';

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

// Resolve a empresa-tenant (escritório contábil) do usuário atual.
// Para admin, espera-se que o admin também tenha sua company; se não tiver,
// retorna null e a UI deve avisar.
export async function getCurrentTenantCompanyId() {
  const my = await fetchMyCompany();
  return my?.company?.id || null;
}

// =============================================================================
// accounting_companies
// =============================================================================

export async function listCompanies({ tenantCompanyId, competencia } = {}) {
  if (!tenantCompanyId) return [];
  let q = supabase
    .from('accounting_companies')
    .select('*')
    .eq('tenant_company_id', tenantCompanyId)
    .order('nome', { ascending: true });
  if (competencia) q = q.eq('competencia', competencia);
  const { data, error } = await q;
  if (error) throw new Error(translate(error));
  return (data || []).map(normalizeCompany);
}

export async function upsertCompany(record) {
  const payload = {
    ...record,
    tasks: { ...emptyTasks(), ...(record.tasks || {}) },
  };
  if (!payload.id) delete payload.id;

  const { data, error } = await supabase
    .from('accounting_companies')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return normalizeCompany(data);
}

export async function updateCompanyTask(id, taskId, status) {
  // Lê o tasks atual e mescla. (Postgres não tem update parcial em jsonb sem rpc,
  // mas o objeto é pequeno — read-modify-write funciona.)
  const { data: current, error: e1 } = await supabase
    .from('accounting_companies')
    .select('tasks')
    .eq('id', id)
    .single();
  if (e1) throw new Error(translate(e1));

  const newTasks = { ...emptyTasks(), ...(current?.tasks || {}), [taskId]: status };
  const { data, error } = await supabase
    .from('accounting_companies')
    .update({ tasks: newTasks })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return normalizeCompany(data);
}

export async function deleteCompany(id) {
  const { error } = await supabase
    .from('accounting_companies')
    .delete()
    .eq('id', id);
  if (error) throw new Error(translate(error));
}

function normalizeCompany(row) {
  return {
    ...row,
    tasks: { ...emptyTasks(), ...(row?.tasks || {}) },
  };
}

// =============================================================================
// accounting_file_records
// =============================================================================

export async function listFileRecords({ accountingCompanyIds, competencia }) {
  if (!accountingCompanyIds || accountingCompanyIds.length === 0) return [];
  let q = supabase
    .from('accounting_file_records')
    .select('*')
    .in('accounting_company_id', accountingCompanyIds);
  if (competencia) q = q.eq('competencia', competencia);
  const { data, error } = await q;
  if (error) throw new Error(translate(error));
  return data || [];
}

export async function upsertFileRecord({ accountingCompanyId, docType, competencia, received, notes }) {
  const payload = {
    accounting_company_id: accountingCompanyId,
    doc_type: docType,
    competencia,
    received: !!received,
    received_at: received ? new Date().toISOString() : null,
    notes: notes ?? null,
  };
  const { data, error } = await supabase
    .from('accounting_file_records')
    .upsert(payload, { onConflict: 'accounting_company_id,doc_type,competencia' })
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return data;
}

// =============================================================================
// accounting_reconciliations
// =============================================================================

export async function listReconciliations({ accountingCompanyIds, competencia }) {
  if (!accountingCompanyIds || accountingCompanyIds.length === 0) return [];
  let q = supabase
    .from('accounting_reconciliations')
    .select('*')
    .in('accounting_company_id', accountingCompanyIds);
  if (competencia) q = q.eq('competencia', competencia);
  const { data, error } = await q;
  if (error) throw new Error(translate(error));
  return data || [];
}

export async function upsertReconciliation({ accountingCompanyId, category, competencia, status, observacoes }) {
  const payload = {
    accounting_company_id: accountingCompanyId,
    category,
    competencia,
    status: status || 'nao_iniciado',
    observacoes: observacoes ?? null,
  };
  const { data, error } = await supabase
    .from('accounting_reconciliations')
    .upsert(payload, { onConflict: 'accounting_company_id,category,competencia' })
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return data;
}

// =============================================================================
// Subscription gate — usado por SubscriptionRoute
// =============================================================================

export async function hasActiveSubscription(systemSlug) {
  const tenantId = await getCurrentTenantCompanyId();
  if (!tenantId) return { hasAccess: false, tenantId: null };

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('company_id', tenantId)
    .eq('system_slug', systemSlug)
    .in('status', ['active', 'trialing'])
    .limit(1);
  if (error) return { hasAccess: false, tenantId };
  return { hasAccess: (data || []).length > 0, tenantId };
}
