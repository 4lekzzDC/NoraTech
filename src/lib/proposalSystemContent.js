// Conteúdo comercial por sistema — visão geral, destaques, funcionalidades,
// módulos e (quando existir) vídeo de demonstração — usado só pelo modal
// "Ver detalhes" da página pública da proposta (PropostaPublicaPage.jsx).
//
// Fica separado de `lib/systems.js` de propósito: aquele catálogo é
// operacional (slug, ícone, preço-base — usado pra montar assinatura,
// cobrança, rota interna); este aqui é só texto de venda, sem nenhum dado
// que precise ficar em sincronia com o banco. `video`/`previewImage` ficam
// `null` até existir um asset de verdade pra apontar — o modal já sabe
// esconder a aba "Demonstração" e a prévia quando não há nada pra mostrar,
// então preencher isso depois é só trocar o valor aqui.

export const PROPOSAL_SYSTEM_CONTENT = {
  'whatsapp-bot': {
    tagline: 'Atendimento inteligente que entende, direciona e resolve.',
    overview: 'O NoraChat usa inteligência artificial para atender clientes pelo WhatsApp de forma rápida e precisa — identifica a intenção da conversa, coleta as informações necessárias e transfere para um atendente humano só quando faz sentido. Nada de fila de espera nem resposta genérica: o cliente sente que está sendo entendido desde a primeira mensagem.',
    highlights: [
      { icon: '⚡', title: 'Mais agilidade', desc: 'Respostas instantâneas e triagem automática, sem depender de alguém disponível pra responder.' },
      { icon: '🎯', title: 'Menos retrabalho', desc: 'Reduz tarefas repetitivas da equipe — perguntas frequentes e triagem inicial saem da fila humana.' },
      { icon: '🛡️', title: 'Melhor experiência', desc: 'Atendimento contínuo e humanizado, 24 horas por dia, sem deixar o cliente sem resposta.' },
    ],
    features: [
      'Atende 24/7 e nunca deixa o cliente sem resposta',
      'Entende a intenção do cliente e direciona corretamente',
      'Integra com WhatsApp — e outros canais conforme o plano',
      'Histórico completo de conversas e métricas em tempo real',
      'Transferência fluida para atendentes humanos quando necessário',
    ],
    modules: [
      'Atendimento inteligente',
      'Triagem por intenção',
      'Base de conhecimento',
      'Transferência para humano',
      'Relatórios e métricas',
    ],
    video: null,
    previewImage: null,
  },

  'solucoes-contabeis': {
    tagline: 'Hub de soluções para o escritório contábil, do fechamento à análise.',
    overview: 'O NoraHub centraliza as ferramentas que o escritório contábil usa no dia a dia: acompanhamento do fechamento mensal por empresa, conciliação de extratos e fornecedores, cálculos fiscais (DIFAL, IRPJ/CSLL) e controle de prazos — tudo num painel só, com visão gerencial de quem está em dia e quem precisa de atenção.',
    highlights: [
      { icon: '📊', title: 'Visão gerencial', desc: 'Status do fechamento de cada empresa num painel só, sem precisar caçar informação em planilha.' },
      { icon: '🧮', title: 'Menos cálculo manual', desc: 'DIFAL, IRPJ/CSLL e conciliações que hoje tomam horas viram cálculo automático.' },
      { icon: '⏰', title: 'Prazo sob controle', desc: 'Alertas de pendência e vencimento antes que virem problema pro cliente.' },
    ],
    features: [
      'Acompanhamento mensal por empresa: arquivos, conciliação e prazos',
      'Conciliação automática de extratos bancários e de fornecedores',
      'Calculadoras fiscais prontas: DIFAL, IRPJ e CSLL',
      'CRM dos clientes do escritório, com regime tributário e histórico',
      'Análise de demonstrações com indicadores e gráficos',
    ],
    modules: [
      'Acompanhamento Contábil',
      'Conciliador de Extratos',
      'Conciliador de Fornecedores',
      'Calculadora de DIFAL',
      'Calculadora de IRPJ e CSLL',
      'Controle de Prazos',
    ],
    video: null,
    previewImage: null,
  },

  noradocs: {
    tagline: 'Documentos organizados sozinhos, sem escritório levantar um dedo.',
    overview: 'O NoraDocs recebe os documentos do cliente (por e-mail ou upload) e organiza tudo sozinho: identifica de qual cliente é, qual a competência e a categoria — extrato, nota fiscal, folha — e arquiva já no lugar certo dentro do Google Drive do escritório. O que hoje é triagem manual vira só conferência.',
    highlights: [
      { icon: '🗂️', title: 'Organização automática', desc: 'Cliente, competência e categoria identificados sem intervenção manual.' },
      { icon: '📥', title: 'Entrada facilitada', desc: 'Documento chega por e-mail ou upload — não precisa treinar o cliente em nada novo.' },
      { icon: '🔍', title: 'Fácil de encontrar depois', desc: 'Tudo arquivado no Google Drive do escritório, na estrutura certa desde o início.' },
    ],
    features: [
      'Identifica cliente, competência e categoria automaticamente',
      'Recebe documentos por e-mail de entrada dedicado ou upload direto',
      'Arquiva direto no Google Drive do escritório, na pasta certa',
      'Categorias prontas: extratos, contas a pagar/receber, notas fiscais e mais',
      'Histórico completo de tudo que já foi processado, com status por documento',
    ],
    modules: [
      'Recebimento de documentos',
      'Classificação automática',
      'Integração com Google Drive',
      'Cadastro de clientes',
      'Histórico e auditoria',
    ],
    video: null,
    previewImage: null,
  },
};

export function getProposalSystemContent(slug) {
  return PROPOSAL_SYSTEM_CONTENT[slug] || null;
}
