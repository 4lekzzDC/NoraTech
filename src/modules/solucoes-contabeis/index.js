// Barrel do módulo "Soluções Contábeis".
//
// Concentra o ponto de entrada usado pelo router e o catálogo de sistemas
// (src/lib/systems.js). Tudo o que é interno ao módulo permanece encapsulado
// — fora do módulo, importe apenas a partir deste arquivo.

export { default as SolucoesContabeisPage } from './pages/SolucoesContabeisPage.jsx';
export {
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  SOLUCOES_CONTABEIS_LEGACY_ROUTE,
  SOLUCOES_CONTABEIS_NAME,
} from './constants.js';
