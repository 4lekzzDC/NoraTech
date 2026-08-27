// Formatação e exportação do resultado da apuração de DIFAL.
//
// Fica separado do motor porque é a única camada que sabe que existe uma
// tela: o motor devolve número e código ('excecao', 'nao_aplicavel'), e é
// aqui que isso vira texto em português. Módulo puro — a escrita do arquivo
// XLSX, que depende do navegador, está em `difalExport.js`.

export function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

// '33071000' → '3307.10.00', que é como o NCM aparece na TIPI e como o fiscal
// procura na tabela. Também pontua os prefixos da hierarquia, porque eles
// aparecem na coluna de origem da alíquota: '330720' → '3307.20'.
export function fmtNcm(valor) {
  const d = String(valor ?? '').replace(/\D+/g, '');
  if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  if (d.length === 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  if (d.length === 4 || d.length === 2) return d;
  return String(valor ?? '') || '—';
}

export function fmtCnpj(valor) {
  const d = String(valor ?? '').replace(/\D+/g, '');
  if (d.length !== 14) return String(valor ?? '') || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function fmtData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

// ── Situações ─────────────────────────────────────────────────────────────
// `cor` é o nome da chave na paleta, não o hex: a página roda em tema claro e
// escuro, e quem resolve isso é o `getPalette`.
export const SITUACOES = {
  calculado:     { label: 'Calculado',     curto: 'OK',       cor: 'green' },
  pendente:      { label: 'Pendente',      curto: 'Pendente', cor: 'gold'  },
  nao_aplicavel: { label: 'Não aplicável', curto: 'N/A',      cor: 'muted' },
};

export function rotuloSituacao(situacao) {
  return SITUACOES[situacao] || { label: situacao || '—', curto: '—', cor: 'muted' };
}

const NOME_NIVEL = { 8: 'item', 6: 'subposição', 4: 'posição', 2: 'capítulo' };

/**
 * De onde saiu a alíquota interna, em duas linhas: o rótulo curto que vai na
 * coluna da tabela e a explicação que aparece ao abrir o item.
 *
 * É o coração da conferência. Sem isso a tela mostra "18%" e o contador não
 * tem como saber se aquilo veio da regra do NCM, de uma exceção ou da regra
 * geral do estado — e é exatamente essa diferença que ele precisa auditar.
 */
export function rotuloOrigemAliquota(aliquotas) {
  if (!aliquotas) return { curto: '—', longo: 'Item sem alíquota apurada.' };
  const { origemInterna, ncmRegra, nivelNcm, fundamento } = aliquotas;

  if (origemInterna === 'regra_geral') {
    return {
      curto: 'Regra geral',
      longo: `Nenhuma faixa de NCM cadastrada casou com este produto: aplicada a alíquota geral do estado. ${fundamento || ''}`.trim(),
    };
  }
  const nivel = NOME_NIVEL[nivelNcm] || 'faixa';
  if (origemInterna === 'excecao') {
    return {
      curto: `${fmtNcm(ncmRegra)} · exceção`,
      longo: `A ${nivel} ${ncmRegra} é exceção cadastrada e remete à regra geral do estado. ${fundamento || ''}`.trim(),
    };
  }
  return {
    curto: `${fmtNcm(ncmRegra)} · ${nivel}`,
    longo: `Alíquota cadastrada para a ${nivel} ${ncmRegra}. ${fundamento || ''}`.trim(),
  };
}

export function rotuloFonteInterestadual(fonte) {
  return fonte === 'destaque_xml'
    ? 'Alíquota destacada na própria nota'
    : 'Alíquota da matriz origem × destino (a nota não destacou)';
}

export const ROTULO_FINALIDADE = {
  uso_consumo: 'Uso e consumo',
  ativo_imobilizado: 'Ativo imobilizado',
  comercializacao: 'Revenda',
  nao_aquisicao: 'Não é aquisição',
  indefinida: 'Indefinida',
};

export const ROTULO_METODO = {
  base_simples: 'Base simples',
  base_dupla: 'Base dupla (por dentro)',
};

// ── Achatamento para tabela e planilha ────────────────────────────────────

/**
 * Junta os itens de todas as notas numa lista só, com os dados da nota
 * repetidos em cada linha. É o formato que a tabela da tela e a planilha
 * consomem — e o que o fiscal cola no papel de trabalho.
 */
export function achatarItens(notas) {
  const linhas = [];
  for (const nota of notas || []) {
    if (!nota?.ok || !nota.processada) continue;
    for (const item of nota.itens) {
      linhas.push({
        arquivo: nota.arquivo ?? null,
        chave: nota.nota.chave,
        numeroNota: nota.nota.numero,
        dataEmissao: nota.nota.dataEmissao,
        emitente: nota.nota.emitente.nome,
        ufOrigem: nota.operacao.ufOrigem,
        ufDestino: nota.operacao.ufDestino,
        ...item,
      });
    }
  }
  return linhas;
}

export const COLUNAS_EXPORTACAO = [
  'Arquivo', 'Nota', 'Emissão', 'Emitente', 'UF origem', 'UF destino',
  'Item', 'Código', 'Descrição', 'NCM', 'CFOP', 'Finalidade', 'Situação',
  'Origem da alíquota', 'Fundamento', 'Alíq. interna (%)', 'Alíq. interestadual (%)',
  'FCP (%)', 'Base', 'DIFAL', 'FCP', 'Total', 'Observação',
];

/**
 * Matriz pronta para virar planilha: cabeçalho, uma linha por item e a linha
 * de total. Valores monetários saem como número (a formatação é da planilha),
 * e a coluna de observação carrega o motivo da pendência ou os alertas — o
 * arquivo exportado precisa se explicar sozinho fora do sistema.
 */
export function linhasExportacao(notas) {
  const itens = achatarItens(notas);
  const linhas = [COLUNAS_EXPORTACAO];

  for (const l of itens) {
    const origem = rotuloOrigemAliquota(l.aliquotas);
    const observacao = [l.motivo, ...(l.alertas || [])].filter(Boolean).join(' · ');
    linhas.push([
      l.arquivo || '', l.numeroNota, fmtData(l.dataEmissao), l.emitente,
      l.ufOrigem, l.ufDestino,
      l.nItem, l.codigo, l.descricao, fmtNcm(l.ncm), l.cfop,
      ROTULO_FINALIDADE[l.finalidade] || '',
      rotuloSituacao(l.situacao).label,
      l.situacao === 'calculado' ? origem.curto : '',
      l.aliquotas?.fundamento || '',
      l.aliquotas?.interna ?? '',
      l.aliquotas?.interestadual ?? '',
      l.aliquotas?.fcp ?? '',
      l.valores.vBase, l.valores.vDifal, l.valores.vFcp, l.valores.vTotal,
      observacao,
    ]);
  }

  const soma = (campo) => itens.reduce((s, l) => s + l.valores[campo], 0);
  linhas.push([]);
  const arredondado = (campo) => Math.round(soma(campo) * 100) / 100;
  // 'TOTAL' cai na coluna de FCP (%), a última antes dos valores, para que a
  // linha de soma fique embaixo das colunas que ela soma.
  linhas.push([
    ...Array(17).fill(''), 'TOTAL',
    arredondado('vBase'), arredondado('vDifal'), arredondado('vFcp'), arredondado('vTotal'),
    '',
  ]);

  return linhas;
}

export function nomeArquivoExportacao(competencia) {
  const marca = competencia || new Date().toISOString().slice(0, 10);
  return `DIFAL_${marca}.xlsx`;
}

/**
 * A conta do item escrita por extenso, do jeito que ela seria feita no papel
 * de trabalho. O contador confere a fórmula, não o resultado — se o número
 * estiver errado, é aqui que ele vê por quê.
 *
 * @returns {{difal: string, fcp: string|null}|null} null em item sem cálculo.
 */
export function explicarCalculo(item) {
  if (!item || item.situacao !== 'calculado' || !item.aliquotas) return null;
  const { interna, interestadual, fcp } = item.aliquotas;
  const { vBase, vBaseDifal, vDifal, vFcp } = item.valores;

  const difal = item.metodoBase === 'base_dupla'
    ? `Base recomposta ${fmtBRL(vBaseDifal)} × ${fmtPct(interna)} − ${fmtBRL(vBase)} × ${fmtPct(interestadual)} = ${fmtBRL(vDifal)}`
    : `${fmtBRL(vBase)} × (${fmtPct(interna)} − ${fmtPct(interestadual)}) = ${fmtBRL(vDifal)}`;

  return {
    difal,
    fcp: fcp > 0 ? `FCP: ${fmtBRL(vBaseDifal)} × ${fmtPct(fcp)} = ${fmtBRL(vFcp)}` : null,
  };
}

/**
 * Competência dominante do lote (o mês da maioria das notas), usada no nome
 * do arquivo exportado. Lote com notas de meses diferentes é comum na virada
 * — o mês da maioria erra menos que o da primeira nota da lista.
 */
export function competenciaDoLote(notas) {
  const contagem = new Map();
  for (const nota of notas || []) {
    const data = nota?.nota?.dataEmissao;
    if (!data) continue;
    const mes = data.slice(0, 7);
    contagem.set(mes, (contagem.get(mes) || 0) + 1);
  }
  if (!contagem.size) return null;
  return [...contagem.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
}
