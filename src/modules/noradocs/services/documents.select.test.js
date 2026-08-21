import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guarda contra o bug mais silencioso deste módulo: uma coluna que o código lê
// mas a consulta não traz. O campo chega `undefined`, nenhum erro é lançado, e
// a decisão que dependia dele passa a ser sempre a mesma — errada.
//
// `drive_file_id` ficou de fora por três etapas. Enquanto isso,
// `confirmarDocumento` gravava o caminho novo no banco sem mover o arquivo no
// Drive, porque achava que não havia arquivo.

const AQUI = new URL('.', import.meta.url);

// A lista é lida do FONTE, não importada: documents.service.js importa
// `lib/supabase` por um caminho sem extensão, que o Vite resolve e o loader
// ESM do Node não. Este teste é análise estática do código — igual ao que ele
// já faz com os leitores abaixo.
function colunasDaConsulta() {
  const fonte = readFileSync(new URL('./documents.service.js', AQUI), 'utf8');
  const bloco = fonte.match(/COLUNAS_DO_DOCUMENTO = \[([\s\S]*?)\];/);
  assert.ok(bloco, 'COLUNAS_DO_DOCUMENTO não foi encontrada em documents.service.js');
  return [...bloco[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const COLUNAS_DO_DOCUMENTO = colunasDaConsulta();

// Arquivos que recebem uma linha de documento e leem campos dela.
const LEITORES = [
  '../components/ReviewDrawer.jsx',
  '../components/DocumentTable.jsx',
  '../components/EventTrail.jsx',
  '../pages/HistoricoPage.jsx',
  '../domain/status.js',
  './review.service.js',
];

// Campos que vêm de outro lugar (relacionamentos, estado da tela) e por isso
// não precisam estar na lista de colunas.
const NAO_SAO_COLUNAS = new Set(['client', 'category', 'id', 'length', 'map', 'filter']);

for (const arquivo of LEITORES) {
  test(`${arquivo}: todo campo de documento que ele lê vem na consulta`, () => {
    const fonte = readFileSync(new URL(arquivo, AQUI), 'utf8');

    // Casa `doc.algo` e `documento.algo` — a forma como uma linha é lida.
    const lidos = [...fonte.matchAll(/\b(?:doc|documento)\.([a-z][a-z0-9_]*)/g)]
      .map((m) => m[1])
      .filter((campo) => !NAO_SAO_COLUNAS.has(campo));

    const faltando = [...new Set(lidos)].filter((c) => !COLUNAS_DO_DOCUMENTO.includes(c));
    assert.deepEqual(
      faltando,
      [],
      `${arquivo} lê ${faltando.join(', ')}, mas a consulta de documents.service.js não traz `
      + 'essa(s) coluna(s). O campo chegaria undefined sem nenhum erro.',
    );
  });
}
