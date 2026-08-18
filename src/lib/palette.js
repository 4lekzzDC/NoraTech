// Paleta tema-aware da NoraTech — compartilhada entre os produtos internos.
//
// Nasceu dentro do módulo Soluções Contábeis e foi promovida para cá quando o
// NoraDocs passou a precisar da mesma identidade. `solucoes-contabeis/theme.js`
// re-exporta este arquivo, então nenhum import antigo precisou mudar.
//
// Mantém a identidade roxa em ambos os temas e garante contraste legível no
// tema claro (cards definidos, bordas visíveis, textos escuros sobre fundos
// claros).
const DARK = {
  bg:           '#08080a',
  surface:      'rgba(255,255,255,0.02)',
  surface2:     'rgba(255,255,255,0.04)',
  surfaceSolid: '#111114',
  text:         '#eeede9',
  muted:        'rgba(255,255,255,0.55)',
  muted2:       'rgba(255,255,255,0.35)',
  border:       'rgba(255,255,255,0.07)',
  border2:      'rgba(255,255,255,0.12)',
  primary:      '#7C3AED',
  primarySoft:  'rgba(124,58,237,0.16)',
  primaryBorder:'rgba(124,58,237,0.32)',
  primaryText:  '#ddd6fe',
  green:        '#34d399',
  red:          '#ff5c5c',
  gold:         '#f0b429',
  inputBg:      'rgba(0,0,0,0.3)',
  rowHover:     'rgba(124,58,237,0.05)',
  shadow:       'none',
};

const LIGHT = {
  bg:           '#eef0f4',
  surface:      '#ffffff',
  surface2:     '#f6f7fa',
  surfaceSolid: '#ffffff',
  text:         '#0f1115',
  muted:        'rgba(15,17,21,0.62)',
  muted2:       'rgba(15,17,21,0.42)',
  border:       'rgba(15,17,21,0.10)',
  border2:      'rgba(15,17,21,0.18)',
  primary:      '#6d28d9',
  primarySoft:  'rgba(124,58,237,0.10)',
  primaryBorder:'rgba(124,58,237,0.30)',
  primaryText:  '#5b21b6',
  green:        '#059669',
  red:          '#dc2626',
  gold:         '#b45309',
  inputBg:      '#ffffff',
  rowHover:     'rgba(124,58,237,0.06)',
  shadow:       '0 1px 2px rgba(15,17,21,0.04), 0 2px 8px rgba(15,17,21,0.05)',
};

export function getPalette(theme) {
  return theme === 'light' ? LIGHT : DARK;
}

export const FONT_INTER = "'Inter', sans-serif";
export const FONT_MONO  = "'JetBrains Mono', monospace";
