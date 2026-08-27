import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_EXPORTACAO, CST_ICMS, ORIGEM_MERCADORIA, achatarItens, competenciaDoLote,
  descreverCodigo, explicarCalculo, fmtCnpj, fmtData, fmtNcm, fmtPct, fmtQtd,
  linhasExportacao, nomeArquivoExportacao, rotuloOrigemAliquota, rotuloSituacao,
  rotuloTributacaoIcms,
} from './difalFormato.js';
import { processarLote } from './difalPipeline.js';
import { XML_NFE_EXEMPLO } from './fixtures/nfeExemplo.js';

const LOTE = processarLote([{ nome: 'nfe-1234.xml', xml: XML_NFE_EXEMPLO }]);

test('formata NCM, CNPJ, data e percentual como o fiscal lê', () => {
  assert.equal(fmtNcm('33071000'), '3307.10.00');
  assert.equal(fmtNcm('330720'), '3307.20', 'prefixo de subposição também é pontuado');
  assert.equal(fmtNcm('3307'), '3307');
  assert.equal(fmtNcm('333'), '333', 'comprimento fora da hierarquia aparece cru');
  assert.equal(fmtCnpj('98765432000110'), '98.765.432/0001-10');
  assert.equal(fmtData('2026-08-14'), '14/08/2026');
  assert.equal(fmtData(null), '—');
  assert.equal(fmtPct(25), '25%');
  assert.equal(fmtPct(1.65), '1,65%');
});

test('a origem da alíquota distingue regra do NCM, exceção e regra geral', () => {
  const daPosicao = rotuloOrigemAliquota({ origemInterna: 'ncm', ncmRegra: '3307', nivelNcm: 4, fundamento: 'RICMS art. 55' });
  assert.equal(daPosicao.curto, '3307 · posição');

  // Regra de 8 dígitos aparece pontuada, como na TIPI.
  const doItem = rotuloOrigemAliquota({ origemInterna: 'ncm', ncmRegra: '33079000', nivelNcm: 8, fundamento: 'x' });
  assert.equal(doItem.curto, '3307.90.00 · item');
  assert.match(daPosicao.longo, /RICMS art\. 55/);

  const daExcecao = rotuloOrigemAliquota({ origemInterna: 'excecao', ncmRegra: '330720', nivelNcm: 6, fundamento: 'Desodorantes' });
  assert.equal(daExcecao.curto, '3307.20 · exceção');
  assert.match(daExcecao.longo, /remete à regra geral/);

  const geral = rotuloOrigemAliquota({ origemInterna: 'regra_geral', ncmRegra: null, nivelNcm: 0 });
  assert.equal(geral.curto, 'Regra geral');
  assert.match(geral.longo, /Nenhuma faixa de NCM/);

  assert.equal(rotuloOrigemAliquota(null).curto, '—');
});

test('situação desconhecida não quebra a tela', () => {
  assert.equal(rotuloSituacao('calculado').label, 'Calculado');
  assert.equal(rotuloSituacao('inventada').label, 'inventada');
  assert.equal(rotuloSituacao(undefined).label, '—');
});

test('achatarItens repete os dados da nota em cada item e ignora nota não processada', () => {
  const linhas = achatarItens(LOTE.notas);
  assert.equal(linhas.length, 7);
  assert.equal(linhas[0].numeroNota, '1234');
  assert.equal(linhas[0].ufOrigem, 'PR');
  assert.equal(linhas[0].arquivo, 'nfe-1234.xml');

  const comRejeitada = achatarItens([...LOTE.notas, { ok: true, processada: false, itens: [] }, { ok: false }]);
  assert.equal(comRejeitada.length, 7);
});

test('a planilha leva cabeçalho, uma linha por item e a linha de total', () => {
  const linhas = linhasExportacao(LOTE.notas);
  assert.deepEqual(linhas[0], COLUNAS_EXPORTACAO);
  assert.equal(linhas.length, 1 + 7 + 2, 'cabeçalho + itens + linha em branco + total');

  const perfume = linhas[1];
  assert.equal(perfume[9], '3307.10.00');
  assert.equal(perfume[12], 'Calculado');
  assert.equal(perfume[13], '3307 · posição');
  assert.equal(perfume[19], 143);

  const total = linhas.at(-1);
  assert.equal(total[17], 'TOTAL');
  assert.deepEqual(total.slice(18, 22), [4950, 640, 4, 644]);
  assert.equal(total.length, COLUNAS_EXPORTACAO.length);
});

