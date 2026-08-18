import { supabase } from '../../../lib/supabase';
import { GOOGLE_CALLBACK_ROUTE } from '../constants';

// Conexão do escritório com o Google Drive — escopo `drive.file`, nunca o
// escopo amplo. Arquitetura em docs/noradocs/integracao-google.md.
//
// Há UM único ponto de autenticação com o Google: o consentimento inicial,
// que troca um `code` por um refresh_token guardado no servidor. O Picker
// (usado depois para escolher a pasta raiz) não pede um segundo login — ele
// recebe um access_token emprestado desse mesmo refresh_token pela Edge
// Function `noradocs-drive`. Não existem duas identidades para reconciliar,
// porque só existe uma.

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// `openid email` acompanham o drive.file só para sabermos QUAL conta Google
// ficou conectada — a tela precisa dizer "conectado como fulano@..." para o
// escritório conferir onde os documentos estão sendo arquivados. Ambos são
// escopos não sensíveis e não dão acesso a dado nenhum além da identidade.
export const OAUTH_SCOPES = `openid email ${DRIVE_FILE_SCOPE}`;

const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_KEY = 'noradocs_oauth_state';

function callbackUrl() {
  return `${window.location.origin}${GOOGLE_CALLBACK_ROUTE}`;
}

// O Picker exige o NÚMERO do projeto no Google Cloud, não o client ID — e ele
// é justamente o prefixo numérico do client ID
// ("223036358695-mojkdu....apps.googleusercontent.com" → "223036358695").
// Derivar daqui evita uma segunda variável de ambiente que teria que ser
// mantida em sincronia à mão.
function projectNumberFromClientId(clientId) {
  return String(clientId || '').split('-')[0];
}

// Quando a Edge Function responde com status não-2xx, o supabase-js devolve
// um `error` genérico ("Edge Function returned a non-2xx status code") e
// guarda a Response de verdade em `error.context` — sem ler isso, a mensagem
// específica que a função mandou (a que o usuário precisa ver) se perde.
async function functionErrorMessage(error, fallback) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch { /* corpo da resposta não era JSON */ }
  }
  return error?.message || fallback;
}

// Redireciona a própria aba para o consentimento do Google. Full-page
// redirect, não popup: mais simples, funciona igual em qualquer navegador e
// não depende de bloqueador de popup.
export function startGoogleConnect() {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('A integração com o Google ainda não foi configurada neste ambiente.');

  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',              // garante que o refresh_token sempre venha
    include_granted_scopes: 'false',
    state,
  });
  window.location.assign(`${OAUTH_ENDPOINT}?${params.toString()}`);
}

// Consome o `code` que o Google devolveu na URL de callback. Valida o
// `state` contra o que foi guardado antes do redirect — proteção de CSRF
// padrão do fluxo de código sem sessão de backend própria.
export async function completeGoogleConnect({ code, state }) {
  const esperado = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!state || state !== esperado) {
    throw new Error('Sessão de conexão expirada ou inválida. Tente conectar novamente.');
  }

  const { data, error } = await supabase.functions.invoke('noradocs-google-oauth', {
    body: { action: 'connect', code, redirectUri: callbackUrl() },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Não foi possível concluir a conexão com o Google.'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function disconnectGoogle() {
  const { data, error } = await supabase.functions.invoke('noradocs-google-oauth', {
    body: { action: 'disconnect' },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Não foi possível desconectar.'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchConnectionStatus(tenantId) {
  const [{ data: account }, { data: settings }] = await Promise.all([
    supabase.from('noradocs_google_accounts')
      .select('google_email, status, connected_at, last_error')
      .eq('tenant_company_id', tenantId).maybeSingle(),
    supabase.from('noradocs_settings')
      .select('drive_root_folder_id, drive_root_folder_name, drive_staging_folder_id')
      .eq('tenant_company_id', tenantId).maybeSingle(),
  ]);
  return { account: account || null, settings: settings || null };
}

// ── Google Picker — só a pasta raiz, no MVP ──────────────────────────────

let pickerScriptPromise = null;

function loadPickerLibrary() {
  if (window.google?.picker) return Promise.resolve();
  if (!pickerScriptPromise) {
    pickerScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => window.gapi.load('picker', { callback: resolve });
      script.onerror = () => reject(new Error('Não foi possível carregar o seletor de pastas do Google.'));
      document.head.appendChild(script);
    });
  }
  return pickerScriptPromise;
}

// Abre o Picker restrito a pastas e devolve a escolhida, ou null se o
// contador cancelou. O token vem do servidor — nunca pedimos ao navegador
// para logar no Google de novo.
export async function pickRootFolder() {
  const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  if (!apiKey) throw new Error('O seletor de pastas do Google ainda não foi configurado neste ambiente.');

  const appId = projectNumberFromClientId(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
  if (!appId) throw new Error('A integração com o Google ainda não foi configurada neste ambiente.');

  const { data, error } = await supabase.functions.invoke('noradocs-drive', {
    body: { action: 'picker-token' },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Não foi possível preparar o seletor de pastas.'));
  if (data?.error) throw new Error(data.error);

  await loadPickerLibrary();

  return new Promise((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true);

      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(data.accessToken)
        .setDeveloperKey(apiKey)
        // OBRIGATÓRIO com o escopo drive.file: é o setAppId que faz o Google
        // vincular o item escolhido a ESTE app. Sem ele o seletor abre e
        // deixa escolher normalmente, mas nenhuma concessão é criada — e o
        // servidor recebe 404 ao tentar ler a pasta (o Google responde
        // "não encontrado" em vez de "sem permissão", para não revelar se o
        // arquivo existe).
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .addView(view)
        .setTitle('Escolha a pasta raiz do NoraDocs')
        .setCallback((result) => {
          if (result.action === window.google.picker.Action.PICKED) {
            const item = result.docs[0];
            resolve({ id: item.id, name: item.name });
          } else if (result.action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });
}

export async function confirmRootFolder({ id, name }) {
  const { data, error } = await supabase.functions.invoke('noradocs-drive', {
    body: { action: 'set-root-folder', folderId: id, folderName: name },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Não foi possível confirmar a pasta escolhida.'));
  if (data?.error) throw new Error(data.error);
  return data;
}
