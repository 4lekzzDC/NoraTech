// Barrel público do módulo "Soluções Contábeis".
// Tudo o que é interno ao módulo permanece encapsulado — fora do módulo,
// importe apenas a partir deste arquivo.

export { default as SolucoesContabeisHub } from './pages/SolucoesContabeisHub.jsx';
export { default as SistemaEmConstrucao } from './pages/SistemaEmConstrucao.jsx';
export { default as AcompanhamentoContabilPage } from './sistemas/acompanhamento-contabil/AcompanhamentoContabilPage.jsx';
export { default as ContabilPage } from './sistemas/contabil/ContabilPage.jsx';
export { default as PessoalPage } from './sistemas/pessoal/PessoalPage.jsx';

export {
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_NAME,
  SOLUCOES_CONTABEIS_ROUTE,
  ACOMPANHAMENTO_CONTABIL_LEGACY_ROUTE,
  HUB_MODULES,
  HUB_SECTIONS,
  HUB_MODULES_BY_SLUG,
  getHubModule,
  moduleRoute,
} from './constants.js';