test('valores saem como número, para a planilha somar sem conversão', () => {
  const linhas = linhasExportacao(LOTE.notas);
  for (const linha of linhas.slice(1, 8)) {
    for (const col of [18, 19, 20, 21]) assert.equal(typeof linha[col], 'number');
  }
});

test('a observação carrega o motivo da pendência para fora do sistema', () => {
  const linhas = linhasExportacao(LOTE.notas);
  const pendente = linhas.find((l) => l[12] === 'Pendente');
  assert.match(pendente.at(-1), /8 dígitos/);
  assert.equal(pendente[13], '', 'item sem cálculo não mostra origem de alíquota');
});

test('lote vazio exporta só cabeçalho e total zerado', () => {
  const linhas = linhasExportacao([]);
  assert.equal(linhas.length, 3);
  assert.deepEqual(linhas.at(-1).slice(18, 22), [0, 0, 0, 0]);
});

test('nome do arquivo usa a competência quando ela existe', () => {
  assert.equal(nomeArquivoExportacao('2026-08'), 'DIFAL_2026-08.xlsx');
  assert.match(nomeArquivoExportacao(null), /^DIFAL_\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test('a conta do item aparece por extenso, para conferência no papel', () => {
  const itens = achatarItens(LOTE.notas);
  const perfume = itens.find((i) => i.nItem === 1);
  assert.equal(
    explicarCalculo(perfume).difal,
    'R$ 1.100,00 × (25% − 12%) = R$ 143,00',
  );
  assert.equal(explicarCalculo(perfume).fcp, null, 'sem FCP, sem linha de FCP');

  const cigarrilha = itens.find((i) => i.nItem === 5);
  assert.match(explicarCalculo(cigarrilha).fcp, /× 2% = R\$\u00a04,00$/);

  const pendente = itens.find((i) => i.situacao === 'pendente');
  assert.equal(explicarCalculo(pendente), null);
  assert.equal(explicarCalculo(null), null);
});

test('base dupla mostra a base recomposta na explicação', () => {
  const dupla = processarLote([{ nome: 'x.xml', xml: XML_NFE_EXEMPLO }], { metodoBase: 'base_dupla' });
  const perfume = achatarItens(dupla.notas).find((i) => i.nItem === 1);
  assert.match(explicarCalculo(perfume).difal, /^Base recomposta R\$/);
});

test('competência do lote é o mês da maioria das notas', () => {
  assert.equal(competenciaDoLote(LOTE.notas), '2026-08');
  assert.equal(competenciaDoLote([]), null);
  assert.equal(competenciaDoLote([{ nota: { dataEmissao: null } }]), null);
});

test('códigos do leiaute viram texto, e o desconhecido aparece cru', () => {
  assert.equal(descreverCodigo(CST_ICMS, '60'), '60 — ICMS cobrado anteriormente por substituição tributária');
  assert.equal(descreverCodigo(CST_ICMS, '00'), '00 — Tributada integralmente');
  assert.equal(descreverCodigo(ORIGEM_MERCADORIA, '1'), '1 — Estrangeira — importação direta, exceto a do código 6');
  assert.equal(descreverCodigo(CST_ICMS, '77'), '77', 'código fora da tabela não ganha descrição inventada');
  assert.equal(descreverCodigo(CST_ICMS, null), '—');
});

test('a tributação de origem sai em uma linha, com CST ou CSOSN', () => {
  assert.match(rotuloTributacaoIcms({ cst: '00', csosn: null }), /^CST 00 — Tributada integralmente$/);
  assert.match(rotuloTributacaoIcms({ cst: null, csosn: '102' }), /^CSOSN 102 — Tributada pelo Simples/);
  assert.equal(rotuloTributacaoIcms({ cst: null, csosn: null, grupo: 'ICMSSN900' }), 'ICMSSN900');
  assert.equal(rotuloTributacaoIcms(null), '—');
});

test('quantidade mostra as casas da nota, sem zeros à toa', () => {
  assert.equal(fmtQtd(10), '10');
  assert.equal(fmtQtd(1.5), '1,5');
  assert.equal(fmtQtd('abc'), '—');
});
