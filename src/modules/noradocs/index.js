// Barrel público do NoraDocs.
// Tudo o que é interno ao módulo permanece encapsulado — fora do módulo,
// importe apenas a partir deste arquivo.

export { default as NoraDocsInboxPage } from './pages/InboxPage.jsx';
export { default as NoraDocsHistoricoPage } from './pages/HistoricoPage.jsx';
export { default as NoraDocsClientesPage } from './pages/ClientesPage.jsx';
export { default as NoraDocsConfiguracoesPage } from './pages/ConfiguracoesPage.jsx';

export {
  NORADOCS_SLUG,
  NORADOCS_NAME,
  NORADOCS_ROUTE,
  NAV_ITEMS,
  DOCUMENT_STATUS,
  SEED_CATEGORIES,
  noradocsRoute,
} from './constants.js';
