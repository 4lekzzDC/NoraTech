import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABELA_SP } from './ncmRegras.js';
import {
  buscarAliquotaInterna, explicarOrigem, fatiarNcm, indexarTabela, normalizarNcm,
} from './ncmBusca.js';

const DATA = '2026-08-14';
const buscar = (ncm, tabela = TABELA_SP, data = DATA) =>
  buscarAliquotaInterna(ncm, tabela, { data });

test('normaliza e fatia do específico para o genérico', () => {
  assert.equal(normalizarNcm('3307.10.00'), '33071000');
  assert.equal(normalizarNcm('3307'), null, 'NCM precisa ter 8 dígitos');
  assert.deepEqual(fatiarNcm('33072010'), ['33072010', '330720', '3307', '33']);
  assert.deepEqual(fatiarNcm('lixo'), []);
});

test('acha pela posição de 4 dígitos quando não há regra mais específica', () => {
  const r = buscar('33071000');
  assert.equal(r.aliquota, 25);
  assert.equal(r.nivel, 4);
  assert.equal(r.ncmRegra, '3307');
  assert.equal(r.origem, 'ncm');
});

test('a exceção de 6 dígitos ganha da posição de 4 e cai na regra geral', () => {
  const r = buscar('33072010');
  assert.equal(r.aliquota, 18);
  assert.equal(r.nivel, 6);
  assert.equal(r.ncmRegra, '330720');
  assert.equal(r.origem, 'excecao');
  assert.match(explicarOrigem(r), /exceção que cai na regra geral/);
});

test('a exceção de 8 dígitos ganha da posição de 4', () => {
  const r = buscar('33079000');
  assert.equal(r.aliquota, 18);
  assert.equal(r.nivel, 8);
  assert.equal(r.origem, 'ncm');
});

test('sem nenhuma faixa, cai na regra geral da UF', () => {
  const r = buscar('12345678');
  assert.equal(r.aliquota, 18);
  assert.equal(r.nivel, 0);
  assert.equal(r.origem, 'regra_geral');
  assert.equal(r.ncmRegra, null);
});

test('regra geral e regra própria de 18% não se confundem no relatório', () => {
  assert.equal(buscar('84713012').origem, 'ncm');
  assert.equal(buscar('12345678').origem, 'regra_geral');
});

test('FCP vem da regra quando cadastrado, senão da regra geral', () => {
  assert.equal(buscar('24022000').fcp, 2);
  assert.equal(buscar('33071000').fcp, 0);
});

test('NCM inválido não é completado nem chutado — vira pendência', () => {
  for (const ncm of ['0000', '', null, '333']) {
    const r = buscar(ncm);
    assert.equal(r.encontrada, false);
    assert.equal(r.aliquota, null);
    assert.equal(r.origem, 'nao_resolvida');
    assert.match(r.motivo, /8 dígitos/);
  }
});

test('regra fora de vigência na data da nota é ignorada', () => {
  // Arroz só tem alíquota reduzida a partir de 2024.
  assert.equal(buscar('10061010', TABELA_SP, '2026-08-14').aliquota, 7);
  const antes = buscar('10061010', TABELA_SP, '2023-06-01');
  assert.equal(antes.aliquota, 18);
  assert.equal(antes.origem, 'regra_geral');
});

test('entre vigências disjuntas, vale a que está em vigor na data da nota', () => {
  const tabela = {
    uf: 'SP', versao: 't', regraGeral: { aliquota: 18, fcp: 0, fundamento: 'x' },
    regras: [
      { ncm: '2203', aliquota: 25, fundamento: 'antiga', vigenciaFim: '2025-12-31' },
      { ncm: '2203', aliquota: 20, fundamento: 'nova', vigenciaInicio: '2026-01-01' },
    ],
  };
  assert.equal(buscar('22031000', tabela, '2025-07-01').aliquota, 25);
  assert.equal(buscar('22031000', tabela, '2026-07-01').aliquota, 20);
});

test('sem regra geral cadastrada, a busca falha em vez de inventar alíquota', () => {
  const tabela = { uf: 'MG', versao: 't', regras: [] };
  const r = buscar('12345678', tabela);
  assert.equal(r.encontrada, false);
  assert.match(r.motivo, /não tem regra geral cadastrada/);
});

test('o índice pré-montado devolve o mesmo resultado da busca direta', () => {
  const indice = indexarTabela(TABELA_SP);
  const comIndice = buscarAliquotaInterna('33072010', TABELA_SP, { data: DATA, indice });
  assert.deepEqual(comIndice, buscar('33072010'));
});
