// Engine puro do Conciliador de Fornecedores (sem React, sem DOM).
// Porta fiel das funções cforn* do Autonomy (dashboard.html 5366-5816).
//
// Lógica central: agrupa lançamentos por (Fornecedor + NF), compara
// total de compras (crédito) com total de pagamentos (débito).
// Status: conciliado | pendente (pago a menos) | excesso (pago a mais)
//
// Schema transação: { nf, date, description, debit, credit, supplier }
// Schema grupo:     { key, nf, supplier, totalCompras, totalPagamentos, transactions[] }

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// Helpers numéricos
// ──────────────────────────────────────────────────────────────────────

export function parseNum(v) {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/[^\d,.\-]/g, '').trim();
  if (!s) return 0;
  // Formato BR: vírgula como decimal (ex: 1.234,56)
  if (/\d,\d{2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

function extractValues(str) {
  // BR: 1.234,56
  const br = [...str.matchAll(/(?<![,\d])(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/g)]
    .map((m) => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
  if (br.length) return br;
  // Internacional: 1234.56
  return [...str.matchAll(/(?<![.\d])(\d+\.\d{2})(?!\d)/g)].map((m) => parseFloat(m[1]));
}

function classify(desc, amount) {
  const u = desc.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isPay = /PAGAMENTO|PAGO|QUITACAO|QUITADA|BAIXA/.test(u);
  const isBuy = /COMPRA|AQUISICAO|NOTA FISCAL|FATURA|ENTRADA/.test(u);
  // Em conta fornecedores: débito = pagamento, crédito = compra
  if (isPay && !isBuy) return { debit: amount, credit: 0 };
  if (isBuy && !isPay) return { debit: 0, credit: amount };
  return { debit: 0, credit: amount }; // default: compra
}

// ──────────────────────────────────────────────────────────────────────
// Parse XLSX/XLS
// ──────────────────────────────────────────────────────────────────────

export function parseXlsxWb(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  // Detecta linha de cabeçalho e mapa de colunas
  let headerRow = -1;
  let cm = { date: -1, desc: -1, debit: -1, credit: -1, value: -1 };
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const r = rows[i].map((c) => String(c).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const di  = r.findIndex((c) => /^dat/.test(c));
    const hi  = r.findIndex((c) => /hist|descr|lanc|memo/.test(c));
    const dbi = r.findIndex((c) => /\bdeb|\bentrad|\bcomp/.test(c));
    const cri = r.findIndex((c) => /\bcred|\bsaid|\bpag/.test(c));
    const vi  = r.findIndex((c) => /\bvalor|\bvalue/.test(c));
    if (hi >= 0 || dbi >= 0 || cri >= 0 || vi >= 0) {
      headerRow = i;
      cm = { date: di, desc: hi, debit: dbi, credit: cri, value: vi };
      break;
    }
  }

  const txs = [];
  let currentSupplier = '';
  const start = headerRow >= 0 ? headerRow + 1 : 0;

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const fullLine = row.map((c) => String(c)).join(' ');
    const supM = fullLine.match(/CONTA[:\s]+[\d.]+\s*[-–—]\s*(.{3,50})/i);
    if (supM && !fullLine.match(/<[^>]+>/)) { currentSupplier = supM[1].trim(); continue; }

    const desc = cm.desc >= 0 ? String(row[cm.desc] || '') : fullLine;
    const nfM = desc.match(/<([^>]+)>/);
    if (!nfM) continue;
    const nf = nfM[1].trim();

    let date = '';
    if (cm.date >= 0 && row[cm.date]) {
      const dv = row[cm.date];
      if (typeof dv === 'number') {
        try {
          const d = XLSX.SSF.parse_date_code(dv);
          date = `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
        } catch { date = String(dv).substring(0, 10); }
      } else { date = String(dv).substring(0, 10); }
    }

    let debit = 0, credit = 0;
    if (cm.debit >= 0 && cm.credit >= 0) {
      debit  = parseNum(row[cm.debit]);
      credit = parseNum(row[cm.credit]);
    } else if (cm.value >= 0) {
      const r = classify(desc, parseNum(row[cm.value]));
      debit = r.debit; credit = r.credit;
    } else {
      const nums = row.map((c) => parseNum(c)).filter((n) => n > 0);
      if (nums.length) { const r = classify(desc, nums[0]); debit = r.debit; credit = r.credit; }
    }

    if (debit > 0 || credit > 0) txs.push({ nf, date, description: desc, debit, credit, supplier: currentSupplier });
  }
  return txs;
}

export async function parseXlsxFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  return parseXlsxWb(wb);
}

// ──────────────────────────────────────────────────────────────────────
// Parse TXT/CSV
// ──────────────────────────────────────────────────────────────────────

export function parseTxt(text) {
  const lines = text.split(/\r?\n/);
  const txs = [];
  let currentSupplier = '';

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (!t.match(/<[^>]+>/)) {
      const sm =
        t.match(/CONTA[:\s]+[\d.]+\s*[-–—]\s*(.{3,60})/i) ||
        t.match(/^FORNECEDOR[:\s]+(.{3,60})/i) ||
        t.match(/^(.{5,50}(?:LTDA|S\.?A\.?|ME|EPP|EIRELI)\.?)\s*$/i);
      if (sm) currentSupplier = sm[1].trim().replace(/\s+/g, ' ');
      continue;
    }

    const nfM = t.match(/<([^>]+)>/);
    if (!nfM) continue;
    const nf = nfM[1].trim();

    const dateM = t.match(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{2})/);
    const date = dateM ? dateM[0] : '';

    const vals = extractValues(t);
    if (!vals.length) continue;

    // Indicador D/C no final da linha tem prioridade
    const dcM = t.match(/\b([DC])\s*$/i);
    let debit = 0, credit = 0;
    if (dcM) {
      if (dcM[1].toUpperCase() === 'D') debit = vals[0]; else credit = vals[0];
    } else {
      const r = classify(t, vals[0]); debit = r.debit; credit = r.credit;
    }

    if (debit > 0 || credit > 0) txs.push({ nf, date, description: t, debit, credit, supplier: currentSupplier });
  }
  return txs;
}

// ──────────────────────────────────────────────────────────────────────
// Dispatcher de arquivo
// ──────────────────────────────────────────────────────────────────────

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsxFile(file);
  }
  // TXT / CSV
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(parseTxt(e.target.result));
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// ──────────────────────────────────────────────────────────────────────
// Agrupamento e status
// ──────────────────────────────────────────────────────────────────────

export function processGroups(transactions) {
  const map = {};
  for (const tx of transactions) {
    const key = (tx.supplier || '') + '||' + tx.nf;
    if (!map[key]) map[key] = { key, nf: tx.nf, supplier: tx.supplier || '', totalCompras: 0, totalPagamentos: 0, transactions: [] };
    map[key].totalCompras    += tx.credit; // crédito = compra em conta fornecedores
    map[key].totalPagamentos += tx.debit;  // débito  = pagamento
    map[key].transactions.push(tx);
  }
  return Object.values(map);
}

export function getStatus(group) {
  const diff = group.totalCompras - group.totalPagamentos;
  if (Math.abs(diff) < 0.01) return 'conciliado';
  return diff > 0 ? 'pendente' : 'excesso';
}

// ──────────────────────────────────────────────────────────────────────
// Export XLSX (2 abas: Resumo + Lançamentos)
// ──────────────────────────────────────────────────────────────────────

export function exportToXlsx(groups, transactions) {
  const wb = XLSX.utils.book_new();

  const statusLabel = { conciliado: 'Conciliado', pendente: 'Pendente', excesso: 'Pago a mais' };

  const sumRows = [
    ['Conciliação de Fornecedores', '', '', '', '', ''],
    ['Gerado em:', new Date().toLocaleString('pt-BR'), '', '', '', ''],
    ['', '', '', '', '', ''],
    ['NF', 'Fornecedor', 'Total Compras', 'Total Pago', 'Diferença', 'Status'],
  ];
  groups.forEach((g) => {
    const st = getStatus(g);
    sumRows.push([g.nf, g.supplier, g.totalCompras, g.totalPagamentos, g.totalCompras - g.totalPagamentos, statusLabel[st]]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Resumo');

  const detRows = [['NF', 'Fornecedor', 'Data', 'Histórico', 'Tipo', 'Valor']];
  transactions.forEach((tx) => {
    detRows.push([tx.nf, tx.supplier, tx.date, tx.description, tx.debit > 0 ? 'Pagamento' : 'Compra', tx.debit > 0 ? tx.debit : tx.credit]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detRows), 'Lançamentos');

  XLSX.writeFile(wb, 'conciliacao_fornecedores.xlsx');
}

// ──────────────────────────────────────────────────────────────────────
// Persistência do último resumo (localStorage)
// ──────────────────────────────────────────────────────────────────────

const SUMMARY_KEY = 'cfornLastSummary';

function cfornKey(companyId) {
  return companyId ? `${SUMMARY_KEY}_${companyId}` : SUMMARY_KEY;
}

export function loadLastSummary(companyId) {
  try { return JSON.parse(localStorage.getItem(cfornKey(companyId)) || 'null'); }
  catch { return null; }
}

export function saveLastSummary(groups, companyId) {
  const summary = {
    date:     new Date().toISOString(),
    total:    groups.length,
    ok:       groups.filter((g) => getStatus(g) === 'conciliado').length,
    pendente: groups.filter((g) => getStatus(g) === 'pendente').length,
    excesso:  groups.filter((g) => getStatus(g) === 'excesso').length,
  };
  localStorage.setItem(cfornKey(companyId), JSON.stringify(summary));
  return summary;
}

// ──────────────────────────────────────────────────────────────────────
// Formatação
// ──────────────────────────────────────────────────────────────────────

export function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
