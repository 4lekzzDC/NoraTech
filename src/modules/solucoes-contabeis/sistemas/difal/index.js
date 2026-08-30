// Barrel público do sistema de DIFAL. A UI (e qualquer outro módulo) importa
// daqui; o resto do diretório é interno.
//
// Ponto de entrada normal:
//
//   import { processarLote, TABELA_SP } from '.../sistemas/difal/index.js';
//
//   const { totais, porNcm, pendencias } = processarLote(
//     arquivos,                                  // [{ nome, xml }]
//     { cnpjCliente, tabela: TABELA_SP },
//   );
//
// As três camadas ficam expostas separadamente de propósito: a tela de
// cadastro de alíquotas mexe só em `ncmRegras`, a de conferência item a item
// chama `buscarAliquotaInterna` para explicar de onde saiu o número, e o
// processamento em lote usa o pipeline inteiro.

// Motor de regras (dados)
export {
  TABELA_SP,
  TABELAS_POR_UF,
  TIPOS_REGRA,
  NIVEIS_VALIDOS,
  digitosNcm,
  getTabela,
  validarTabela,
} from './ncmRegras.js';

// Busca hierárquica
export {
  NIVEIS_BUSCA,
  buscarAliquotaInterna,
  explicarOrigem,
  fatiarNcm,
  indexarTabela,
  normalizarNcm,
} from './ncmBusca.js';

// Leitura do XML
export { lerNFe, parseXml } from './nfeXml.js';

// Cálculo
export {
  ALIQUOTAS_INTERESTADUAIS_VALIDAS,
  FINALIDADES,
  aliquotaInterestadual,
  aplicarAliquotas,
  baseDeCalculo,
  calcularItem,
  centavos,
  finalidadeDoCfop,
} from './difalEngine.js';

// Pipeline
export { VERSAO_MOTOR, consolidar, processarLote, processarNota } from './difalPipeline.js';
