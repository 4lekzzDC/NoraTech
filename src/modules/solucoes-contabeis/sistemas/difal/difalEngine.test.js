import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aliquotaInterestadual, aplicarAliquotas, baseDeCalculo, calcularItem, centavos,
  finalidadeDoCfop,
} from './difalEngine.js';
import { TABELA_SP } from './ncmRegras.js';
import { indexarTabela } from './ncmBusca.js';

// ── Alíquota interestadual ────────────────────────────────────────────────

test('7% saindo do Sul/Sudeste para as demais UFs, 12% no restante', () => {
  const aliq = (o, d, orig = '0') =>
    aliquotaInterestadual({ ufOrigem: o, ufDestino: d, origemProduto: orig });
  assert.equal(aliq('SP', 'BA'), 7);
  assert.equal(aliq('SP', 'ES'), 7, 'ES recebe a 7% apesar de ser Sudeste');
  assert.equal(aliq('PR', 'SP'), 12);
  assert.equal(aliq('BA', 'SP'), 12);
  assert.equal(aliq('ES', 'MG'), 12, 'saída do ES não tem a redução para 7%');
});

test('mercadoria importada é 4%, mas sem similar nacional segue a matriz', () => {
  const aliq = (orig) => aliquotaInterestadual({ ufOrigem: 'SP', ufDestino: 'BA', origemProduto: orig });
  for (const orig of ['1', '2', '3', '8']) assert.equal(aliq(orig), 4);
  for (const orig of ['6', '7']) assert.equal(aliq(orig), 7);
  assert.equal(aliq('0'), 7);
});

// ── CFOP ──────────────────────────────────────────────────────────────────

test('CFOP declara finalidade e se a operação é interestadual', () => {
  assert.deepEqual(finalidadeDoCfop('6556'), { finalidade: 'uso_consumo', interestadual: true });
  assert.deepEqual(finalidadeDoCfop('6551'), { finalidade: 'ativo_imobilizado', interestadual: true });
  assert.deepEqual(finalidadeDoCfop('6102'), { finalidade: 'comercializacao', interestadual: true });
  assert.deepEqual(finalidadeDoCfop('5102'), { finalidade: 'comercializacao', interestadual: false });
  assert.equal(finalidadeDoCfop('6202').finalidade, 'nao_aquisicao', 'devolução');
  assert.equal(finalidadeDoCfop('6901').finalidade, 'nao_aquisicao', 'remessa para industrialização');
  assert.equal(finalidadeDoCfop('6553').finalidade, 'nao_aquisicao', 'devolução de compra de ativo');
  assert.equal(finalidadeDoCfop('').finalidade, 'indefinida');
});

// ── Base de cálculo ───────────────────────────────────────────────────────

const item = (extra = {}) => ({
  vProd: 1000, vFrete: 100, vSeg: 50, vDesc: 150, vOutro: 30, vIpi: 200, ...extra,
});

test('base soma acessórias e subtrai desconto', () => {
  const { valor } = baseDeCalculo(item(), 'comercializacao');
  assert.equal(valor, 1030); // 1000 + 100 + 50 + 30 − 150
});

test('IPI integra a base em uso e consumo e ativo, mas não em revenda', () => {
  assert.equal(baseDeCalculo(item(), 'uso_consumo').valor, 1230);
  assert.equal(baseDeCalculo(item(), 'ativo_imobilizado').valor, 1230);
  assert.equal(baseDeCalculo(item(), 'comercializacao').valor, 1030);
  assert.equal(baseDeCalculo(item(), 'uso_consumo').ipiIntegra, true);
});

test('centavos arredonda meio centavo para cima, sem erro de ponto flutuante', () => {
  assert.equal(centavos(0.1 + 0.2), 0.3);
  assert.equal(centavos(1.005), 1.01);
  assert.equal(centavos(143.0000000001), 143);
});

// ── Aplicação das alíquotas ───────────────────────────────────────────────

test('base simples: diferença de alíquota sobre a base', () => {
  const r = aplicarAliquotas({ base: 1000, aliquotaInterna: 18, aliquotaInter: 12 });
  assert.equal(r.vDifal, 60);
  assert.equal(r.vBaseDifal, 1000);
  assert.equal(r.vTotal, 60);
});

test('base dupla: recompõe a base por dentro antes do confronto', () => {
  const r = aplicarAliquotas({
    base: 1000, aliquotaInterna: 18, aliquotaInter: 12, metodoBase: 'base_dupla',
  });
  // 1000 × 0,88 ÷ 0,82 = 1073,17 → 1073,17 × 18% − 1000 × 12% = 73,17
  assert.equal(r.vBaseDifal, 1073.17);
  assert.equal(r.vDifal, 73.17);
});

test('FCP incide sobre a base do método usado e entra no total', () => {
  const simples = aplicarAliquotas({ base: 1000, aliquotaInterna: 25, aliquotaInter: 12, fcp: 2 });
  assert.deepEqual(
    { difal: simples.vDifal, fcp: simples.vFcp, total: simples.vTotal },
    { difal: 130, fcp: 20, total: 150 },
  );
  const dupla = aplicarAliquotas({
    base: 1000, aliquotaInterna: 25, aliquotaInter: 12, fcp: 2, metodoBase: 'base_dupla',
  });
  assert.equal(dupla.vFcp, centavos(dupla.vBaseDifal * 0.02));
});

// ── Item ponta a ponta ────────────────────────────────────────────────────

const CONTEXTO = {
  tabela: TABELA_SP,
  indice: indexarTabela(TABELA_SP),
  ufOrigem: 'PR',
  ufDestino: 'SP',
  dataEmissao: '2026-08-14',
  politicaRevenda: 'nao_incide',
  metodoBase: 'base_simples',
};

