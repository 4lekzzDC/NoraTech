import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FOLDER_TEMPLATE, FOLDER_TEMPLATE_TOKENS,
  formatFolderPath, normalizarSegmento, resolveFolderPath, tokensDesconhecidos,
} from './folderTemplate.js';

const CONTEXTO = {
  clienteNome: 'Silva Comércio de Alimentos ME',
  cnpj: '11.222.333/0001-81',
  competencia: '2026-08',
  categoriaNome: 'Extratos bancários',
  tipo: 'Extrato bancário',
};

test('resolve o template padrão com o contexto completo', () => {
  const caminho = formatFolderPath(DEFAULT_FOLDER_TEMPLATE, CONTEXTO);
  assert.equal(caminho, 'Silva Comércio de Alimentos ME/2026/2026-08/Extratos bancários');
});

test('ano e mês vêm da competência, não são digitados à parte', () => {
  const segs = resolveFolderPath('{ano}/{mes}', CONTEXTO);
  assert.deepEqual(segs, ['2026', '08']);
});

test('token conhecido sem valor some do caminho, não vira segmento em branco', () => {
  const segs = resolveFolderPath('{cliente}/{competencia}/{categoria}', { clienteNome: 'Costa Ltda' });
  assert.deepEqual(segs, ['Costa Ltda']);
});

// O contrário de sumir: um erro de digitação (token que não existe) precisa
// aparecer literal no caminho — é o que torna o erro visível na pré-visualização
// antes de o escritório salvar um modelo quebrado.
test('token desconhecido fica literal no caminho, para o erro aparecer', () => {
  const segs = resolveFolderPath('{cliente}/{competencai}', CONTEXTO);
  assert.deepEqual(segs, ['Silva Comércio de Alimentos ME', '{competencai}']);
});

test('tokensDesconhecidos lista só o que não está na lista oficial', () => {
  assert.deepEqual(tokensDesconhecidos('{cliente}/{competencai}/{categoria}'), ['competencai']);
  assert.deepEqual(tokensDesconhecidos(DEFAULT_FOLDER_TEMPLATE), []);
  assert.deepEqual(tokensDesconhecidos(''), []);
});

// Barra dentro de um VALOR (não do template) não pode criar uma subpasta sem
// querer — "Silva/Costa Ltda" tem que virar um nome de pasta, não dois níveis.
test('barra dentro de um valor vira traço, não separador de pasta', () => {
  const segs = resolveFolderPath('{cliente}', { clienteNome: 'Silva/Costa Ltda' });
  assert.deepEqual(segs, ['Silva-Costa Ltda']);
});

test('espaços duplos e nas pontas são colapsados', () => {
  assert.equal(normalizarSegmento('  Extratos   Bancários  '), 'Extratos Bancários');
});

test('acento é preservado — normalização é estrutural, não cosmética', () => {
  assert.equal(normalizarSegmento('Contábil'), 'Contábil');
});

test('lista oficial de tokens contém os sete documentados na arquitetura', () => {
  assert.deepEqual(FOLDER_TEMPLATE_TOKENS, ['cliente', 'cnpj', 'ano', 'mes', 'competencia', 'categoria', 'tipo']);
});

test('template vazio devolve caminho vazio, sem lançar', () => {
  assert.deepEqual(resolveFolderPath('', CONTEXTO), []);
  assert.equal(formatFolderPath('', CONTEXTO), '');
});
