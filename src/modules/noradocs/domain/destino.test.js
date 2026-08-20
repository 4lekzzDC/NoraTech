import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirDestino } from './destino.js';

const FECHADO = { decisao: 'organizar', motivoRevisao: null };
const ABERTO = { decisao: 'revisar', motivoRevisao: 'Categoria não identificada.' };

const CONFIRMADO = { id: 'c1', nome: 'Silva Comércio ME', status: 'confirmado' };
const PROVISORIO = { id: 'p1', nome: 'Aurora Panificação', status: 'provisorio' };

test('cliente cadastrado e campos fechados vão para a árvore real', () => {
  const d = decidirDestino({ resultado: FECHADO, cliente: CONFIRMADO });
  assert.equal(d.base, 'raiz');
  assert.equal(d.status, 'organizado');
  assert.equal(d.motivo, null);
});

test('sem cliente vai para triagem, com o motivo da classificação', () => {
  const d = decidirDestino({ resultado: ABERTO, cliente: null });
  assert.equal(d.base, 'triagem');
  assert.equal(d.status, 'revisar');
  assert.match(d.motivo, /Categoria não identificada/);
});

test('sem cliente e sem motivo ainda explica o que houve', () => {
  const d = decidirDestino({ resultado: { decisao: 'revisar', motivoRevisao: null }, cliente: null });
  assert.equal(d.base, 'triagem');
  assert.ok(d.motivo, 'o contador precisa de uma frase, não de um campo vazio');
});

test('cliente provisório vai para verificação MESMO com tudo preenchido', () => {
  // O caso que mais importa: promover à árvore oficial um palpite sobre o
  // remetente é o que produz pastas duplicadas com três grafias do mesmo nome.
  const d = decidirDestino({ resultado: FECHADO, cliente: PROVISORIO });
  assert.equal(d.base, 'verificacao');
  assert.equal(d.status, 'revisar');
  assert.match(d.motivo, /Aurora Panificação/);
  assert.match(d.motivo, /não é cliente cadastrado/);
});

test('cliente provisório com campos faltando também vai para verificação', () => {
  // Falta cadastro é mais forte que falta informação: o documento tem uma
  // empresa a que pertencer, e agrupá-lo por ela vale mais que jogá-lo no
  // monte da triagem.
  const d = decidirDestino({ resultado: ABERTO, cliente: PROVISORIO });
  assert.equal(d.base, 'verificacao');
});

test('cliente cadastrado com campo faltando cai na triagem, como no upload manual', () => {
  const d = decidirDestino({ resultado: ABERTO, cliente: CONFIRMADO });
  assert.equal(d.base, 'triagem');
  assert.equal(d.status, 'revisar');
  assert.match(d.motivo, /Categoria não identificada/);
});

test('arquivamento automático desligado segura tudo na triagem', () => {
  const d = decidirDestino({ resultado: FECHADO, cliente: CONFIRMADO, autoOrganize: false });
  assert.equal(d.base, 'triagem');
  assert.equal(d.status, 'revisar');
  assert.match(d.motivo, /desligado/);
});

test('auto_organize desligado não desvia o provisório da verificação', () => {
  // A verificação não é uma forma de arquivamento automático — é uma fila de
  // cadastro. Desligar o automático não deveria misturá-la com a triagem.
  const d = decidirDestino({ resultado: FECHADO, cliente: PROVISORIO, autoOrganize: false });
  assert.equal(d.base, 'verificacao');
});

test('cliente sem status explícito é tratado como confirmado', () => {
  // Todo cliente cadastrado antes da E10 não tem a coluna preenchida em
  // memória; tratá-lo como provisório mandaria o arquivo do escritório
  // inteiro para _verificação.
  const d = decidirDestino({ resultado: FECHADO, cliente: { id: 'c9', nome: 'Antigo Ltda' } });
  assert.equal(d.base, 'raiz');
  assert.equal(d.status, 'organizado');
});
