import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podeConfirmarEmLote, podeReprocessar } from './status.js';

const completo = {
  client: { id: 'c1' }, category: { id: 'k1' }, competencia: '2026-08',
};

test('entra no lote quando os três campos estão resolvidos', () => {
  assert.equal(podeConfirmarEmLote(completo), true);
});

// O lote é atalho para o que precisa só de um aval. Qualquer campo em aberto
// é decisão, e decisão não se toma em massa.
test('fica de fora do lote com qualquer campo em aberto', () => {
  assert.equal(podeConfirmarEmLote({ ...completo, client: null }), false);
  assert.equal(podeConfirmarEmLote({ ...completo, category: null }), false);
  assert.equal(podeConfirmarEmLote({ ...completo, competencia: null }), false);
});

test('não quebra com documento vazio', () => {
  assert.equal(podeConfirmarEmLote({}), false);
});

// ── podeReprocessar ──────────────────────────────────────────────────────

test('documento com arquivo no Drive pode ser reprocessado', () => {
  assert.equal(podeReprocessar({ drive_file_id: 'abc123' }), true);
});

// Sem arquivo no Drive nenhum retry do servidor resolve — o caminho é
// descartar e reenviar, e a UI precisa dizer isso em vez de oferecer um
// botão que nunca vai funcionar.
test('documento cujo arquivo não chegou ao Drive não pode ser reprocessado', () => {
  assert.equal(podeReprocessar({ drive_file_id: null }), false);
  assert.equal(podeReprocessar({}), false);
});
