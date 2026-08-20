// Reescrita dos caminhos quando um cliente provisório é promovido.
//
// Ao confirmar, a pasta sai de `_verificação/Aurora/...` para `Aurora/...` no
// Drive — e tudo que o banco guarda sobre esses caminhos precisa acompanhar:
// as chaves do cache de pastas e o `drive_path` de cada documento.
//
// É cirurgia de string, e por isso está aqui e não no serviço: errar por um
// caractere produz uma chave de cache que não casa com nada, o próximo
// documento do cliente cria uma segunda árvore no Drive, e nada nisso dá erro.

/**
 * Tira o prefixo e, se o contador corrigiu a grafia ao confirmar, troca o
 * nome do cliente — que é sempre o primeiro segmento do caminho.
 *
 * @param {string} caminho     ex.: "_verificação/Aurora/2026/2026-08"
 * @param {string} prefixo     ex.: "_verificação/" ou "verificacao:"
 * @param {string} nomeAntigo  ex.: "Aurora"
 * @param {string} nomeNovo    ex.: "Padaria Aurora Ltda"
 * @returns {string|null} o caminho novo, ou null se não começava com o prefixo
 */
export function promoverCaminho(caminho, prefixo, nomeAntigo, nomeNovo) {
  const valor = String(caminho ?? '');
  if (!valor.startsWith(prefixo)) return null;

  const semPrefixo = valor.slice(prefixo.length);

  // Só troca o nome se ele for de fato o primeiro segmento. Sem esta
  // verificação, um caminho inesperado teria os primeiros N caracteres
  // amputados e viraria lixo silencioso.
  if (nomeNovo === nomeAntigo) return semPrefixo;
  if (semPrefixo !== nomeAntigo && !semPrefixo.startsWith(`${nomeAntigo}/`)) return semPrefixo;

  return nomeNovo + semPrefixo.slice(nomeAntigo.length);
}
