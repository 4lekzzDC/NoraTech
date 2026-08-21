// Serviço compartilhado de clientes — Soluções Contábeis.
//
// Base única por equipe: todo sistema do módulo (Gestão de Clientes,
// Codificador de Arquivos, Análise de Demonstrações, Calculadora IRPJ/CSLL...)
// lê e grava os MESMOS clientes daqui. Nenhum sistema tem cópia própria.
//
// Reaproveita `accounting_companies` (já usada pelo Acompanhamento Contábil,
// já com RLS por tenant_company_id via has_accounting_access) em vez de criar
// uma segunda tabela de clientes — estendida com os campos do cadastro
// completo (CNPJ, contato, endereço, quadro societário). `nome` e `regime`
// já existiam lá com o mesmo significado usado aqui (Razão Social e regime
// tributário), por isso não são duplicados: a API deste módulo expõe esses
// dois como `name`/`tributacao` (o nome que a UI já usa) e traduz por baixo.
//
// Contas bancárias moram em `accounting_company_bank_accounts`, uma linha
// por conta, para um cliente poder ter mais de uma.
import { supabase } from '../../../lib/supabase';
import { getCurrentTenantCompanyId } from '../../../lib/subscriptions';

export { getCurrentTenantCompanyId };

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

// Campos do cadastro completo que passam direto, mesmo nome nos dois lados.
const PASSTHROUGH_FIELDS = [
  'cnpj', 'trade_name', 'email', 'phone', 'atividade', 'cnae', 'ramo_atividade',
  'capital_social', 'cep', 'logradouro', 'numero', 'complemento', 'bairro',
  'cidade', 'estado', 'lat', 'lng', 'geo_level', 'socios',
];

function toDbPayload(appData) {
  const out = {};
  if ('name' in appData) out.nome = appData.name;
  if ('tributacao' in appData) out.regime = appData.tributacao;
  if ('status' in appData) out.ativo = appData.status !== 'inativo';
  PASSTHROUGH_FIELDS.forEach((k) => { if (k in appData) out[k] = appData[k]; });
  return out;
}

function fromDbRow(row) {
  if (!row) return row;
  const { nome, regime, ativo, ...rest } = row;
  return {
    ...rest,
    name: nome,
    tributacao: regime || '',
    status: ativo === false ? 'inativo' : 'ativo',
  };
}

// =============================================================================
// Clientes (accounting_companies)
// =============================================================================

export async function getClientes(tenantCompanyId) {
  if (!tenantCompanyId) return [];
  const { data, error } = await supabase
    .from('accounting_companies')
    .select('*')
    .eq('tenant_company_id', tenantCompanyId)
    .order('nome', { ascending: true });
  if (error) throw new Error(translate(error));
  return (data || []).map(fromDbRow);
}

export async function saveCliente(data, id, tenantCompanyId) {
  const payload = toDbPayload(data);
  if (id) {
    const { data: row, error } = await supabase
      .from('accounting_companies')
      .update(payload)
      .eq('id', id)
      .eq('tenant_company_id', tenantCompanyId)
      .select('*')
      .single();
    if (error) throw new Error(translate(error));
    return fromDbRow(row);
  }
  const { data: row, error } = await supabase
    .from('accounting_companies')
    .insert({ ...payload, tenant_company_id: tenantCompanyId })
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return fromDbRow(row);
}

export async function deleteCliente(id, tenantCompanyId) {
  const { error } = await supabase
    .from('accounting_companies')
    .delete()
    .eq('id', id)
    .eq('tenant_company_id', tenantCompanyId);
  if (error) throw new Error(translate(error));
}

// =============================================================================
// Contas bancárias (accounting_company_bank_accounts)
// =============================================================================

export async function getBancos(clienteId) {
  if (!clienteId) return [];
  const { data, error } = await supabase
    .from('accounting_company_bank_accounts')
    .select('*')
    .eq('accounting_company_id', clienteId)
    .order('label', { ascending: true });
  if (error) throw new Error(translate(error));
  return data || [];
}

