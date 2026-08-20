// A paleta foi promovida para `src/lib/palette.js` quando o NoraDocs passou a
// precisar da mesma identidade visual. Este arquivo permanece como fachada do
// módulo: os ~20 imports internos continuam apontando para cá.
export { getPalette, FONT_INTER, FONT_MONO } from '../../lib/palette';
