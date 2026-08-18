// Extração de texto de PDF, no navegador.
//
// Este é o ponto do produto onde a promessa de privacidade se materializa: o
// texto do documento é lido AQUI, usado para classificar AQUI, e descartado.
// Ele nunca é enviado ao Supabase nem a serviço nenhum — o que sobrevive é só
// a evidência curta que justificou a decisão ("CNPJ x no texto").
//
// pdfjs-dist já é dependência do projeto; o carregamento tardio e o worker
// seguem o mesmo padrão de transformador-extrato e analise-demonstracoes.

let _pdfjsLib = null;

async function getPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;
  _pdfjsLib = await import('pdfjs-dist');
  _pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;
  return _pdfjsLib;
}

// Só as primeiras páginas: CNPJ, competência e o tipo do documento aparecem no
// cabeçalho. Ler um extrato de 80 páginas inteiro atrasaria o lote sem
// melhorar a classificação em nada.
const MAX_PAGINAS = 3;

export async function extrairTextoDePdf(arrayBuffer) {
  const pdfjsLib = await getPdfJs();
  // pdfjs consome (detaches) o buffer que recebe; passamos uma cópia para o
  // chamador poder reusar o original no hash e no upload.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

  const paginas = [];
  const limite = Math.min(pdf.numPages, MAX_PAGINAS);
  for (let p = 1; p <= limite; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    paginas.push(content.items.map((item) => item.str).join(' '));
  }
  return paginas.join('\n');
}

// Devolve '' quando não há texto a extrair — PDF digitalizado (só imagem),
// formato não suportado, arquivo corrompido. Não é erro: o motor de regras
// simplesmente classifica pelo nome do arquivo, e o que não fechar vai para
// revisão. Falhar o upload inteiro por causa disso seria pior.
export async function extrairTexto(file, arrayBuffer) {
  if (file.type !== 'application/pdf') return '';
  try {
    return await extrairTextoDePdf(arrayBuffer);
  } catch (err) {
    console.warn('[noradocs] não foi possível extrair texto do PDF:', err?.message);
    return '';
  }
}
