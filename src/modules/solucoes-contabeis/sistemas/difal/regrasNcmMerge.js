// Monta o objeto de tabela que `ncmBusca`/`difalEngine` esperam — a partir
// de linhas de banco, não mais da constante em `ncmRegras.js`.
//
// Módulo puro: recebe arrays de linha, devolve `{ uf, versao, metodoBase,
// politicaRevenda, regraGeral, regras }`, o MESMO formato de `TABELA_SP`. O
// motor de busca (`ncmBusca.buscarAliquotaInterna`) não muda uma linha —
// só passa a receber esse objeto de uma fonte diferente.
//
// A regra de mistura é por PREFIXO inteiro, não por linha: se o escritório
// cadastrou QUALQUER regra para '3307', as regras globais para '3307' (a
// posição toda, com todas as vigências que ela já teve) somem, e só o que o
// escritório cadastrou vale. Meio prefixo global, meio prefixo do
// escritório, seria demais para auditar depois — "de quem é esta linha?"
// precisa ter resposta única.

function agruparPorPrefixo(linhas) {
  const grupos = new Map();
  for (const linha of linhas || []) {
    const lista = grupos.get(linha.ncm_prefixo) || [];
    lista.push(linha);
    grupos.set(linha.ncm_prefixo, lista);
  }
  return grupos;
}

function linhaParaRegra(linha, origemAjuste) {
  const regra = {
    ncm: linha.ncm_prefixo,
    tipo: linha.tipo,
    fundamento: linha.fundamento,
    // 'tenant' quando esta linha sobrepôs a base global — a tela usa isto
    // para avisar "esta alíquota não é a que o admin da plataforma
    // cadastrou, é um ajuste deste escritório".
    origemAjuste,
  };
  if (linha.segue_geral) regra.seguirGeral = true;
  else regra.aliquota = Number(linha.aliquota);
  if (linha.fcp != null) regra.fcp = Number(linha.fcp);
  if (linha.excecao_de) regra.excecaoDe = linha.excecao_de;
  if (linha.vigencia_inicio) regra.vigenciaInicio = linha.vigencia_inicio;
  if (linha.vigencia_fim) regra.vigenciaFim = linha.vigencia_fim;
  return regra;
}

/**
 * @param {object} args
 *   uf              string
 *   configGlobal    linha de difal_uf_config com tenant_company_id null, ou null
 *   configTenant    linha de difal_uf_config daquele escritório, ou null
 *   regrasGlobais   linhas de difal_regras_ncm globais
 *   regrasTenant    linhas de difal_regras_ncm daquele escritório
 *
 * @returns {object|null} tabela pronta para `buscarAliquotaInterna`, ou
 *   `null` quando a UF não tem config nem global nem do escritório — mesmo
 *   sinal de "não cadastrada" que `getTabela()` sempre devolveu.
 */
export function montarTabelaUf({ uf, configGlobal, configTenant, regrasGlobais, regrasTenant }) {
  const config = configTenant || configGlobal;
  if (!config) return null;

  const globaisPorPrefixo = agruparPorPrefixo(regrasGlobais);
  const doTenantPorPrefixo = agruparPorPrefixo(regrasTenant);
  const prefixos = new Set([...globaisPorPrefixo.keys(), ...doTenantPorPrefixo.keys()]);

  const regras = [];
  for (const prefixo of prefixos) {
    const doTenant = doTenantPorPrefixo.has(prefixo);
    const linhas = doTenant ? doTenantPorPrefixo.get(prefixo) : globaisPorPrefixo.get(prefixo);
    for (const linha of linhas) regras.push(linhaParaRegra(linha, doTenant ? 'tenant' : 'global'));
  }

  return {
    uf,
    versao: config.versao || null,
    metodoBase: config.metodo_base,
    politicaRevenda: config.politica_revenda,
    regraGeral: {
      aliquota: Number(config.regra_geral_aliquota),
      fcp: Number(config.regra_geral_fcp || 0),
      fundamento: config.regra_geral_fundamento,
    },
    regras,
  };
}

/** Lista de prefixos que o escritório sobrepôs à base global — para a tela
 * explicar por que uma regra não é a que o admin da plataforma cadastrou. */
export function prefixosAjustados(regrasTenant) {
  return [...new Set((regrasTenant || []).map((l) => l.ncm_prefixo))];
}
