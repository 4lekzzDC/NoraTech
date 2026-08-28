// Dublê do cliente Supabase para o harness de preview. Não fala com banco.
//
// A versão anterior devolvia um Proxy que engolia qualquer chamada e NÃO era
// thenable. Isso bastava enquanto todo acesso a dado passava pelos dublês de
// serviço — mas quem faz `await supabase.from(...)` direto recebia o próprio
// proxy no lugar de `{ data, error }`, e o destructuring entregava um `error`
// truthy. O componente então renderizava estado de falha na preview, que é
// justamente o que ela não deve mostrar.
//
// Agora o construtor de consulta é encadeável E awaitable, e devolve linhas de
// mentira por tabela. O ganho é que o código de produção roda inteiro —
// consulta, contagem, marcação como lida, atualização otimista — contra uma
// fronteira de I/O falsa, em vez de a preview exercitar um caminho paralelo.

const agora = Date.now();
const ha = (min) => new Date(agora - min * 60000).toISOString();

// Uma de cada família, para conferir o layout: não lida x lida, título curto x
// prévia de duas linhas, e o ícone vermelho do alerta.
const NOTIFICACOES = [
  { id: 'n1', type: 'fatura_recusada', title: 'Pagamento recusado',
    body: 'Não foi possível cobrar R$ 1.240,00. Verifique o cartão cadastrado.',
    link: '/area-do-cliente?tab=cobranca', metadata: {}, read_at: null, created_at: ha(4), company_id: 'c1' },
  { id: 'n2', type: 'equipe_pedido', title: 'Isabella Martins pediu para entrar',
    body: 'Aguardando sua aprovação em Planejamento.',
    link: '/area-do-cliente?tab=equipe', metadata: {}, read_at: null, created_at: ha(52), company_id: 'c1' },
  { id: 'n3', type: 'suporte_resposta', title: 'Resposta no chamado #2',
    body: 'Verificamos aqui e o problema era a pasta raiz do Drive, que tinha sido movida. Já reconfiguramos e os documentos voltaram a ser arquivados normalmente.',
    link: '/area-do-cliente?tab=suporte', metadata: {}, read_at: null, created_at: ha(180), company_id: 'c1' },
  { id: 'n4', type: 'fatura_paga', title: 'Pagamento confirmado',
    body: 'Recebemos R$ 890,00. Obrigado!',
    link: '/area-do-cliente?tab=cobranca', metadata: {}, read_at: ha(2880), created_at: ha(2900), company_id: 'c1' },
];

// Sistema de mentira para as telas de Admin/Sistemas — só o suficiente pra
// AdminSystemEditorPage carregar (ela consulta `systems` direto, sem passar
// por um dublê de serviço próprio).
const SISTEMAS = [
  {
    slug: 'solucoes-contabeis', name: 'NoraHub',
    description: 'Suíte completa para escritórios contábeis.', icon: '📊', logo_url: null,
    color: '#7C3AED', default_amount: 0, url: '/solucoes-contabeis', internal: true,
    aliases: ['acompanhamento-contabil'], active: true, sort_order: 2, video_url: null,
  },
];

const TABELAS = { notifications: NOTIFICACOES, systems: SISTEMAS };

function consulta(tabela) {
  let linhas = () => (TABELAS[tabela] || []).slice();
  let contando = false;
  let somenteNaoLidas = false;
  let modoUnico = null; // null | 'maybe' | 'single'

  const q = {
    select: (_cols, opcoes) => { contando = Boolean(opcoes?.count); return q; },
    // `is('read_at', null)` é o filtro do contador; os demais não mudam nada
    // aqui, e ignorá-los é honesto: o dublê não promete filtrar de verdade.
    is: (coluna, valor) => { if (coluna === 'read_at' && valor === null) somenteNaoLidas = true; return q; },
    eq: () => q, neq: () => q, in: () => q, gte: () => q, lte: () => q,
    order: () => q, limit: () => q, range: () => q,
    update: () => q, insert: () => q, upsert: () => q, delete: () => q,
    maybeSingle: () => { modoUnico = 'maybe'; return q; },
    single: () => { modoUnico = 'single'; return q; },
    then: (resolve, reject) => {
      const dados = somenteNaoLidas ? linhas().filter((l) => !l.read_at) : linhas();
      let resultado;
      if (contando) resultado = { data: null, count: dados.length, error: null };
      else if (modoUnico) resultado = { data: dados[0] || null, error: null };
      else resultado = { data: dados, error: null };
      return Promise.resolve(resultado).then(resolve, reject);
    },
  };
  return q;
}

const vazio = { data: null, error: null };

export const supabase = {
  from: (tabela) => consulta(tabela),
  rpc: async () => vazio,
  auth: {
    getUser: async () => ({ data: { user: { id: 'u1' } } }),
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  functions: { invoke: async () => vazio },
};
export default supabase;
export const AVATARS_BUCKET = 'avatars';
export function purgeLocalSession() {}
