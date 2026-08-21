import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesclarReclassificacao } from './reclassificacao.js';

// O caso que originou este módulo: uma DANFE chegou pelo e-mail, e a
// classificação inicial (só assunto + corpo do e-mail) não achou cliente,
// competência nem categoria — "DANFE", o CNPJ do emitente e a data de
// emissão só existiam dentro do PDF, que essa primeira passada nunca lê.

test('preenche categoria e competência que estavam vazias', () => {
  const atual = { clientId: null, categoryId: null, competencia: '2026-07' };
  const novo = { clientId: null, categoryId: 'cat-notas-fiscais', competencia: '2026-08', suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.equal(r.categoryId, 'cat-notas-fiscais');
  assert.equal(r.competencia, '2026-08');
  assert.equal(r.mudou, true);
});

test('não substitui um cliente já confirmado por outro achado no PDF', () => {
  const atual = { clientId: 'cliente-real', categoryId: null, competencia: null };
  const novo = { clientId: 'outro-cliente', categoryId: null, competencia: null, suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.equal(r.clientId, 'cliente-real');
});

test('substitui um cliente provisório por um confirmado achado no PDF', () => {
  const atual = { clientId: 'provisorio-tiktok', categoryId: null, competencia: null };
  const novo = { clientId: 'cliente-real', categoryId: null, competencia: null, suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, true);
  assert.equal(r.clientId, 'cliente-real');
  assert.equal(r.mudou, true);
});

test('preenche cliente quando o atual estava em aberto', () => {
  const atual = { clientId: null, categoryId: null, competencia: null };
  const novo = { clientId: 'cliente-real', categoryId: null, competencia: null, suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.equal(r.clientId, 'cliente-real');
});

test('não troca cliente em aberto se o PDF também não achou nenhum', () => {
  const atual = { clientId: null, categoryId: 'cat-x', competencia: '2026-07' };
  const novo = { clientId: null, categoryId: 'cat-x', competencia: '2026-08', suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.equal(r.clientId, null);
  assert.equal(r.competencia, '2026-08');
});

test('competência suposta no segundo passe não substitui uma competência real', () => {
  const atual = { clientId: null, categoryId: null, competencia: '2026-08' };
  const novo = { clientId: null, categoryId: null, competencia: '2026-11', suposicoes: ['competencia'] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.equal(r.competencia, '2026-08');
});

test('nada muda: mudou fica false', () => {
  const atual = { clientId: 'c1', categoryId: 'cat1', competencia: '2026-08' };
  const novo = { clientId: 'c1', categoryId: 'cat1', competencia: '2026-08', suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, false);
  assert.deepEqual(r, { clientId: 'c1', categoryId: 'cat1', competencia: '2026-08', mudou: false });
});

test('cliente provisório sem achado novo no PDF permanece provisório, não vira null', () => {
  const atual = { clientId: 'provisorio-tiktok', categoryId: 'cat-x', competencia: '2026-07' };
  const novo = { clientId: null, categoryId: 'cat-x', competencia: '2026-08', suposicoes: [] };
  const r = mesclarReclassificacao(atual, novo, true);
  assert.equal(r.clientId, 'provisorio-tiktok');
});
