// Engine puro da Análise de Demonstrações (sem React, sem DOM).
// Porta fiel das funções adem* do Autonomy (dashboard.html 6396-6925), com parser
// reforçado para lidar com relatórios contábeis reais (múltiplas colunas,
// hierarquia por indentação, totais que só aparecem na última linha do grupo).
//
// Fluxo: XLSX/PDF upload → parse DRE/Balanço/Balancete → computed object
// → KPIs + 6 gráficos no dashboard → tabelas de detalhamento
//
// localStorage: chave 'adem_data' (preservada do legado)

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// Helpers numéricos
// ──────────────────────────────────────────────────────────────────────

export function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  s = s.replace(/[R$\s]/g, '');
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

export function fmt(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + 'M';
  if (abs >= 1e3) return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + 'K';
  return 'R$ ' + v.toFixed(2).replace('.', ',');
}

export function pct(v) {
  return (v * 100).toFixed(1).replace('.', ',') + '%';
}

// ──────────────────────────────────────────────────────────────────────
// Normalização de linhas → árvore de itens (label + indentação + valores)
//
// Relatórios contábeis reais não têm a descrição sempre na coluna 0 nem o
// valor sempre na última coluna: a descrição pode estar em qualquer coluna
// (indicando nível hierárquico) e o total de uma seção às vezes só aparece
// na última linha-filha, não na linha do cabeçalho. `buildItems` normaliza
// isso para uma lista plana com nível de indentação, e `resolveValue` sabe
// somar os filhos quando o cabeçalho não carrega valor próprio.
// ──────────────────────────────────────────────────────────────────────

function looksNumeric(cell) {
  if (typeof cell === 'number') return true;
  if (typeof cell !== 'string') return false;
  const s = cell.trim();
  if (s === '') return false;
  return /^\(?-?\s*R?\$?\s*-?\d{1,3}(\.\d{3})*(,\d+)?\)?-?$/.test(s) || /^-?\d+(\.\d+)?$/.test(s);
}

function normalizeLabel(s) {
  return String(s).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildItems(rows) {
  const items = [];
  for (const row of rows) {
    if (!row) continue;
    let labelColIdx = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === 'string' && cell.trim() !== '' && !looksNumeric(cell)) { labelColIdx = c; break; }
    }
    if (labelColIdx === -1) continue;
    const raw = String(row[labelColIdx]);
    const labelRaw = raw.trim().replace(/\s+/g, ' ');
    if (!labelRaw || labelRaw.length < 2) continue;
    const leadingSpaces = raw.length - raw.replace(/^\s+/, '').length;
    const codeCandidate = labelColIdx > 0 && looksNumeric(row[labelColIdx - 1]) ? String(row[labelColIdx - 1]).trim() : '';

    const values = [];
    for (let c = labelColIdx + 1; c < row.length; c++) {
      const cell = row[c];
      if (cell === '' || cell === null || cell === undefined) continue;
      if (typeof cell !== 'number' && !looksNumeric(cell)) continue;
      values.push(parseNum(cell));
    }

    items.push({ label: normalizeLabel(labelRaw), labelRaw, indent: labelColIdx * 100 + leadingSpaces, values, code: codeCandidate });
  }
  return items;
}

// Valor "total" de uma linha: o último valor não-zero (a coluna mais à
// direita preenchida — normalmente a mais agregada, ex: "Total"/"Soma").
// Usado para decidir se a própria linha já carrega o total da seção.
function directValue(item) {
  for (let i = item.values.length - 1; i >= 0; i--) {
    if (item.values[i] !== 0) return item.values[i];
  }
  return 0;
}

// Valor "próprio" de uma linha: o primeiro valor não-zero (a coluna mais à
// esquerda — o saldo individual daquela linha). Diferente de directValue:
// a última linha de um grupo às vezes carrega, nas colunas seguintes, o
// subtotal acumulado da seção — usar a coluna da direita ali faria a soma
// dos filhos contar esse subtotal duas vezes.
function ownValue(item) {
  for (let i = 0; i < item.values.length; i++) {
    if (item.values[i] !== 0) return item.values[i];
  }
  return 0;
}

