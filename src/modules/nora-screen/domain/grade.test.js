import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDaGrade, transmissoesVisiveis } from './grade.js';

test('uma transmissão ocupa o palco inteiro', () => {
  assert.deepEqual(layoutDaGrade(1), { colunas: 1, linhas: 1, nome: 'solo' });
  // Palco vazio usa a mesma forma: não há grade a montar.
  assert.equal(layoutDaGrade(0).colunas, 1);
});

test('duas ficam lado a lado, e não num 2x2 pela metade', () => {
  assert.deepEqual(layoutDaGrade(2), { colunas: 2, linhas: 1, nome: 'dupla' });
});

test('três e quatro entram num 2x2', () => {
  assert.deepEqual(layoutDaGrade(3), { colunas: 2, linhas: 2, nome: 'quadro' });
  assert.deepEqual(layoutDaGrade(4), { colunas: 2, linhas: 2, nome: 'quadro' });
});

test('acima de quatro a grade cresce pela raiz', () => {
  assert.deepEqual(layoutDaGrade(5), { colunas: 3, linhas: 2, nome: 'mosaico' });
  assert.deepEqual(layoutDaGrade(9), { colunas: 3, linhas: 3, nome: 'mosaico' });
  assert.deepEqual(layoutDaGrade(10), { colunas: 4, linhas: 3, nome: 'mosaico' });
});

test('a grade sempre comporta todas as transmissões', () => {
  for (let n = 1; n <= 30; n += 1) {
    const { colunas, linhas } = layoutDaGrade(n);
    assert.ok(colunas * linhas >= n, `${n} não cabe em ${colunas}x${linhas}`);
  }
});

test('entrada estranha não quebra a grade', () => {
  for (const v of [null, undefined, -3, NaN, 'abc', 2.7]) {
    const { colunas, linhas } = layoutDaGrade(v);
    assert.ok(colunas >= 1 && linhas >= 1, `${v} produziu ${colunas}x${linhas}`);
  }
});

test('focar mostra uma, sem derrubar as outras', () => {
  const t = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(transmissoesVisiveis({ transmissoes: t, focoId: 'b' }).length, 1);
  assert.equal(transmissoesVisiveis({ transmissoes: t, focoId: 'b' })[0].id, 'b');
  // A lista original continua inteira: quem está fora de vista segue recebendo.
  assert.equal(t.length, 3);
});

test('foco em quem já saiu volta a mostrar todas, em vez de palco vazio', () => {
  const t = [{ id: 'a' }, { id: 'b' }];
  assert.equal(transmissoesVisiveis({ transmissoes: t, focoId: 'sumiu' }).length, 2);
  assert.equal(transmissoesVisiveis({ transmissoes: t, focoId: null }).length, 2);
  assert.deepEqual(transmissoesVisiveis({}), []);
});
