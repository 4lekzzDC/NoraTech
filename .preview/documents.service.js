export { documentsService as _ } from './fakes.js';
import { documentsService } from './fakes.js';
export const listDocuments = documentsService.listDocuments;
export const countByStatus = documentsService.countByStatus;
export const fetchContextoDeClassificacao = documentsService.fetchContextoDeClassificacao;
export const fetchSettingsCompletas = documentsService.fetchSettingsCompletas;
export const listHistorico = documentsService.listHistorico;

// Copiados do serviço real: são dados, e a preview precisa deles para montar
// as mesmas colunas e os mesmos status da caixa de entrada.
export const COLUNAS_DO_DOCUMENTO = [
  'id', 'file_name', 'mime_type', 'size_bytes', 'origem', 'status', 'competencia',
  'review_reason', 'matched', 'received_at', 'organized_at',
  'drive_file_id', 'drive_folder_id', 'drive_path', 'drive_web_link',
  'error_message', 'retry_count',
];
export const STATUS_INBOX = ['revisar', 'processando', 'erro'];