// Soma os valores próprios dos descendentes diretos (recursivo para
// sub-cabeçalhos), usado quando a própria linha não carrega nenhum valor.
function rollupChildren(items, idx) {
  const item = items[idx];
  let sum = 0;
  let j = idx + 1;
  while (j < items.length && items[j].indent > item.indent) {
    const hasChildren = j + 1 < items.length && items[j + 1].indent > items[j].indent;
    if (hasChildren) {
      sum += resolveValue(items, j);
      const childIndent = items[j].indent;
      let k = j + 1;
      while (k < items.length && items[k].indent > childIndent) k++;
      j = k;
    } else {
      sum += ownValue(items[j]);
      j++;
    }
  }
  return sum;
}

function resolveValue(items, idx) {
  const item = items[idx];
  const direct = directValue(item);
  if (direct !== 0) return direct;
  if (item.values.length > 0) return 0; // linha tem valor explícito zerado — não é cabeçalho
  return rollupChildren(items, idx);
}

// Linhas de cabeçalho/rodapé (título do relatório, dados da empresa) nunca
// são o dado procurado, mas podem casualmente conter alguma keyword — por
// exemplo o título "Demonstração do Resultado do Exercício" contém a frase
// "resultado do exercício", igual ao rótulo de uma linha de Lucro Líquido.
const BOILERPLATE_EXCLUDE = ['demonstração', 'balanço patrimonial', 'sistema licenciado', 'empresa:', 'c.n.p.j', 'período:', 'folha:'];

