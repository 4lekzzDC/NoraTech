import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PADRAO_CODIGO,
  codigoValido,
  ehHostDoNoraScreen,
  gerarCodigoDeSala,
  iniciaisDe,
  noraScreenRoute,
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

// ═══════════════════════════════════════════════════════════════
// Endereço público: transmissao.noratech.com.br
// ═══════════════════════════════════════════════════════════════

test('reconhece o host do Nora Screen, e só ele', () => {
  assert.ok(ehHostDoNoraScreen('transmissao.noratech.com.br'));
  assert.ok(ehHostDoNoraScreen('TRANSMISSAO.NORATECH.COM.BR'), 'host não diferencia maiúsculas');
  assert.ok(ehHostDoNoraScreen('transmissao.localhost:5178'), 'porta não atrapalha');
  assert.ok(ehHostDoNoraScreen('transmissao.staging.noratech.com.br'), 'preview responde igual');

  assert.equal(ehHostDoNoraScreen('noratech.com.br'), false);
  assert.equal(ehHostDoNoraScreen('www.noratech.com.br'), false);
  assert.equal(ehHostDoNoraScreen('localhost'), false);
  // Não basta conter a palavra: tem que ser o subdomínio.
  assert.equal(ehHostDoNoraScreen('noratech.com.br/transmissao'), false);
  assert.equal(ehHostDoNoraScreen(''), false);
  assert.equal(ehHostDoNoraScreen(null), false);
  assert.equal(ehHostDoNoraScreen(undefined), false);
});

test('no subdomínio o Nora Screen ocupa a raiz', () => {
  assert.equal(noraScreenRoute('', true), '/');
  assert.equal(noraScreenRoute('sala/KMPT-7R4X', true), '/sala/KMPT-7R4X');
  assert.equal(noraScreenRoute('salas', true), '/salas');
});

test('no domínio principal continua sob /transmissao', () => {
  assert.equal(noraScreenRoute('', false), '/transmissao');
  assert.equal(noraScreenRoute('sala/KMPT-7R4X', false), '/transmissao/sala/KMPT-7R4X');
  assert.equal(noraScreenRoute('salas', false), '/transmissao/salas');
});

test('caminho com barra na frente não vira barra dupla', () => {
  // É daqui que sai o link de convite: `origin + rota`. Uma barra a mais
  // deixaria o convite em //sala/CODIGO, que não abre a sala.
  assert.equal(noraScreenRoute('/sala/KMPT-7R4X', true), '/sala/KMPT-7R4X');
  assert.equal(noraScreenRoute('/sala/KMPT-7R4X', false), '/transmissao/sala/KMPT-7R4X');
});

test('o link de convite fica sempre no host de quem convida', () => {
  const convite = (origem, noSubdominio) => `${origem}${noraScreenRoute('sala/KMPT-7R4X', noSubdominio)}`;
  assert.equal(
    convite('https://transmissao.noratech.com.br', true),
    'https://transmissao.noratech.com.br/sala/KMPT-7R4X',
  );
  assert.equal(
    convite('https://noratech.com.br', false),
    'https://noratech.com.br/transmissao/sala/KMPT-7R4X',
  );
});
