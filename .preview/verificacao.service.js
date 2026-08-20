let provisorios = [
  { id: 'p1', nome: 'Aurora Panificação', documentos: 4, created_at: '2026-08-19T09:00:00Z',
    origem_deteccao: { tipo: 'dominio_remetente', valor: 'aurorapanificacao.com.br' } },
  { id: 'p2', nome: 'transportesbrasil.com.br', documentos: 1, created_at: '2026-08-20T11:30:00Z',
    origem_deteccao: { tipo: 'dominio_remetente', valor: 'transportesbrasil.com.br' } },
];
export const listarProvisorios = async () => provisorios;
export const confirmarProvisorio = async ({ cliente }) => {
  provisorios = provisorios.filter((p) => p.id !== cliente.id);
  return { promovidos: 3, pastaMovida: true };
};
export const fundirProvisorio = async ({ provisorio }) => {
  provisorios = provisorios.filter((p) => p.id !== provisorio.id);
  return { movidos: 3, pendentes: ['nota-sem-data.pdf'] };
};
