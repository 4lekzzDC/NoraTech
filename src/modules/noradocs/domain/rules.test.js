import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificar } from './rules.js';

// Cadastro de um escritório fictício, próximo do que se vê na prática:
// um cliente com CNPJ, um sem CNPJ e um inativo.
const SILVA = {
  id: 'cli-silva', nome: 'Silva Comércio de Alimentos ME',
  cnpj: '11222333000181', aliases: ['Silva ME', 'SILVACOM'], ativo: true,
};
const COSTA = {
  id: 'cli-costa', nome: 'Costa Serviços Ltda',
  cnpj: null, aliases: ['Costa'], ativo: true,
};
const ANTIGO = {
  id: 'cli-antigo', nome: 'Silva Antiga ME',
  cnpj: null, aliases: ['Silva ME'], ativo: false,
};

const EXTRATOS = { id: 'cat-ext', slug: 'extratos-bancarios', nome: 'Extratos bancários',
  keywords: ['extrato', 'conta corrente'], ativo: true };
const NOTAS = { id: 'cat-nf', slug: 'notas-fiscais', nome: 'Notas fiscais',
  keywords: ['nota fiscal', 'nfe', 'danfe'], ativo: true };
const PAGAR = { id: 'cat-pag', slug: 'contas-a-pagar', nome: 'Contas a pagar',
  keywords: ['pagar', 'boleto'], ativo: true };

const CONTEXTO = {
  clients: [SILVA, COSTA, ANTIGO],
  categories: [EXTRATOS, NOTAS, PAGAR],
  rules: [],
};

const RECEBIDO = new Date(2026, 8, 10); // setembro/2026

function run(sinais, contexto = CONTEXTO) {
  return classificar({ receivedAt: RECEBIDO, ...sinais }, contexto);
}

// ── Caminho feliz ────────────────────────────────────────────────────────

test('os três campos identificados liberam o arquivamento automático', () => {
  const r = run({
    fileName: 'extrato_08-2026.pdf',
    text: 'Banco Itaú — CNPJ 11.222.333/0001-81 — extrato de conta corrente',
  });
  assert.equal(r.clientId, 'cli-silva');
  assert.equal(r.competencia, '2026-08');
  assert.equal(r.categoryId, 'cat-ext');
  assert.equal(r.decisao, 'organizar');
  assert.equal(r.motivoRevisao, null);
  assert.equal(r.pendencias.length, 0);
});

test('a evidência diz por que, em uma frase', () => {
  const r = run({ fileName: 'extrato 08-2026.pdf', text: 'CNPJ 11.222.333/0001-81' });
  const cliente = r.evidence.find((e) => e.campo === 'cliente');
  assert.equal(cliente.detalhe, 'CNPJ 11.222.333/0001-81 no texto');
});

// ── Identificação de cliente ─────────────────────────────────────────────

test('CNPJ no nome do arquivo também identifica', () => {
  const r = run({ fileName: 'nf 11222333000181 08-2026.pdf', text: 'nota fiscal' });
  assert.equal(r.clientId, 'cli-silva');
});

test('apelido no nome do arquivo identifica quando não há CNPJ', () => {
  const r = run({ fileName: 'boleto Silva ME 08-2026.pdf', text: '' });
  assert.equal(r.clientId, 'cli-silva');
  assert.match(r.evidence.find((e) => e.campo === 'cliente').detalhe, /Silva ME/);
});

// Dois candidatos não é meio acerto — arquivar no cliente errado é pior do que
// perguntar.
test('apelido ambíguo entre dois clientes ativos vai para revisão', () => {
  const contexto = { ...CONTEXTO, clients: [SILVA, { ...ANTIGO, ativo: true }] };
  const r = run({ fileName: 'boleto Silva ME 08-2026.pdf', text: '' }, contexto);
  assert.equal(r.clientId, null);
  assert.equal(r.decisao, 'revisar');
  assert.match(r.motivoRevisao, /mais de um cliente/);
});

test('cliente inativo não participa da classificação', () => {
  const contexto = { ...CONTEXTO, clients: [ANTIGO] };
  const r = run({ fileName: 'boleto Silva ME 08-2026.pdf' }, contexto);
  assert.equal(r.clientId, null);
});

test('sem cliente identificado o motivo é legível', () => {
  const r = run({ fileName: 'documento (3).pdf', text: 'sem nada util' });
  assert.equal(r.clientId, null);
  assert.match(r.motivoRevisao, /nenhum CNPJ conhecido/);
});

test('escritório sem cliente cadastrado não quebra', () => {
  const r = run({ fileName: 'extrato 08-2026.pdf' }, { ...CONTEXTO, clients: [] });
  assert.equal(r.clientId, null);
  assert.equal(r.decisao, 'revisar');
});

// ── Regras do escritório ─────────────────────────────────────────────────

