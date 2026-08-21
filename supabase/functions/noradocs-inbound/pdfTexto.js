// Extração de texto de PDF no servidor — só para o caminho do e-mail.
//
// O upload manual extrai o texto NO NAVEGADOR, antes de classificar (ver
// services/pdfText.js): é o que sustenta a promessa de privacidade do
// produto — o conteúdo do documento nunca sai da máquina do contador. O
// caminho do e-mail não tem essa opção. Os bytes do anexo vão direto do
// complemento do Gmail para o Drive; nunca passam por este servidor, e no
// momento de classificar (`preparar`) o arquivo ainda nem existe em lugar
// nenhum que dê para ler. Sem alguma forma de ver o PDF, "DANFE", o CNPJ do
// emitente e a data de emissão — tudo que só existe DENTRO do arquivo —
// fica invisível para sempre, mesmo com a palavra-chave certa cadastrada.
//
// A saída: ler de volta o arquivo que O PRÓPRIO NoraDocs acabou de criar no
// Drive, depois que o upload termina. O grant `drive.file` já cobre isso —
// é conteúdo que o app criou, não exige escopo novo nem reautorização de
// ninguém. É por isso que esta leitura acontece em `concluir`, depois do
// upload, e não em `preparar`.
//
// unpdf, não pdfjs-dist: o pdfjs-dist que o navegador usa depende de DOM e
// de um Worker de browser — não roda em Deno. unpdf embute um build do
// mesmo motor (PDF.js) sem essas dependências, feito para edge/serverless.
// Zero dependências próprias, e já testado neste projeto contra um PDF real.

import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@1.8.1';

// Mesmo limite do navegador: CNPJ, competência e o tipo do documento
// aparecem no cabeçalho. Ler um extrato de 80 páginas inteiro gastaria
// tempo numa chamada que já está no caminho crítico do complemento, sem
// melhorar a classificação em nada.
const MAX_PAGINAS = 3;

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<string>} o texto extraído, ou '' se não deu para ler
 *   (PDF escaneado/só imagem, arquivo corrompido, qualquer erro da
 *   biblioteca). Nunca lança — quem chama trata isto como "sem texto novo",
 *   nunca como motivo para reportar falha no que já é um upload concluído.
 */
export async function extrairTextoDePdf(bytes) {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    const paginas = Array.isArray(text) ? text : [text];
    return paginas.slice(0, MAX_PAGINAS).join('\n');
  } catch (err) {
    console.warn('[noradocs-inbound] não foi possível extrair texto do PDF:', err?.message);
    return '';
  }
}
