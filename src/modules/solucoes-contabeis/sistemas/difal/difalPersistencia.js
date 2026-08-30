// Tradução entre o resultado do motor e as linhas do banco.
//
// Módulo puro: não fala com o Supabase (isso é do `difal.service.js`), só
// converte forma. Fica separado porque a ida e a volta precisam FECHAR — o
// que a tela mostra depois de recarregar tem que ser idêntico ao que ela
// mostrava antes de salvar, e isso é testável sem banco nenhum.
//
// A volta reaproveita `consolidar` do pipeline em vez de gravar totais por
// nota e recalcular à mão: os totais do lote, a quebra por NCM e a lista de
// pendências saem da MESMA função que os produz no processamento ao vivo.
// Um caminho só, um comportamento só.

import { consolidar } from './difalPipeline.js';

// Situação da nota como ela vai para o banco. O motor tem três estados de
// nota (lida e processada, lida e descartada, ilegível) e o banco precisa
// distinguir os três para a tela remontar a lista igualzinha.
export function situacaoDaNota(nota) {
  if (!nota?.ok) return 'erro';
  if (nota.processada) return 'processada';
  return nota.situacao || 'nao_aplicavel';
}

/**
 * Resultado do motor → linhas prontas para gravar.
 *
 * @param {object} resultado  saída de `processarLote`
 * @param {object} contexto
 *   tenantCompanyId, accountingCompanyId, competencia, ufDestino,
 *   metodoBase, politicaRevenda, versaoMotor, versaoTabela, createdBy
 * @param {object} [xmlPorArquivo]  { [nomeDoArquivo]: xml } — o texto original
 *   de cada nota. Ausente, a nota é gravada sem XML (a lupa fica sem a aba).
 */
export function linhasParaGravar(resultado, contexto, xmlPorArquivo = {}) {
  const apuracao = {
    tenant_company_id: contexto.tenantCompanyId,
    accounting_company_id: contexto.accountingCompanyId || null,
    competencia: contexto.competencia,
    uf_destino: contexto.ufDestino || null,
    metodo_base: contexto.metodoBase || 'base_simples',
    politica_revenda: contexto.politicaRevenda || 'nao_incide',
    versao_motor: String(contexto.versaoMotor ?? ''),
    versao_tabela: contexto.versaoTabela || null,
    status: contexto.status || 'aberta',
    totais: resultado.totais,
    observacoes: contexto.observacoes || null,
    created_by: contexto.createdBy || null,
  };

  const notas = (resultado.notas || []).map((nota) => ({
    nota: {
      tenant_company_id: contexto.tenantCompanyId,
      arquivo: nota.arquivo || null,
      chave: nota.nota?.chave || null,
      numero: nota.nota?.numero || null,
      serie: nota.nota?.serie || null,
      data_emissao: nota.nota?.dataEmissao || null,
      emitente_cnpj: nota.nota?.emitente?.cnpj || null,
      emitente_nome: nota.nota?.emitente?.nome || null,
      uf_origem: nota.operacao?.ufOrigem || nota.nota?.emitente?.uf || null,
      uf_destino: nota.operacao?.ufDestino || nota.nota?.destinatario?.uf || null,
      situacao: situacaoDaNota(nota),
      motivo: nota.motivo || nota.erro || null,
      totais: nota.totais,
      identificacao: nota.nota || null,
      xml: (nota.arquivo && xmlPorArquivo[nota.arquivo]) || null,
    },
    itens: (nota.itens || []).map((item) => ({
      n_item: item.nItem,
      codigo: item.codigo || null,
      descricao: item.descricao || null,
      ncm: item.ncm || null,
      cfop: item.cfop || null,
      situacao: item.situacao,
      motivo: item.motivo || null,
      finalidade: item.finalidade || null,
      aliquota_interna: item.aliquotas?.interna ?? null,
      aliquota_interestadual: item.aliquotas?.interestadual ?? null,
      fcp: item.aliquotas?.fcp ?? null,
      origem_interna: item.aliquotas?.origemInterna || null,
      ncm_regra: item.aliquotas?.ncmRegra || null,
      fundamento: item.aliquotas?.fundamento || null,
      fonte_interestadual: item.aliquotas?.fonteInterestadual || null,
      v_base: item.valores.vBase,
      v_base_difal: item.valores.vBaseDifal,
      v_difal: item.valores.vDifal,
      v_fcp: item.valores.vFcp,
      v_total: item.valores.vTotal,
      base: item.base || null,
      fonte: item.fonte || null,
      alertas: item.alertas || [],
    })),
  }));

  return { apuracao, notas };
}

