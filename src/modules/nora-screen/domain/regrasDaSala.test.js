import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGRAS_PADRAO,
  podeCompartilhar,
  podeEntrar,
  regrasDaLinha,
} from './regrasDaSala.js';

test('sala sem linha no banco usa as regras padrão', () => {
  assert.deepEqual(regrasDaLinha(null), REGRAS_PADRAO);
  assert.deepEqual(regrasDaLinha(undefined), REGRAS_PADRAO);
});

test('linha do banco vira regras, tolerando nulos', () => {
  assert.deepEqual(
    regrasDaLinha({ entradas_bloqueadas: true, somente_host_compartilha: null, encerrada: false }),
    { entradasBloqueadas: true, somenteHostCompartilha: false, encerrada: false },
  );
});

test('entrada livre por padrão', () => {
  assert.deepEqual(podeEntrar({}), { pode: true, motivo: null });
});

test('entradas bloqueadas barram convidado, nunca o host', () => {
  const regras = { ...REGRAS_PADRAO, entradasBloqueadas: true };
  assert.equal(podeEntrar({ regras, souHost: false }).motivo, 'entradas-bloqueadas');
  // Trancar o host do lado de fora da própria sala seria uma armadilha.
  assert.ok(podeEntrar({ regras, souHost: true }).pode);
});

test('sala encerrada barra todo mundo, inclusive o host', () => {
  const regras = { ...REGRAS_PADRAO, encerrada: true };
  assert.equal(podeEntrar({ regras, souHost: true }).motivo, 'encerrada');
  assert.equal(podeEntrar({ regras, souHost: false }).motivo, 'encerrada');
});

test('somente-host barra convidado e libera o host', () => {
  const regras = { ...REGRAS_PADRAO, somenteHostCompartilha: true };
  assert.equal(podeCompartilhar({ regras, souHost: false }).motivo, 'somente-host');
  assert.ok(podeCompartilhar({ regras, souHost: true }).pode);
});

test('bloqueio individual fala mais alto que a regra geral', () => {
  // Quem foi bloqueado pelo host precisa ler o motivo certo, e não
  // "só o host compartilha", que sugeriria um impedimento diferente.
  const regras = { ...REGRAS_PADRAO, somenteHostCompartilha: true };
  assert.equal(
    podeCompartilhar({ regras, souHost: false, bloqueadoIndividualmente: true }).motivo,
    'bloqueado',
  );
});

test('sala encerrada impede compartilhar até para o host', () => {
  const regras = { ...REGRAS_PADRAO, encerrada: true };
  assert.equal(podeCompartilhar({ regras, souHost: true }).motivo, 'encerrada');
});

test('alguém já transmitindo é o último motivo, não o primeiro', () => {
  assert.equal(podeCompartilhar({ outroTransmitindo: true }).motivo, 'ocupado');
  assert.equal(
    podeCompartilhar({ outroTransmitindo: true, bloqueadoIndividualmente: true }).motivo,
    'bloqueado',
  );
});
