// Analytics local do hub Soluções Contábeis — sem backend.
// Armazena eventos de acesso em localStorage e fornece estatísticas prontas
// para o dashboard. Preparado para futura troca por chamada real à API.
//
// Chave: sc_hub_log → [{ slug, ts }]  (máx 500 entradas)

const KEY   = 'sc_hub_log';
const MAX   = 500;

// ── CRUD básico ────────────────────────────────────────────────────────────────

function readLog() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function writeLog(log) {
  localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)));
}

export function logAccess(slug) {
  const log = readLog();
  log.push({ slug, ts: Date.now() });
  writeLog(log);
}

export function clearLog() {
  localStorage.removeItem(KEY);
}

// ── Seed de demo ───────────────────────────────────────────────────────────────
// Preenche dados realistas quando o log está vazio (uso em portfólio).

const DEMO_SLUGS = [
  'codificador', 'conciliador-extratos', 'transformador-extrato',
  'analise-demonstracoes', 'prazos', 'gestao-clientes',
  'conciliador-fornecedores', 'acompanhamento-contabil',
];

export function seedDemoIfEmpty() {
  if (readLog().length > 0) return;
  const now   = Date.now();
  const DAY   = 86_400_000;
  const log   = [];

  // Últimos 30 dias com volume crescente nos últimos 7
  for (let d = 29; d >= 0; d--) {
    const base    = d < 7 ? 18 : 6;
    const count   = Math.max(1, base + Math.floor(Math.random() * 8) - 3);
    const dayBase = now - d * DAY;
    for (let i = 0; i < count; i++) {
      const slug = DEMO_SLUGS[Math.floor(Math.random() * DEMO_SLUGS.length)];
      const jitter = Math.floor(Math.random() * DAY * 0.8);
      log.push({ slug, ts: dayBase - jitter });
    }
  }
  writeLog(log.sort((a, b) => a.ts - b.ts));
}

// ── Estatísticas ───────────────────────────────────────────────────────────────

function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export function getStats() {
  const log  = readLog();
  const ms   = monthStart();
  const now  = Date.now();
  const DAY  = 86_400_000;

  const thisMonth = log.filter((e) => e.ts >= ms);
  const uniqueSlugsMes = [...new Set(thisMonth.map((e) => e.slug))];
  const lastEvent = log.length ? log[log.length - 1] : null;

  // Gráfico dos últimos 7 dias
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayTs    = startOfDay(now - i * DAY);
    const nextDay  = dayTs + DAY;
    const label    = new Date(dayTs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const count    = log.filter((e) => e.ts >= dayTs && e.ts < nextDay).length;
    days.push({ label, count });
  }

  // Últimos 6 acessos únicos por sistema
  const seen = new Set();
  const recent = [];
  for (let i = log.length - 1; i >= 0 && recent.length < 6; i--) {
    const e = log[i];
    if (!seen.has(e.slug)) { seen.add(e.slug); recent.push(e); }
  }

  // Variação vs mês anterior
  const prevStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  const prevEnd   = ms;
  const prevCount = log.filter((e) => e.ts >= prevStart && e.ts < prevEnd).length;
  const delta     = prevCount > 0 ? Math.round(((thisMonth.length - prevCount) / prevCount) * 100) : null;

  return {
    totalMes:    thisMonth.length,
    sistemasMes: uniqueSlugsMes.length,
    lastAccess:  lastEvent ? lastEvent.ts : null,
    recent,
    days,
    delta,
  };
}
