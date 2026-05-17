// Identidade e catálogo do hub "Soluções Contábeis" — suite de módulos
// migrados do Autonomy v9.0 para a stack da NoraTech.
//
// Apenas `acompanhamento-contabil` já está implementado nesta etapa; todos
// os demais cards do hub levam à página SistemaEmConstrucao via catch-all
// `/solucoes-contabeis/:slug`. Quando um módulo for migrado, basta criar
// a rota dedicada em src/main.jsx que aponte para o arquivo correspondente
// em `sistemas/<slug>/`.

export const SOLUCOES_CONTABEIS_SLUG = 'solucoes-contabeis';
export const SOLUCOES_CONTABEIS_LEGACY_SLUGS = ['acompanhamento-contabil'];
export const SOLUCOES_CONTABEIS_NAME = 'Soluções Contábeis';
export const SOLUCOES_CONTABEIS_ROUTE = '/solucoes-contabeis';

// Rota antiga (pré-suite) que ia direto para o Acompanhamento Contábil.
// Mantida para retrocompatibilidade — redireciona para o módulo dentro do hub.
export const ACOMPANHAMENTO_CONTABIL_LEGACY_ROUTE = '/acompanhamento-contabil';

export function moduleRoute(slug) {
  return `${SOLUCOES_CONTABEIS_ROUTE}/${slug}`;
}

// Status do card no hub:
//   'available' → módulo já migrado, rota real
//   'soon'      → módulo ainda em migração, abre SistemaEmConstrucao
export const HUB_SECTIONS = [
  { id: 'sistema',     title: 'Sistema',     subtitle: 'Visão geral, equipe e ferramentas pessoais.' },
  { id: 'categorias',  title: 'Categorias',  subtitle: 'Grades de módulos agrupados por área.' },
  { id: 'ferramentas', title: 'Ferramentas', subtitle: 'Sistemas operacionais do dia a dia contábil.' },
  { id: 'permissoes',  title: 'Permissões',  subtitle: 'Equipe, papéis e perfis customizados.' },
];

export const HUB_MODULES = [
  // Sistema
  { slug: 'visao-geral', name: 'Visão Geral', icon: '🏠', section: 'sistema',
    status: 'soon', description: 'Painel inicial com indicadores e atalhos rápidos.' },
  { slug: 'usuarios', name: 'Usuários', icon: '👥', section: 'sistema',
    status: 'soon', description: 'Gerencie membros, convites e cargos da equipe.' },
  { slug: 'logs', name: 'Logs', icon: '📜', section: 'sistema',
    status: 'soon', description: 'Auditoria de ações dentro da plataforma.' },
  { slug: 'perfil', name: 'Perfil', icon: '🪪', section: 'sistema',
    status: 'soon', description: 'Preferências e dados do seu usuário.' },
  { slug: 'chat', name: 'Chat', icon: '💬', section: 'sistema',
    status: 'soon', description: 'Suporte interno e comunicação com o time.' },

  // Categorias
  { slug: 'contabil', name: 'Contábil', icon: '📒', section: 'categorias',
    status: 'available', description: 'Grade dos módulos contábeis.' },
  { slug: 'fiscal', name: 'Fiscal', icon: '🧾', section: 'categorias',
    status: 'soon', description: 'Grade dos módulos fiscais.' },
  { slug: 'financeiro', name: 'Financeiro', icon: '💸', section: 'categorias',
    status: 'soon', description: 'Grade dos módulos financeiros.' },
  { slug: 'gestao', name: 'Gestão', icon: '🗂️', section: 'categorias',
    status: 'soon', description: 'Grade dos módulos de gestão.' },
  { slug: 'pessoal', name: 'Pessoal', icon: '👤', section: 'categorias',
    status: 'soon', description: 'Grade dos módulos de RH e pessoal.' },

  // Ferramentas
  { slug: 'acompanhamento-contabil', name: 'Acompanhamento Contábil', icon: '📊',
    section: 'ferramentas', status: 'available',
    description: 'Status mensal por empresa: arquivos, conciliação e prazos.' },
  { slug: 'codificador', name: 'Codificador de Arquivos', icon: '🔢',
    section: 'ferramentas', status: 'available',
    description: 'Aplicação de regras e parsing de arquivos contábeis.' },
  { slug: 'conciliador-extratos', name: 'Conciliador de Extratos', icon: '🧮',
    section: 'ferramentas', status: 'available',
    description: 'Conciliação automática de extratos bancários.' },
  { slug: 'conciliador-fornecedores', name: 'Conciliador de Fornecedores', icon: '🤝',
    section: 'ferramentas', status: 'available',
    description: 'Conciliação de relatórios de fornecedores.' },
  { slug: 'gestao-clientes', name: 'Gestão de Clientes', icon: '🏢',
    section: 'ferramentas', status: 'available',
    description: 'CRM dos clientes do escritório contábil.' },
  { slug: 'prazos', name: 'Controle de Prazos', icon: '⏰',
    section: 'ferramentas', status: 'available',
    description: 'Tarefas, vencimentos e alertas por empresa.' },
  { slug: 'analise-demonstracoes', name: 'Análise de Demonstrações', icon: '📈',
    section: 'ferramentas', status: 'available',
    description: 'Indicadores financeiros e gráficos analíticos.' },
  { slug: 'transformador-extrato', name: 'Transformador de Extrato', icon: '🔄',
    section: 'ferramentas', status: 'available',
    description: 'Conversão de extratos entre formatos.' },

  // Permissões
  { slug: 'permissoes-equipe', name: 'Permissões da Equipe', icon: '🔐',
    section: 'permissoes', status: 'soon',
    description: 'Matriz de permissões dos membros do time.' },
  { slug: 'perfis-customizados', name: 'Perfis Customizados', icon: '⚙️',
    section: 'permissoes', status: 'soon',
    description: 'Defina papéis customizados com permissões específicas.' },
];

export const HUB_MODULES_BY_SLUG = HUB_MODULES.reduce((acc, m) => {
  acc[m.slug] = m;
  return acc;
}, {});

export function getHubModule(slug) {
  return HUB_MODULES_BY_SLUG[slug] || null;
}
