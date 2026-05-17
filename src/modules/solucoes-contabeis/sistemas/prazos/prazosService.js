// Serviço do Controle de Prazos — localStorage, sem React, sem DOM.
// Porta fiel das funções prazo* do Autonomy (dashboard.html 5820-6385).
//
// Chaves localStorage (fiel ao legado):
//   prazos_tipos_arquivo   → tipos de colunas da aba Arquivos
//   prazos_tipos_conciliacao → tipos de colunas da aba Conciliação
//   prazos_tarefas         → tarefas mensais por empresa
//   prazos_config          → config por empresa (resp, prazos, aplicabilidade)
//   prazos_eventos         → eventos personalizados do calendário
//   gestao_clientes        → empresas (chave compartilhada com Gestão de Clientes)
//   prazos_usuarios        → usuários locais para atribuição de responsáveis

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────

export const OBRIGACOES = [
  { dia: 7,  nome: 'FGTS',                         regime: 'todos',            cor: '#4a9eff' },
  { dia: 7,  nome: 'eSocial – Folha (S-1200)',      regime: 'todos',            cor: '#a78bfa' },
  { dia: 15, nome: 'DCTF Mensal',                   regime: 'todos',            cor: '#f0b429' },
  { dia: 20, nome: 'DAS – Simples Nacional',         regime: 'Simples Nacional', cor: '#34d399' },
  { dia: 20, nome: 'GPS – Autônomos/Pró-labore',    regime: 'todos',            cor: '#60a5fa' },
  { dia: 25, nome: 'DARF PIS/COFINS',               regime: 'Lucro Presumido',  cor: '#f87171' },
  { dia: 25, nome: 'DARF PIS/COFINS',               regime: 'Lucro Real',       cor: '#f87171' },
  { dia: 25, nome: 'IRPJ/CSLL – Estimativa mensal', regime: 'Lucro Real',       cor: '#e879f9' },
  { dia: 28, nome: 'IRPJ/CSLL – Lucro Presumido',   regime: 'Lucro Presumido',  cor: '#e879f9' },
  { dia: 30, nome: 'Folha de Pagamento',             regime: 'todos',            cor: '#fb923c' },
  { dia: 30, nome: 'MEI – DAS',                     regime: 'MEI',              cor: '#34d399' },
];

export const TIPOS_ARQUIVO_DEFAULT = [
  { id: 'contas_pagar',   nome: 'Contas a Pagar',       grupo: '' },
  { id: 'contas_receber', nome: 'Contas a Receber',      grupo: '' },
  { id: 'taxas_adm',      nome: 'Taxas Administrativas', grupo: '' },
  { id: 'extrato',        nome: 'Extrato',               grupo: '' },
  { id: 'estoques',       nome: 'Estoques',              grupo: '' },
];

export const TIPOS_CONC_DEFAULT = [
  { id: 'cod_contas_pagar',   nome: 'Contas a Pagar',       grupo: 'Codificação & Importação' },
  { id: 'cod_contas_receber', nome: 'Contas a Receber',      grupo: 'Codificação & Importação' },
  { id: 'cod_taxas',          nome: 'Taxas Administrativas', grupo: 'Codificação & Importação' },
  { id: 'cod_extratos',       nome: 'Extratos & Aplicações', grupo: 'Codificação & Importação' },
  { id: 'conc_apuracao',      nome: 'Apuração',              grupo: 'Conciliação' },
  { id: 'conc_folha',         nome: 'Folha',                 grupo: 'Conciliação' },
  { id: 'conc_demais',        nome: 'Demais contas',         grupo: 'Conciliação' },
  { id: 'conc_fornecedores',  nome: 'Fornecedores',          grupo: 'Conciliação' },
];

// ──────────────────────────────────────────────────────────────────────
// Helpers localStorage
// ──────────────────────────────────────────────────────────────────────

