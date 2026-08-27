import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApiAliquotasEconet, parseApiAliquotasEconetEmLote } from './econetApiParser.js';

function respostaPagina({ page = 1, lastPage = 2, total = 150, data }) {
  return JSON.stringify({
    observacao: ['<p>ATENÇÃO...</p>'],
    aliquotas: {
      aliquota_especifica: {
        current_page: page, last_page: lastPage, total, per_page: 100, data,
      },
      aliquota_geral: [],
      exibe_coluna_fundo: true,
    },
  });
}

const REGISTRO_COM_NCM = {
  aliquota: '7.0000', fundo: '', aliquota_efetiva: '7', nbm_ncm: '4014.10.00',
  descricao: 'Preservativos', inicio_vigencia: null, fim_vigencia: null,
  ncm_vigente: true, tipo: 'ESPECÍFICA',
  base_legal: [{ base_legal: 'Artigo 53-A, I, RICMS/SP', link: 'https://x/1' }],
  observacoes: ['Texto com <a href="https://x/2">link</a> embutido.'],
};

const REGISTRO_SEM_NCM = {
  aliquota: '25.5000', fundo: '2.0000', aliquota_efetiva: '27.5', nbm_ncm: '',
  descricao: 'Bebidas alcoólicas em geral', inicio_vigencia: '2021-12-30', fim_vigencia: null,
  ncm_vigente: true, tipo: 'GERAL', base_legal: [], observacoes: [],
};

const TEXTO_PAGINA_1 = respostaPagina({ page: 1, lastPage: 2, total: 3, data: [REGISTRO_COM_NCM, REGISTRO_SEM_NCM] });
const TEXTO_PAGINA_2 = respostaPagina({ page: 2, lastPage: 2, total: 3, data: [REGISTRO_SEM_NCM] });

test('lê os registros e converte alíquota/FECP para número', () => {
  const resultado = parseApiAliquotasEconet(TEXTO_PAGINA_1);
  assert.equal(resultado.registros.length, 2);
  assert.equal(resultado.registros[0].ncm, '4014.10.00');
  assert.equal(resultado.registros[0].aliquota, 7);
  assert.equal(resultado.registros[0].fecp, null);
  assert.equal(resultado.registros[1].fecp, 2);
  assert.equal(resultado.registros[1].aliquota, 25.5);
});

test('registro sem nbm_ncm fica com ncm vazio, não null — categoria sem código específico', () => {
  const resultado = parseApiAliquotasEconet(TEXTO_PAGINA_1);
  assert.equal(resultado.registros[1].ncm, '');
});

test('extrai base legal e observações (com links) por registro', () => {
  const resultado = parseApiAliquotasEconet(TEXTO_PAGINA_1);
  const [reg] = resultado.registros;
  assert.equal(reg.baseLegal[0].texto, 'Artigo 53-A, I, RICMS/SP');
  assert.equal(reg.baseLegal[0].url, 'https://x/1');
  assert.match(reg.observacoes[0].texto, /Texto com link embutido/);
  assert.equal(reg.observacoes[0].links[0].url, 'https://x/2');
});

test('devolve os metadados de paginação', () => {
  const resultado = parseApiAliquotasEconet(TEXTO_PAGINA_1);
  assert.deepEqual(resultado.paginacao, { atual: 1, ultima: 2, total: 3, porPagina: 100 });
});

test('devolve null para texto que não é essa API (JSON inválido ou formato diferente)', () => {
  assert.equal(parseApiAliquotasEconet('não é json'), null);
  assert.equal(parseApiAliquotasEconet('{"outraCoisa": true}'), null);
  assert.equal(parseApiAliquotasEconet(''), null);
});

test('parseApiAliquotasEconetEmLote junta os registros de várias páginas coladas', () => {
  const resultado = parseApiAliquotasEconetEmLote([TEXTO_PAGINA_1, TEXTO_PAGINA_2]);
  assert.equal(resultado.registros.length, 3);
  assert.equal(resultado.paginas.length, 2);
});

test('parseApiAliquotasEconetEmLote ignora texto que não é uma página válida', () => {
  const resultado = parseApiAliquotasEconetEmLote([TEXTO_PAGINA_1, 'lixo']);
  assert.equal(resultado.registros.length, 2);
  assert.equal(resultado.paginas.length, 1);
});
