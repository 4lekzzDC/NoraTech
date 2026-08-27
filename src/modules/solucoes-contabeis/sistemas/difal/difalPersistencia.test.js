import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linhasParaGravar, resultadoDeLinhas, situacaoDaNota, xmlPorArquivo } from './difalPersistencia.js';
import { processarLote } from './difalPipeline.js';
import { XML_NFE_EXEMPLO } from './fixtures/nfeExemplo.js';

const ENTRADAS = [
  { nome: 'nfe-1234.xml', xml: XML_NFE_EXEMPLO },
  { nome: 'quebrada.xml', xml: '<NFe><infNFe>' },
  // Nota interna (SP → SP): lida e descartada na triagem.
  { nome: 'interna.xml', xml: XML_NFE_EXEMPLO.replace('<UF>PR</UF>', '<UF>SP</UF>') },
];
const LOTE = processarLote(ENTRADAS);

const CONTEXTO = {
  tenantCompanyId: 't1',
  accountingCompanyId: 'c2',
  competencia: '2026-08',
  ufDestino: 'SP',
  metodoBase: 'base_simples',
  politicaRevenda: 'nao_incide',
  versaoMotor: '1',
  versaoTabela: '2026-01',
  createdBy: 'u1',
};

// Simula o que o banco devolve: as notas com seus itens aninhados.
function comoOBancoDevolve(gravado) {
  return gravado.notas.map(({ nota, itens }) => ({ ...nota, itens }));
}

test('as três situações de nota chegam distintas ao banco', () => {
  const [processada, ilegivel, interna] = LOTE.notas;
  assert.equal(situacaoDaNota(processada), 'processada');
  assert.equal(situacaoDaNota(ilegivel), 'erro');
  assert.equal(situacaoDaNota(interna), 'nao_aplicavel');
});

test('a apuração grava os parâmetros que mudam o resultado', () => {
  const { apuracao } = linhasParaGravar(LOTE, CONTEXTO);
  assert.deepEqual(
    {
      tenant: apuracao.tenant_company_id, comp: apuracao.competencia,
      metodo: apuracao.metodo_base, revenda: apuracao.politica_revenda,
      motor: apuracao.versao_motor, tabela: apuracao.versao_tabela,
      status: apuracao.status,
    },
    {
      tenant: 't1', comp: '2026-08', metodo: 'base_simples',
      revenda: 'nao_incide', motor: '1', tabela: '2026-01', status: 'aberta',
    },
  );
  assert.equal(apuracao.totais.vTotal, LOTE.totais.vTotal);
});

test('cada nota leva chave, partes, situação e o XML original', () => {
  const { notas } = linhasParaGravar(LOTE, CONTEXTO, xmlPorArquivo(ENTRADAS));
  const processada = notas[0].nota;

  assert.equal(processada.chave, '41260812345678000199550010000012341000012340');
  assert.equal(processada.numero, '1234');
  assert.equal(processada.data_emissao, '2026-08-14');
  assert.equal(processada.emitente_cnpj, '12345678000199');
  assert.equal(processada.uf_origem, 'PR');
  assert.equal(processada.uf_destino, 'SP');
  assert.equal(processada.situacao, 'processada');
  assert.equal(processada.xml, XML_NFE_EXEMPLO);
  assert.equal(processada.identificacao.modelo, '55', 'identificação completa para a lupa');
  assert.equal(processada.tenant_company_id, 't1', 'tenant desnormalizado para o aviso de repetida');

  // O arquivo ilegível também vira linha: nota que some sem explicação vira
  // desconfiança na apuração inteira.
  const ilegivel = notas[1].nota;
  assert.equal(ilegivel.situacao, 'erro');
  assert.match(ilegivel.motivo, /malformado/);
  assert.equal(notas[1].itens.length, 0);
});

