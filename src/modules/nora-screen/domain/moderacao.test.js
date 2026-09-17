import test from 'node:test';
import assert from 'node:assert/strict';
import { ACOES, acoesDisponiveis, podeModerar } from './moderacao.js';

const base = { hostId: 'h', autorId: 'h', alvoId: 'x', acao: ACOES.BLOQUEAR };

test('só o host modera', () => {
  assert.ok(podeModerar(base));
  assert.ok(!podeModerar({ ...base, autorId: 'outro' }));
});

test('ninguém modera a si mesmo, nem o host', () => {
  assert.ok(!podeModerar({ ...base, alvoId: 'h' }));
});

test('ação desconhecida é recusada', () => {
  assert.ok(!podeModerar({ ...base, acao: 'virar-host' }));
  assert.ok(!podeModerar({ ...base, acao: undefined }));
});

test('sala sem host definido não modera ninguém', () => {
  assert.ok(!podeModerar({ ...base, hostId: null }));
});

test('menu só existe para o host e nunca no próprio host', () => {
  const alvo = { id: 'x', transmitindo: false };
  assert.equal(acoesDisponiveis({ alvo, souHost: false, euId: 'h' }).length, 0);
  assert.equal(acoesDisponiveis({ alvo: { id: 'h' }, souHost: true, euId: 'h' }).length, 0);
  assert.ok(acoesDisponiveis({ alvo, souHost: true, euId: 'h' }).length > 0);
});

test('menu reflete o estado do participante', () => {
  const menu = (alvo) => acoesDisponiveis({ alvo, souHost: true, euId: 'h' }).map((a) => a.acao);

  assert.deepEqual(menu({ id: 'x' }), [ACOES.BLOQUEAR, ACOES.REMOVER]);
  assert.deepEqual(menu({ id: 'x', bloqueado: true }), [ACOES.LIBERAR, ACOES.REMOVER]);
  assert.deepEqual(
    menu({ id: 'x', transmitindo: true }),
    [ACOES.PARAR, ACOES.BLOQUEAR, ACOES.REMOVER],
  );
  // Bloquear e liberar nunca aparecem juntos: são a mesma chave.
  const bloqueado = menu({ id: 'x', bloqueado: true, transmitindo: true });
  assert.ok(bloqueado.includes(ACOES.LIBERAR) && !bloqueado.includes(ACOES.BLOQUEAR));
});

test('remover é sempre a última opção e é marcada como destrutiva', () => {
  const acoes = acoesDisponiveis({ alvo: { id: 'x', transmitindo: true }, souHost: true, euId: 'h' });
  const ultima = acoes[acoes.length - 1];
  assert.equal(ultima.acao, ACOES.REMOVER);
  assert.ok(ultima.destrutiva);
  assert.ok(acoes.slice(0, -1).every((a) => !a.destrutiva));
});