function ls(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

export const getTipos       = (cat) => ls('prazos_tipos_' + cat, cat === 'arquivo' ? TIPOS_ARQUIVO_DEFAULT.map(x => ({ ...x })) : TIPOS_CONC_DEFAULT.map(x => ({ ...x })));
export const saveTipos      = (cat, v) => lsSet('prazos_tipos_' + cat, v);
export const getTarefas     = () => ls('prazos_tarefas', []);
export const saveTarefas    = (v) => lsSet('prazos_tarefas', v);
export const getConfig      = () => ls('prazos_config', []);
export const saveConfig     = (v) => lsSet('prazos_config', v);
export const getEventos     = () => ls('prazos_eventos', []);
export const saveEventos    = (v) => lsSet('prazos_eventos', v);
export const getClientes    = () => ls('gestao_clientes', []);
export const getUsuarios    = () => ls('prazos_usuarios', []);
export const saveUsuarios   = (v) => lsSet('prazos_usuarios', v);

// ──────────────────────────────────────────────────────────────────────
// Formatação
// ──────────────────────────────────────────────────────────────────────

export function fmtMes(mesStr) {
  const [y, m] = mesStr.split('-');
  return String(m).padStart(2, '0') + '/' + y;
}

export function mesLabel(mesStr) {
  const [y, m] = mesStr.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function navMes(mesStr, delta) {
  const [y, m] = mesStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function currentMes() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// ──────────────────────────────────────────────────────────────────────
// Garantir tarefa existe para empresa/mês
// ──────────────────────────────────────────────────────────────────────

export function ensureTarefas(mes) {
  const empresas = getClientes();
  const tarefas  = getTarefas();
  let changed = false;
  empresas.forEach((e) => {
    if (!tarefas.find((t) => t.empresa_id === e.id && t.mes === mes)) {
      const cfg = getConfig().find((c) => c.empresa_id === e.id) || {};
      tarefas.push({
        id:             'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        empresa_id:     e.id,
        mes,
        responsavel_id: cfg.resp_id || '',
        arquivo:        {},
        conciliacao:    {},
        obs:            '',
      });
      changed = true;
    }
  });
  if (changed) saveTarefas(tarefas);
  return getTarefas().filter((t) => t.mes === mes);
}

// ──────────────────────────────────────────────────────────────────────
// Status geral de uma tarefa
// ──────────────────────────────────────────────────────────────────────

export function getTaskStatus(tarefa, tipos, cat, configs) {
  const cfg   = configs.find((c) => c.empresa_id === tarefa.empresa_id) || {};
  const slots = tipos.map((tp) => {
    const app = cfg.tipos?.[cat]?.[tp.id];
    if (app === 'na' || app === 'inativo') return null;
    return tarefa[cat]?.[tp.id]?.status || 'pendente';
  }).filter((s) => s !== null);
  if (!slots.length) return 'pendente';
  if (slots.every((s) => s === 'concluido')) return 'concluido';
  if (slots.some((s) => s === 'atrasado'))   return 'atrasado';
  return 'pendente';
}

// ──────────────────────────────────────────────────────────────────────
// Ciclar status de uma célula (pendente → concluido → atrasado → pendente)
// ──────────────────────────────────────────────────────────────────────

export function toggleCell(empresa_id, cat, tipo_id, mes) {
  const tarefas = getTarefas();
  const t = tarefas.find((x) => x.empresa_id === empresa_id && x.mes === mes);
  if (!t) return tarefas;
  if (!t[cat]) t[cat] = {};
  if (!t[cat][tipo_id]) t[cat][tipo_id] = { status: 'pendente', valor: '' };
  const cycle = { pendente: 'concluido', concluido: 'atrasado', atrasado: 'pendente' };
  const cell = t[cat][tipo_id];
  cell.status = cycle[cell.status] || 'pendente';
  cell.valor  = cell.status === 'concluido' ? fmtMes(mes) : '';
  saveTarefas(tarefas);
  return [...tarefas];
}

// ──────────────────────────────────────────────────────────────────────
// Auto-marcar atrasados (compara prazo da config com hoje)
// ──────────────────────────────────────────────────────────────────────

export function autoStatus(mes) {
  const today   = new Date();
  const [y, m]  = mes.split('-').map(Number);
  const tarefas = getTarefas();
  const configs = getConfig();
  let changed   = 0;
  const cats    = ['arquivo', 'conciliacao'];
  tarefas.filter((t) => t.mes === mes).forEach((t) => {
    const cfg = configs.find((c) => c.empresa_id === t.empresa_id) || {};
    cats.forEach((cat) => {
      const tipos     = getTipos(cat);
      const prazoDay  = cat === 'arquivo' ? (cfg.prazo_rec || 10) : (cfg.prazo_conc || 25);
      const deadline  = new Date(y, m - 1, prazoDay, 23, 59);
      if (today <= deadline) return;
      tipos.forEach((tp) => {
        const app = cfg.tipos?.[cat]?.[tp.id];
        if (app === 'na' || app === 'inativo') return;
        if (!t[cat]) t[cat] = {};
        if (!t[cat][tp.id]) t[cat][tp.id] = { status: 'pendente', valor: '' };
        if (t[cat][tp.id].status === 'pendente') { t[cat][tp.id].status = 'atrasado'; changed++; }
      });
    });
  });
  if (changed) saveTarefas(tarefas);
  return { changed, tarefas: [...tarefas] };
}

// ──────────────────────────────────────────────────────────────────────
// Export XLSX (fiel ao legado)
// ──────────────────────────────────────────────────────────────────────

export function exportTab(cat, mes) {
  const tipos    = getTipos(cat);
  const empresas = getClientes();
  const usuarios = getUsuarios();
  const configs  = getConfig();
  const tarefas  = getTarefas().filter((t) => t.mes === mes);

  const heads = ['Empresa', 'CNPJ', 'Tributação', 'Responsável', ...tipos.map((t) => t.nome), 'Observações'];
  const rows  = tarefas.map((t) => {
    const emp  = empresas.find((e) => e.id === t.empresa_id);
    const resp = usuarios.find((u) => u.id === t.responsavel_id);
    const cfg  = configs.find((c) => c.empresa_id === t.empresa_id) || {};
    return [
      emp?.name || '',
      emp?.cnpj || '',
      emp?.tributacao || '',
      resp?.nome || '',
      ...tipos.map((tp) => {
        const app  = cfg.tipos?.[cat]?.[tp.id];
        if (app === 'na') return '-';
        const cell = t[cat]?.[tp.id] || {};
        return cell.status === 'concluido' ? (cell.valor || mes)
             : cell.status === 'atrasado'  ? 'ATRASADO'
             : '';
      }),
      t.obs || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([heads, ...rows]);
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, ...tipos.map(() => ({ wch: 14 })), { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cat === 'arquivo' ? 'Arquivos' : 'Conciliação');
  XLSX.writeFile(wb, 'prazos_' + cat + '_' + mes + '.xlsx');
}
