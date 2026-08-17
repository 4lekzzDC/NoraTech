// Engine puro do Transformador de Extrato (sem React, sem DOM).
// Porta fiel das funções teProcessFile / teParseExtrato / teExport do Autonomy.
//
// Schema dos registros: { data: 'DD/MM/YYYY', descricao: string, pagar: number, receber: number }
// PDF parsing usa pdfjs-dist (carregado dinamicamente para não inflar o bundle inicial).

import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────────────────
// pdfjs — lazy load + worker
// ──────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────
// PDF → texto
// ──────────────────────────────────────────────────────────────────────

async function extractTextFromPdf(file) {
  const pdfjsLib = await getPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Agrupa itens por posição Y (reconstrução de linhas, fiel ao legado)
    const lines = [];
    let lastY = null;
    let currentLine = '';
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += item.str + ' ';
      lastY = y;
    });
    if (currentLine.trim()) lines.push(currentLine.trim());
    fullText += lines.join('\n') + '\n';
  }
  return fullText;
}

// ──────────────────────────────────────────────────────────────────────
// Parse principal — porta fiel de teParseExtrato (dashboard.html 7117-7260)
// ──────────────────────────────────────────────────────────────────────

export function parseExtrato(text) {
  const rows = [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Detecta ano pelo cabeçalho do PDF (ex: "fevereiro/2026")
  let inferredYear = new Date().getFullYear().toString();
  const yearMatch = text.match(
    /(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/?\s*(\d{4})/i,
  );
  if (yearMatch) inferredYear = yearMatch[1];

  const dateRegexFull  = /^(\d{2}[\/.\-]\d{2}[\/.\-]\d{2,4})\s+/;
  const dateRegexShort = /^(\d{2}\/\d{2})\s+/;

  const skipLine = (l) => {
    const lw = l.toLowerCase();
    return (
      /^(extrato consolidado|prezado cliente|solu[çc][õo]es em|o santander|getnet:|cobran[çc]as:|pix:|pagamento a fornecedores|tributos:|fopa:|extrato_pj|balp_|pagina:|fale conosco|loja:|central de|consultas,|de segunda|s[aá]bado|4004|0800 |55 11|libras|acesse:|ouvidoria|se n[ãa]o ficou|ou pelo|para contrata|das 8h|nome$|ag[eê]ncia|conta corrente$)/i.test(lw) ||
      /^resumo\s*[-–]/.test(lw) ||
      /^\(\s*[=+\-]\s*\)/.test(l) ||
      /^(dep[oó]sitos\s*\/|outros\s*(cr[eé]ditos|d[eé]bitos)|pagamentos\s*\/|limite\s*santander|saldo\s*(de\s*conta|de\s*investimentos|dispon[ií]vel)|movimenta[çc][ãa]o$)/i.test(lw) ||
      /^data\s+descri/i.test(lw) ||
      /^cr[eé]ditos\s+d[eé]bitos/i.test(lw)
    );
  };

  let currentDate = '';
  let lastRow = null;
  // Linhas sem valor ficam aqui até aparecer uma linha com valor: só então
  // dá pra saber se elas eram a descrição de uma transação nova (valor veio
  // numa linha separada, ex: "CANCELAMENTO PGTO TITULO" + "DADOS TITULO NAO
  // VALIDOS" + "- 4.398,00") ou só um complemento da transação anterior.
  let pendingDesc = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // O PDF do Santander emenda, depois do último lançamento, um resumo de
    // "Saldos por Período" seguido de um relatório à parte de investimentos
    // (CDB) com sua própria tabela "Valor Principal (R$)...". Nada dali é
    // lançamento de extrato — para por aqui para não confundir texto de
    // rodapé/disclaimer/relatório de CDB com descrição de transação.
    if (/^saldos por per[íi]odo/i.test(line) || /valor\s+principal\s*\(r\$\)/i.test(line)) break;

    if (skipLine(line)) continue;

    let rest = line;
    let hasDate = false;

    let dateMatch = line.match(dateRegexFull);
    if (dateMatch) {
      currentDate = dateMatch[1];
      rest = line.substring(dateMatch[0].length).trim();
      hasDate = true;
    } else {
      dateMatch = line.match(dateRegexShort);
      if (dateMatch) {
        currentDate = dateMatch[1] + '/' + inferredYear;
        rest = line.substring(dateMatch[0].length).trim();
        hasDate = true;
      }
    }

    const restLow = rest.toLowerCase();
    if (
      restLow.startsWith('saldo em') || restLow.startsWith('saldo para') ||
      restLow.startsWith('saldo anterior') || restLow.startsWith('saldo final') ||
      restLow.includes('s a l d o')
    ) continue;
    if (/^total\b/i.test(rest)) continue;
    if (!currentDate) continue;

    // Coleta todos os valores monetários da linha
    const allVals = [];
    const vScan = /((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})\s*(-?)/g;
    let vm;
    while ((vm = vScan.exec(rest)) !== null) {
      const nv = parseFloat(vm[1].replace(/\./g, '').replace(',', '.'));
      allVals.push({ value: Math.abs(nv), hasMinus: vm[2] === '-', index: vm.index });
    }

    if (allVals.length === 0) {
      // Linha de continuação — ainda não dá pra saber se é o começo da
      // descrição de uma transação nova ou o complemento da anterior.
      // Só decide quando a próxima linha com valor aparecer.
      // Descrição real de lançamento nunca passa de 2-3 linhas; um buffer
      // maior que isso é sinal de texto solto (rodapé, disclaimer) — nesse
      // caso é mais seguro descartar do que inventar uma linha com ele.
      if (rest.length >= 2 && !/^\d+$/.test(rest) && pendingDesc.length < 4) {
        pendingDesc.push(rest);
      }
      continue;
    }

    // Santander: débito tem "-" no final, crédito não
    const debitVal = allVals.find((v) => v.hasMinus);
    const transVal = debitVal || allVals[0];

    let descricao = rest.substring(0, transVal.index).trim();
    descricao = descricao.replace(/\s+\d{4,6}\s*$/, '').replace(/\s+-\s*$/, '').trim();
    descricao = descricao.replace(/\s+/g, ' ').trim();

    // Linha "vazia" além do valor (só um "-" ou um nº de documento solto):
    // a descrição real estava nas linhas anteriores sem valor. Se, ao
    // contrário, esta linha já trouxe descrição própria, o que ficou
    // pendente era complemento da transação anterior.
    const inlineDescTrivial = !descricao || descricao.length < 2 || /^-+$/.test(descricao) || /^\d+$/.test(descricao);
    if (pendingDesc.length > 0) {
      if (inlineDescTrivial && pendingDesc.length < 4) {
        descricao = pendingDesc.join(' ').trim();
      } else if (lastRow) {
        lastRow.descricao += ' ' + pendingDesc.join(' ');
      }
      pendingDesc = [];
    }

    if (!descricao || descricao.length < 2) { lastRow = null; continue; }

    const lower = descricao.toLowerCase();
    if (
      lower.includes('saldo anterior') || lower.includes('saldo final') ||
      lower.includes('saldo do dia') || lower.includes('total de créditos') ||
      lower.includes('total de débitos')
    ) { lastRow = null; continue; }

    let pagar = 0;
    let receber = 0;

    if (transVal.hasMinus) {
      pagar = transVal.value;
    } else {
      if (
        lower.includes('pagamento cartao') || lower.includes('pix recebido') ||
        lower.includes('ted recebida') || lower.includes('crédito') ||
        lower.includes('credito') || lower.includes('depósito') ||
        lower.includes('deposito') || lower.includes('transferência recebida') ||
        lower.includes('transf recebida') || lower.includes('recebimento') ||
        lower.includes('estorno') || lower.includes('resgate contamax') ||
        lower.includes('cancelamento')
      ) {
        receber = transVal.value;
      } else if (
        lower.includes('pagto') || lower.includes('pgto') ||
        lower.includes('tarifa') || lower.includes('taxa') ||
        lower.includes('ted enviada') || lower.includes('pix enviado') ||
        lower.includes('pix devolvido') || lower.includes('compra') ||
        lower.includes('saque') || lower.includes('transferência enviada') ||
        lower.includes('transf enviada') || lower.includes('transf valor') ||
        lower.includes('boleto') || lower.includes('pagamento de') ||
        lower.includes('aplicacao contamax') || lower.includes('debito pagamento')
      ) {
        pagar = transVal.value;
      } else {
        receber = transVal.value;
      }
    }

    // Normaliza data para DD/MM/YYYY
    let dataFormatted = currentDate.replace(/[.\-]/g, '/');
    const parts = dataFormatted.split('/');
    if (parts[2] && parts[2].length === 2) {
      parts[2] = '20' + parts[2];
      dataFormatted = parts.join('/');
    }

    const row = {
      data: dataFormatted,
      descricao,
      pagar: Math.round(pagar * 100) / 100,
      receber: Math.round(receber * 100) / 100,
    };
    rows.push(row);
    lastRow = row;
  }

  return rows;
}

// ──────────────────────────────────────────────────────────────────────
// Entrada pública: PDF → rows
// ──────────────────────────────────────────────────────────────────────

export async function parsePdf(file) {
  const text = await extractTextFromPdf(file);
  return { rows: parseExtrato(text), rawText: text };
}

// ──────────────────────────────────────────────────────────────────────
// Export XLSX — porta fiel de teExport (dashboard.html 7262-7303)
// ──────────────────────────────────────────────────────────────────────

export function exportToXlsx(rows) {
  const totalPagar   = rows.reduce((a, r) => a + r.pagar, 0);
  const totalReceber = rows.reduce((a, r) => a + r.receber, 0);

  const wsData = [['Data', 'Descrição', 'Valor a Pagar', 'Valor a Receber']];
  rows.forEach((r) => wsData.push([r.data, r.descricao, r.pagar || '', r.receber || '']));
  wsData.push([]);
  wsData.push(['', 'TOTAL', totalPagar, totalReceber]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 18 }, { wch: 18 }];

  for (let r = 1; r <= rows.length; r++) {
    const cellP = XLSX.utils.encode_cell({ r, c: 2 });
    const cellR = XLSX.utils.encode_cell({ r, c: 3 });
    if (ws[cellP]) ws[cellP].z = '#,##0.00';
    if (ws[cellR]) ws[cellR].z = '#,##0.00';
  }
  const totalRow = rows.length + 2;
  const cellTP = XLSX.utils.encode_cell({ r: totalRow, c: 2 });
  const cellTR = XLSX.utils.encode_cell({ r: totalRow, c: 3 });
  if (ws[cellTP]) ws[cellTP].z = '#,##0.00';
  if (ws[cellTR]) ws[cellTR].z = '#,##0.00';

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  const fname = 'Extrato_Transformado_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fname);
  return fname;
}

// ──────────────────────────────────────────────────────────────────────
// Histórico — localStorage isolado por organização (máx 50 entradas)
// ──────────────────────────────────────────────────────────────────────

const TE_HISTORY_KEY = 'te_history';
const MAX_HISTORY = 50;

function teKey(companyId) {
  return companyId ? `${TE_HISTORY_KEY}_${companyId}` : TE_HISTORY_KEY;
}

export function loadHistory(companyId) {
  try { return JSON.parse(localStorage.getItem(teKey(companyId)) || '[]'); }
  catch { return []; }
}

export function pushHistory(entry, current, companyId) {
  const next = [entry, ...current].slice(0, MAX_HISTORY);
  localStorage.setItem(teKey(companyId), JSON.stringify(next));
  return next;
}

export function clearHistory(companyId) {
  localStorage.removeItem(teKey(companyId));
  return [];
}

// ──────────────────────────────────────────────────────────────────────
// Formatação
// ──────────────────────────────────────────────────────────────────────

export function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