// Localiza o item cujo rótulo casa com alguma keyword (string = substring,
// array = todas as substrings precisam casar). strategy 'shallowest' (padrão)
// prioriza a linha de nível hierárquico mais alto entre as candidatas (evita
// pegar uma sub-linha em vez do total da seção); 'largest' prioriza o maior
// valor absoluto (útil quando várias linhas usam um termo genérico).
function findItemIndex(items, keywords, opts = {}) {
  const { exclude = [], strategy = 'shallowest' } = opts;
  const kws = keywords.map((k) => (Array.isArray(k) ? k.map((x) => x.toLowerCase()) : k.toLowerCase()));
  const exc = [...BOILERPLATE_EXCLUDE, ...exclude].map((e) => e.toLowerCase());
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < items.length; i++) {
    const label = items[i].label;
    if (exc.some((e) => label.includes(e))) continue;
    const match = kws.some((kw) => (Array.isArray(kw) ? kw.every((k) => label.includes(k)) : label.includes(kw)));
    if (!match) continue;
    const score = strategy === 'largest' ? -Math.abs(resolveValue(items, i)) : items[i].indent;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function findValue(items, keywords, opts) {
  const idx = findItemIndex(items, keywords, opts);
  return idx === -1 ? 0 : resolveValue(items, idx);
}

// ──────────────────────────────────────────────────────────────────────
// Parse de cada demonstração
// ──────────────────────────────────────────────────────────────────────

export function parseDRE(rows) {
  const items = buildItems(rows);
  const v = (keywords, opts) => findValue(items, keywords, opts);

  const recBruta   = v(['receita bruta', 'receita operacional bruta', 'faturamento bruto']);
  const deducoes   = Math.abs(v(['deduç', '(-) deduç', 'deducoes', 'abatimento'], { exclude: ['resultado'] }));
  const recLiquida = v(['receita líquida', 'receita operacional líquida']) || recBruta - deducoes;
  const cmv        = Math.abs(v(['custo', 'cmv', 'cpv', 'custo dos produtos', 'custo das mercadorias', 'custo dos serviços'], { exclude: ['resultado'] }));
  const lucroBruto = v(['lucro bruto', 'resultado bruto']) || (recLiquida - cmv);
  const despOp     = Math.abs(v(['despesas operacionais', 'total despesas operac'], { exclude: ['resultado'] }));
  const despAdmin  = Math.abs(v(['administrativ', 'despesas administrativ'], { exclude: ['resultado'] }));
  const despVendas = Math.abs(v(['despesas com vendas', 'despesas comerciais', 'despesas de vendas'], { exclude: ['receita', 'resultado'] }));
  const despFin    = Math.abs(v(['despesas financeiras', 'resultado financeiro', 'financeiras'], { exclude: ['receita', 'resultado antes'] }));
  const depAmort   = Math.abs(v(['depreciaç', 'amortizaç', 'deprec'], { exclude: ['resultado'] }));
  const lucroOp    = v(['lucro operacional', 'resultado operacional', 'resultado antes']) || (lucroBruto - despOp - despAdmin - despVendas);
  const ir         = Math.abs(v(['imposto de renda', 'irpj e csll', 'provisão para ir'], { exclude: ['receita', 'resultado'] }));
  const lucroLiq   = v(['lucro líquido', 'resultado líquido', 'resultado do exercício', 'lucro/prejuízo']) || (lucroOp - ir);
  const ebitda     = lucroOp + depAmort;

  return {
    recBruta, deducoes, recLiquida, cmv, lucroBruto,
    despOp, despAdmin, despVendas, despFin, depAmort,
    lucroOp, ir, lucroLiq, ebitda,
    margemBruta:  recLiquida ? lucroBruto / recLiquida : 0,
    margemLiq:    recLiquida ? lucroLiq   / recLiquida : 0,
    margemEbitda: recLiquida ? ebitda     / recLiquida : 0,
  };
}

export function parseBalanco(rows) {
  const items = buildItems(rows);
  const v = (keywords, opts) => findValue(items, keywords, opts);

  const ativoTotal    = Math.abs(v(['ativo total', 'total do ativo', 'total ativo', 'ativo']));
  const ativoCirc     = Math.abs(v(['ativo circulante', 'total ativo circulante']));
  const ativoNC       = Math.abs(v(['ativo não circulante', 'total ativo não circulante'])) || (ativoTotal - ativoCirc);
  const caixa         = Math.abs(v(['disponível', 'disponibilidades', 'caixa e equivalentes', 'caixa', 'bancos']));
  const estoques      = Math.abs(v(['estoque', 'estoques']));
  const contasReceber = Math.abs(v(['contas a receber', 'clientes', 'duplicatas a receber']));
  const passivoCirc   = Math.abs(v(['passivo circulante', 'total passivo circulante']));
  const passivoNC     = Math.abs(v(['passivo não circulante', 'exigível a longo', 'total passivo não circulante']));
  const passivoTotal  = (passivoCirc + passivoNC) || Math.abs(v(['passivo total', 'total do passivo', 'total passivo', 'passivo']));
  const pl            = Math.abs(v(['patrimônio líquido', 'patrimonio liquido', 'total patrimônio', 'total do patrimônio'])) || (ativoTotal - passivoTotal);
  const fornecedores  = Math.abs(v(['fornecedores', 'contas a pagar']));
  const emprestimos   = Math.abs(v(['empréstimos', 'emprestimos', 'financiamentos'], { strategy: 'largest', exclude: ['a receber'] }));

  return {
    ativoTotal, ativoCirc, ativoNC, caixa, estoques, contasReceber,
    passivoTotal, passivoCirc, passivoNC, pl, fornecedores, emprestimos,
    liqCorrente: passivoCirc ? ativoCirc / passivoCirc : 0,
    liqSeca:     passivoCirc ? (ativoCirc - estoques) / passivoCirc : 0,
    liqImediata: passivoCirc ? caixa / passivoCirc : 0,
    endividamento: ativoTotal ? passivoTotal / ativoTotal : 0,
    compEndiv:     passivoTotal ? passivoCirc / passivoTotal : 0,
  };
}

export function parseBalancete(rows) {
  const items = buildItems(rows);
  const contas = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Linhas com filhos (nível hierárquico menor que a próxima) são
    // cabeçalhos/subtotais de agrupamento — só as contas-folha entram na lista.
    const isLeaf = !(i + 1 < items.length && items[i + 1].indent > item.indent);
    if (!isLeaf) continue;

    const vals = item.values;
    let debito = 0, credito = 0, saldo = 0;
    if (vals.length >= 3) {
      [debito, credito, saldo] = vals.slice(-3);
    } else if (vals.length === 2) {
      [debito, credito] = vals;
      saldo = Math.abs(debito - credito);
    } else if (vals.length === 1) {
      saldo = vals[0];
    } else {
      continue;
    }
    if (debito === 0 && credito === 0 && saldo === 0) continue;

    contas.push({ cod: item.code, desc: item.labelRaw, debito, credito, saldo: Math.abs(saldo) });
  }

  contas.sort((a, b) => b.saldo - a.saldo);
  return { contas };
}

