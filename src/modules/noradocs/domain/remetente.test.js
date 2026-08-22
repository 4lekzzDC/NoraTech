import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehCaixaAutomatica, empresaDoRemetente } from './remetente.js';

// O caso que originou este módulo: uma DANFE da Carpei Acessórios chegou
// anexada a um aviso de entrega da TikTok Shop. O produto criou um cliente
// provisório chamado "TikTok Shop" e abriu uma pasta com o nome da plataforma.

test('remetente automático não vira empresa', () => {
  assert.equal(empresaDoRemetente('no-reply@shop.tiktok.com', 'TikTok Shop'), null);
});

test('reconhece as grafias de caixa automática', () => {
  for (const endereco of [
    'no-reply@x.com', 'noreply@x.com', 'no_reply@x.com', 'no.reply@x.com',
    'nao-responda@x.com', 'naoresponda@x.com', 'donotreply@x.com',
    'notificacoes@x.com', 'mailer-daemon@x.com', 'postmaster@x.com',
    'no-reply-financeiro@x.com', 'sistema-noreply@x.com',
  ]) {
    assert.equal(ehCaixaAutomatica(endereco), true, endereco);
  }
});

test('caixa de gente não é confundida com automática', () => {
  // O risco do lado oposto: recusar um remetente legítimo faz todo documento
  // daquele cliente cair em triagem sem motivo.
  for (const endereco of [
    'vendas@padariaaurora.com.br', 'financeiro@aurora.com.br',
    'contato@aurora.com.br', 'joao@aurora.com.br', 'nf@aurora.com.br',
    'abounce@aurora.com.br', 'renotificacao@aurora.com.br',
  ]) {
    assert.equal(ehCaixaAutomatica(endereco), false, endereco);
  }
});

test('empresa de verdade continua virando cliente provisório', () => {
  assert.deepEqual(
    empresaDoRemetente('financeiro@padariaaurora.com.br', 'Padaria Aurora Ltda'),
    { nome: 'Padaria Aurora Ltda', dominio: 'padariaaurora.com.br' },
  );
});

test('provedor aberto não vira empresa', () => {
  assert.equal(empresaDoRemetente('fulano@gmail.com', 'Fulano'), null);
});

test('sem nome de exibição, cai no domínio', () => {
  assert.deepEqual(
    empresaDoRemetente('nf@aurora.com.br', ''),
    { nome: 'aurora.com.br', dominio: 'aurora.com.br' },
  );
});

test('nome de exibição que é um e-mail não vira nome de pasta', () => {
  assert.deepEqual(
    empresaDoRemetente('nf@aurora.com.br', 'nf@aurora.com.br'),
    { nome: 'aurora.com.br', dominio: 'aurora.com.br' },
  );
});
