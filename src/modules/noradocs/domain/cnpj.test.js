import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCNPJ, formatCPF, isValidCNPJ, isValidCPF, onlyDigits } from './cnpj.js';

test('CNPJ válido, com e sem máscara', () => {
  assert.equal(isValidCNPJ('11.222.333/0001-81'), true);
  assert.equal(isValidCNPJ('11222333000181'), true);
});

test('CNPJ recusa dígito verificador errado', () => {
  assert.equal(isValidCNPJ('11.222.333/0001-82'), false);
});

// Sequências repetidas passam na conta dos dígitos verificadores — são o erro
// clássico de quem implementa só o algoritmo e para por aí.
test('CNPJ recusa sequência repetida', () => {
  for (const d of ['00000000000000', '11111111111111', '99999999999999']) {
    assert.equal(isValidCNPJ(d), false, d);
  }
});

test('CNPJ recusa tamanho errado e vazio', () => {
  assert.equal(isValidCNPJ('1122233300018'), false);
  assert.equal(isValidCNPJ('112223330001812'), false);
  assert.equal(isValidCNPJ(''), false);
  assert.equal(isValidCNPJ(null), false);
});

test('CPF válido, com e sem máscara', () => {
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('52998224725'), true);
});

test('CPF recusa inválidos', () => {
  assert.equal(isValidCPF('529.982.247-26'), false);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCPF('123.456.789-00'), false);
});

test('máscara é progressiva enquanto o usuário digita', () => {
  assert.equal(formatCNPJ('11'), '11');
  assert.equal(formatCNPJ('11222'), '11.222');
  assert.equal(formatCNPJ('11222333000181'), '11.222.333/0001-81');
  assert.equal(formatCPF('529982'), '529.982');
  assert.equal(formatCPF('52998224725'), '529.982.247-25');
});

test('máscara ignora excesso de dígitos', () => {
  assert.equal(formatCNPJ('112223330001819999'), '11.222.333/0001-81');
});

test('onlyDigits limpa qualquer formatação', () => {
  assert.equal(onlyDigits('11.222.333/0001-81'), '11222333000181');
  assert.equal(onlyDigits(undefined), '');
});