// ──────────────────────────────────────────────────────────────────────
// Leitura de arquivo — XLSX e PDF
// ──────────────────────────────────────────────────────────────────────

export async function loadXlsxFile(file) {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

// pdfjs — carregado dinamicamente para não inflar o bundle inicial.
let _pdfjsLib = null;
async function getPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;
  _pdfjsLib = await import('pdfjs-dist');
  _pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;
  return _pdfjsLib;
}

const PDF_NUM_TOKEN_RE = /\(?-?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*-?\)?/g;

// Converte uma linha de texto do PDF em uma "pseudo-linha" no mesmo formato
// das linhas do XLSX: [rótulo (com espaços indicando indentação), valor1, valor2, ...]
function pdfLineToRow(text, indentSpaces) {
  const matches = [...text.matchAll(PDF_NUM_TOKEN_RE)];
  const indent = ' '.repeat(Math.max(0, indentSpaces));
  if (matches.length === 0) return [indent + text.trim()];
  const label = text.slice(0, matches[0].index).trim();
  const nums = matches.map((m) => m[0].trim());
  return [indent + label, ...nums];
}

export async function loadPdfFile(file) {
  const pdfjsLib = await getPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    let lastY = null;
    let current = null;
    content.items.forEach((item) => {
      const x = item.transform[4];
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (current) lines.push(current);
        current = null;
      }
      if (!current) current = { x, text: '' };
      current.text += item.str + ' ';
      lastY = y;
    });
    if (current) lines.push(current);
  }

  const minX = lines.reduce((m, l) => Math.min(m, l.x), Infinity);
  return lines
    .map((l) => ({ x: l.x, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
    .map((l) => pdfLineToRow(l.text, Math.round((l.x - minX) / 6)));
}

export async function loadFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return loadPdfFile(file);
  return loadXlsxFile(file);
}

// ──────────────────────────────────────────────────────────────────────
// Processamento completo (raw → parsed)
// ──────────────────────────────────────────────────────────────────────

export function processAll(raw) {
  return {
    dre:       raw.dre       ? parseDRE(raw.dre)           : null,
    balanco:   raw.balanco   ? parseBalanco(raw.balanco)   : null,
    balancete: raw.balancete ? parseBalancete(raw.balancete) : null,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Persistência (localStorage — chave legada 'adem_data')
// ──────────────────────────────────────────────────────────────────────

const ADEM_KEY = 'adem_data';

function ademKey(companyId) {
  return companyId ? `${ADEM_KEY}_${companyId}` : ADEM_KEY;
}

export function saveParsed(parsed, companyId) {
  try { localStorage.setItem(ademKey(companyId), JSON.stringify(parsed)); } catch { /* quota */ }
}

export function loadParsed(companyId) {
  try { return JSON.parse(localStorage.getItem(ademKey(companyId)) || 'null'); } catch { return null; }
}

export function clearParsed(companyId) {
  localStorage.removeItem(ademKey(companyId));
}

// ──────────────────────────────────────────────────────────────────────
// Dados de gráficos — retorna config Chart.js pronta
// ──────────────────────────────────────────────────────────────────────

const COLORS = {
  blue:   '#4a9eff',
  green:  '#34d399',
  red:    '#ff5c5c',
  orange: '#fb923c',
  purple: '#a78bfa',
  gold:   '#f0b429',
  cyan:   '#22d3ee',
  darkBg: '#4a5a6a',
};

export function buildChartConfigs(parsed, isDark) {
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const txtColor  = isDark ? '#8899aa' : '#6b7280';
  const d = parsed.dre;
  const b = parsed.balanco;
  const configs = {};

  // 1. DRE composição (barra horizontal)
  if (d) {
    configs.dre = {
      type: 'bar',
      data: {
        labels: ['Receita Líq.', 'CMV', 'Lucro Bruto', 'Desp. Admin.', 'Desp. Vendas', 'Desp. Financ.', 'Lucro Operac.', 'IR/CSLL', 'Lucro Líquido'],
        datasets: [{
          data: [d.recLiquida, -d.cmv, d.lucroBruto, -d.despAdmin, -d.despVendas, -d.despFin, d.lucroOp, -d.ir, d.lucroLiq],
          backgroundColor: [COLORS.blue, COLORS.red, COLORS.green, COLORS.orange, COLORS.orange, COLORS.orange, COLORS.purple, COLORS.red, COLORS.cyan],
          borderRadius: 4, barPercentage: 0.65,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: txtColor, callback: (v) => fmt(v) } },
          y: { grid: { display: false }, ticks: { color: txtColor, font: { size: 11 } } },
        },
      },
    };
  }

  // 2. Estrutura patrimonial (stacked bar)
  if (b) {
    configs.balanco = {
      type: 'bar',
      data: {
        labels: ['Ativo', 'Passivo + PL'],
        datasets: [
          { label: 'Circulante',           data: [b.ativoCirc, b.passivoCirc], backgroundColor: COLORS.blue,   borderRadius: 4 },
          { label: 'Não Circulante',       data: [b.ativoNC,   b.passivoNC],   backgroundColor: COLORS.purple, borderRadius: 4 },
          { label: 'Patrimônio Líquido',   data: [0,           b.pl],          backgroundColor: COLORS.green,  borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: txtColor, boxWidth: 10, padding: 12 } },
          tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.raw) } },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: txtColor } },
          y: { stacked: true, grid: { color: gridColor }, ticks: { color: txtColor, callback: (v) => fmt(v) } },
        },
      },
    };
  }

  // 3. Rentabilidade
  if (d) {
    const roe = b && b.pl         ? d.lucroLiq / b.pl         : 0;
    const roa = b && b.ativoTotal ? d.lucroLiq / b.ativoTotal : 0;
    configs.rentab = {
      type: 'bar',
      data: {
        labels: ['Margem Bruta', 'Margem Líquida', 'Margem EBITDA', 'ROE', 'ROA'],
        datasets: [{
          data: [d.margemBruta * 100, d.margemLiq * 100, d.margemEbitda * 100, roe * 100, roa * 100],
          backgroundColor: [COLORS.blue, COLORS.green, COLORS.gold, COLORS.purple, COLORS.cyan],
          borderRadius: 4, barPercentage: 0.55,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw.toFixed(1) + '%' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: txtColor } },
          y: { grid: { color: gridColor }, ticks: { color: txtColor, callback: (v) => v + '%' } },
        },
      },
    };
  }

  // 4. Liquidez
  if (b) {
    configs.liquidez = {
      type: 'bar',
      data: {
        labels: ['Liq. Corrente', 'Liq. Seca', 'Liq. Imediata'],
        datasets: [{ data: [b.liqCorrente, b.liqSeca, b.liqImediata], backgroundColor: [COLORS.blue, COLORS.green, COLORS.gold], borderRadius: 4, barPercentage: 0.45 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw.toFixed(2) } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: txtColor } },
          y: { grid: { color: gridColor }, ticks: { color: txtColor }, beginAtZero: true },
        },
      },
    };
  }

  // 5. Top 10 Balancete
  if (parsed.balancete) {
    const top10 = parsed.balancete.contas.slice(0, 10);
    configs.balancete = {
      type: 'bar',
      data: {
        labels: top10.map((c) => c.desc.length > 25 ? c.desc.slice(0, 25) + '…' : c.desc),
        datasets: [{ label: 'Saldo', data: top10.map((c) => c.saldo), backgroundColor: COLORS.blue, borderRadius: 4, barPercentage: 0.6 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: txtColor, callback: (v) => fmt(v) } },
          y: { grid: { display: false }, ticks: { color: txtColor, font: { size: 10 } } },
        },
      },
    };
  }

  // 6. Análise Vertical DRE (doughnut)
  if (d && d.recLiquida) {
    const rl = d.recLiquida;
    const outros = Math.max(0, 100
      - Math.abs(d.cmv / rl * 100) - Math.abs(d.despAdmin / rl * 100)
      - Math.abs(d.despVendas / rl * 100) - Math.abs(d.despFin / rl * 100)
      - Math.abs(d.ir / rl * 100) - Math.max(0, d.lucroLiq / rl * 100));
    configs.av = {
      type: 'doughnut',
      data: {
        labels: ['CMV', 'Desp. Admin.', 'Desp. Vendas', 'Desp. Financ.', 'IR/CSLL', 'Lucro Líquido', 'Outros'],
        datasets: [{
          data: [
            Math.abs(d.cmv / rl * 100), Math.abs(d.despAdmin / rl * 100), Math.abs(d.despVendas / rl * 100),
            Math.abs(d.despFin / rl * 100), Math.abs(d.ir / rl * 100), Math.max(0, d.lucroLiq / rl * 100), outros,
          ],
          backgroundColor: [COLORS.red, COLORS.orange, COLORS.gold, COLORS.purple, '#ef4444', COLORS.green, COLORS.darkBg],
          borderWidth: 0, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: txtColor, boxWidth: 10, padding: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + c.raw.toFixed(1) + '%' } },
        },
      },
    };
  }

  return configs;
}

