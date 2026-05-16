import { supabase } from '../../../lib/supabase';
import { getCurrentTenantCompanyId, getCurrentMembership } from '../../../lib/subscriptions';
import { emptyTasks } from '../domain';

export { getCurrentTenantCompanyId, getCurrentMembership };

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
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

export async function upsertFileRecord({ accountingCompanyId, docType, competencia, fileStatus, notes }) {
  const isReceived = fileStatus === 'recebido';
  const payload = {
    accounting_company_id: accountingCompanyId,
    doc_type: docType,
    competencia,
    file_status: fileStatus || 'pendente',
    received: isReceived,
    received_at: isReceived ? new Date().toISOString() : null,
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
// accounting_params — thresholds do card "Atrasadas"
// =============================================================================

const DEFAULT_PARAMS = {
  dia_cobranca: 0,
  dia_recebimento: 0,
  dia_extrato_aplicacoes: 0,
  dia_apuracao: 0,
  dia_folha: 0,
  dia_demais_contas: 0,
  dia_fornecedores: 0,
};

export async function listAccountingParams(tenantCompanyId) {
  if (!tenantCompanyId) return { ...DEFAULT_PARAMS };
  const { data, error } = await supabase
    .from('accounting_params')
    .select('*')
    .eq('tenant_company_id', tenantCompanyId)
    .maybeSingle();
  if (error) {
    // Se a tabela ainda não existe (migração não aplicada), retorna default
    // em vez de quebrar o dashboard.
    if (/relation .* does not exist|could not find table|does not exist/i.test(error.message || '')) {
      return { ...DEFAULT_PARAMS, _missing: true };
    }
    throw new Error(translate(error));
  }
  if (!data) return { ...DEFAULT_PARAMS };
  return { ...DEFAULT_PARAMS, ...data };
}

export async function upsertAccountingParams(tenantCompanyId, params) {
  const payload = { tenant_company_id: tenantCompanyId, ...params };
  const { data, error } = await supabase
    .from('accounting_params')
    .upsert(payload, { onConflict: 'tenant_company_id' })
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return { ...DEFAULT_PARAMS, ...data };
}