export async function saveBanco(record, id) {
  const payload = { ...record };
  delete payload.id;
  if (id) {
    const { data, error } = await supabase
      .from('accounting_company_bank_accounts')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(translate(error));
    return data;
  }
  const { data, error } = await supabase
    .from('accounting_company_bank_accounts')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(translate(error));
  return data;
}

export async function deleteBanco(id) {
  const { error } = await supabase
    .from('accounting_company_bank_accounts')
    .delete()
    .eq('id', id);
  if (error) throw new Error(translate(error));
}

// Todas as contas bancárias da equipe, de qualquer cliente — usado por
// painéis que mostram um total agregado (ex.: métrica do Codificador) sem
// precisar de uma chamada por cliente.
export async function getAllBancos(tenantCompanyId) {
  if (!tenantCompanyId) return [];
  const { data, error } = await supabase
    .from('accounting_company_bank_accounts')
    .select('*, accounting_companies!inner(tenant_company_id)')
    .eq('accounting_companies.tenant_company_id', tenantCompanyId);
  if (error) throw new Error(translate(error));
  return (data || []).map((row) => {
    const { accounting_companies: _accounting_companies, ...rest } = row;
    return rest;
  });
}

// =============================================================================
// Importação automática dos dados legados (localStorage → Supabase)
// =============================================================================
// Até esta migração, a Gestão de Clientes e as Contas Bancárias do
// Codificador viviam só no navegador de quem cadastrou (chaves
// `gestao_clientes_<companyId>` e `cod_banks_<companyId>`). Para ninguém
// perder cadastro nem precisar redigitar nada, na primeira vez que a equipe
// abre um sistema do módulo depois deste deploy, o que estiver salvo
// localmente é copiado para o Supabase — uma vez só, marcado por uma flag
// local para não duplicar em aberturas seguintes nem re-rodar em outra aba.

function importFlagKey(tenantCompanyId) {
  return `noratech_clients_migrated_${tenantCompanyId}`;
}

function readLegacyJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

export async function importLegacyClientsIfNeeded(tenantCompanyId) {
  if (!tenantCompanyId) return { imported: 0 };
  const flagKey = importFlagKey(tenantCompanyId);
  if (localStorage.getItem(flagKey)) return { imported: 0 };

  // A chave legada usava o mesmo tenantCompanyId como companyId — é o valor
  // que getCurrentTenantCompanyId() já devolvia quando o localStorage era a
  // única base.
  const legacyClients = readLegacyJSON(`gestao_clientes_${tenantCompanyId}`);
  if (!legacyClients.length) {
    localStorage.setItem(flagKey, '1');
    return { imported: 0 };
  }

  // Se já tem cliente na base remota, provavelmente outra máquina da mesma
  // equipe já importou (ou já cadastrou de verdade por lá) — não sobrescreve.
  const remote = await getClientes(tenantCompanyId);
  if (remote.length > 0) {
    localStorage.setItem(flagKey, '1');
    return { imported: 0 };
  }

  const legacyBanks = readLegacyJSON(`cod_banks_${tenantCompanyId}`);

  let imported = 0;
  for (const legacy of legacyClients) {
    const { id: legacyId, created_at: _created_at, updated_at: _updated_at, ...appData } = legacy;
    let created;
    try {
      created = await saveCliente(appData, null, tenantCompanyId);
    } catch {
      // Cliente com dado incompatível (ex.: CNPJ duplicado entre dois
      // cadastros locais diferentes) — pula em vez de travar a importação
      // dos demais.
      continue;
    }
    imported++;

    const clientBanks = legacyBanks.filter((b) => b.company_id === legacyId && b.code && b.label);
    for (const b of clientBanks) {
      try {
        await saveBanco({
          accounting_company_id: created.id,
          bank_name: b.bank_name || null,
          code: b.code,
          label: b.label,
        });
      } catch { /* conta com dado insuficiente, ignora */ }
    }
  }

  localStorage.setItem(flagKey, '1');
  return { imported };
}