// ──────────────────────────────────────────────────────────────────────
// Linhas de detalhe DRE e Balanço (para o painel Detalhes)
// ──────────────────────────────────────────────────────────────────────

export function buildDreRows(d) {
  return [
    { desc: 'Receita Bruta',               val: d.recBruta,     type: 'value' },
    { desc: '(-) Deduções',                val: -d.deducoes,    type: 'value' },
    { desc: '= Receita Líquida',           val: d.recLiquida,   type: 'total' },
    { desc: '(-) CMV/CPV',                 val: -d.cmv,         type: 'value' },
    { desc: '= Lucro Bruto',               val: d.lucroBruto,   type: 'total' },
    { desc: '(-) Despesas Administrativas',val: -d.despAdmin,   type: 'value' },
    { desc: '(-) Despesas com Vendas',     val: -d.despVendas,  type: 'value' },
    { desc: '(-) Despesas Financeiras',    val: -d.despFin,     type: 'value' },
    { desc: '= Lucro Operacional',         val: d.lucroOp,      type: 'total' },
    { desc: '(-) Depreciação/Amortização', val: -d.depAmort,    type: 'value' },
    { desc: '(-) IR/CSLL',                 val: -d.ir,          type: 'value' },
    { desc: '= Lucro Líquido',             val: d.lucroLiq,     type: 'total' },
    { desc: '',                            val: null,           type: 'sep' },
    { desc: 'EBITDA',                      val: d.ebitda,       type: 'highlight' },
    { desc: 'Margem Bruta',                val: d.margemBruta,  type: 'pct' },
    { desc: 'Margem Líquida',              val: d.margemLiq,    type: 'pct' },
    { desc: 'Margem EBITDA',               val: d.margemEbitda, type: 'pct' },
  ];
}

