import test from 'node:test';
import assert from 'node:assert/strict';
import { FOLGA, LARGURA_DA_DICA, aparelhoComPonteiroFino, posicaoDaDica } from './dica.js';

// Botão da engrenagem na lateral, numa tela de 1360.
const naLateral = { left: 261, right: 287, top: 243, bottom: 269 };

test('com espaço à direita, abre à direita do botão', () => {
  const p = posicaoDaDica({ alvo: naLateral, larguraDaTela: 1360 });
  assert.equal(p.lado, 'direita');
  assert.equal(p.estilo.left, 287 + FOLGA);
  assert.equal(p.estilo.right, 'auto');
});

test('a dica fica centrada na altura do botão', () => {
  const p = posicaoDaDica({ alvo: naLateral, larguraDaTela: 1360 });
  assert.equal(p.estilo.top, 256, 'meio entre 243 e 269');
});

test('sem espaço à direita, vira para a esquerda', () => {
  // Botão colado na borda direita da tela.
  const colado = { left: 1300, right: 1340, top: 100, bottom: 126 };
  const p = posicaoDaDica({ alvo: colado, larguraDaTela: 1360 });
  assert.equal(p.lado, 'esquerda');
  assert.equal(p.estilo.left, 'auto');
  // Ancorada pela direita: da borda até o lado esquerdo do botão, mais a folga.
  assert.equal(p.estilo.right, (1360 - 1300) + FOLGA);
});

test('nunca ancora pelos dois lados ao mesmo tempo', () => {
  for (const largura of [320, 768, 1024, 1360, 1920]) {
    const p = posicaoDaDica({ alvo: naLateral, larguraDaTela: largura });
    const ancorados = [p.estilo.left, p.estilo.right].filter((v) => v !== 'auto');
    assert.equal(ancorados.length, 1, `em ${largura}px ancorou ${ancorados.length} lados`);
  }
});

test('a decisão é sobre caber, não sobre metade da tela', () => {
  // Sobra exatamente o necessário: ainda cabe à direita.
  const alvo = { left: 100, right: 500, top: 0, bottom: 20 };
  const justo = 500 + LARGURA_DA_DICA + FOLGA;
  assert.equal(posicaoDaDica({ alvo, larguraDaTela: justo }).lado, 'direita');
  // Um pixel a menos e vira.
  assert.equal(posicaoDaDica({ alvo, larguraDaTela: justo - 1 }).lado, 'esquerda');
});

test('a âncora nunca fica negativa, que jogaria a dica para fora', () => {
  const foraDaTela = { left: -50, right: -10, top: 10, bottom: 30 };
  const p = posicaoDaDica({ alvo: foraDaTela, larguraDaTela: 400 });
  const valor = p.estilo.left === 'auto' ? p.estilo.right : p.estilo.left;
  assert.ok(valor >= 0, `âncora ${valor} deveria ser >= 0`);
});

test('sem alvo não há posição', () => {
  assert.equal(posicaoDaDica({ alvo: null, larguraDaTela: 1000 }), null);
  assert.equal(posicaoDaDica(), null);
});

test('dica flutuante só onde existe ponteiro fino', () => {
  const fino = (q) => ({ matches: q.includes('hover: hover') });
  const toque = () => ({ matches: false });
  assert.equal(aparelhoComPonteiroFino(fino), true);
  assert.equal(aparelhoComPonteiroFino(toque), false);
  // Ambiente sem matchMedia (SSR, teste) não quebra: simplesmente não mostra.
  assert.equal(aparelhoComPonteiroFino(undefined), false);
  assert.equal(aparelhoComPonteiroFino(() => { throw new Error('sem suporte'); }), false);
});
