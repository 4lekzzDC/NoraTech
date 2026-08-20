import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// O motor de regras roda em dois lugares: no navegador (upload manual) e na
// Edge Function de entrada por e-mail, que não tem navegador nenhum no
// caminho. Como cada Edge Function é implantada com o próprio pacote de
// arquivos, a função carrega uma CÓPIA de domain/.
//
// Cópia sem guarda vira divergência silenciosa: alguém corrige uma regra aqui,
// o e-mail continua classificando pela regra antiga, e a diferença só aparece
// quando um documento vai parar na pasta errada — sem nada no log dizendo por
// quê.
//
// Este teste é o guarda. Quando ele quebrar, rode:
//
//     npm run sync:edge-domain
//
// e reimplante noradocs-inbound. Não edite a cópia à mão: o original é este
// diretório.

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA = join(AQUI, '../../../../supabase/functions/noradocs-inbound/domain');

const MODULOS = ['cnpj.js', 'texto.js', 'competencia.js', 'rules.js', 'folderTemplate.js', 'destino.js'];

for (const modulo of MODULOS) {
  test(`domain/${modulo} está idêntico à cópia da Edge Function`, () => {
    const original = readFileSync(join(AQUI, modulo), 'utf8');
    const copia = readFileSync(join(COPIA, modulo), 'utf8');
    assert.equal(
      copia,
      original,
      `A cópia em supabase/functions/noradocs-inbound/domain/${modulo} divergiu do original. `
      + 'Rode `npm run sync:edge-domain` e reimplante a função.',
    );
  });
}
