import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from './hash.js';

const buf = (texto) => new TextEncoder().encode(texto).buffer;

test('produz o SHA-256 conhecido de uma entrada vazia', async () => {
  assert.equal(
    await sha256Hex(new ArrayBuffer(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('produz o SHA-256 conhecido de "abc"', async () => {
  assert.equal(
    await sha256Hex(buf('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('conteúdos diferentes produzem hashes diferentes', async () => {
  assert.notEqual(await sha256Hex(buf('extrato agosto')), await sha256Hex(buf('extrato setembro')));
});

// A deduplicação tem que enxergar o mesmo documento reenviado, mesmo que o
// cliente tenha renomeado o arquivo antes de mandar de novo.
test('o mesmo conteúdo produz sempre o mesmo hash', async () => {
  assert.equal(await sha256Hex(buf('extrato agosto')), await sha256Hex(buf('extrato agosto')));
});
