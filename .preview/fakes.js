// Dublês dos serviços, para abrir a caixa de entrada sem banco nem Google.
const clients = [
  { id: 'c1', nome: 'Silva Comércio ME', cnpj: '12345678000190' },
  { id: 'c2', nome: "D'Angelo Transportes Ltda", cnpj: '98765432000110' },
  { id: 'c3', nome: 'Padaria Aurora', cnpj: '11222333000181' },
];
const categories = [
  { id: 'k1', nome: 'Extratos bancários' },
  { id: 'k2', nome: 'Notas fiscais' },
  { id: 'k3', nome: 'Folha' },
];

const docs = [
  { id: 'd1', file_name: 'extrato_itau_08-2026.pdf', status: 'revisar', competencia: '2026-08',
    client: clients[0], category: categories[0], drive_path: null, matched: { pendencias: [] },
    review_reason: null },
  { id: 'd2', file_name: '585532502422029870_1.pdf', status: 'revisar', competencia: '2026-07',
    client: null, category: null, drive_path: null, matched: { pendencias: ['cliente', 'categoria'] },
    review_reason: 'Cliente não identificado: nenhum CNPJ conhecido no texto nem no nome do arquivo. Competência suposta pelo mês anterior ao recebimento. Categoria não identificada: nenhuma palavra-chave de categoria encontrada.',
    // Como vem pelo Gmail: tem id do arquivo, mas o web_link é nulo.
    drive_file_id: '1E22rHkgE-fpz3IYck3JYoyAFG-tP8Ako', drive_web_link: null },
  { id: 'd3', file_name: 'NFe_98765432000110_072026.xml', status: 'revisar', competencia: '2026-07',
    client: clients[1], category: categories[1], drive_path: null, matched: { pendencias: [] },
    review_reason: null },
  { id: 'd4', file_name: 'folha-aurora-agosto.pdf', status: 'erro', competencia: '2026-08',
    client: clients[2], category: categories[2], drive_path: null, matched: { pendencias: [] },
    review_reason: null, error_message: 'O Google recusou o envio do arquivo (403).' },
  { id: 'd5', file_name: 'extrato_bradesco_08-2026.pdf', status: 'revisar', competencia: '2026-08',
    client: clients[0], category: categories[0], drive_path: null, matched: { pendencias: [] },
    review_reason: null },
  { id: 'd6', file_name: 'NFe_11222333000181_082026.xml', status: 'processando', competencia: '2026-08',
    client: clients[2], category: categories[1], drive_path: null, matched: { pendencias: [] },
    review_reason: null },
  { id: 'd7', file_name: 'extrato_itau_07-2026.pdf', status: 'organizado', competencia: '2026-07',
    client: clients[0], category: categories[0], mime_type: 'application/pdf',
    drive_path: 'Silva Comércio ME/2026/2026-07/Extratos bancários/extrato_itau_07-2026.pdf',
    drive_file_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', drive_web_link: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view',
    received_at: '2026-08-02T09:14:00Z', organized_at: '2026-08-02T09:15:10Z',
    matched: { pendencias: [] }, review_reason: null },
  { id: 'd8', file_name: 'nota-fiscal-scaneada.jpg', status: 'descartado', competencia: '2026-06',
    client: clients[1], category: categories[1], mime_type: 'image/jpeg',
    drive_path: null, drive_file_id: null, drive_web_link: null,
    received_at: '2026-07-18T14:02:00Z', organized_at: null,
    matched: { pendencias: [] }, review_reason: null },
];

export const documentsService = {
  listDocuments: async ({ status }) => (status ? docs.filter((d) => d.status === status) : docs),
  listHistorico: async ({ clientId = '', dataDe = '', dataAte = '', status = '', busca = '' } = {}) => docs
    .filter((d) => d.status === 'organizado' || d.status === 'descartado')
    .filter((d) => !clientId || d.client?.id === clientId)
    .filter((d) => !status || d.status === status)
    .filter((d) => !dataDe || (d.received_at && d.received_at >= `${dataDe}T00:00:00`))
    .filter((d) => !dataAte || (d.received_at && d.received_at <= `${dataAte}T23:59:59`))
    .filter((d) => !busca || d.file_name.toLowerCase().includes(busca.trim().toLowerCase())),
  countByStatus: async () => ({ revisar: 4, erro: 1 }),
  fetchContextoDeClassificacao: async () => ({ clients, categories, rules: [] }),
  fetchSettingsCompletas: async () => ({ drive_root_folder_id: 'root', folder_template: '{cliente}/{ano}/{mes}', auto_organize: true }),
};
export const reviewService = {
  confirmarDocumento: async () => {}, criarRegra: async () => {},
  descartarDocumento: async () => {}, reprocessarDocumento: async () => true,
};
export const driveService = { fetchConnectionStatus: async () => ({ account: { status: 'connected', google_email: 'escritorio@exemplo.com' }, settings: {} }) };
export const tenantService = { resolveTenant: async () => ({ tenantId: 't1', ready: true }) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uploadService = {
  processarArquivo: async (file, { onEtapa } = {}) => {
    for (const etapa of ['lendo', 'classificando', 'enviando', 'gravando']) {
      onEtapa?.(etapa);
      await sleep(500);
    }
    if (file.name.includes('falha')) throw new Error('O Google recusou o envio do arquivo (403).');
    return { status: file.name.includes('revisar') ? 'revisar' : 'organizado' };
  },
};
