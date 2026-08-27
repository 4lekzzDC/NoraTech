import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResultadoAliquota, parseResultadosAliquota } from './econetParser.js';

const HTML_RESULTADO_3307 = `
<table width="100%" border="1" style="width:100%; border-collapse: collapse">
      <thead>
        <tr style="background: WhiteSmoke">
          <th>Alíquota</th>
            <th>FECOP</th>
            <th>Alíquota Efetiva</th>
          <th>NCM</th>
          <th>EX</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>

      <tr>
        <td style="text-align: center">25 %</td>
        <td style="text-align: center">-</td>
        <td style="text-align: center">25 %</td>
        <td style="text-align: center">3307</td>
        <td style="text-align: center">-</td>
        <td>Perfumes e cosméticos (exceto posição 3307.20 (desodorantes (desodorizantes) corporais e antiperspirantes) e códigos 3307.10.00 (preparações para barbear) e 3307.90.00 (soluções para lentes de contato/olhos artificiais))</td>
      </tr>
      </tbody>
      </table>
        <table width="100%" border="1" style="width:100%; border-collapse: collapse">
          <tbody>
      <tr style="background: WhiteSmoke">
        <th>Base Legal da Alíquota</th>
      </tr>
      <tr>
        <td>

        <a target='_blank' href='https://www.econeteditora.com.br/icms_sao_paulo/livro1-art1a259.asp#art55_iv'>Artigo 55, inciso IV, do RICMS/SP</a>

        </td>
      </tr>
        <tr style="background: WhiteSmoke">
          <th>Observações</th>
        </tr>
          <tr>
            <td>Ao mencionar as exceções, em relação às quais não se aplica a alíquota de 25%, o RICMS/SP faz referência à classificação fiscal na NBM/SH, vigente em 31.12.96 - excetuando desta alíquota os códigos 3307.10.0100 e 3307.90.0500.</td>
          </tr>

          <tr>
            <td>Os desodorizantes e aromatizantes de ambientes, NCM 3307.49.00, não se caracterizam como perfumes, sujeitando-se à alíquota de 18%, de acordo com a <a href="https://www.econeteditora.com.br/icms_sao_paulo/consultas/2016/resp_cons_11700_2016.php">Consulta nº 11.700/2016</a>.</td>
          </tr>

      </tbody>
    </table>
`;

test('lê a linha de dados: alíquota, alíquota efetiva, FECOP, NCM, EX e descrição', () => {
  const resultado = parseResultadoAliquota(HTML_RESULTADO_3307);
  assert.equal(resultado.registros.length, 1);
  const [linha] = resultado.registros;
  assert.equal(linha.aliquota, 25);
  assert.equal(linha.aliquotaEfetiva, 25);
  assert.equal(linha.fecp, null);
  assert.equal(linha.ncm, '3307');
  assert.equal(linha.ex, null);
  assert.match(linha.descricao, /Perfumes e cosméticos/);
  assert.match(linha.descricao, /3307\.20/);
});

test('lê a base legal com texto e url do link', () => {
  const resultado = parseResultadoAliquota(HTML_RESULTADO_3307);
  assert.deepEqual(resultado.baseLegal, {
    texto: 'Artigo 55, inciso IV, do RICMS/SP',
    url: 'https://www.econeteditora.com.br/icms_sao_paulo/livro1-art1a259.asp#art55_iv',
  });
});

test('lê as observações como texto livre, cada uma com seus próprios links', () => {
  const resultado = parseResultadoAliquota(HTML_RESULTADO_3307);
  assert.equal(resultado.observacoes.length, 2);
  assert.match(resultado.observacoes[0].texto, /NBM\/SH, vigente em 31\.12\.96/);
  assert.equal(resultado.observacoes[0].links.length, 0);
  assert.match(resultado.observacoes[1].texto, /3307\.49\.00/);
  assert.equal(resultado.observacoes[1].links[0].url, 'https://www.econeteditora.com.br/icms_sao_paulo/consultas/2016/resp_cons_11700_2016.php');
});

test('retorna null quando o HTML não é um resultado de consulta', () => {
  assert.equal(parseResultadoAliquota('<div>não é isso</div>'), null);
  assert.equal(parseResultadoAliquota(''), null);
  assert.equal(parseResultadoAliquota(null), null);
});

test('percentual com vírgula decimal é convertido corretamente', () => {
  const html = HTML_RESULTADO_3307.replace('25 %', '17,5 %');
  const resultado = parseResultadoAliquota(html);
  assert.equal(resultado.registros[0].aliquota, 17.5);
});

test('parseResultadosAliquota reconhece um único resultado colado, igual ao parse singular', () => {
  const resultados = parseResultadosAliquota(HTML_RESULTADO_3307);
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].registros[0].ncm, '3307');
  assert.equal(resultados[0].baseLegal.texto, 'Artigo 55, inciso IV, do RICMS/SP');
});

test('parseResultadosAliquota reconhece vários "Copiar conteúdo" colados em sequência', () => {
  const htmlOutraConsulta = HTML_RESULTADO_3307
    .replace('3307', '2402')
    .replace('25 %', '25 %'); // mantém alíquota, só troca o NCM para simular outra consulta
  const html = HTML_RESULTADO_3307 + '\n' + htmlOutraConsulta;
  const resultados = parseResultadosAliquota(html);
  assert.equal(resultados.length, 2);
  assert.equal(resultados[0].registros[0].ncm, '3307');
  assert.equal(resultados[1].registros[0].ncm, '2402');
});

test('parseResultadosAliquota descarta um bloco malformado (sem coluna NCM) sem derrubar os demais', () => {
  const blocoInvalido = `
    <table><thead><tr><th>Nada</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>
    <table><tbody><tr><th>Outra coisa</th></tr><tr><td>y</td></tr></tbody></table>
  `;
  const html = blocoInvalido + HTML_RESULTADO_3307;
  const resultados = parseResultadosAliquota(html);
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].registros[0].ncm, '3307');
});

test('parseResultadosAliquota devolve lista vazia quando nada é reconhecível', () => {
  assert.deepEqual(parseResultadosAliquota('<div>nada aqui</div>'), []);
  assert.deepEqual(parseResultadosAliquota(''), []);
});
