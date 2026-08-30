import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABELA_SP, digitosNcm, getTabela, validarTabela } from './ncmRegras.js';

test('a tabela de SP entregue no repositório é válida', () => {
  assert.deepEqual(validarTabela(TABELA_SP), []);
});

test('digitosNcm tira pontuação', () => {
  assert.equal(digitosNcm('3307.20'), '330720');
  assert.equal(digitosNcm('3307.90.00'), '33079000');
  assert.equal(digitosNcm(null), '');
});

test('getTabela resolve por UF, sem diferenciar caixa', () => {
  assert.equal(getTabela('sp'), TABELA_SP);
  assert.equal(getTabela('MG'), null);
});

const base = (regras) => ({
  uf: 'SP', versao: 't', regraGeral: { aliquota: 18, fcp: 0, fundamento: 'x' }, regras,
});

test('reprova prefixo com número de dígitos fora da hierarquia', () => {
  const erros = validarTabela(base([{ ncm: '330', aliquota: 25, fundamento: 'x' }]));
  assert.match(erros[0], /2, 4, 6 ou 8 dígitos/);
});

test('reprova regra sem alíquota e regra com alíquota e seguirGeral juntos', () => {
  assert.match(validarTabela(base([{ ncm: '3307', fundamento: 'x' }]))[0], /aliquota' OU 'seguirGeral/);
  assert.match(
    validarTabela(base([{ ncm: '3307', aliquota: 25, seguirGeral: true, fundamento: 'x' }]))[0],
    /aliquota' OU 'seguirGeral/,
  );
});

test('reprova exceção cujo pai não é faixa mais genérica', () => {
  const erros = validarTabela(base([
    { ncm: '3307.20', seguirGeral: true, tipo: 'excecao', excecaoDe: '2202', fundamento: 'x' },
  ]));
  assert.match(erros[0], /não é faixa mais genérica/);
});

test('reprova duplicidade com vigência sobreposta e aceita vigências disjuntas', () => {
  const sobreposto = validarTabela(base([
    { ncm: '3307', aliquota: 25, fundamento: 'x' },
    { ncm: '3307', aliquota: 20, fundamento: 'y' },
  ]));
  assert.match(sobreposto[0], /duplicado com vigência sobreposta/);

  const disjunto = validarTabela(base([
    { ncm: '3307', aliquota: 25, fundamento: 'x', vigenciaFim: '2025-12-31' },
    { ncm: '3307', aliquota: 20, fundamento: 'y', vigenciaInicio: '2026-01-01' },
  ]));
  assert.deepEqual(disjunto, []);
});

test('reprova alíquota implausível, FCP implausível e falta de fundamento', () => {
  const erros = validarTabela(base([{ ncm: '3307', aliquota: 250, fcp: 90 }]));
  assert.equal(erros.length, 3);
});

test('reprova vigência com início depois do fim, aceita início antes do fim', () => {
  const erros = validarTabela(base([
    { ncm: '3307', aliquota: 25, fundamento: 'x', vigenciaInicio: '2026-06-01', vigenciaFim: '2026-01-01' },
  ]));
  assert.match(erros[0], /início \(2026-06-01\) é depois do fim \(2026-01-01\)/);

  const ok = validarTabela(base([
    { ncm: '3307', aliquota: 25, fundamento: 'x', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-06-01' },
  ]));
  assert.deepEqual(ok, []);
});
