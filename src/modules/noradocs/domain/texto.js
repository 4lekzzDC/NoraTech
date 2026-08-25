// Normalização de texto para comparação. Módulo puro.
//
// Nome de arquivo que sai de um escritório contábil é caótico:
// "EXTRATO_Itaú - Silva ME (ago.2026).pdf". Comparar isso com o cadastro
// exige achatar acento, caixa e pontuação antes — senão "Itaú" não casa com
// "itau" e "Silva ME" não casa com "silva-me".

// A faixa dos acentos combinantes (U+0300 a U+036F), montada em tempo de
// execução em vez de escrita dentro do literal de regex.
//
// Escrita direta, ela é conteúdo invisível no arquivo — dois caracteres que
// não desenham nada e se grudam no colchete anterior. Qualquer caminho que
// reescreva o fonte sem preservar byte a byte (implantação por API, copiar e
// colar, editor que normaliza Unicode) pode mutilar a faixa em silêncio, e aí
// `normalizar()` simplesmente para de achatar acento. Nada quebra de forma
// visível: "Itaú" só deixa de casar com o cadastro "Itau", e o documento vai
// para a pasta errada sem erro nenhum. Montada assim, o arquivo é ASCII puro e
// não há o que se perder no caminho.
const COMBINANTES = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g',
);

// NFD separa "á" em "a" + acento combinante; tirar a faixa acima deixa só a
// letra base.
export function semAcentos(valor) {
  return String(valor ?? '').normalize('NFD').replace(COMBINANTES, '');
}

export function normalizar(valor) {
  return semAcentos(valor)
    .toLowerCase()
    .replace(/[_\-.()[\]{}]+/g, ' ')   // pontuação de separação vira espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove a extensão antes de normalizar: ".pdf" no fim de todo nome só
// atrapalha comparação e pode casar com palavra-chave por acidente.
export function normalizarNomeArquivo(nome) {
  return normalizar(String(nome ?? '').replace(/\.[a-z0-9]{2,5}$/i, ''));
}

// Casa `agulha` dentro de `palheiro` respeitando limite de palavra, para que
// "nota" não case dentro de "anotacoes".
export function contemTermo(palheiro, agulha) {
  const termo = normalizar(agulha);
  if (termo.length < 3) return false;
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escapado}( |$)`).test(normalizar(palheiro));
}
