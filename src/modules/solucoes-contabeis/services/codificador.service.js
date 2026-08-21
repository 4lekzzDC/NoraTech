// Serviço de persistência do Codificador de Arquivos.
//
// Toda I/O com localStorage do módulo está isolada aqui para que, quando
// o backend Supabase ficar pronto, basta trocar a implementação destas
// funções (mantendo as assinaturas) sem mexer na UI.
//
// Chaves isoladas por organização:
//   cod_banks_<companyId>  → contas bancárias
//   cod_rules_<companyId>  → regras de codificação
//   cod_logs_<companyId>   → histórico de codificações
//   gestao_clientes_<companyId> → empresas (chave compartilhada com Gestão de Clientes)

const K_CONTAS   = 'cod_banks';
const K_REGRAS   = 'cod_rules';
const K_LOGS     = 'cod_logs';
const K_CLIENTES = 'gestao_clientes';

function scopedKey(base, companyId) {
  return companyId ? `${base}_${companyId}` : base;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Empresas (clientes) ──
// Schema: { id, name, cnpj?, teamId? } — compartilhado com Gestão de Clientes.
export function listEmpresas(companyId) {
  return readJSON(scopedKey(K_CLIENTES, companyId), []);
}

// ── Contas bancárias ──
// Schema: { id, company_id, code, label, bank_name? }
export function listContas(companyId) {
  return readJSON(scopedKey(K_CONTAS, companyId), []);
}

export function saveContas(contas, companyId) {
  writeJSON(scopedKey(K_CONTAS, companyId), contas);
}

export function upsertConta(input, companyId) {
  const contas = listContas(companyId);
  if (input.id) {
    const i = contas.findIndex((c) => c.id === input.id);
    if (i > -1) contas[i] = { ...contas[i], ...input };
  } else {
    contas.push({ id: 'bk_' + Date.now(), ...input });
  }
  saveContas(contas, companyId);
  return contas;
}

export function deleteConta(id, companyId) {
  const next = listContas(companyId).filter((c) => c.id !== id);
  saveContas(next, companyId);
  return next;
}

// ── Regras de codificação ──
// Schema: { id, company_id, name, pattern, match_type, nature, account, history_template?, is_active }
// company_id null = regra global, aplicada a qualquer cliente.
// nature 'D' = pagamento (débito), 'C' = recebimento (crédito) — o mesmo
// histórico de banco costuma valer para os dois sentidos, e não é a mesma
// contrapartida contábil; regra antiga sem este campo casa com qualquer natureza.
export function listRegras(companyId) {
  return readJSON(scopedKey(K_REGRAS, companyId), []);
}

export function saveRegras(regras, companyId) {
  writeJSON(scopedKey(K_REGRAS, companyId), regras);
}

export function upsertRegra(input, companyId) {
  const regras = listRegras(companyId);
  if (input.id) {
    const i = regras.findIndex((r) => r.id === input.id);
    if (i > -1) regras[i] = { ...regras[i], ...input };
  } else {
    regras.push({ id: 'r_' + Date.now(), is_active: 1, ...input });
  }
  saveRegras(regras, companyId);
  return regras;
}

export function toggleRegra(id, ativa, companyId) {
  const regras = listRegras(companyId);
  const i = regras.findIndex((r) => r.id === id);
  if (i > -1) {
    regras[i].is_active = ativa ? 1 : 0;
    saveRegras(regras, companyId);
  }
  return regras;
}

export function deleteRegra(id, companyId) {
  const next = listRegras(companyId).filter((r) => r.id !== id);
  saveRegras(next, companyId);
  return next;
}

// ── Logs / histórico de codificações ──
// Schema: { id, empresa, conta, filename, total, coded, pending, time }
export function listLogs(companyId) {
  return readJSON(scopedKey(K_LOGS, companyId), []);
}

export function pushLog(log, companyId) {
  const logs = listLogs(companyId);
  logs.unshift({ id: Date.now(), ...log, time: log.time || new Date().toISOString() });
  // Mantém os últimos 200 (igual Autonomy)
  writeJSON(scopedKey(K_LOGS, companyId), logs.slice(0, 200));
  return logs;
}

// ── Bootstrap: cria dados demo se ainda não existirem ──
export function seedDemoIfEmpty(companyId) {
  let empresas = listEmpresas(companyId);
  let createdEmpresa = false;
  if (!empresas.length) {
    const id = 'emp_' + Date.now();
    empresas = [{ id, name: 'Cliente Demo Ltda', cnpj: '00.000.000/0001-00' }];
    writeJSON(scopedKey(K_CLIENTES, companyId), empresas);
    createdEmpresa = true;
  }
  const eid = empresas[0].id;
  if (!listContas(companyId).length) {
    saveContas([
      { id: 'bk_' + Date.now(), company_id: eid, code: '1.1.01', label: 'Conta Corrente BB', bank_name: 'Banco do Brasil' },
    ], companyId);
  }
  if (!listRegras(companyId).length) {
    saveRegras([
      { id: 'r1', company_id: eid, name: 'Pagamento Fornecedor', pattern: 'PAGTO', match_type: 'contains', nature: 'D', account: '2.1.01', history_template: 'Pgto fornecedor', is_active: 1 },
      { id: 'r2', company_id: eid, name: 'Recebimento Clientes', pattern: 'TED RECEBIDA', match_type: 'contains', nature: 'C', account: '1.1.02', history_template: 'Recebimento de clientes', is_active: 1 },
      { id: 'r3', company_id: null, name: 'Tarifa Bancária', pattern: 'TARIFA', match_type: 'contains', nature: 'D', account: '6.1.01', history_template: 'Tarifa bancária', is_active: 1 },
    ], companyId);
  }
  return { createdEmpresa };
}
