// Normalização de texto para comparação. Módulo puro.
//
// Nome de arquivo que sai de um escritório contábil é caótico:
// "EXTRATO_Itaú - Silva ME (ago.2026).pdf". Comparar isso com o cadastro
// exige achatar acento, caixa e pontuação antes — senão "Itaú" não casa com
// "itau" e "Silva ME" não casa com "silva-me".

export function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // tira acentos
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
