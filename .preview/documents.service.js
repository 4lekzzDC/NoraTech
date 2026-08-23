export { documentsService as _ } from './fakes.js';
import { documentsService } from './fakes.js';
export const listDocuments = documentsService.listDocuments;
export const countByStatus = documentsService.countByStatus;
export const fetchContextoDeClassificacao = documentsService.fetchContextoDeClassificacao;
export const fetchSettingsCompletas = documentsService.fetchSettingsCompletas;
export const listHistorico = documentsService.listHistorico;
