let clientes = [
  { id: 'c1', nome: 'Silva Comércio ME', cnpj: '12345678000190', status: 'confirmado', ativo: true, aliases: ['silvacom'], regime: 'Simples Nacional' },
  { id: 'c2', nome: "D'Angelo Transportes Ltda", cnpj: '98765432000110', status: 'confirmado', ativo: true, aliases: [], regime: 'Lucro Presumido' },
];
export const listClients = async () => clientes;
export const createClient = async () => {};
export const updateClient = async () => {};
export const deleteClient = async () => {};
export const setClientAtivo = async () => {};
export const fetchImportaveis = async () => [];
export const importarDoContabil = async () => [];
