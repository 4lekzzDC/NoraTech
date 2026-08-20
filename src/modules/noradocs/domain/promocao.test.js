import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoverCaminho } from './promocao.js';

const P = '_verificação/';
const C = 'verificacao:';

test('tira o prefixo do caminho exibido', () => {
  assert.equal(promoverCaminho(`${P}Aurora/2026/2026-08`, P, 'Aurora', 'Aurora'),
    'Aurora/2026/2026-08');
});

test('tira o prefixo da chave de cache', () => {
  assert.equal(promoverCaminho(`${C}Aurora/2026`, C, 'Aurora', 'Aurora'), 'Aurora/2026');
});

test('troca o nome quando o contador corrige a grafia ao confirmar', () => {
  assert.equal(
    promoverCaminho(`${P}aurora.com.br/2026/2026-08`, P, 'aurora.com.br', 'Padaria Aurora Ltda'),
    'Padaria Aurora Ltda/2026/2026-08',
  );
});

test('a pasta do próprio cliente, sem subpastas, também é promovida', () => {
  assert.equal(promoverCaminho(`${C}aurora.com.br`, C, 'aurora.com.br', 'Padaria Aurora'),
    'Padaria Aurora');
});

test('caminho sem o prefixo devolve null em vez de ser mutilado', () => {
  // O serviço filtra por LIKE antes de chamar, mas um caminho já promovido
  // que voltasse aqui teria os primeiros caracteres amputados em silêncio.
  assert.equal(promoverCaminho('Aurora/2026', P, 'Aurora', 'Aurora'), null);
});

test('nome que não é o primeiro segmento não é trocado', () => {
  // "Aurora" aparece no meio do caminho, não no começo: trocar por posição
  // produziria "NovoNomea Aurora/..." — lixo que nenhum erro denunciaria.
  assert.equal(
    promoverCaminho(`${P}Outra Empresa/Aurora`, P, 'Aurora', 'Novo Nome'),
    'Outra Empresa/Aurora',
  );
});

test('nome com prefixo comum não confunde a troca', () => {
  // "Aurora" é prefixo de "Aurora Panificação": sem checar o separador, o
  // caminho de "Aurora Panificação" seria cortado no meio da palavra.
  assert.equal(
    promoverCaminho(`${P}Aurora Panificação/2026`, P, 'Aurora', 'Novo'),
    'Aurora Panificação/2026',
  );
});
