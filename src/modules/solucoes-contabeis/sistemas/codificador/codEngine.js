// Engine puro do Codificador (sem React, sem DOM).
// Porting fiel das funções do Autonomy v9.0:
//   - _findHeader / _toDecimal / _toDate / codParseRows (dashboard.html 4230–4294)
//   - _normText / _matchRule / codApplyRules                (4297–4323)
//   - codExport (planilha IMPORTACAO Domínio Contábil)       (4342–4397)
//
// PDF parsing (teParseExtrato) NÃO está aqui — depende de pdfjs-dist e
// fica para etapa posterior.

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// XLSX parse — porting de xlsx_parser.py / codParseRows
// ──────────────────────────────────────────────────────────────────────

const HEADER_SYNONYMS = {
  date: ['data', 'dt', 'date'],
  desc: ['historico', 'histórico', 'descricao', 'descrição', 'description', 'lancamento', 'lançamento', 'complemento'],
  value: ['valor', 'value', 'vlr', 'amount'],
  credit: ['credito', 'crédito', 'entrada', 'entradas', 'recebimento', 'recebimentos', 'credit'],
  debit: ['debito', 'débito', 'saida', 'saída', 'saidas', 'saídas', 'pagamento', 'pagamentos', 'debit'],
};

function normHeader(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeader(rows) {
  let bestIdx = 0;
  let bestScore = -1;
  let bestMap = {};
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const headers = rows[i].map((c) => normHeader(String(c ?? '')));
    const mapping = {};
    let score = 0;
    for (const [key, syns] of Object.entries(HEADER_SYNONYMS)) {
      for (let j = 0; j < headers.length; j++) {
        if (syns.includes(headers[j])) {
          mapping[key] = j;
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestMap = mapping;
    }
  }
  return { idx: bestIdx, map: bestMap };
}

function toDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).replace('R$', '').replace(/\s/g, '').trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function toDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  return s;
}

function parseRows(raw) {
  const { idx, map } = findHeader(raw);
  const dataRows = raw.slice(idx + 1);
  const hasCredit = 'credit' in map && 'debit' in map;
  const hasValue = 'value' in map;
  const out = [];
  for (const row of dataRows) {
    if (!row.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) continue;
    const dt = toDate(row[map.date ?? -1]);
    const desc = String(row[map.desc ?? -1] ?? '').trim();
    let value = null;
    let nature = '';
    let credit = 0;
    let debit = 0;
    if (hasCredit) {
      credit = toDecimal(row[map.credit]) ?? 0;
      debit = toDecimal(row[map.debit]) ?? 0;
      value = credit - debit;
      nature = credit > 0 && debit === 0 ? 'C' : debit > 0 && credit === 0 ? 'D' : value > 0 ? 'C' : value < 0 ? 'D' : 'N';
    } else if (hasValue) {
      value = toDecimal(row[map.value]);
      if (value === null) continue;
      nature = value > 0 ? 'C' : value < 0 ? 'D' : 'N';
      credit = value > 0 ? value : 0;
      debit = value < 0 ? -value : 0;
    } else continue;
    out.push({
      date: dt,
      description: desc,
      value: String(value ?? ''),
      nature,
      credit: String(credit),
      debit: String(debit),
    });
  }
  return out;
}

export async function parseXlsxFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'DD/MM/YYYY', defval: '' });
  return parseRows(raw);
}

// ──────────────────────────────────────────────────────────────────────
// Rule engine — porting de rule_engine.py / codApplyRules
// ──────────────────────────────────────────────────────────────────────

function normText(s) {
  return (s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function matchRule(descNorm, rule) {
  const pat = rule.match_type === 'regex' ? rule.pattern : normText(rule.pattern);
  if (rule.match_type === 'contains') return descNorm.includes(pat);
  if (rule.match_type === 'startswith') return descNorm.startsWith(pat);
  if (rule.match_type === 'regex') {
    try {
      return new RegExp(pat).test(descNorm);
    } catch {
      return false;
    }
  }
  return false;
}

export function applyRules(rows, rules, fallback = '9999') {
  let coded = 0;
  const out = rows.map((row) => {
    const descNorm = normText(row.description);
    const matched = rules.find((r) => matchRule(descNorm, r));
    const nr = { ...row, description_norm: descNorm };
    if (matched) {
      nr.coded = 1;
      nr.rule_id = matched.id;
      nr.contra_account = matched.account;
      nr.history_out = matched.history_template || row.description;
      coded++;
    } else {
      nr.coded = 0;
      nr.rule_id = '';
      nr.contra_account = fallback;
      nr.history_out = row.description;
    }
    return nr;
  });
  return { coded, rows: out };
}

// ──────────────────────────────────────────────────────────────────────
// Export — porting de exporter_xlsx.py / codExport
// ──────────────────────────────────────────────────────────────────────

export function exportDominio(rows, { bankCode, empresaName }) {
  if (!rows.length) throw new Error('Nenhum dado para exportar.');
  const ws = {};
  const headers = ['Descricao', 'Data', 'Valor', 'Debito', 'Credito', 'Historico'];
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h };
  });

  rows.forEach((r, i) => {
    const nat = String(r.nature || '').toUpperCase();
    const val = parseFloat(String(r.value || '0').replace(',', '.'));
    const valAbs = Number.isNaN(val) ? 0 : Math.abs(val);
    const contra = String(r.contra_account || '');
    let deb;
    let cred;
    if (nat === 'C') {
      deb = bankCode;
      cred = contra;
    } else if (nat === 'D') {
      deb = contra;
      cred = bankCode;
    } else {
      deb = bankCode;
      cred = contra;
    }
    const rawDate = String(r.date || '');
    const dateStr = rawDate.includes('-') ? rawDate.split('-').reverse().join('/') : rawDate;
    const desc = String(r.description || '');
    const hist = String(r.history_out || r.description || '');
    const cells = [
      { t: 's', v: desc },
      { t: 's', v: dateStr },
      { t: 'n', v: valAbs },
      { t: 's', v: String(deb) },
      { t: 's', v: String(cred) },
      { t: 's', v: hist },
    ];
    cells.forEach((cell, c) => {
      ws[XLSX.utils.encode_cell({ r: i + 1, c })] = cell;
    });
  });

  ws['!ref'] = 'A1:' + XLSX.utils.encode_cell({ r: rows.length, c: 5 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'IMPORTACAO');

  const fname =
    'extrato_dominio_' +
    (empresaName || 'export').replace(/\s+/g, '_') +
    '_' +
    new Date().toISOString().slice(0, 10) +
    '.xlsx';
  const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
  return fname;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers de UI
// ──────────────────────────────────────────────────────────────────────

export function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return 'agora';
  if (d < 3600) return Math.floor(d / 60) + 'min';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  return Math.floor(d / 86400) + 'd';
}
