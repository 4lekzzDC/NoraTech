import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sha256Hex } from './hash.js';

// O complemento do Gmail (addon/Codigo.gs) reimplementa o sha256Hex, porque o
// Apps Script não importa módulo deste repositório. Se as duas
// implementações divergirem, a deduplicação para de reconhecer o mesmo
// arquivo vindo dos dois caminhos — e nada nisso dá erro: o documento é
// aceito, o arquivo vira duplicata no Drive, e ninguém fica sabendo.
//
// A armadilha concreta: `Utilities.computeDigest` do Apps Script devolve
// bytes COM SINAL (-128..127). Sem o `& 0xFF`, todo byte acima de 127 vira um
// hexadecimal negativo e o hash inteiro sai errado — para uns arquivos sim e
// para outros não, que é o pior tipo de bug.

const CODIGO_DO_COMPLEMENTO = new URL('../../../../addon/Codigo.gs', import.meta.url);

function carregarDoComplemento() {
  const fonte = readFileSync(CODIGO_DO_COMPLEMENTO, 'utf8');
  const corpo = fonte.match(/function sha256Hex\(bytes\) \{[\s\S]*?\n\}/);
  assert.ok(corpo, 'sha256Hex não foi encontrada em addon/Codigo.gs');

  // Dublê do Apps Script: devolve o digest como bytes com sinal, igual ao
  // ambiente real.
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (_algoritmo, bytes) => {
      const digest = crypto.createHash('sha256').update(Buffer.from(bytes)).digest();
      return Array.from(digest).map((b) => (b > 127 ? b - 256 : b));
    },
  };
  return new Function('Utilities', `${corpo[0]}; return sha256Hex;`)(Utilities);
}

const CASOS = [
  ['texto comum', Buffer.from('extrato itau agosto 2026')],
  ['bytes altos, onde o sinal quebraria', Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x01])],
  ['arquivo binário', crypto.createHash('sha512').update('semente fixa').digest()],
  ['vazio', Buffer.alloc(0)],
];

for (const [nome, buffer] of CASOS) {
  test(`complemento e navegador produzem o mesmo hash: ${nome}`, async () => {
    const esperado = crypto.createHash('sha256').update(buffer).digest('hex');
    const doComplemento = carregarDoComplemento()(Array.from(buffer));
    const doNavegador = await sha256Hex(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
    );

    assert.equal(doNavegador, esperado);
    assert.equal(
      doComplemento,
      esperado,
      'addon/Codigo.gs saiu de sincronia com domain/hash.js — a deduplicação '
      + 'deixaria de reconhecer o mesmo arquivo vindo do Gmail e do upload manual.',
    );
  });
}
