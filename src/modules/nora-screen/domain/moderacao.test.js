import test from 'node:test';
import assert from 'node:assert/strict';
import { ACOES, acoesDisponiveis, podeModerar } from './moderacao.js';

const SALA = { donoId: 'dono', admins: ['ana'] };
const acao = (extra) => podeModerar({ ...SALA, acao: ACOES.BLOQUEAR, ...extra });

test('o dono modera qualquer um, menos ele mesmo', () => {
  assert.ok(acao({ autorId: 'dono', alvoId: 'carla' }));
  assert.ok(acao({ autorId: 'dono', alvoId: 'ana' }));
  assert.equal(acao({ autorId: 'dono', alvoId: 'dono' }), false);
});

test('o admin modera participantes, mas não o dono nem outro admin', () => {
  assert.ok(acao({ autorId: 'ana', alvoId: 'carla' }));
  assert.equal(acao({ autorId: 'ana', alvoId: 'dono' }), false);
  assert.equal(
    podeModerar({ donoId: 'dono', admins: ['ana', 'bruno'], autorId: 'ana', alvoId: 'bruno', acao: ACOES.REMOVER }),
    false,
  );
});

test('participante comum não modera ninguém', () => {
  assert.equal(acao({ autorId: 'carla', alvoId: 'diego' }), false);
});

test('promover e rebaixar admin é só do dono', () => {
  for (const a of [ACOES.PROMOVER, ACOES.REBAIXAR]) {
    assert.ok(podeModerar({ ...SALA, autorId: 'dono', alvoId: 'carla', acao: a }), `dono deveria ${a}`);
    // Admin modera gente, mas não decide quem é admin.
    assert.equal(podeModerar({ ...SALA, autorId: 'ana', alvoId: 'carla', acao: a }), false, `admin não deveria ${a}`);
  }
});

test('ação desconhecida nunca passa', () => {
  assert.equal(acao({ autorId: 'dono', alvoId: 'carla', acao: 'explodir' }), false);
  assert.equal(acao({ autorId: 'dono', alvoId: 'carla', acao: undefined }), false);
});

test('sem dono definido ninguém modera', () => {
  assert.equal(podeModerar({ donoId: null, admins: [], autorId: 'x', alvoId: 'y', acao: ACOES.REMOVER }), false);
});

test('o menu não aparece para quem não pode moderar', () => {
  assert.deepEqual(acoesDisponiveis({ alvo: { id: 'carla' }, euId: 'diego', ...SALA }), []);
  // Nem sobre si mesmo.
  assert.deepEqual(acoesDisponiveis({ alvo: { id: 'dono' }, euId: 'dono', ...SALA }), []);
});

test('o menu acompanha o estado de quem é o alvo', () => {
  const rotulos = (alvo, euId = 'dono') =>
    acoesDisponiveis({ alvo, euId, ...SALA }).map((a) => a.acao);

  assert.ok(!rotulos({ id: 'carla' }).includes(ACOES.PARAR), 'quem não transmite não tem "parar"');
  assert.ok(rotulos({ id: 'carla', transmitindo: true }).includes(ACOES.PARAR));
  assert.ok(rotulos({ id: 'carla' }).includes(ACOES.BLOQUEAR));
  assert.ok(rotulos({ id: 'carla', bloqueado: true }).includes(ACOES.LIBERAR));
});

test('só o dono vê promover, e nunca sobre ele mesmo', () => {
  const doDono = acoesDisponiveis({ alvo: { id: 'carla' }, euId: 'dono', ...SALA }).map((a) => a.acao);
  assert.ok(doDono.includes(ACOES.PROMOVER));

  const sobreAdmin = acoesDisponiveis({ alvo: { id: 'ana' }, euId: 'dono', ...SALA }).map((a) => a.acao);
  assert.ok(sobreAdmin.includes(ACOES.REBAIXAR), 'admin já promovido oferece rebaixar');

  const doAdmin = acoesDisponiveis({ alvo: { id: 'carla' }, euId: 'ana', ...SALA }).map((a) => a.acao);
  assert.ok(!doAdmin.includes(ACOES.PROMOVER), 'admin não promove');
  assert.ok(doAdmin.includes(ACOES.REMOVER), 'mas continua moderando');
});

test('remover é sempre a última e marcada como destrutiva', () => {
  const lista = acoesDisponiveis({ alvo: { id: 'carla', transmitindo: true }, euId: 'dono', ...SALA });
  assert.equal(lista.at(-1).acao, ACOES.REMOVER);
  assert.ok(lista.at(-1).destrutiva);
});
