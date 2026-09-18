import test from 'node:test';
import assert from 'node:assert/strict';
import { maisRecente, participantesDoPresence, quemCompartilha } from './presenca.js';

// ═══════════════════════════════════════════════════════════════
// O bug do "Só assistindo".
//
// Cada chave do presence guarda uma LISTA de metas, e um `track` novo
// não substitui o anterior — acrescenta. Ler a primeira devolvia o
// estado mais VELHO da pessoa, então quem começava a compartilhar
// continuava aparecendo como "só assistindo" para os outros.
// ═══════════════════════════════════════════════════════════════

test('entre várias metas, vale a mais recente — não a primeira', () => {
  const metas = [
    { id: 'ana', transmitindo: false, anunciadoEm: 1000 },
    { id: 'ana', transmitindo: true, anunciadoEm: 2000 },
  ];
  assert.equal(maisRecente(metas).transmitindo, true);
});

test('a ordem em que as metas chegam não decide nada', () => {
  // O presence não promete ordem; só o carimbo decide.
  const novo = { id: 'ana', transmitindo: true, anunciadoEm: 2000 };
  const velho = { id: 'ana', transmitindo: false, anunciadoEm: 1000 };
  assert.equal(maisRecente([novo, velho]).transmitindo, true);
  assert.equal(maisRecente([velho, novo]).transmitindo, true);
});

test('com três estados seguidos, ganha o último', () => {
  const metas = [
    { anunciadoEm: 10, microfoneAtivo: false, mudo: true },
    { anunciadoEm: 20, microfoneAtivo: true, mudo: false },
    { anunciadoEm: 30, microfoneAtivo: true, mudo: true },
  ];
  const atual = maisRecente(metas);
  assert.equal(atual.microfoneAtivo, true);
  assert.equal(atual.mudo, true);
});

test('meta sem carimbo não atropela uma carimbada', () => {
  // Cliente de outra versão, ou meta antiga: o que tem carimbo é mais novo.
  const metas = [{ id: 'x', transmitindo: true, anunciadoEm: 500 }, { id: 'x', transmitindo: false }];
  assert.equal(maisRecente(metas).transmitindo, true);
});

test('lista vazia ou inválida não quebra a listagem', () => {
  assert.equal(maisRecente([]), null);
  assert.equal(maisRecente(null), null);
  assert.equal(maisRecente(undefined), null);
  assert.equal(maisRecente('nada'), null);
});

test('uma meta só é ela mesma', () => {
  const unica = { id: 'z', transmitindo: true, anunciadoEm: 1 };
  assert.equal(maisRecente([unica]), unica);
});

test('a lista sai do presence já com o estado atual de cada um', () => {
  const estado = {
    ana: [{ id: 'ana', entrouEm: 1, transmitindo: false, anunciadoEm: 10 },
          { id: 'ana', entrouEm: 1, transmitindo: true, anunciadoEm: 20 }],
    bru: [{ id: 'bru', entrouEm: 2, transmitindo: true, anunciadoEm: 5 }],
  };
  const lista = participantesDoPresence(estado);
  assert.deepEqual(lista.map((p) => p.id), ['ana', 'bru'], 'ordem por chegada');
  // O caso do bug: dois compartilhando, e os dois aparecem assim.
  assert.equal(lista.every((p) => p.transmitindo), true);
});

test('quem foi removido não volta por um sync atrasado', () => {
  const estado = {
    ana: [{ id: 'ana', entrouEm: 1 }],
    bru: [{ id: 'bru', entrouEm: 2 }],
  };
  const lista = participantesDoPresence(estado, { expulsos: new Set(['bru']) });
  assert.deepEqual(lista.map((p) => p.id), ['ana']);
  // Aceita array também, para quem chamar sem Set.
  assert.deepEqual(participantesDoPresence(estado, { expulsos: ['ana'] }).map((p) => p.id), ['bru']);
});

test('presence vazio ou estranho devolve lista vazia', () => {
  assert.deepEqual(participantesDoPresence({}), []);
  assert.deepEqual(participantesDoPresence(null), []);
  // Meta sem id não é participante.
  assert.deepEqual(participantesDoPresence({ x: [{ entrouEm: 1 }] }), []);
});

test('compartilhando é por pessoa, nunca um estado global', () => {
  const participantes = [{ id: 'ana' }, { id: 'bru' }, { id: 'caio' }];
  // Ana e Caio transmitem; Bruno não. Nada de "alguém está transmitindo".
  const ids = quemCompartilha({
    participantes,
    transmissoes: [{ id: 'ana' }, { id: 'caio' }],
  });
  assert.deepEqual(ids.sort(), ['ana', 'caio']);
  assert.ok(!ids.includes('bru'));
});

test('a mídia que chega conta mesmo se a presença ainda não contou', () => {
  // O vídeo dela está na minha tela: ela está compartilhando, ponto.
  const ids = quemCompartilha({
    participantes: [{ id: 'ana', transmitindo: false }],
    transmissoes: [{ id: 'ana' }],
  });
  assert.deepEqual(ids, ['ana']);
});

test('a presença conta mesmo antes da mídia chegar', () => {
  // A negociação leva um instante; o rótulo não espera por ela.
  const ids = quemCompartilha({
    participantes: [{ id: 'bru', transmitindo: true }],
    transmissoes: [],
  });
  assert.deepEqual(ids, ['bru']);
});

test('ninguém transmitindo é lista vazia, e não um falso positivo', () => {
  assert.deepEqual(quemCompartilha({ participantes: [{ id: 'a' }], transmissoes: [] }), []);
  assert.deepEqual(quemCompartilha({}), []);
});
