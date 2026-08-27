// Escrita da planilha de apuração. Vive separado de `difalFormato.js` porque
// depende do `xlsx` e do download do navegador — o resto do módulo continua
// rodando no `node --test` sem arrastar essa dependência junto.

import * as XLSX from 'xlsx';
import { linhasExportacao, nomeArquivoExportacao } from './difalFormato.js';

// Largura das colunas na ordem de COLUNAS_EXPORTACAO. Planilha que abre com
// tudo cortado é planilha que o contador refaz na mão.
const LARGURAS = [
  22, 8, 11, 30, 6, 6, 6, 14, 34, 14, 7, 16, 14, 20, 40, 10, 10, 8, 13, 13, 11, 13, 46,
];

const COLUNAS_MOEDA = [18, 19, 20, 21];

export function exportarXlsx(notas, competencia) {
  const linhas = linhasExportacao(notas);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = LARGURAS.map((wch) => ({ wch }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  for (let r = 1; r < linhas.length; r += 1) {
    for (const c of COLUNAS_MOEDA) {
      const celula = ws[XLSX.utils.encode_cell({ r, c })];
      if (celula && typeof celula.v === 'number') celula.z = '#,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DIFAL');
  const nome = nomeArquivoExportacao(competencia);
  XLSX.writeFile(wb, nome);
  return nome;
}
