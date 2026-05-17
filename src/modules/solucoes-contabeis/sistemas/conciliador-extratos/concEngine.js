// Engine puro do Conciliador de Extratos (sem React, sem DOM).
// Porting fiel das funções do Autonomy v9.0:
//   - concParseXlsx / concParseDate / concParseNum / concFmtDate (dashboard.html 5124–5238)
//   - concMatch (greedy por valor + data ±3 dias)              (5265–5284)
//   - concExport (planilha "Conciliação" XLSX)                 (5327–5362)
//
// Schema dos registros: { date: Date, dateStr: 'DD/MM/AAAA', desc: string, value: number }
// PDF parsing NÃO está aqui — depende de pdfjs-dist; fica para etapa posterior.

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export function parseDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Excel serial → JS Date (epoch 1899-12-30 + days)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/)
         || s.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{2})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const d = new Date(+y, +m[2] - 1, +m[1]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d) {
  if (!d) return '—';
  return String(d.getDate()).padStart(2, '0') + '/' +
         String(d.getMonth() + 1).padStart(2, '0') + '/' +
         d.getFullYear();
}

export function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().replace(/\s/g, '').replace('−', '-');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let clean = s;
  if (lastComma > lastDot) clean = s.replace(/\./g, '').replace(',', '.');
  else clean = s.replace(/,/g, '');
  return parseFloat(clean) || 0;
}

// ──────────────────────────────────────────────────────────────────────
// XLSX parser
// ──────────────────────────────────────────────────────────────────────

export async function parseXlsx(file, tipo) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerRow = -1;
  let cols = {};
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i].map((c) => String(c).toLowerCase().trim());
    const di  = row.findIndex((c) => /data|date/.test(c));
    const vi  = row.findIndex((c) => /valor|value|vl[_ ]/.test(c));
    const di2 = row.findIndex((c) => /débito|debito|deb/.test(c));
    const ci2 = row.findIndex((c) => /crédito|credito|cred/.test(c));
    const hi  = row.findIndex((c) => /histórico|historico|descri|memo|lançamento|lancamento/.test(c));
    if (di >= 0 && (vi >= 0 || di2 >= 0)) {
      headerRow = i;
      cols = { date: di, value: vi >= 0 ? vi : -1, debit: di2, credit: ci2, desc: hi };
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error('Não foi possível identificar as colunas. Verifique se há colunas de data e valor.');
  }

  const rows = [];
  for (let i = headerRow + 1; i < raw.length; i++) {
    const r = raw[i];
    const dateRaw = r[cols.date];
    if (!dateRaw) continue;
    const dateObj = parseDate(dateRaw);
    if (!dateObj) continue;
    let value = 0;
    if (cols.value >= 0) {
      value = parseNum(r[cols.value]);
    } else {
      const deb = parseNum(r[cols.debit]);
      const cre = parseNum(r[cols.credit]);
      value = cre > 0 ? cre : deb > 0 ? -deb : 0;
    }
    if (value === 0 && tipo !== 'razao') continue;
    const desc = cols.desc >= 0 ? String(r[cols.desc] || '').trim() : '';
    rows.push({ date: dateObj, dateStr: fmtDate(dateObj), desc, value });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────
// Matching: greedy por valor (±0,01) e data (±3 dias, escolhe a menor diferença)
// ──────────────────────────────────────────────────────────────────────

export function match(razao, extrato) {
  const usedR = new Set();
  const usedE = new Set();
  const matched = [];
  const somenteExtrato = [];
  const somenteRazao = [];

  extrato.forEach((e, ei) => {
    let bestIdx = null;
    let bestScore = Infinity;
    razao.forEach((r, ri) => {
      if (usedR.has(ri)) return;
      if (Math.abs(Math.abs(r.value) - Math.abs(e.value)) > 0.01) return;
      const diff = Math.abs(e.date - r.date) / 86400000;
      if (diff <= 3 && diff < bestScore) {
        bestIdx = ri;
        bestScore = diff;
      }
    });
    if (bestIdx !== null) {
      usedR.add(bestIdx);
      usedE.add(ei);
      matched.push({ extrato: e, razao: razao[bestIdx] });
    }
  });

  extrato.forEach((e, i) => { if (!usedE.has(i)) somenteExtrato.push(e); });
  razao.forEach((r, i) => { if (!usedR.has(i)) somenteRazao.push(r); });

  return { matched, somenteExtrato, somenteRazao };
}

// ──────────────────────────────────────────────────────────────────────
// Export para XLSX
// ──────────────────────────────────────────────────────────────────────

export function exportResult(result) {
  const { matched, somenteExtrato, somenteRazao } = result;
  const ws = {};
  const heads = ['Status', 'Data Extrato', 'Descrição Extrato', 'Valor', 'Data Razão', 'Histórico Razão'];
  heads.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });

  let row = 1;
  const addRow = (status, extrato, razao, value) => {
    const cells = [
      { t: 's', v: status },
      { t: 's', v: extrato?.dateStr || '' },
      { t: 's', v: extrato?.desc || '' },
      { t: 'n', v: value },
      { t: 's', v: razao?.dateStr || '' },
      { t: 's', v: razao?.desc || '' },
    ];
    cells.forEach((cell, c) => { ws[XLSX.utils.encode_cell({ r: row, c })] = cell; });
    row++;
  };

  matched.forEach((m) => addRow('Conciliado', m.extrato, m.razao, m.extrato.value));
  somenteExtrato.forEach((e) => addRow('Só no Extrato', e, null, e.value));
  somenteRazao.forEach((r) => addRow('Só no Razão', null, r, r.value));

  ws['!ref'] = 'A1:' + XLSX.utils.encode_cell({ r: row, c: 5 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliação');

  const fname = 'conciliacao_bancaria_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  return fname;
}
