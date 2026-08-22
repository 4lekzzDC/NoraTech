import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  competenciaAnterior, competenciaLegivel, extrairCompetencia,
  formatCompetencia, isCompetencia,
} from './competencia.js';

const comp = (texto) => extrairCompetencia(texto)?.competencia ?? null;

test('formato e validação', () => {
  assert.equal(formatCompetencia(2026, 8), '2026-08');
  assert.equal(isCompetencia('2026-08'), true);
  assert.equal(isCompetencia('2026-13'), false);
  assert.equal(isCompetencia('2026-8'), false);
  assert.equal(competenciaLegivel('2026-08'), '08/2026');
  assert.equal(competenciaLegivel('lixo'), '—');
});

test('extrai de mês/ano', () => {
  assert.equal(comp('extrato_08/2026.pdf'), '2026-08');
  assert.equal(comp('extrato 08-2026'), '2026-08');
});

test('extrai de data completa', () => {
  assert.equal(comp('fechamento 18/08/2026'), '2026-08');
  assert.equal(comp('emitido em 01.12.2026'), '2026-12');
});

test('extrai de ano-mês e AAAAMM', () => {
  assert.equal(comp('relatorio 2026-08 final'), '2026-08');
  assert.equal(comp('arquivo 202608 v2'), '2026-08');
});

test('extrai de mês por extenso', () => {
  assert.equal(comp('extrato agosto de 2026'), '2026-08');
  assert.equal(comp('ago/2026'), '2026-08');
  assert.equal(comp('Março 2026'), '2026-03');
  assert.equal(comp('ago/26'), '2026-08');
});

// Um CNPJ carrega "/0001-81", que se parece com data. Se o motor lesse isso
// como competência, todo documento com CNPJ no texto viria com mês errado —
// e ninguém perceberia, porque o valor seria plausível.
test('não confunde CNPJ com data', () => {
  assert.equal(comp('CNPJ 11.222.333/0001-81'), null);
  assert.equal(comp('CPF 529.982.247-25'), null);
});

test('ignora ano fora da faixa 20xx', () => {
  assert.equal(comp('nota 08/1998'), null);
  assert.equal(comp('pedido 1234/5678'), null);
});

test('não encontra competência em texto sem data', () => {
  assert.equal(comp('extrato bancario itau'), null);
  assert.equal(comp(''), null);
});

test('mês anterior vira competência, inclusive virando o ano', () => {
  assert.equal(competenciaAnterior(new Date(2026, 8, 15)), '2026-08'); // setembro → agosto
  assert.equal(competenciaAnterior(new Date(2026, 0, 3)), '2025-12');  // janeiro → dezembro
});

// ── Ano de dois dígitos: só no nome do arquivo ────────────────────────────
//
// Estes casos vêm de um bug real: uma DANFE emitida em 13/08/2026, anexada a
// um e-mail da TikTok Shop, foi arquivada em 2016-08. O "ago 16" estava no
// corpo do e-mail; a data do documento nunca chegou a ser lida.

test('ano de dois dígitos COM separador de data vale em qualquer texto', () => {
  // A barra é o que distingue data de coincidência.
  assert.equal(extrairCompetencia('período de ago/26 a set/26')?.competencia, '2026-08');
  assert.equal(extrairCompetencia('agosto-26')?.competencia, '2026-08');
});

test('ano de dois dígitos SEM separador só vale em nome de arquivo', () => {
  // "folha_ago_26.pdf" — o underscore vira espaço na normalização.
  assert.equal(
    extrairCompetencia('folha ago 26.pdf', { permitirAnoCurto: true })?.competencia,
    '2026-08',
  );
  assert.equal(extrairCompetencia('folha ago 26.pdf'), null);
});

test('prosa NÃO aceita mês por extenso com ano de dois dígitos', () => {
  // O caso que quebrou: dois dígitos depois de um mês, em texto corrido.
  assert.equal(extrairCompetencia('seu pedido foi entregue em ago 16'), null);
  assert.equal(extrairCompetencia('validade mar 30 dias'), null);
  assert.equal(extrairCompetencia('previsão set 20 a set 25'), null);
});

test('prosa continua lendo data escrita como data', () => {
  // O que a restrição NÃO pode custar: a data de emissão de uma DANFE.
  assert.equal(
    extrairCompetencia('DATA DE EMISSÃO DATA DE SAÍDA 13/08/2026 13/08/2026 12:54:58')?.competencia,
    '2026-08',
  );
  assert.equal(extrairCompetencia('competência agosto de 2026')?.competencia, '2026-08');
  assert.equal(extrairCompetencia('referente a 08/2026')?.competencia, '2026-08');
});

test('o padrão frouxo não vaza pelo padrão do parâmetro', () => {
  // Sem opção explícita, o comportamento é o seguro. Quem quiser o frouxo
  // precisa pedir — é o que impede um chamador novo de reintroduzir o bug.
  assert.equal(extrairCompetencia('entregue ago 16'), null);
  assert.equal(extrairCompetencia('entregue ago 16', {}), null);
});
