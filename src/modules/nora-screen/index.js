// Barrel público do Nora Screen.
// Tudo o que é interno ao módulo permanece encapsulado — fora do módulo,
// importe apenas a partir deste arquivo.

export { default as NoraScreenHome } from './pages/NoraScreenHome.jsx';
export { default as NoraScreenSala } from './pages/NoraScreenSala.jsx';
export { default as RotasDoSubdominio } from './RotasDoSubdominio.jsx';

export {
  NORA_SCREEN_SLUG,
  NORA_SCREEN_NAME,
  NORA_SCREEN_ROUTE,
  NO_SUBDOMINIO,
  HOST_NORA_SCREEN,
  ehHostDoNoraScreen,
  noraScreenRoute,
  gerarCodigoDeSala,
  normalizarCodigo,
  codigoValido,
  iniciaisDe,
} from './constants.js';
