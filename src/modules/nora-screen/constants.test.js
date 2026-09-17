import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PADRAO_CODIGO,
  codigoValido,
  gerarCodigoDeSala,
  iniciaisDe,
  normalizarCodigo,
} from './constants.js';

test('código gerado sempre sai no formato canônico', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(gerarCodigoDeSala(), PADRAO_CODIGO);
  }
});

test('código nunca usa caracteres que se confundem ao ditar ou ler', () => {
  // 0/O e 1/I/L são o motivo do alfabeto reduzido: o código é ditado por
  // voz e lido de uma tela transmitida.
  const proibidos = /[01OIL]/;
  for (let i = 0; i < 400; i += 1) {
    assert.ok(!proibidos.test(gerarCodigoDeSala()), 'saiu caractere ambíguo');
  }
});

test('normalização aceita o que a pessoa realmente digita ou cola', () => {
  assert.equal(normalizarCodigo('abcd2345'), 'ABCD-2345');
  assert.equal(normalizarCodigo('ABCD-2345'), 'ABCD-2345');
  assert.equal(normalizarCodigo(' abcd 2345 '), 'ABCD-2345');
  assert.equal(normalizarCodigo('abcd--2345'), 'ABCD-2345');
  // Excesso é cortado em vez de virar um código maior e inválido.
  assert.equal(normalizarCodigo('ABCD2345XYZW'), 'ABCD-2345');
  // Parcial não ganha hífen antes da hora, senão o cursor pula ao digitar.
  assert.equal(normalizarCodigo('AB'), 'AB');
  assert.equal(normalizarCodigo(''), '');
  assert.equal(normalizarCodigo(null), '');
});

test('validação recusa código incompleto ou com caractere fora do alfabeto', () => {
  assert.ok(codigoValido('abcd2345'));
  assert.ok(codigoValido('ABCD-2345'));
  assert.ok(!codigoValido('ABC'));
  assert.ok(!codigoValido(''));
  // O e 1 não existem no alfabeto — um código com eles nunca foi gerado aqui.
  assert.ok(!codigoValido('AOOO-1111'));
});

test('iniciais do avatar', () => {
  assert.equal(iniciaisDe('4lekzz'), '4L');
  assert.equal(iniciaisDe('Ana Souza'), 'AS');
  assert.equal(iniciaisDe('  Maria  da  Silva '), 'MS');
  assert.equal(iniciaisDe(''), '');
  assert.equal(iniciaisDe(undefined), '');
  // Emoji conta como um caractere só — não pode sair partido ao meio.
  assert.equal(Array.from(iniciaisDe('🚀foguete')).length, 2);
});
