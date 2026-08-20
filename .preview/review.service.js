import { reviewService } from './fakes.js';
export const confirmarDocumento = reviewService.confirmarDocumento;
export const criarRegra = reviewService.criarRegra;
export const descartarDocumento = reviewService.descartarDocumento;
export const reprocessarDocumento = reviewService.reprocessarDocumento;
export const verificarNoDrive = async () => ({ existe: true });
export const listarEventos = async () => [];
