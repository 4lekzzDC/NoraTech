// Barrel público do Nora Screen.
// Tudo o que é interno ao módulo permanece encapsulado — fora do módulo,
// importe apenas a partir deste arquivo.

export { default as NoraScreenHome } from './pages/NoraScreenHome.jsx';
export { default as NoraScreenSala } from './pages/NoraScreenSala.jsx';

export {
  NORA_SCREEN_SLUG,
  NORA_SCREEN_NAME,
  NORA_SCREEN_ROUTE,
  noraScreenRoute,
  gerarCodigoDeSala,
  normalizarCodigo,
  codigoValido,
  iniciaisDe,
} from './constants.js';
