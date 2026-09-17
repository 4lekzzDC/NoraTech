import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPEL, papelDe, podeAgirSobre, podeGerirSala, podeModerar } from './papeis.js';

const SALA = { donoId: 'dono', admins: ['ana', 'bruno'] };

test('o papel sai de quem é dono e de quem está na lista de admins', () => {
  assert.equal(papelDe({ id: 'dono', ...SALA }), PAPEL.DONO);
  assert.equal(papelDe({ id: 'ana', ...SALA }), PAPEL.ADMIN);
  assert.equal(papelDe({ id: 'carla', ...SALA }), PAPEL.PARTICIPANTE);
  assert.equal(papelDe({}), PAPEL.PARTICIPANTE);
  assert.equal(papelDe({ id: 'x', donoId: null, admins: null }), PAPEL.PARTICIPANTE);
});

test('dono na lista de admins continua sendo dono', () => {
  assert.equal(papelDe({ id: 'dono', donoId: 'dono', admins: ['dono'] }), PAPEL.DONO);
});

test('gerir a sala é só do dono', () => {
  assert.ok(podeGerirSala({ id: 'dono', ...SALA }));
  assert.equal(podeGerirSala({ id: 'ana', ...SALA }), false);
  assert.equal(podeGerirSala({ id: 'carla', ...SALA }), false);
});

test('moderar é do dono e do admin', () => {
  assert.ok(podeModerar({ id: 'dono', ...SALA }));
  assert.ok(podeModerar({ id: 'ana', ...SALA }));
  assert.equal(podeModerar({ id: 'carla', ...SALA }), false);
});

test('ninguém age sobre si mesmo, nem o dono', () => {
  assert.equal(podeAgirSobre({ autorId: 'dono', alvoId: 'dono', ...SALA }), false);
  assert.equal(podeAgirSobre({ autorId: 'ana', alvoId: 'ana', ...SALA }), false);
});

test('admin não mexe em dono nem em outro admin', () => {
  // Promover alguém não pode ser o primeiro passo para derrubar quem promoveu.
  assert.equal(podeAgirSobre({ autorId: 'ana', alvoId: 'dono', ...SALA }), false);
  assert.equal(podeAgirSobre({ autorId: 'ana', alvoId: 'bruno', ...SALA }), false);
  assert.ok(podeAgirSobre({ autorId: 'ana', alvoId: 'carla', ...SALA }));
});

test('o dono age sobre qualquer um', () => {
  assert.ok(podeAgirSobre({ autorId: 'dono', alvoId: 'ana', ...SALA }));
  assert.ok(podeAgirSobre({ autorId: 'dono', alvoId: 'carla', ...SALA }));
});

test('participante não age sobre ninguém', () => {
  assert.equal(podeAgirSobre({ autorId: 'carla', alvoId: 'diego', ...SALA }), false);
  assert.equal(podeAgirSobre({ autorId: 'carla', alvoId: 'dono', ...SALA }), false);
});
