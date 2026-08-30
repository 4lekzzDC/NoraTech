import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAliquotasPortalSvrs, ufsDoPortalSvrs } from './svrsPortalParser.js';

// Réplica mínima da estrutura real do Portal da DIFAL (SVRS): árvore de UF
// (data-target="#CodUf-N") e, dentro de cada UF, uma lista de "mercadoria"
// (data-target="#N", célula às vezes em texto puro, às vezes em <span>) com
// um painel de detalhe (div#N) com campos rotulados.
function ufBloco(codUf, estado, mercadorias) {
  const linhasMercadoria = mercadorias.map(({ id, celula, campos }) => `
    <tr data-toggle="collapse" data-parent="#tabelaExpansiva2" data-target="#${id}" class="accordion-toggle" onclick="x">
      <td width="3%"> </td>
      <td width="5%"><button class="btn btn-xs"><i class="glyphicon glyphicon-plus"></i></button></td>
      <td>${celula}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:0">
        <div id="${id}" class="collapse">
          <table class="table">
            <tbody>
              <tr><td rowspan="6" width="8%"></td></tr>
              ${Object.entries(campos).map(([rotulo, valor]) => `
              <tr><td width="15%"><label>${rotulo}</label></td><td>${valor}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>`).join('');

  return `
    <tr data-toggle="collapse" data-parent="#tabelaExpansiva" data-target="#${codUf}" class="accordion-toggle" onclick="x">
      <td><button class="btn btn-xs"><i class="glyphicon glyphicon-plus"></i></button></td>
      <td>${estado}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0">
        <div id="${codUf}" class="collapse">
          <table id="#tabelaExpansiva2" class="table table-hover">
            <thead><tr><th width="3%"></th><th width="5%"></th><th>Mercadoria</th></tr></thead>
            <tbody>${linhasMercadoria}</tbody>
          </table>
        </div>
      </td>
    </tr>`;
}

const HTML_PORTAL = `<html><body><table>
  <thead><tr><th width="5%"></th><th>UF</th></tr></thead>
  <tbody>
  ${ufBloco('CodUf-35', 'São Paulo', [
    {
      id: '101',
      celula: 'Regra Geral',
      campos: {
        'NCM/SH (se aplicável)': '',
        'Alíquota interna': '18%',
        'Fundo de Combate à Pobreza': '',
        'Observação': 'Art. 52, I, RICMS/00',
        'Data da atualização': '03/02/2023',
      },
    },
    {
      // célula embrulhada em <span>, como acontece de verdade em alguns estados
      id: '102',
      celula: '<span style="font-family: Helvetica;">Preservativos</span>',
      campos: {
        'NCM/SH (se aplicável)': '4014.10.0000',
        'Alíquota interna': '7%',
        'Fundo de Combate à Pobreza': '',
        'Observação': 'Art. 53-A, I, RICMS/00',
        'Data da atualização': '03/02/2023',
      },
    },
  ])}
  ${ufBloco('CodUf-43', 'Rio Grande do Sul', [
    {
      id: '201',
      celula: 'Bebidas alcoólicas, exceto cerveja e chope',
      campos: {
        'NCM/SH (se aplicável)': '(vários)',
        'Alíquota interna': '25,5%',
        'Fundo de Combate à Pobreza': '2%',
        'Observação': 'FECOEP',
        'Data da atualização': '30/12/2021',
      },
    },
  ])}
  </tbody>
</table></body></html>`;

test('lê os registros das duas UFs, com mercadoria em texto puro e em <span>', () => {
  const registros = parseAliquotasPortalSvrs(HTML_PORTAL);
  assert.equal(registros.length, 3);
  assert.deepEqual(registros.map((r) => r.uf), ['São Paulo', 'São Paulo', 'Rio Grande do Sul']);
  assert.equal(registros[1].mercadoria, 'Preservativos');
});

test('converte alíquota e FECP para número, tratando vírgula decimal', () => {
  const registros = parseAliquotasPortalSvrs(HTML_PORTAL);
  const rs = registros.find((r) => r.uf === 'Rio Grande do Sul');
  assert.equal(rs.aliquotaInterna, 25.5);
  assert.equal(rs.fecp, 2);
});

test('campo NCM/SH vazio vira string vazia, não null — mercadoria por categoria é o normal', () => {
  const registros = parseAliquotasPortalSvrs(HTML_PORTAL);
  assert.equal(registros[0].ncmSh, '');
  assert.equal(registros[1].ncmSh, '4014.10.0000');
});

test('mantém o texto de observação e data de atualização tal como aparecem', () => {
  const registros = parseAliquotasPortalSvrs(HTML_PORTAL);
  assert.equal(registros[0].observacao, 'Art. 52, I, RICMS/00');
  assert.equal(registros[0].dataAtualizacao, '03/02/2023');
});

test('ufsDoPortalSvrs lista as UFs na ordem de aparição, sem repetir', () => {
  const registros = parseAliquotasPortalSvrs(HTML_PORTAL);
  assert.deepEqual(ufsDoPortalSvrs(registros), ['São Paulo', 'Rio Grande do Sul']);
});

test('devolve lista vazia para HTML sem a estrutura esperada', () => {
  assert.deepEqual(parseAliquotasPortalSvrs('<div>nada aqui</div>'), []);
  assert.deepEqual(parseAliquotasPortalSvrs(''), []);
  assert.deepEqual(parseAliquotasPortalSvrs(null), []);
});