export function buildBalancoRows(b) {
  return [
    { desc: 'ATIVO',                       val: null, type: 'head' },
    { desc: 'Ativo Circulante',            val: b.ativoCirc,      type: 'value' },
    { desc: '  Caixa e Equivalentes',      val: b.caixa,          type: 'sub' },
    { desc: '  Contas a Receber',          val: b.contasReceber,  type: 'sub' },
    { desc: '  Estoques',                  val: b.estoques,       type: 'sub' },
    { desc: 'Ativo Não Circulante',        val: b.ativoNC,        type: 'value' },
    { desc: 'Ativo Total',                 val: b.ativoTotal,     type: 'total' },
    { desc: '',                            val: null, type: 'sep' },
    { desc: 'PASSIVO',                     val: null, type: 'head' },
    { desc: 'Passivo Circulante',          val: b.passivoCirc,    type: 'value' },
    { desc: '  Fornecedores',              val: b.fornecedores,   type: 'sub' },
    { desc: 'Passivo Não Circulante',      val: b.passivoNC,      type: 'value' },
    { desc: '  Empréstimos/Financ.',       val: b.emprestimos,    type: 'sub' },
    { desc: 'Passivo Total',               val: b.passivoTotal,   type: 'total' },
    { desc: '',                            val: null, type: 'sep' },
    { desc: 'PATRIMÔNIO LÍQUIDO',          val: b.pl,             type: 'total' },
    { desc: '',                            val: null, type: 'sep' },
    { desc: 'INDICADORES',                 val: null, type: 'head' },
    { desc: 'Liquidez Corrente',           val: b.liqCorrente,    type: 'idx' },
    { desc: 'Liquidez Seca',               val: b.liqSeca,        type: 'idx' },
    { desc: 'Liquidez Imediata',           val: b.liqImediata,    type: 'idx' },
    { desc: 'Endividamento',               val: b.endividamento,  type: 'pct' },
    { desc: 'Composição Endividamento',    val: b.compEndiv,      type: 'pct' },
  ];
}
