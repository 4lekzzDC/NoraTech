// Serviço de persistência do Codificador de Arquivos.
//
// Regras e logs continuam em localStorage, isolados por organização — são
// configuração do próprio Codificador, não cadastro de clientes da equipe.
//
// Empresas (clientes) e contas bancárias NÃO vivem mais aqui: vêm da base
// compartilhada da equipe (services/clients.service.js), a mesma que a
// Gestão de Clientes usa — ver a regra de arquitetura "Clientes por
// equipe" (um cliente pertence à equipe, não a um sistema específico).
//
// Chaves isoladas por organização:
//   cod_rules_<companyId>  → regras de codificação
//   cod_logs_<companyId>   → histórico de codificações

const K_REGRAS = 'cod_rules';
const K_LOGS   = 'cod_logs';

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

// ── Bootstrap: cria regra demo global se ainda não existir nenhuma regra ──
// Não cria mais cliente nem conta demo: clientes agora são um cadastro real
// e compartilhado da equipe (Gestão de Clientes) — semear um "Cliente Demo
// Ltda" ali seria poluir a base de verdade da equipe, não só uma tela vazia.
// A regra global (company_id null) continua útil como exemplo, já que não
// depende de nenhum cliente existir.
export function seedDemoIfEmpty(companyId) {
  if (listRegras(companyId).length) return;
  saveRegras([
    { id: 'r_demo_tarifa', company_id: null, name: 'Tarifa Bancária', pattern: 'TARIFA', match_type: 'contains', nature: 'D', account: '6.1.01', history_template: 'Tarifa bancária', is_active: 1 },
  ], companyId);
}
