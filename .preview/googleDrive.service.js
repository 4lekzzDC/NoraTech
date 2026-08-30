import { driveService } from './fakes.js';
export const fetchConnectionStatus = driveService.fetchConnectionStatus;
export const startGoogleConnect = () => {};
export const disconnectGoogle = async () => {};
export const pickRootFolder = async () => null;
export const confirmRootFolder = async () => ({});
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const OAUTH_SCOPES = 'openid email';

// O fluxo de OAuth não roda na preview: o callback devolve conexão pronta.
export const completeGoogleConnect = async () => ({ email: 'preview@noratech.dev', conectado: true });