const itemNfe = (extra = {}) => ({
  nItem: 1, codigo: 'X', descricao: 'Produto', ncm: '33071000', cfop: '6556',
  quantidade: 1, vProd: 1000, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vIpi: 0,
  icms: { grupo: 'ICMS00', origem: '0', cst: '00', csosn: null, vBC: 1000, pICMS: 12, vICMS: 120 },
  ...extra,
});

test('item tributado normalmente: 25% x 12% sobre a base', () => {
  const r = calcularItem(itemNfe({ vFrete: 100 }), CONTEXTO);
  assert.equal(r.situacao, 'calculado');
  assert.equal(r.valores.vBase, 1100);
  assert.equal(r.valores.vDifal, 143);
  assert.equal(r.aliquotas.interna, 25);
  assert.equal(r.aliquotas.interestadual, 12);
  assert.equal(r.aliquotas.ncmRegra, '3307');
  assert.match(r.aliquotas.fundamento, /art\. 55/);
});

test('ST não gera diferencial', () => {
  for (const icms of [
    { cst: '60', csosn: null }, { cst: '10', csosn: null }, { cst: null, csosn: '500' },
  ]) {
    const r = calcularItem(itemNfe({ icms: { ...itemNfe().icms, ...icms, pICMS: null } }), CONTEXTO);
    assert.equal(r.situacao, 'nao_aplicavel');
    assert.match(r.motivo, /ST/);
    assert.equal(r.valores.vTotal, 0);
  }
});

test('CST de isenção e de base reduzida vão para revisão humana, não para cálculo', () => {
  for (const cst of ['40', '41', '50', '51', '20', '90']) {
    const r = calcularItem(itemNfe({ icms: { ...itemNfe().icms, cst } }), CONTEXTO);
    assert.equal(r.situacao, 'pendente', `CST ${cst}`);
    assert.equal(r.valores.vDifal, 0);
  }
});

test('CSOSN de fornecedor do Simples sem ST calcula pela matriz de UF', () => {
  const r = calcularItem(itemNfe({
    icms: { grupo: 'ICMSSN102', origem: '0', cst: null, csosn: '102', vBC: 0, pICMS: null, vICMS: 0 },
  }), CONTEXTO);
  assert.equal(r.situacao, 'calculado');
  assert.equal(r.aliquotas.interestadual, 12);
  assert.equal(r.aliquotas.fonteInterestadual, 'matriz_uf');
});

test('destaque do XML manda na interestadual e a divergência com a matriz vira alerta', () => {
  const importado = calcularItem(itemNfe({
    ncm: '84713012',
    icms: { ...itemNfe().icms, origem: '1', pICMS: 4 },
  }), CONTEXTO);
  assert.equal(importado.aliquotas.interestadual, 4);
  assert.equal(importado.aliquotas.fonteInterestadual, 'destaque_xml');
  assert.deepEqual(importado.alertas, []);

  const divergente = calcularItem(itemNfe({ icms: { ...itemNfe().icms, origem: '0', pICMS: 7 } }), CONTEXTO);
  assert.equal(divergente.aliquotas.interestadual, 7);
  assert.match(divergente.alertas[0], /diferente da esperada/);
});

test('destaque fora das alíquotas legais é descartado com alerta', () => {
  const r = calcularItem(itemNfe({ icms: { ...itemNfe().icms, pICMS: 18 } }), CONTEXTO);
  assert.equal(r.aliquotas.interestadual, 12);
  assert.equal(r.aliquotas.fonteInterestadual, 'matriz_uf');
  assert.match(r.alertas[0], /não é alíquota interestadual válida/);
});

test('interna menor ou igual à interestadual não gera cobrança', () => {
  const r = calcularItem(itemNfe({ ncm: '10061010' }), CONTEXTO); // arroz 7% x 12%
  assert.equal(r.situacao, 'nao_aplicavel');
  assert.match(r.motivo, /não supera a interestadual/);
});

test('revenda depende da política da UF de destino', () => {
  const semAntecipacao = calcularItem(itemNfe({ cfop: '6102' }), CONTEXTO);
  assert.equal(semAntecipacao.situacao, 'nao_aplicavel');
  assert.match(semAntecipacao.motivo, /revenda/);

  const comAntecipacao = calcularItem(itemNfe({ cfop: '6102' }), {
    ...CONTEXTO, politicaRevenda: 'antecipacao_parcial',
  });
  assert.equal(comAntecipacao.situacao, 'calculado');
  assert.equal(comAntecipacao.finalidade, 'comercializacao');
});

test('finalidade informada pelo cliente sobrepõe a do CFOP', () => {
  const r = calcularItem(itemNfe({ cfop: '6102', vIpi: 100 }), {
    ...CONTEXTO, finalidadeForcada: 'uso_consumo',
  });
  assert.equal(r.situacao, 'calculado');
  assert.equal(r.finalidade, 'uso_consumo');
  assert.equal(r.valores.vBase, 1100, 'com uso e consumo, o IPI entra na base');
});

test('CFOP não mapeado vira pendência em vez de cálculo às cegas', () => {
  // 6127 (venda de produção sob encomenda para industrialização) não diz o
  // que o comprador vai fazer com o bem — quem decide isso é o cliente.
  const r = calcularItem(itemNfe({ cfop: '6127' }), CONTEXTO);
  assert.equal(r.situacao, 'pendente');
  assert.match(r.motivo, /destinação do item precisa ser informada/);
});

test('NCM que a tabela não resolve vira pendência', () => {
  const r = calcularItem(itemNfe({ ncm: '0000' }), CONTEXTO);
  assert.equal(r.situacao, 'pendente');
  assert.match(r.motivo, /8 dígitos/);
});
