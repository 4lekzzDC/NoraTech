import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caminho, filhosPorNome, identarXml, lerNFe, numero, parseXml, texto, xmlDoItem,
} from './nfeXml.js';
import { XML_NFE_EXEMPLO } from './fixtures/nfeExemplo.js';

test('lê tags, atributos, texto e tag vazia', () => {
  const raiz = parseXml('<a versao="4.00"><b>1</b><c/><b>2</b></a>');
  assert.equal(raiz.nome, 'a');
  assert.equal(raiz.atributos.versao, '4.00');
  assert.deepEqual(filhosPorNome(raiz, 'b').map((n) => n.texto), ['1', '2']);
  assert.deepEqual(filhosPorNome(raiz, 'c')[0].filhos, []);
});

test('ignora declaração, comentário e DOCTYPE; lê CDATA como texto', () => {
  const raiz = parseXml(
    '<?xml version="1.0"?><!DOCTYPE x><a><!-- nota --><b><![CDATA[a > b & c]]></b></a>',
  );
  assert.equal(texto(raiz, 'b'), 'a > b & c');
});

test('decodifica entidades no texto e nos atributos', () => {
  const raiz = parseXml('<a t="Alfa &amp; Cia"><b>1 &lt; 2 &#38; 3 &#x41;</b></a>');
  assert.equal(raiz.atributos.t, 'Alfa & Cia');
  assert.equal(texto(raiz, 'b'), '1 < 2 & 3 A');
});

test("'>' dentro de atributo não parte a tag", () => {
  const raiz = parseXml('<a t="14 > 10"><b>ok</b></a>');
  assert.equal(raiz.atributos.t, '14 > 10');
  assert.equal(texto(raiz, 'b'), 'ok');
});

test('ignora prefixo de namespace', () => {
  const raiz = parseXml('<ns:NFe xmlns:ns="x"><ns:infNFe><ns:ide/></ns:infNFe></ns:NFe>');
  assert.equal(raiz.nome, 'NFe');
  assert.ok(caminho(raiz, 'infNFe', 'ide'));
});

test('XML malformado lança em vez de devolver nota pela metade', () => {
  assert.throws(() => parseXml('<a><b></a>'), /malformado/);
  assert.throws(() => parseXml('<a><b>'), /não foi fechada/);
  assert.throws(() => parseXml('<a><!-- sem fim'), /comentário sem fechamento/);
});

test('numero devolve 0 em campo ausente ou não numérico, sem NaN', () => {
  const raiz = parseXml('<a><v>12.34</v><x>abc</x></a>');
  assert.equal(numero(raiz, 'v'), 12.34);
  assert.equal(numero(raiz, 'x'), 0);
  assert.equal(numero(raiz, 'inexistente'), 0);
});

test('lerNFe extrai identificação, partes e totais', () => {
  const nfe = lerNFe(XML_NFE_EXEMPLO);
  assert.equal(nfe.chave, '41260812345678000199550010000012341000012340');
  assert.equal(nfe.numero, '1234');
  assert.equal(nfe.modelo, '55');
  assert.equal(nfe.dataEmissao, '2026-08-14');
  assert.equal(nfe.emitente.uf, 'PR');
  assert.equal(nfe.emitente.nome, 'Distribuidora Alfa & Cia Ltda');
  assert.equal(nfe.emitente.crt, '3');
  assert.equal(nfe.destinatario.cnpj, '98765432000110');
  assert.equal(nfe.destinatario.uf, 'SP');
  assert.equal(nfe.totais.vNF, 5730);
  assert.equal(nfe.itens.length, 7);
});

test('lerNFe extrai cada item com produto, ICMS e IPI', () => {
  const [perfume, , notebook, detergente] = lerNFe(XML_NFE_EXEMPLO).itens;

  assert.equal(perfume.nItem, 1);
  assert.equal(perfume.ncm, '33071000');
  assert.equal(perfume.cfop, '6556');
  assert.equal(perfume.vProd, 1000);
  assert.equal(perfume.vFrete, 100);
  assert.equal(perfume.vIpi, 0);
  assert.deepEqual(
    { cst: perfume.icms.cst, csosn: perfume.icms.csosn, orig: perfume.icms.origem, p: perfume.icms.pICMS },
    { cst: '00', csosn: null, orig: '0', p: 12 },
  );

  assert.equal(notebook.vIpi, 150);
  assert.equal(notebook.icms.origem, '1');

  // CST 60 não traz pICMS: `null` diz "não destacado", que é diferente de 0.
  assert.equal(detergente.icms.grupo, 'ICMS60');
  assert.equal(detergente.icms.cst, '60');
  assert.equal(detergente.icms.pICMS, null);
});

test('lê grupo do Simples Nacional como CSOSN, não como CST', () => {
  const xml = `<NFe><infNFe Id="NFe1" versao="4.00"><ide><mod>55</mod></ide>
    <emit><enderEmit><UF>PR</UF></enderEmit></emit>
    <dest><enderDest><UF>SP</UF></enderDest></dest>
    <det nItem="1"><prod><NCM>33071000</NCM><CFOP>6556</CFOP><vProd>100.00</vProd></prod>
      <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto>
    </det></infNFe></NFe>`;
  const item = lerNFe(xml).itens[0];
  assert.equal(item.icms.csosn, '102');
  assert.equal(item.icms.cst, null);
  assert.equal(item.icms.pICMS, null);
});

test('aceita NF-e sem protocolo e recusa XML que não é NF-e', () => {
  assert.ok(lerNFe('<NFe><infNFe Id="NFe9" versao="4.00"><ide><nNF>9</nNF></ide></infNFe></NFe>'));
  assert.throws(() => lerNFe('<html><body>erro 500</body></html>'), /não é uma NF-e/);
  assert.throws(() => lerNFe(''), /XML vazio/);
});

test('identarXml devolve o XML como o motor leu, com recuo', () => {
  const identado = identarXml('<a versao="4.00"><b>1</b><c><d>2</d></c><e/></a>');
  assert.equal(identado, [
    '<a versao="4.00">',
    '  <b>1</b>',
    '  <c>',
    '    <d>2</d>',
    '  </c>',
    '  <e/>',
    '</a>',
  ].join('\n'));
});

test('identarXml reescapa o que veio como entidade', () => {
  const identado = identarXml('<a t="Alfa &amp; Cia"><b>1 &lt; 2</b></a>');
  assert.equal(identado, '<a t="Alfa &amp; Cia">\n  <b>1 &lt; 2</b>\n</a>');
});

test('identarXml sobrevive a entrada vazia', () => {
  assert.equal(identarXml(''), '');
  assert.equal(identarXml(null), '');
});

test('xmlDoItem recorta o <det> pedido', () => {
  const det = xmlDoItem(XML_NFE_EXEMPLO, 2);
  assert.match(det, /^<det nItem="2">/);
  assert.match(det, /<xProd>Desodorante aerosol<\/xProd>/);
  assert.match(det, /^ {2}<prod>$/m, 'os filhos vêm recuados');
  assert.ok(!det.includes('Perfume'), 'só o item pedido');
});

test('xmlDoItem devolve null para item inexistente', () => {
  assert.equal(xmlDoItem(XML_NFE_EXEMPLO, 99), null);
  assert.equal(xmlDoItem('', 1), null);
});
