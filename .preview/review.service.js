import { reviewService } from './fakes.js';
export const confirmarDocumento = reviewService.confirmarDocumento;
export const criarRegra = reviewService.criarRegra;
export const descartarDocumento = reviewService.descartarDocumento;
export const reprocessarDocumento = reviewService.reprocessarDocumento;
export const verificarNoDrive = async () => ({ ok: true });
export const listarEventos = async () => [
  {
    id: 'ev1', type: 'recebido', actor_type: 'system', actor_id: null,
    payload: { origem: 'email', remetente: 'financeiro@clientefake.com.br', assunto: 'NF agosto', file_name: 'nf.pdf' },
    created_at: '2026-08-23T09:10:00Z',
  },
  {
    id: 'ev2', type: 'revisao_solicitada', actor_type: 'system', actor_id: null,
    payload: {}, created_at: '2026-08-23T09:10:05Z',
  },
  {
    id: 'ev3', type: 'confirmado', actor_type: 'user', actor_id: 'u1',
    actor: { id: 'u1', name: 'Ana Contadora', email: 'ana@escritorio.com.br' },
    payload: {}, created_at: '2026-08-23T09:12:00Z',
  },
];
