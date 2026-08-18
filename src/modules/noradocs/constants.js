// Identidade e navegação do NoraDocs — recebimento, classificação e
// arquivamento automático de documentos para escritórios de contabilidade.
//
// Produto comercial separado do hub Soluções Contábeis: slug próprio no
// catálogo (`src/lib/systems.js`) e gate de assinatura próprio. O tenant é o
// escritório (tabela `companies`); os clientes atendidos por ele são uma
// entidade do NoraDocs, não do banco de empresas da plataforma.
//
// Arquitetura e decisões em docs/noradocs/.

export const NORADOCS_SLUG = 'noradocs';
export const NORADOCS_NAME = 'NoraDocs';
export const NORADOCS_ROUTE = '/noradocs';

export function noradocsRoute(path = '') {
  return path ? `${NORADOCS_ROUTE}/${path}` : NORADOCS_ROUTE;
}

// Navegação lateral. Quatro telas, e a intenção é que continuem sendo quatro:
// a Caixa de Entrada é o produto, o resto existe para alimentá-la.
export const NAV_ITEMS = [
  { path: '',              label: 'Caixa de entrada', hint: 'Arquivos aguardando destino' },
  { path: 'historico',     label: 'Histórico',        hint: 'Tudo que já foi arquivado' },
  { path: 'clientes',      label: 'Clientes',         hint: 'Empresas atendidas pelo escritório' },
  { path: 'configuracoes', label: 'Configurações',    hint: 'Google Drive, pastas e categorias' },
];

// Estados de um documento. As transições válidas ficam em `domain/status.js`
// (Etapa 6) — aqui mora só a apresentação.
export const DOCUMENT_STATUS = {
  processando: { label: 'Processando', tone: 'neutral' },
  revisar:     { label: 'Revisar',     tone: 'warn'    },
  organizado:  { label: 'Organizado',  tone: 'ok'      },
  erro:        { label: 'Erro',        tone: 'danger'  },
  descartado:  { label: 'Descartado',  tone: 'muted'   },
};

// Categorias-semente de cada escritório. Viram linhas em `noradocs_categories`
// na Etapa 1, onde passam a ser editáveis (nome, ordem, palavras-chave).
export const SEED_CATEGORIES = [
  { slug: 'extratos-bancarios', nome: 'Extratos bancários' },
  { slug: 'contas-a-pagar',     nome: 'Contas a pagar'     },
  { slug: 'contas-a-receber',   nome: 'Contas a receber'   },
  { slug: 'cartoes-taxas',      nome: 'Cartões e taxas'    },
  { slug: 'notas-fiscais',      nome: 'Notas fiscais'      },
  { slug: 'estoque',            nome: 'Estoque'            },
  { slug: 'folha',              nome: 'Folha'              },
  { slug: 'outros',             nome: 'Outros'             },
];
