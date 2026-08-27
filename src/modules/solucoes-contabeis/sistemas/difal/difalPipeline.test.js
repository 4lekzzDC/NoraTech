import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consolidar, processarLote, processarNota } from './difalPipeline.js';
import { TABELA_SP } from './ncmRegras.js';
import { XML_NFE_EXEMPLO } from './fixtures/nfeExemplo.js';

const item = (resultado, nItem) => resultado.itens.find((i) => i.nItem === nItem);

test('a nota de exemplo é processada item a item, com números conferíveis na mão', () => {
  const r = processarNota(XML_NFE_EXEMPLO);
  assert.equal(r.ok, true);
  assert.equal(r.processada, true);
  assert.equal(r.operacao.ufOrigem, 'PR');
  assert.equal(r.operacao.ufDestino, 'SP');
  assert.equal(r.versaoTabela, TABELA_SP.versao);

  // 1 · perfume: base 1000 + 100 de frete = 1100 × (25% − 12%) = 143,00
  assert.deepEqual(
    { s: item(r, 1).situacao, base: item(r, 1).valores.vBase, difal: item(r, 1).valores.vDifal },
    { s: 'calculado', base: 1100, difal: 143 },
  );
  // 2 · desodorante: a exceção 3307.20 derruba os 25% da posição → 500 × 6%
  assert.equal(item(r, 2).aliquotas.origemInterna, 'excecao');
  assert.equal(item(r, 2).valores.vDifal, 30);
  // 3 · notebook importado no ativo: IPI entra na base → 3150 × (18% − 4%)
  assert.equal(item(r, 3).finalidade, 'ativo_imobilizado');
  assert.equal(item(r, 3).valores.vBase, 3150);
  assert.equal(item(r, 3).valores.vDifal, 441);
  // 4 · detergente com ST retido: fora do cálculo
  assert.equal(item(r, 4).situacao, 'nao_aplicavel');
  // 5 · cigarrilha: 200 × 13% = 26,00 de DIFAL + 200 × 2% = 4,00 de FCP
  assert.deepEqual(
    { difal: item(r, 5).valores.vDifal, fcp: item(r, 5).valores.vFcp, total: item(r, 5).valores.vTotal },
    { difal: 26, fcp: 4, total: 30 },
  );
  // 6 · NCM fora do padrão: pendência, nunca cálculo por aproximação
  assert.equal(item(r, 6).situacao, 'pendente');
  // 7 · camiseta para revenda em SP: sem antecipação
  assert.equal(item(r, 7).situacao, 'nao_aplicavel');

  assert.deepEqual(r.totais, {
    itens: 7, calculados: 4, pendentes: 1, naoAplicaveis: 2,
    vBase: 4950, vDifal: 640, vFcp: 4, vTotal: 644,
  });
});

test('o total da nota é a soma dos itens já arredondados', () => {
  const r = processarNota(XML_NFE_EXEMPLO);
  const somaMao = r.itens.reduce((s, i) => s + i.valores.vTotal, 0);
  assert.equal(r.totais.vTotal, Math.round(somaMao * 100) / 100);
});

test('método base dupla muda o resultado e fica registrado no item', () => {
  const r = processarNota(XML_NFE_EXEMPLO, { metodoBase: 'base_dupla' });
  assert.equal(r.operacao.metodoBase, 'base_dupla');
  assert.equal(item(r, 1).metodoBase, 'base_dupla');
  assert.ok(item(r, 1).valores.vDifal > 143, 'base recomposta por dentro sempre eleva o DIFAL');
});

test('política de antecipação na revenda traz os itens de revenda para o cálculo', () => {
  const r = processarNota(XML_NFE_EXEMPLO, { politicaRevenda: 'antecipacao_parcial' });
  assert.equal(item(r, 7).situacao, 'calculado');
  assert.equal(item(r, 7).valores.vDifal, 36); // 600 × (18% − 12%)
});

// ── Triagem da nota ───────────────────────────────────────────────────────

const nota = ({ ufEmit = 'PR', ufDest = 'SP', mod = '55', fin = '1', cnpjDest = '98765432000110' }) => `
  <NFe><infNFe Id="NFe1" versao="4.00">
    <ide><mod>${mod}</mod><nNF>1</nNF><dhEmi>2026-08-14T10:00:00-03:00</dhEmi><idDest>2</idDest><finNFe>${fin}</finNFe></ide>
    <emit><CNPJ>12345678000199</CNPJ><enderEmit><UF>${ufEmit}</UF></enderEmit></emit>
    <dest><CNPJ>${cnpjDest}</CNPJ><enderDest><UF>${ufDest}</UF></enderDest></dest>
    <det nItem="1"><prod><NCM>33071000</NCM><CFOP>6556</CFOP><vProd>100.00</vProd></prod>
      <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><pICMS>12.00</pICMS></ICMS00></ICMS></imposto>
    </det>
  </infNFe></NFe>`;

