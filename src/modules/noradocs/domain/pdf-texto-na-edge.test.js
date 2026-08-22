import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// pdfTexto.js só existe na Edge Function (supabase/functions/noradocs-inbound/),
// não em domain/: ele importa `unpdf`, e domain/ precisa continuar
// zero-dependência para poder rodar tanto no navegador quanto no Deno sem
// carregar nada que um dos dois lados não precisa.
//
// Para testar o arquivo de verdade — não uma cópia reescrita à mão — este
// teste lê o fonte, troca o import de `https://esm.sh/unpdf@x` pelo pacote
// `unpdf` instalado localmente (devDependency, só para isto rodar em Node) e
// importa a cópia temporária. O runtime muda; o código testado é o mesmo que
// vai para produção.

const FONTE = fileURLToPath(
  new URL('../../../../supabase/functions/noradocs-inbound/pdfTexto.js', import.meta.url),
);

async function carregarPdfTexto() {
  const original = readFileSync(FONTE, 'utf8');
  const reescrito = original.replace("'https://esm.sh/unpdf@1.8.1'", "'unpdf'");
  assert.notEqual(reescrito, original, 'o import de unpdf não foi encontrado em pdfTexto.js — o arquivo mudou de forma inesperada');

  // Dentro do repositório, não em os.tmpdir(): a resolução de `import 'unpdf'`
  // sobe o diretório a partir de quem importa até achar um node_modules, e
  // um arquivo fora do projeto nunca acha o dele.
  const RAIZ_DO_REPO = fileURLToPath(new URL('../../../../', import.meta.url));
    // Sufixo aleatório, não só timestamp: dois testes no mesmo milissegundo
  // colidiriam no nome do arquivo e um pegaria o módulo do cache do outro.
  const caminhoTemporario = join(RAIZ_DO_REPO, `.pdfTexto-teste-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(caminhoTemporario, reescrito);
  try {
    return await import(`file://${caminhoTemporario}`);
  } finally {
    rmSync(caminhoTemporario, { force: true });
  }
}

// PDF mínimo, gerado na hora — sem depender de um arquivo de exemplo
// comitado. O produto lida com documento real (DANFE, boleto, contrato), e
// um PDF de exemplo de verdade carregaria dado de alguém; um sintético com
// texto plano é o bastante para provar que a extração funciona.
function pdfComTexto(texto) {
  const escapado = texto.replace(/[()\\]/g, '\\$&');
  const conteudo = `BT /F1 12 Tf 20 100 Td (${escapado}) Tj ET`;
  const objetos = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 400 200]/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${conteudo.length}>>stream\n${conteudo}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj${o}endobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objetos.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer<</Size ${objetos.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

test('extrai o texto de um PDF de verdade', async () => {
  const { extrairTextoDePdf } = await carregarPdfTexto();
  const bytes = pdfComTexto('DANFE nota fiscal CNPJ 11.222.333/0001-81 emitida em 13/08/2026');
  const texto = await extrairTextoDePdf(bytes);
  assert.match(texto, /DANFE/);
  assert.match(texto, /13\/08\/2026/);
});

test('bytes que não são PDF: devolve string vazia, não lança', async () => {
  const { extrairTextoDePdf } = await carregarPdfTexto();
  const lixo = new TextEncoder().encode('isto não é um PDF de jeito nenhum');
  const texto = await extrairTextoDePdf(lixo);
  assert.equal(texto, '');
});

test('array vazio: devolve string vazia, não lança', async () => {
  const { extrairTextoDePdf } = await carregarPdfTexto();
  const texto = await extrairTextoDePdf(new Uint8Array(0));
  assert.equal(texto, '');
});
