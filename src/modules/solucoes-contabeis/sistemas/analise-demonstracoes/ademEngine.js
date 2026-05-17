// Engine puro da Análise de Demonstrações (sem React, sem DOM).
// Porta fiel das funções adem* do Autonomy (dashboard.html 6396-6925).
//
// Fluxo: XLSX upload → parse DRE/Balanço/Balancete → computed object
// → KPIs + 6 gráficos no dashboard → tabelas de detalhamento
//
// localStorage: chave 'adem_data' (preservada do legado)

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
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

function findRow(rows, keywords) {
  const kws = keywords.map((k) => k.toLowerCase());
  for (const row of rows) {
    const label = String(row[0] || '').toLowerCase().trim();
    if (kws.some((kw) => label.includes(kw))) return row;
  }
  return null;
}

function findVal(rows, keywords) {
  const row = findRow(rows, keywords);
  if (!row) return 0;
  for (let i = row.length - 1; i >= 1; i--) {
    const v = parseNum(row[i]);
    if (v !== 0) return v;
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────────────
// Parse de cada demonstração
// ──────────────────────────────────────────────────────────────────────

export function parseDRE(rows) {
  const recBruta   = findVal(rows, ['receita bruta', 'receita operacional bruta', 'faturamento bruto']);
  const deducoes   = Math.abs(findVal(rows, ['deduç', '(-) deduç', 'deducoes', 'abatimento']));
  const recLiquida = findVal(rows, ['receita líquida', 'receita operacional líquida']) || recBruta - deducoes;
  const cmv        = Math.abs(findVal(rows, ['custo', 'cmv', 'cpv', 'custo dos produtos', 'custo das mercadorias', 'custo dos serviços']));
  const lucroBruto = findVal(rows, ['lucro bruto', 'resultado bruto']) || (recLiquida - cmv);
  const despOp     = Math.abs(findVal(rows, ['despesas operacionais', 'total despesas operac']));
  const despAdmin  = Math.abs(findVal(rows, ['administrativ', 'despesas administrativ']));
  const despVendas = Math.abs(findVal(rows, ['vendas', 'despesas com vendas', 'despesas comerciais']));
  const despFin    = Math.abs(findVal(rows, ['financeiras', 'despesas financeiras', 'resultado financeiro']));
  const depAmort   = Math.abs(findVal(rows, ['depreciaç', 'amortizaç', 'deprec']));
  const lucroOp    = findVal(rows, ['lucro operacional', 'resultado operacional', 'resultado antes']) || (lucroBruto - despOp - despAdmin - despVendas);
  const ir         = Math.abs(findVal(rows, ['imposto de renda', 'irpj', 'csll', 'provisão para ir']));
  const lucroLiq   = findVal(rows, ['lucro líquido', 'resultado líquido', 'resultado do exercício', 'lucro/prejuízo']) || (lucroOp - ir);
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
  const ativoTotal    = findVal(rows, ['ativo total', 'total do ativo', 'total ativo']);
  const ativoCirc     = findVal(rows, ['ativo circulante', 'total ativo circulante']);
  const ativoNC       = findVal(rows, ['ativo não circulante', 'ativo nao circulante', 'total ativo não circulante']) || (ativoTotal - ativoCirc);
  const caixa         = findVal(rows, ['caixa', 'disponibilidades', 'caixa e equivalentes', 'bancos']);
  const estoques      = findVal(rows, ['estoque', 'estoques']);
  const contasReceber = findVal(rows, ['contas a receber', 'clientes', 'duplicatas a receber']);
  const passivoTotal  = findVal(rows, ['passivo total', 'total do passivo', 'total passivo']);
  const passivoCirc   = findVal(rows, ['passivo circulante', 'total passivo circulante']);
  const passivoNC     = findVal(rows, ['passivo não circulante', 'passivo nao circulante', 'exigível a longo', 'total passivo não circulante']);
  const pl            = findVal(rows, ['patrimônio líquido', 'patrimonio liquido', 'total patrimônio', 'total do patrimônio']) || (ativoTotal - passivoTotal);
  const fornecedores  = findVal(rows, ['fornecedores', 'contas a pagar']);
  const emprestimos   = findVal(rows, ['empréstimos', 'emprestimos', 'financiamentos']);

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
  const contas = [];
  for (const row of rows) {
    if (!row || !row[0]) continue;
    const cod  = String(row[0]).trim();
    const desc = String(row[1] || row[0] || '').trim();
    if (!desc || desc.length < 2) continue;
    const debito  = parseNum(row[2] || row[1]);
    const credito = parseNum(row[3] || row[2]);
    const saldo   = parseNum(row[4] || row[3]) || Math.abs(debito - credito);
    if (debito === 0 && credito === 0 && saldo === 0) continue;
    contas.push({ cod, desc, debito, credito, saldo: Math.abs(saldo) });
  }
  contas.sort((a, b) => b.saldo - a.saldo);
  return { contas };
}

// ──────────────────────────────────────────────────────────────────────
// Leitura de arquivo XLSX
// ──────────────────────────────────────────────────────────────────────

export async function loadXlsxFile(file) {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
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

export function saveParsed(parsed) {
  try { localStorage.setItem(ADEM_KEY, JSON.stringify(parsed)); } catch { /* quota */ }
}

export function loadParsed() {
  try { return JSON.parse(localStorage.getItem(ADEM_KEY) || 'null'); } catch { return null; }
}

export function clearParsed() {
  localStorage.removeItem(ADEM_KEY);
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
