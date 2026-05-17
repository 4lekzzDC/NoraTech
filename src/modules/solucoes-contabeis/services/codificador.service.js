// Serviço de persistência do Codificador de Arquivos.
//
// Toda I/O com localStorage do módulo está isolada aqui para que, quando
// o backend Supabase ficar pronto, basta trocar a implementação destas
// funções (mantendo as assinaturas) sem mexer na UI.
//
// Mantém compatibilidade de schema com o Autonomy v9.0 (mesmas chaves:
// cod_banks, cod_rules, cod_logs, gestao_clientes) para que dados
// pré-existentes sejam carregados sem migração.

const K_CONTAS = 'cod_banks';
const K_REGRAS = 'cod_rules';
const K_LOGS = 'cod_logs';
const K_CLIENTES = 'gestao_clientes';

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
export function listEmpresas() {
  return readJSON(K_CLIENTES, []);
}

// ── Contas bancárias ──
// Schema: { id, company_id, code, label, bank_name? }
export function listContas() {
  return readJSON(K_CONTAS, []);
}

export function saveContas(contas) {
  writeJSON(K_CONTAS, contas);
}

export function upsertConta(input) {
  const contas = listContas();
  if (input.id) {
    const i = contas.findIndex((c) => c.id === input.id);
    if (i > -1) contas[i] = { ...contas[i], ...input };
  } else {
    contas.push({ id: 'bk_' + Date.now(), ...input });
  }
  saveContas(contas);
  return contas;
}

export function deleteConta(id) {
  const next = listContas().filter((c) => c.id !== id);
  saveContas(next);
  return next;
}

// ── Regras de codificação ──
// Schema: { id, company_id, name, pattern, match_type, account, history_template?, is_active }
export function listRegras() {
  return readJSON(K_REGRAS, []);
}

export function saveRegras(regras) {
  writeJSON(K_REGRAS, regras);
}

export function upsertRegra(input) {
  const regras = listRegras();
  if (input.id) {
    const i = regras.findIndex((r) => r.id === input.id);
    if (i > -1) regras[i] = { ...regras[i], ...input };
  } else {
    regras.push({ id: 'r_' + Date.now(), is_active: 1, ...input });
  }
  saveRegras(regras);
  return regras;
}

export function toggleRegra(id, ativa) {
  const regras = listRegras();
  const i = regras.findIndex((r) => r.id === id);
  if (i > -1) {
    regras[i].is_active = ativa ? 1 : 0;
    saveRegras(regras);
  }
  return regras;
}

export function deleteRegra(id) {
  const next = listRegras().filter((r) => r.id !== id);
  saveRegras(next);
  return next;
}

// ── Logs / histórico de codificações ──
// Schema: { id, empresa, conta, filename, total, coded, pending, time }
export function listLogs() {
  return readJSON(K_LOGS, []);
}

export function pushLog(log) {
  const logs = listLogs();
  logs.unshift({ id: Date.now(), ...log, time: log.time || new Date().toISOString() });
  // Mantém os últimos 200 (igual Autonomy)
  writeJSON(K_LOGS, logs.slice(0, 200));
  return logs;
}

// ── Bootstrap: cria dados demo se ainda não existirem ──
export function seedDemoIfEmpty() {
  let empresas = listEmpresas();
  let createdEmpresa = false;
  if (!empresas.length) {
    const id = 'emp_' + Date.now();
    empresas = [{ id, name: 'Cliente Demo Ltda', cnpj: '00.000.000/0001-00' }];
    writeJSON(K_CLIENTES, empresas);
    createdEmpresa = true;
  }
  const eid = empresas[0].id;
  if (!listContas().length) {
    saveContas([
      { id: 'bk_' + Date.now(), company_id: eid, code: '1.1.01', label: 'Conta Corrente BB', bank_name: 'Banco do Brasil' },
    ]);
  }
  if (!listRegras().length) {
    saveRegras([
      { id: 'r1', company_id: eid, name: 'Pagamento Fornecedor', pattern: 'PAGTO', match_type: 'contains', account: '2.1.01', history_template: 'Pgto fornecedor', is_active: 1 },
      { id: 'r2', company_id: eid, name: 'Recebimento Clientes', pattern: 'TED RECEBIDA', match_type: 'contains', account: '1.1.02', history_template: 'Recebimento de clientes', is_active: 1 },
      { id: 'r3', company_id: eid, name: 'Tarifa Bancária', pattern: 'TARIFA', match_type: 'contains', account: '6.1.01', history_template: 'Tarifa bancária', is_active: 1 },
    ]);
  }
  return { createdEmpresa };
}
