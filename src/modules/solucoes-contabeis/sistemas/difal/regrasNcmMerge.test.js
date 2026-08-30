import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTabelaUf, prefixosAjustados } from './regrasNcmMerge.js';
import { validarTabela } from './ncmRegras.js';
import { buscarAliquotaInterna } from './ncmBusca.js';

const CONFIG_GLOBAL = {
  uf: 'SP', versao: '2026-01', metodo_base: 'base_simples', politica_revenda: 'nao_incide',
  regra_geral_aliquota: 18, regra_geral_fcp: 0, regra_geral_fundamento: 'RICMS/SP art. 52',
};

const REGRAS_GLOBAIS = [
  { ncm_prefixo: '3307', tipo: 'posicao', aliquota: 25, segue_geral: false, fcp: null, fundamento: 'x' },
  { ncm_prefixo: '330720', tipo: 'excecao', excecao_de: '3307', segue_geral: true, aliquota: null, fcp: null, fundamento: 'y' },
  { ncm_prefixo: '2203', tipo: 'posicao', aliquota: 25, segue_geral: false, fcp: 2, fundamento: 'z' },
];

test('sem ajuste do escritório, a tabela é só a base global', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: REGRAS_GLOBAIS, regrasTenant: [],
  });
  assert.deepEqual(validarTabela(tabela), []);
  assert.equal(tabela.regraGeral.aliquota, 18);
  assert.equal(tabela.regras.length, 3);
  assert.equal(buscarAliquotaInterna('33071000', tabela).aliquota, 25);
});

test('ajuste do escritório em um NCM novo se soma à base', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: REGRAS_GLOBAIS,
    regrasTenant: [{ ncm_prefixo: '8471', tipo: 'posicao', aliquota: 12, segue_geral: false, fcp: null, fundamento: 'regime especial do cliente' }],
  });
  assert.equal(tabela.regras.length, 4);
  assert.equal(buscarAliquotaInterna('84713012', tabela).aliquota, 12);
  assert.equal(buscarAliquotaInterna('33071000', tabela).aliquota, 25, 'o resto da base global continua valendo');
});

test('ajuste do escritório no MESMO prefixo da base substitui, não soma', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: REGRAS_GLOBAIS,
    regrasTenant: [{ ncm_prefixo: '3307', tipo: 'posicao', aliquota: 20, segue_geral: false, fcp: null, fundamento: 'acordo específico deste cliente' }],
  });
  const doPrefixo3307 = tabela.regras.filter((r) => r.ncm === '3307');
  assert.equal(doPrefixo3307.length, 1, 'a linha global do mesmo prefixo não fica junto');
  assert.equal(buscarAliquotaInterna('33071000', tabela).aliquota, 20);
  // A exceção '330720', que é de OUTRO prefixo, continua da base global.
  assert.equal(buscarAliquotaInterna('33072010', tabela).origem, 'excecao');
});

test('override troca TODAS as vigências daquele prefixo, não mistura uma de cada', () => {
  const globaisComHistorico = [
    { ncm_prefixo: '1006', tipo: 'posicao', aliquota: 12, segue_geral: false, fcp: null, fundamento: 'antiga', vigencia_fim: '2023-12-31' },
    { ncm_prefixo: '1006', tipo: 'posicao', aliquota: 7, segue_geral: false, fcp: null, fundamento: 'nova', vigencia_inicio: '2024-01-01' },
  ];
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: globaisComHistorico,
    regrasTenant: [{ ncm_prefixo: '1006', tipo: 'posicao', aliquota: 4, segue_geral: false, fcp: null, fundamento: 'cliente com regime especial' }],
  });
  const do1006 = tabela.regras.filter((r) => r.ncm === '1006');
  assert.equal(do1006.length, 1, 'nenhuma vigência antiga da base global sobrevive junto ao ajuste');
  assert.equal(do1006[0].aliquota, 4);
});

test('config do escritório sobrepõe a config global inteira (regra geral, método, revenda)', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL,
    configTenant: { ...CONFIG_GLOBAL, metodo_base: 'base_dupla', regra_geral_aliquota: 20, regra_geral_fundamento: 'regime especial' },
    regrasGlobais: REGRAS_GLOBAIS, regrasTenant: [],
  });
  assert.equal(tabela.metodoBase, 'base_dupla');
  assert.equal(tabela.regraGeral.aliquota, 20);
});

test('sem config nem global nem do escritório, devolve null — mesmo sinal de "UF não cadastrada"', () => {
  assert.equal(montarTabelaUf({ uf: 'MG', configGlobal: null, configTenant: null, regrasGlobais: [], regrasTenant: [] }), null);
});

test('prefixosAjustados lista o que o escritório sobrepôs, sem repetir', () => {
  assert.deepEqual(
    prefixosAjustados([{ ncm_prefixo: '3307' }, { ncm_prefixo: '3307' }, { ncm_prefixo: '1006' }]),
    ['3307', '1006'],
  );
  assert.deepEqual(prefixosAjustados([]), []);
  assert.deepEqual(prefixosAjustados(), []);
});

test('a tabela montada continua reprovando cadastro inválido, via o mesmo validarTabela', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: [{ ncm_prefixo: '330', tipo: 'posicao', aliquota: 25, segue_geral: false, fcp: null, fundamento: 'x' }],
    regrasTenant: [],
  });
  const erros = validarTabela(tabela);
  assert.equal(erros.length, 1);
  assert.match(erros[0], /2, 4, 6 ou 8 dígitos/);
});

test('cada regra sai marcada com a origem — global ou ajuste do escritório', () => {
  const tabela = montarTabelaUf({
    uf: 'SP', configGlobal: CONFIG_GLOBAL, configTenant: null,
    regrasGlobais: REGRAS_GLOBAIS,
    regrasTenant: [{ ncm_prefixo: '3307', tipo: 'posicao', aliquota: 20, segue_geral: false, fcp: null, fundamento: 'x' }],
  });
  assert.equal(tabela.regras.find((r) => r.ncm === '3307').origemAjuste, 'tenant');
  assert.equal(tabela.regras.find((r) => r.ncm === '2203').origemAjuste, 'global');
});