// Numérico do Postgres volta como string em alguns drivers. Um total que
// vira '143.00' e entra numa soma de string estragaria a guia inteira.
function num(valor) {
  if (valor == null || valor === '') return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function numOuNulo(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function itemDeLinha(linha, metodoBase) {
  const interna = numOuNulo(linha.aliquota_interna);
  const interestadual = numOuNulo(linha.aliquota_interestadual);
  const ncmRegra = linha.ncm_regra || null;

  // Item sem cálculo não tem bloco de alíquotas — é o que a tela usa para
  // decidir entre mostrar os percentuais e mostrar o travessão.
  const aliquotas = interna == null ? null : {
    interna,
    interestadual,
    fcp: num(linha.fcp),
    diferencial: Math.round((interna - interestadual) * 100) / 100,
    fonteInterestadual: linha.fonte_interestadual || null,
    origemInterna: linha.origem_interna || null,
    // O nível é o comprimento do prefixo cadastrado; regra geral não tem
    // prefixo, e aí o nível é 0.
    nivelNcm: ncmRegra ? ncmRegra.length : 0,
    ncmRegra,
    fundamento: linha.fundamento || null,
  };

  return {
    fonte: linha.fonte || null,
    nItem: linha.n_item,
    codigo: linha.codigo || '',
    descricao: linha.descricao || '',
    ncm: linha.ncm || '',
    cfop: linha.cfop || '',
    situacao: linha.situacao,
    motivo: linha.motivo || null,
    finalidade: linha.finalidade || null,
    aliquotas,
    ...(linha.base ? { base: linha.base } : {}),
    valores: {
      vBase: num(linha.v_base),
      vBaseDifal: num(linha.v_base_difal),
      vDifal: num(linha.v_difal),
      vFcp: num(linha.v_fcp),
      vTotal: num(linha.v_total),
    },
    ...(linha.situacao === 'calculado' ? { metodoBase } : {}),
    alertas: linha.alertas || [],
  };
}

/**
 * Linhas do banco → o mesmo formato que `processarLote` devolve, para a tela
 * desenhar uma apuração salva exatamente como desenha uma recém-processada.
 *
 * @param {object} apuracao  linha de difal_apuracoes
 * @param {Array}  notas     linhas de difal_apuracao_notas, cada uma com `itens`
 */
export function resultadoDeLinhas(apuracao, notas = []) {
  const metodoBase = apuracao?.metodo_base || 'base_simples';

  const reconstruidas = notas.map((linha) => {
    const itens = (linha.itens || [])
      .slice()
      .sort((a, b) => a.n_item - b.n_item)
      .map((i) => itemDeLinha(i, metodoBase));

    const identificacao = {
      chave: linha.chave || '',
      numero: linha.numero || '',
      serie: linha.serie || '',
      dataEmissao: linha.data_emissao || null,
      emitente: { cnpj: linha.emitente_cnpj || '', nome: linha.emitente_nome || '', uf: linha.uf_origem || '' },
      destinatario: { uf: linha.uf_destino || '' },
      ...(linha.identificacao || {}),
    };

    if (linha.situacao === 'erro') {
      return {
        ok: false, processada: false, arquivo: linha.arquivo || null,
        erro: linha.motivo || 'Arquivo ilegível.',
        nota: null, itens: [], totais: linha.totais || {}, alertas: [],
      };
    }

    const base = {
      ok: true,
      arquivo: linha.arquivo || null,
      nota: identificacao,
      totais: linha.totais || {},
      alertas: [],
    };

    if (linha.situacao !== 'processada') {
      return {
        ...base, processada: false,
        situacao: linha.situacao, motivo: linha.motivo || null, itens: [],
      };
    }

    return {
      ...base,
      processada: true,
      situacao: 'processada',
      motivo: null,
      versaoMotor: apuracao?.versao_motor,
      versaoTabela: apuracao?.versao_tabela,
      operacao: {
        ufOrigem: linha.uf_origem || '',
        ufDestino: linha.uf_destino || '',
        metodoBase,
        politicaRevenda: apuracao?.politica_revenda || 'nao_incide',
      },
      itens,
    };
  });

  return { notas: reconstruidas, ...consolidar(reconstruidas) };
}

// Índice { arquivo: xml } a partir do que a tela tem em mãos.
export function xmlPorArquivo(entradas = []) {
  return entradas.reduce((acc, e) => {
    if (e?.nome) acc[e.nome] = e.xml;
    return acc;
  }, {});
}
