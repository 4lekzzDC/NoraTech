// Domínio compartilhado do módulo Acompanhamento Contábil.
// Constantes e funções puras usadas pelas três abas (Dashboard, Arquivos, Conciliação).

export const TASKS = [
  { id: 'contas_pagar',   short: 'C. Pagar',   label: 'Contas a Pagar' },
  { id: 'contas_receber', short: 'C. Receber', label: 'Contas a Receber' },
  { id: 'taxas_adm',      short: 'Tx. Adm.',   label: 'Taxas Administrativas' },
  { id: 'extratos',       short: 'Extratos',   label: 'Extratos' },
  { id: 'estoques',       short: 'Estoques',   label: 'Estoques' },
  { id: 'apuracao',       short: 'Apuração',   label: 'Apuração' },
  { id: 'folha',          short: 'Folha',      label: 'Folha' },
];

export const STATUS = {
  nao_iniciado:       { label: 'Não iniciado',       fg: '#9aa0a6', bg: 'rgba(255,255,255,0.06)', bd: 'rgba(255,255,255,0.14)' },
  em_andamento:       { label: 'Em andamento',       fg: '#60a5fa', bg: 'rgba(37,99,235,0.14)',   bd: 'rgba(37,99,235,0.30)'   },
  aguardando_cliente: { label: 'Aguardando cliente', fg: '#ff8a3d', bg: 'rgba(255,138,61,0.14)',  bd: 'rgba(255,138,61,0.30)'  },
  aguardando_revisao: { label: 'Aguardando revisão', fg: '#a78bfa', bg: 'rgba(124,58,237,0.16)',  bd: 'rgba(124,58,237,0.32)'  },
  concluido:          { label: 'Concluído',          fg: '#00d48a', bg: 'rgba(0,212,138,0.14)',   bd: 'rgba(0,212,138,0.30)'   },
  atrasado:           { label: 'Atrasado',           fg: '#ff6b6b', bg: 'rgba(255,107,107,0.14)', bd: 'rgba(255,107,107,0.30)' },
};

export const STATUS_ORDER = [
  'nao_iniciado', 'em_andamento', 'aguardando_cliente',
  'aguardando_revisao', 'concluido', 'atrasado',
];

export const PRIORITY = {
  alta:  { label: 'Alta',  fg: '#ff6b6b', bg: 'rgba(255,107,107,0.14)', bd: 'rgba(255,107,107,0.28)' },
  media: { label: 'Média', fg: '#ff8a3d', bg: 'rgba(255,138,61,0.14)',  bd: 'rgba(255,138,61,0.28)'  },
  baixa: { label: 'Baixa', fg: '#60a5fa', bg: 'rgba(37,99,235,0.14)',   bd: 'rgba(37,99,235,0.28)'   },
};

export const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];

export const RECON_CATEGORIES = [
  { id: 'extrato_aplicacoes',         label: 'Extrato & Aplicações' },
  { id: 'apuracao',                   label: 'Apuração' },
  { id: 'folha',                      label: 'Folha' },
  { id: 'demais_contas_fornecedores', label: 'Demais contas e fornecedores' },
];

export const RECON_STATUS = {
  nao_iniciado: { label: 'Não iniciado', fg: '#9aa0a6', bg: 'rgba(255,255,255,0.06)', bd: 'rgba(255,255,255,0.14)' },
  em_andamento: { label: 'Em andamento', fg: '#60a5fa', bg: 'rgba(37,99,235,0.14)',   bd: 'rgba(37,99,235,0.30)'   },
  conciliado:   { label: 'Conciliado',   fg: '#00d48a', bg: 'rgba(0,212,138,0.14)',   bd: 'rgba(0,212,138,0.30)'   },
  pendencia:    { label: 'Pendência',    fg: '#ff6b6b', bg: 'rgba(255,107,107,0.14)', bd: 'rgba(255,107,107,0.30)' },
};
export const RECON_STATUS_ORDER = ['nao_iniciado', 'em_andamento', 'conciliado', 'pendencia'];

export function currentCompetencia() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function emptyTasks(s = 'nao_iniciado') {
  return TASKS.reduce((acc, t) => ({ ...acc, [t.id]: s }), {});
}

export function progressOf(company) {
  const total = TASKS.length;
  const done = TASKS.filter((t) => company.tasks?.[t.id] === 'concluido').length;
  return Math.round((done / total) * 100);
}

export function isDelayed(company) {
  if (!company.prazo) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(company.prazo + 'T00:00:00');
  if (Number.isNaN(due.getTime())) return false;
  const allDone = TASKS.every((t) => company.tasks?.[t.id] === 'concluido');
  return !allDone && due < today;
}

export function alertsOf(company) {
  const alerts = [];
  if (isDelayed(company)) alerts.push({ kind: 'atraso', text: 'Prazo vencido com pendências' });
  const aw = TASKS.filter((t) => company.tasks?.[t.id] === 'aguardando_cliente');
  if (aw.length >= 3) alerts.push({ kind: 'cliente', text: `${aw.length} itens aguardando cliente` });
  const blockedAp = company.tasks?.apuracao === 'nao_iniciado'
    && company.tasks?.contas_pagar === 'concluido'
    && company.tasks?.contas_receber === 'concluido';
  if (blockedAp) alerts.push({ kind: 'apuracao', text: 'Apuração pronta para iniciar' });
  return alerts;
}