test('operação interna não gera DIFAL', () => {
  const r = processarNota(nota({ ufEmit: 'SP', ufDest: 'SP' }));
  assert.equal(r.processada, false);
  assert.equal(r.situacao, 'nao_aplicavel');
  assert.match(r.motivo, /Operação interna/);
  assert.equal(r.totais.vTotal, 0);
});

test('modelo 65 e nota de devolução são descartados na triagem', () => {
  assert.match(processarNota(nota({ mod: '65' })).motivo, /modelo 55/);
  assert.match(processarNota(nota({ fin: '4' })).motivo, /devolução/);
});

test('nota de outro destinatário não entra na apuração do cliente', () => {
  const r = processarNota(nota({}), { cnpjCliente: '11.222.333/0001-81' });
  assert.equal(r.situacao, 'nao_aplicavel');
  assert.match(r.motivo, /não é o cliente em apuração/);

  const certa = processarNota(nota({}), { cnpjCliente: '98.765.432/0001-10' });
  assert.equal(certa.processada, true, 'CNPJ com ou sem máscara dá no mesmo');
});

test('UF sem tabela cadastrada vira pendência, não cálculo com alíquota de outra UF', () => {
  const r = processarNota(nota({ ufDest: 'MG' }));
  assert.equal(r.situacao, 'pendente');
  assert.match(r.motivo, /tabela de alíquotas internas cadastrada para MG/);
});

test('tabela de UF diferente do destinatário é recusada', () => {
  const r = processarNota(nota({ ufDest: 'MG' }), { tabela: TABELA_SP });
  assert.match(r.motivo, /Tabela informada é de SP/);
});

test('tabela com erro de cadastro interrompe o processamento', () => {
  const quebrada = { ...TABELA_SP, regras: [...TABELA_SP.regras, { ncm: '330', aliquota: 25, fundamento: 'x' }] };
  const r = processarNota(nota({}), { tabela: quebrada });
  assert.equal(r.situacao, 'pendente');
  assert.match(r.motivo, /erro de cadastro/);
});

test('XML ilegível devolve erro identificado, sem derrubar o lote', () => {
  const r = processarNota('<NFe><infNFe>');
  assert.equal(r.ok, false);
  assert.match(r.erro, /malformado/);
});

// ── Lote e consolidação ───────────────────────────────────────────────────

test('lote soma as notas, agrupa por NCM e lista as pendências', () => {
  const lote = processarLote([
    { nome: 'nfe-1234.xml', xml: XML_NFE_EXEMPLO },
    { nome: 'nfe-1234-copia.xml', xml: XML_NFE_EXEMPLO },
    { nome: 'interna.xml', xml: nota({ ufEmit: 'SP' }) },
    { nome: 'quebrada.xml', xml: '<NFe><infNFe>' },
  ]);

  assert.equal(lote.totais.vTotal, 1288, 'duas notas iguais valem o dobro de uma');
  assert.equal(lote.totais.calculados, 8);

  const perfume = lote.porNcm.find((l) => l.ncm === '33071000');
  assert.deepEqual(
    { itens: perfume.itens, difal: perfume.vDifal, regra: perfume.ncmRegra },
    { itens: 2, difal: 286, regra: '3307' },
  );
  assert.deepEqual(lote.porNcm.map((l) => l.vTotal), [...lote.porNcm.map((l) => l.vTotal)].sort((a, b) => b - a));

  assert.equal(lote.pendencias.length, 2);
  assert.deepEqual(lote.pendencias[0], {
    arquivo: 'nfe-1234.xml',
    chave: '41260812345678000199550010000012341000012340',
    numeroNota: '1234',
    nItem: 6,
    descricao: 'Item com NCM incompleto',
    motivo: lote.pendencias[0].motivo,
  });
  assert.deepEqual(lote.erros, [{ arquivo: 'quebrada.xml', erro: lote.erros[0].erro }]);
});

test('lote aceita XML solto, sem envelope de arquivo', () => {
  const lote = processarLote([XML_NFE_EXEMPLO]);
  assert.equal(lote.totais.vTotal, 644);
  assert.equal(lote.notas[0].arquivo, null);
});

test('consolidar de lista vazia devolve zeros, não NaN', () => {
  const vazio = consolidar([]);
  assert.deepEqual(vazio.totais, {
    itens: 0, calculados: 0, pendentes: 0, naoAplicaveis: 0,
    vBase: 0, vDifal: 0, vFcp: 0, vTotal: 0,
  });
  assert.deepEqual(vazio.porNcm, []);
});

test('pendência de nota inteira também entra na lista do fiscal', () => {
  const lote = processarLote([{ nome: 'mg.xml', xml: nota({ ufDest: 'MG' }) }]);
  assert.equal(lote.pendencias.length, 1);
  assert.equal(lote.pendencias[0].nItem, null);
  assert.match(lote.pendencias[0].motivo, /MG/);
});
