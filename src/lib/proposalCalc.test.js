import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotais } from './proposalCalc.js';

test('sem desconto: total é subtotal + implantação', () => {
  const r = calcularTotais({ items: [{ amount: 100 }, { amount: 50 }], discountType: null, discountValue: 0, setupFee: 20 });
  assert.deepEqual(r, { subtotal: 150, discountAmount: 0, total: 170 });
});

test('desconto percentual arredonda pra 2 casas', () => {
  const r = calcularTotais({ items: [{ amount: 749 }], discountType: 'percent', discountValue: 10, setupFee: 200 });
  assert.equal(r.subtotal, 749);
  assert.equal(r.discountAmount, 74.9);
  assert.equal(r.total, 874.1);
});

test('desconto em valor fixo nunca deixa o total negativo', () => {
  const r = calcularTotais({ items: [{ amount: 50 }], discountType: 'amount', discountValue: 1000, setupFee: 0 });
  assert.equal(r.discountAmount, 50);
  assert.equal(r.total, 0);
});

test('sem itens, tudo zero mesmo com desconto configurado', () => {
  const r = calcularTotais({ items: [], discountType: 'percent', discountValue: 10, setupFee: 0 });
  assert.deepEqual(r, { subtotal: 0, discountAmount: 0, total: 0 });
});

test('aceita valores como string (vêm de input controlado)', () => {
  const r = calcularTotais({ items: [{ amount: '100.50' }], discountType: 'amount', discountValue: '10', setupFee: '5' });
  assert.equal(r.subtotal, 100.5);
  assert.equal(r.discountAmount, 10);
  assert.equal(r.total, 95.5);
});
