let clientes = [
  { id: 'c1', nome: 'Silva Comércio ME', cnpj: '12345678000190', status: 'confirmado', ativo: true, aliases: ['silvacom'], regime: 'Simples Nacional' },
  { id: 'c2', nome: "D'Angelo Transportes Ltda", cnpj: '98765432000110', status: 'confirmado', ativo: true, aliases: [], regime: 'Lucro Presumido' },
];
export const listClients = async () => clientes;

// ── Superfície de Soluções Contábeis ──────────────────────────────────────
// O alias da preview manda os DOIS clients.service (NoraDocs e Soluções
// Contábeis) para este arquivo, e o `src/main.jsx` do app entra no grafo por
// tabela. Faltando um único export daqui, o módulo inteiro falha a ligação e
// a preview abre em branco — por isso o dublê cobre a superfície completa,
// mesmo o que nenhuma tela chega a chamar.
//
// O cadastro é devolvido com os nomes de campo do serviço real
// (`fromDbRow`): `name` no lugar de `nome`, mais `estado`.
export const getClientes = async () => clientes.map((c) => ({
  id: c.id, name: c.nome, cnpj: c.cnpj, estado: 'SP',
  tributacao: 'Simples Nacional', status: 'ativo',
}));
export const saveCliente = async (data) => ({ id: 'novo', ...data });
export const deleteCliente = async () => {};
export const getBancos = async () => [];
export const saveBanco = async (record) => ({ id: 'novo', ...record });
export const deleteBanco = async () => {};
export const getAllBancos = async () => [];
export const importLegacyClientsIfNeeded = async () => ({ importados: 0 });
export const getCurrentTenantCompanyId = async () => 't1';
export const createClient = async () => {};
export const updateClient = async () => {};
export const deleteClient = async () => {};
export const setClientAtivo = async () => {};
export const fetchImportaveis = async () => [];
export const importarDoContabil = async () => [];
