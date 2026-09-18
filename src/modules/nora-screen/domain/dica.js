// ═══════════════════════════════════════════════════════════════
// Onde a dica flutuante se abre.
//
// Geometria pura: recebe o retângulo do botão e a largura da tela,
// devolve de que lado abrir e as coordenadas. Fica fora do componente
// para ser testável sem navegador — e porque "cabe à direita?" é uma
// conta, não um detalhe de renderização.
//
// A dica é `position: fixed` e vive num portal no body. É isso que a
// tira de dentro da lateral: ali ela era um `::after` e o
// `overflow: hidden` da lateral cortava o texto.
// ═══════════════════════════════════════════════════════════════

/** Espaço que a dica precisa de um lado para caber nele. */
export const LARGURA_DA_DICA = 200;
/** Distância entre o botão e a dica. */
export const FOLGA = 10;

/**
 * De que lado abrir e onde.
 *
 * Abre à direita quando há espaço; senão à esquerda. Nunca ancora pelos
 * dois lados ao mesmo tempo — o lado oposto fica `auto`, e é a largura
 * máxima da própria dica que garante que ela não passe da tela.
 */
export function posicaoDaDica({
  alvo,
  larguraDaTela = 0,
  alturaDaTela = 0,
  larguraDaDica = LARGURA_DA_DICA,
  folga = FOLGA,
} = {}) {
  if (!alvo) return null;
  const { left = 0, right = 0, top = 0, bottom = 0 } = alvo;
  const cabeADireita = larguraDaTela - right >= larguraDaDica + folga;
  const meio = (top + bottom) / 2;

  return {
    lado: cabeADireita ? 'direita' : 'esquerda',
    estilo: cabeADireita
      ? { left: Math.round(right + folga), right: 'auto', top: Math.round(meio) }
      : { right: Math.round(Math.max(0, larguraDaTela - left) + folga), left: 'auto', top: Math.round(meio) },
    // Guardado para os testes e para quem precisar ajustar na vertical.
    alturaDaTela,
  };
}

/**
 * Se vale mostrar dica flutuante neste aparelho.
 *
 * No toque não existe "passar o mouse": a dica ou não aparece, ou
 * aparece e fica no caminho do dedo. Lá o rótulo acessível e o `title`
 * dão conta, e é o que o botão já carrega.
 */
export function aparelhoComPonteiroFino(matchMedia) {
  if (typeof matchMedia !== 'function') return false;
  try {
    return Boolean(matchMedia('(hover: hover) and (pointer: fine)').matches);
  } catch {
    return false;
  }
}
