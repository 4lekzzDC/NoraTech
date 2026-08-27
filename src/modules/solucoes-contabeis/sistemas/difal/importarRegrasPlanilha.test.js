import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linhasDePlanilha, MODELO_CABECALHO } from './importarRegrasPlanilha.js';

const CABECALHO = ['NCM', 'Tipo', 'Alíquota', 'Segue geral', 'FCP', 'Exceção de', 'Fundamento', 'Vigência início', 'Vigência fim', 'UF'];

test('lê uma planilha válida, linha a linha', () => {
  const r = linhasDePlanilha([
    CABECALHO,
    ['3307', 'posicao', '25', '', '', '', 'RICMS/SP art. 55', '', '', 'SP'],
    ['330720', '', '', 'sim', '', '3307', 'Desodorantes', '', '', 'SP'],
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.erros.length, 0);
  assert.deepEqual(r.linhas[0], {
    uf: 'SP', ncm: '3307', tipo: 'posicao', aliquota: 25, fcp: null,
    excecaoDe: undefined, fundamento: 'RICMS/SP art. 55',
    vigenciaInicio: undefined, vigenciaFim: undefined,
  });
  assert.equal(r.linhas[1].seguirGeral, true);
  assert.equal(r.linhas[1].excecaoDe, '3307');
});

test('tipo é inferido pelo comprimento do NCM quando a coluna vem vazia', () => {
  const r = linhasDePlanilha([CABECALHO, ['8471', '', '18', '', '', '', 'x', '', '', 'SP']]);
  assert.equal(r.linhas[0].tipo, 'posicao');
});

test('datas aceitam AAAA-MM-DD e DD/MM/AAAA', () => {
  const r = linhasDePlanilha([
    CABECALHO,
    ['1006', 'posicao', '7', '', '', '', 'x', '2024-01-01', '', 'SP'],
    ['2203', 'posicao', '25', '', '2', '', 'y', '01/01/2024', '31/12/2024', 'SP'],
  ]);
  assert.equal(r.linhas[0].vigenciaInicio, '2024-01-01');
  assert.equal(r.linhas[1].vigenciaInicio, '2024-01-01');
  assert.equal(r.linhas[1].vigenciaFim, '2024-12-31');
});

test('UF da coluna vale mais que o padrão; padrão preenche quando a coluna está vazia', () => {
  const r = linhasDePlanilha([
    ['NCM', 'Fundamento', 'Alíquota', 'UF'],
    ['3307', 'x', '25', 'RJ'],
    ['8471', 'x', '18', ''],
  ], 'SP');
  assert.equal(r.linhas[0].uf, 'RJ');
  assert.equal(r.linhas[1].uf, 'SP');
});

test('linha em branco no meio da planilha é ignorada, sem virar erro', () => {
  const r = linhasDePlanilha([CABECALHO, ['', '', '', '', '', '', '', '', '', ''], ['3307', 'posicao', '25', '', '', '', 'x', '', '', 'SP']]);
  assert.equal(r.ok, true);
  assert.equal(r.linhas.length, 1);
});

test('cada erro aponta a linha certa, e um erro não derruba as linhas boas', () => {
  const r = linhasDePlanilha([
    CABECALHO,
    ['3307', 'posicao', '25', '', '', '', 'x', '', '', 'SP'],
    ['333', 'posicao', '25', '', '', '', 'x', '', '', 'SP'],
    ['8471', 'posicao', '18', '', '', '', 'x', '', '', 'SP'],
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.linhas.length, 2, 'as duas linhas boas continuam disponíveis');
  assert.equal(r.erros.length, 1);
  assert.equal(r.erros[0].linha, 3, 'linha 1 é cabeçalho, então a segunda linha de dado é a 3');
  assert.match(r.erros[0].motivo, /2, 4, 6 ou 8 dígitos/);
});

test('sem alíquota e sem "segue geral" é erro; os dois juntos também', () => {
  const semNenhum = linhasDePlanilha([CABECALHO, ['3307', 'posicao', '', '', '', '', 'x', '', '', 'SP']]);
  assert.match(semNenhum.erros[0].motivo, /sem alíquota e sem marcar/);

  const osDois = linhasDePlanilha([CABECALHO, ['3307', 'posicao', '25', 'sim', '', '', 'x', '', '', 'SP']]);
  assert.match(osDois.erros[0].motivo, /só um dos dois/);
});

test('exceção sem "exceção de" é erro', () => {
  const r = linhasDePlanilha([CABECALHO, ['330720', 'excecao', '18', '', '', '', 'x', '', '', 'SP']]);
  assert.match(r.erros[0].motivo, /precisa da coluna/);
});

test('sem fundamento é erro', () => {
  const r = linhasDePlanilha([CABECALHO, ['3307', 'posicao', '25', '', '', '', '', '', '', 'SP']]);
  assert.match(r.erros[0].motivo, /sem fundamento legal/);
});

test('data em formato não reconhecido é erro, distinto de data vazia', () => {
  const r = linhasDePlanilha([CABECALHO, ['3307', 'posicao', '25', '', '', '', 'x', '2024/01/01', '', 'SP']]);
  assert.match(r.erros[0].motivo, /não reconhecida/);
});

test('sem coluna NCM ou sem coluna Fundamento, recusa a planilha inteira', () => {
  assert.equal(linhasDePlanilha([['A', 'B'], ['1', '2']]).ok, false);
  assert.match(linhasDePlanilha([['A', 'B'], ['1', '2']]).erros[0].motivo, /NCM/);
  assert.match(linhasDePlanilha([['NCM'], ['3307']]).erros[0].motivo, /Fundamento/);
});

test('planilha vazia ou só com cabeçalho não lança', () => {
  assert.equal(linhasDePlanilha([]).ok, false);
  assert.equal(linhasDePlanilha([CABECALHO]).ok, false);
  assert.equal(linhasDePlanilha(null).ok, false);
});

test('o modelo de cabeçalho é reconhecido pelo próprio parser — evita o modelo ficar desatualizado', () => {
  const r = linhasDePlanilha([MODELO_CABECALHO, ['3307', 'posicao', '25', '', '', '', 'x', '', '', 'SP']]);
  assert.equal(r.ok, true);
});