test('cada item leva o cálculo e a procedência da alíquota', () => {
  const { notas } = linhasParaGravar(LOTE, CONTEXTO);
  const itens = notas[0].itens;
  assert.equal(itens.length, 7);

  const desodorante = itens.find((i) => i.n_item === 2);
  assert.deepEqual(
    {
      ncm: desodorante.ncm, situacao: desodorante.situacao,
      interna: desodorante.aliquota_interna, inter: desodorante.aliquota_interestadual,
      origem: desodorante.origem_interna, regra: desodorante.ncm_regra,
      fonteInter: desodorante.fonte_interestadual,
      base: desodorante.v_base, total: desodorante.v_total,
    },
    {
      ncm: '33072010', situacao: 'calculado', interna: 18, inter: 12,
      origem: 'excecao', regra: '330720', fonteInter: 'destaque_xml',
      base: 500, total: 30,
    },
  );
  assert.equal(desodorante.fonte.vProd, 500, 'o item cru vai junto');

  const pendente = itens.find((i) => i.situacao === 'pendente');
  assert.equal(pendente.aliquota_interna, null, 'item sem cálculo não inventa alíquota');
  assert.equal(pendente.v_total, 0);
});

test('sem o XML em mãos, a nota é gravada sem ele — e não quebra', () => {
  const { notas } = linhasParaGravar(LOTE, CONTEXTO);
  assert.equal(notas[0].nota.xml, null);
});

// ── O teste que importa ───────────────────────────────────────────────────
test('ida e volta: o que a tela mostra depois de recarregar é o que ela mostrava', () => {
  const gravado = linhasParaGravar(LOTE, CONTEXTO, xmlPorArquivo(ENTRADAS));
  const relido = resultadoDeLinhas(gravado.apuracao, comoOBancoDevolve(gravado));

  assert.deepEqual(relido.totais, LOTE.totais);
  assert.deepEqual(relido.porNcm, LOTE.porNcm);
  assert.deepEqual(relido.pendencias, LOTE.pendencias);
  assert.deepEqual(relido.erros, LOTE.erros);

  // Nota processada: item a item, incluindo o dado bruto e a explicação.
  const antes = LOTE.notas[0];
  const depois = relido.notas[0];
  assert.deepEqual(depois.itens, antes.itens);
  assert.deepEqual(depois.operacao, antes.operacao);
  assert.deepEqual(depois.nota, antes.nota);
  assert.equal(depois.processada, true);

  // Nota ilegível e nota descartada na triagem sobrevivem à ida e volta.
  assert.equal(relido.notas[1].ok, false);
  assert.match(relido.notas[1].erro, /malformado/);
  assert.equal(relido.notas[2].processada, false);
  assert.match(relido.notas[2].motivo, /Operação interna/);
});

test('ida e volta preserva a base dupla, que muda os números', () => {
  const dupla = processarLote(ENTRADAS, { metodoBase: 'base_dupla' });
  const gravado = linhasParaGravar(dupla, { ...CONTEXTO, metodoBase: 'base_dupla' });
  const relido = resultadoDeLinhas(gravado.apuracao, comoOBancoDevolve(gravado));

  assert.deepEqual(relido.totais, dupla.totais);
  const item = relido.notas[0].itens.find((i) => i.nItem === 1);
  assert.equal(item.metodoBase, 'base_dupla');
  assert.equal(item.valores.vBaseDifal, dupla.notas[0].itens[0].valores.vBaseDifal);
  assert.ok(item.valores.vBaseDifal > item.valores.vBase, 'base recomposta por dentro');
});

test('numérico que volta como string do Postgres não estraga a soma', () => {
  const gravado = linhasParaGravar(LOTE, CONTEXTO);
  const comoTexto = comoOBancoDevolve(gravado).map((n) => ({
    ...n,
    itens: n.itens.map((i) => ({
      ...i,
      v_base: String(i.v_base), v_base_difal: String(i.v_base_difal),
      v_difal: String(i.v_difal), v_fcp: String(i.v_fcp), v_total: String(i.v_total),
      aliquota_interna: i.aliquota_interna == null ? null : String(i.aliquota_interna),
      aliquota_interestadual: i.aliquota_interestadual == null ? null : String(i.aliquota_interestadual),
    })),
  }));
  const relido = resultadoDeLinhas(gravado.apuracao, comoTexto);
  assert.deepEqual(relido.totais, LOTE.totais);
  assert.equal(relido.notas[0].itens[0].aliquotas.interna, 25);
});

test('xmlPorArquivo indexa pelo nome e ignora entrada sem nome', () => {
  assert.deepEqual(
    xmlPorArquivo([{ nome: 'a.xml', xml: '<a/>' }, { xml: '<b/>' }]),
    { 'a.xml': '<a/>' },
  );
  assert.deepEqual(xmlPorArquivo(), {});
});