test('regra do escritório identifica cliente que o nome não entregaria', () => {
  const contexto = {
    ...CONTEXTO,
    rules: [{ id: 'r1', client_id: 'cli-costa', match_type: 'filename', pattern: 'CST', priority: 10 }],
  };
  const r = run({ fileName: 'CST_extrato_08-2026.pdf', text: '' }, contexto);
  assert.equal(r.clientId, 'cli-costa');
  assert.match(r.evidence.find((e) => e.campo === 'cliente').detalhe, /regra do escritório/);
});

test('regra de categoria vence palavra-chave', () => {
  const contexto = {
    ...CONTEXTO,
    rules: [{ id: 'r2', category_id: 'cat-pag', match_type: 'filename', pattern: 'extrato', priority: 5 }],
  };
  const r = run({ fileName: 'extrato 08-2026.pdf', text: 'CNPJ 11.222.333/0001-81' }, contexto);
  assert.equal(r.categoryId, 'cat-pag');
});

test('regra inativa é ignorada', () => {
  const contexto = {
    ...CONTEXTO,
    rules: [{ id: 'r3', client_id: 'cli-costa', match_type: 'filename', pattern: 'CST', ativo: false }],
  };
  assert.equal(run({ fileName: 'CST_08-2026.pdf' }, contexto).clientId, null);
});

// email_sender só ganha sinal quando a origem for o Gmail (etapa 2). Até lá
// precisa não casar, em vez de casar por engano com string vazia.
test('regra de remetente não casa enquanto não há e-mail', () => {
  const contexto = {
    ...CONTEXTO,
    rules: [{ id: 'r4', client_id: 'cli-costa', match_type: 'email_sender', pattern: 'costa.com.br' }],
  };
  assert.equal(run({ fileName: 'documento.pdf' }, contexto).clientId, null);
});

// ── Categoria ────────────────────────────────────────────────────────────

test('nome de banco no arquivo classifica como extrato', () => {
  const r = run({ fileName: 'itau 08-2026.pdf', text: 'CNPJ 11.222.333/0001-81' });
  assert.equal(r.categoryId, 'cat-ext');
  assert.match(r.evidence.find((e) => e.campo === 'categoria').detalhe, /banco/);
});

test('entre duas palavras-chave ganha a mais específica', () => {
  const contexto = {
    ...CONTEXTO,
    categories: [
      { id: 'cat-a', slug: 'a', nome: 'A', keywords: ['conta'], ativo: true },
      { id: 'cat-b', slug: 'b', nome: 'B', keywords: ['conta corrente'], ativo: true },
    ],
  };
  const r = run({ fileName: 'extrato conta corrente 08-2026.pdf' }, contexto);
  assert.equal(r.categoryId, 'cat-b');
});

test('palavra-chave do nome do arquivo tem prioridade sobre a do texto', () => {
  const r = run({ fileName: 'danfe 08-2026.pdf', text: 'extrato de conta corrente' });
  assert.equal(r.categoryId, 'cat-nf');
});

// "nota" não pode casar dentro de "anotacoes": limite de palavra importa.
test('palavra-chave respeita limite de palavra', () => {
  const contexto = {
    ...CONTEXTO,
    categories: [{ id: 'cat-x', slug: 'x', nome: 'X', keywords: ['nota'], ativo: true }],
  };
  assert.equal(run({ fileName: 'anotacoes internas 08-2026.pdf' }, contexto).categoryId, null);
});

// ── Competência ──────────────────────────────────────────────────────────

test('competência suposta nunca autoriza arquivamento sozinha', () => {
  const r = run({
    fileName: 'extrato itau.pdf',                 // sem data no nome
    text: 'CNPJ 11.222.333/0001-81 extrato',      // nem no texto
  });
  assert.equal(r.clientId, 'cli-silva');
  assert.equal(r.categoryId, 'cat-ext');
  assert.equal(r.competencia, '2026-08');         // mês anterior a setembro
  assert.deepEqual(r.suposicoes, ['competencia']);
  assert.equal(r.decisao, 'revisar');
  assert.match(r.motivoRevisao, /suposta/);
});

test('underscore no nome do arquivo não esconde a competência', () => {
  const r = run({ fileName: 'extrato_08-2026.pdf' });
  assert.equal(r.competencia, '2026-08');
  assert.deepEqual(r.suposicoes, []);
});

test('CNPJ no texto não é lido como competência', () => {
  const r = run({ fileName: 'extrato itau.pdf', text: 'CNPJ 11.222.333/0001-81' });
  assert.deepEqual(r.suposicoes, ['competencia']); // caiu no fallback, não leu /0001
});

// ── Contrato de saída ────────────────────────────────────────────────────

test('a versão das regras acompanha o resultado', () => {
  assert.equal(typeof run({ fileName: 'x.pdf' }).rulesVersion, 'string');
});

test('nunca lança com entrada vazia', () => {
  const r = classificar({}, {});
  assert.equal(r.decisao, 'revisar');
  assert.equal(r.clientId, null);
  assert.equal(typeof r.motivoRevisao, 'string');
});
