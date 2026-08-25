import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Operações do NoraDocs sobre o Drive do escritório que exigem o token do
// servidor. Cinco ações:
//
//   picker-token       empresta um access_token curto para o Picker abrir
//   set-root-folder    confirma a raiz e cria _triagem e _verificação
//   ensure-folder-path caminha/cria a árvore do destino, com cache; a base é
//                      a raiz, _triagem, _verificação ou _descartados
//   upload-token       empresta um access_token curto para o envio direto
//   move-file          troca o pai do arquivo — de _triagem para o destino
//
// Nunca há um segundo login do Google: todo access_token daqui vem de
// REFRESCAR o mesmo refresh_token guardado na conexão inicial. Existe um
// único grant, do início ao fim.
//
// Os BYTES do documento nunca passam por aqui: o navegador envia o arquivo
// direto ao Google, com o token que 'upload-token' empresta.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Rate limit inline em vez de importar ../_shared/rateLimit.ts: esta função é
// self-contained por decisão de implantação (ver o cabeçalho do arquivo), e o
// custo de repetir doze linhas é menor que o de reintroduzir a resolução de
// caminho relativo que ela evita.
//
// Cada ação aqui vira uma ou mais chamadas à API do Drive, que tem cota
// própria: estourá-la derruba o arquivamento do escritório inteiro, não só de
// quem abusou. O teto é por usuário e alto o bastante para um lote grande de
// upload passar inteiro.
const LIMITE_DRIVE = { bucket: 'noradocs_drive', limit: 120, windowSeconds: 60 };

async function dentroDoLimite(
  // deno-lint-ignore no-explicit-any
  admin: any, userId: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket: LIMITE_DRIVE.bucket,
      p_key: userId,
      p_limit: LIMITE_DRIVE.limit,
      p_window_seconds: LIMITE_DRIVE.windowSeconds,
    });
    if (error) throw error;
    return { allowed: Boolean(data?.allowed), retryAfter: Number(data?.retry_after ?? 60) };
  } catch (err) {
    // Falha aberta: sem banco, o arquivamento não pode parar de funcionar.
    console.error('[noradocs-drive] rate limit falhou, liberando', err);
    return { allowed: true, retryAfter: 0 };
  }
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const STAGING_FOLDER_NAME = '_triagem';
// Irmã de _triagem, com propósito diferente: _triagem guarda o que não foi
// identificado; _verificação guarda o que foi identificado como uma empresa
// que ainda não é cliente. Num falta informação, no outro falta cadastro.
const VERIFICACAO_FOLDER_NAME = '_verificação';
// Terceira irmã: onde vai o arquivo de um documento descartado. Sair da
// vista de quem está arquivando sem apagar nada do Drive do escritório —
// quem decide apagar de verdade é o dono da conta, não o NoraDocs.
const DESCARTADOS_FOLDER_NAME = '_descartados';

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Aspas simples fecham o literal na sintaxe de busca do Drive. Uma pasta de
// cliente chamada "D'Angelo Ltda" montaria uma query quebrada sem isto — e
// todo valor que entra numa query aqui vem do corpo da requisição, então
// nenhum deles pode ser interpolado cru, nem os que "sempre" são ids.
function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Garante UM nível: procura a subpasta pelo nome dentro do pai e cria se não
// existir. Buscar antes de criar é o que impede duas pastas com o mesmo nome
// quando dois uploads do mesmo cliente chegam juntos.
async function ensureChildFolder(accessToken: string, parentId: string, name: string) {
  const q = `'${escapeDriveQuery(parentId)}' in parents and name='${escapeDriveQuery(name)}' `
    + `and mimeType='${FOLDER_MIME}' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)`
    + '&supportsAllDrives=true&includeItemsFromAllDrives=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const found = await searchRes.json().catch(() => ({ files: [] }));
  if (found.files?.[0]?.id) return found.files[0].id as string;

  const createRes = await fetch(`${DRIVE_FILES_URL}?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => '');
    throw new Error(`Falha ao criar a pasta "${name}" no Drive: ${createRes.status} ${errBody}`);
  }
  const created = await createRes.json();
  return created.id as string;
}

// O cache de `noradocs_drive_folders` guarda um id para sempre — e um id do
// Drive não é para sempre. Se alguém apaga a pasta de um cliente por fora
// (limpando dados de teste, por exemplo), o cache não fica sabendo: continua
// devolvendo o id de uma pasta que não existe mais, e todo documento novo
// desse cliente é "arquivado" num endereço fantasma, sem erro nenhum. Foi
// exatamente isso que aconteceu com um extrato: o registro dizia "arquivado",
// mas a pasta do meio da árvore tinha sido apagada dias antes.
//
// Por isso todo cache HIT passa por aqui antes de ser confiado. Custa uma
// chamada extra ao Drive por nível — pouco, perto do que custa um documento
// silenciosamente perdido.
async function folderAindaExiste(accessToken: string, folderId: string) {
  const res = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=id,trashed,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data.mimeType === FOLDER_MIME && !data.trashed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '';

  if (!clientId || !clientSecret) {
    return json({ error: 'A integração com o Google ainda não foi configurada neste ambiente.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'Sessão inválida' }, 401);

  const limite = await dentroDoLimite(admin, user.id);
  if (!limite.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Muitas operações no Drive em sequência. Aguarde um instante.',
        retryAfter: limite.retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(limite.retryAfter),
        },
      },
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Corpo inválido' }, 400); }
  const action = body?.action;

  // A MESMA regra de src/lib/companies.js (fetchMyCompany): membresia mais
  // recente, preferindo a ativa. Não é detalhe — se o servidor escolhesse o
  // escritório por outro critério, quem pertence a dois veria a tela de um e
  // teria os documentos arquivados no Drive do outro. E o `.maybeSingle()`
  // que estava aqui não escolhia nada: com duas membresias o PostgREST
  // devolve erro, e o usuário levava um "você não pertence a nenhum
  // escritório" que era falso.
  const { data: membresias } = await caller
    .from('company_members')
    .select('company_id, status, created_at')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false });
  // Anotação explícita, não pré-existente por acaso: o cliente Supabase é
  // `any` (import via esm.sh, sem tipos neste checkout), e sem isto o
  // `deno check` real — bloqueado até agora pela rede — acusa parâmetro
  // implicitamente `any`.
  const membership = (membresias || []).find((m: { status?: string }) => m.status === 'active')
    || (membresias || [])[0];
  const tenantId = membership?.company_id as string | undefined;
  if (!tenantId) return json({ error: 'Você não pertence a nenhum escritório.' }, 400);

  // Duas alçadas diferentes, de propósito. CONFIGURAR a conexão (escolher a
  // pasta raiz, abrir o seletor) é decisão de quem responde pela conta do
  // escritório. USAR o Drive no dia a dia — arquivar um documento — é o
  // trabalho de qualquer membro; exigir owner/admin aqui inviabilizaria o
  // produto para o time que de fato opera a caixa de entrada.
  const ACOES_DE_CONFIGURACAO = ['picker-token', 'set-root-folder'];
  const rpcDeAcesso = ACOES_DE_CONFIGURACAO.includes(String(action))
    ? 'has_noradocs_manage'
    : 'has_noradocs_access';

  const { data: autorizado } = await caller.rpc(rpcDeAcesso, { p_company_id: tenantId });
  if (!autorizado) {
    return json({
      error: rpcDeAcesso === 'has_noradocs_manage'
        ? 'Apenas o responsável pelo escritório (dono ou admin) pode gerenciar o Google Drive.'
        : 'Você não tem acesso ao NoraDocs neste escritório.',
    }, 403);
  }

  // O refresh_token não fica mais em coluna de texto puro: vive no Vault, e
  // esta RPC (só service_role) é o único caminho de leitura.
  const { data: refreshToken, error: erroToken } = await admin
    .rpc('noradocs_ler_refresh_token', { p_company_id: tenantId });
  if (erroToken) throw erroToken;
  if (!refreshToken) {
    return json({ error: 'O escritório ainda não conectou uma conta do Google.' }, 400);
  }

  const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
  if (!refreshed.ok || !refreshed.data.access_token) {
    console.error('[noradocs-drive] refresh failed', refreshed.data);
    // invalid_grant = a conta revogou o acesso fora do NoraDocs (trocou
    // senha, removeu o app na conta Google). Sinalizamos para a UI oferecer
    // reconectar, em vez de deixar o escritório martelando um botão que nunca
    // vai funcionar.
    await admin.from('noradocs_google_accounts')
      .update({ status: 'revoked', last_error: refreshed.data?.error || 'refresh_failed' })
      .eq('tenant_company_id', tenantId);
    return json({ error: 'A conexão com o Google expirou. Reconecte a conta na tela de Configurações.', code: 'revoked' }, 409);
  }
  const accessToken = refreshed.data.access_token as string;

  try {
    if (action === 'picker-token') {
      return json({ accessToken, expiresIn: refreshed.data.expires_in ?? 3600 });
    }

    if (action === 'set-root-folder') {
      const folderId = String(body?.folderId || '');
      const folderName = String(body?.folderName || '');
      if (!folderId) return json({ error: 'folderId é obrigatório' }, 400);

      // Confirma que o token do servidor realmente alcança a pasta que o
      // Picker devolveu, e que é mesmo uma pasta.
      const folderRes = await fetch(
        `${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!folderRes.ok) {
        const errBody = await folderRes.text().catch(() => '');
        console.error('[noradocs-drive] folder lookup failed', folderRes.status, errBody);
        return json({ error: 'Não foi possível acessar a pasta escolhida. Selecione novamente pelo seletor do Google.' }, 400);
      }
      const folder = await folderRes.json();
      if (folder.mimeType !== FOLDER_MIME) {
        return json({ error: 'O item escolhido não é uma pasta.' }, 400);
      }

      // ensureChildFolder busca antes de criar, então reconfirmar a mesma raiz
      // (ou um clique duplo) não gera pastas repetidas.
      let stagingId: string;
      let verificacaoId: string;
      try {
        stagingId = await ensureChildFolder(accessToken, folderId, STAGING_FOLDER_NAME);
        verificacaoId = await ensureChildFolder(accessToken, folderId, VERIFICACAO_FOLDER_NAME);
      } catch (err) {
        console.error('[noradocs-drive] subpastas da raiz', err);
        return json({ error: 'Pasta raiz confirmada, mas não foi possível criar as subpastas de trabalho.' }, 500);
      }

      const { error: upErr } = await admin.from('noradocs_settings').upsert({
        tenant_company_id: tenantId,
        drive_root_folder_id: folderId,
        drive_root_folder_name: folder.name || folderName || null,
        drive_staging_folder_id: stagingId,
        drive_verificacao_folder_id: verificacaoId,
      }, { onConflict: 'tenant_company_id' });
      if (upErr) throw upErr;

      return json({
        rootFolderId: folderId,
        rootFolderName: folder.name,
        stagingFolderId: stagingId,
        verificacaoFolderId: verificacaoId,
      });
    }

    if (action === 'ensure-folder-path') {
      const segments = Array.isArray(body?.segments) ? (body.segments as string[]) : [];

      // Três pontos de partida possíveis. `staging: true` é a forma antiga e
      // continua entendida: durante a janela entre implantar esta função e
      // implantar o frontend novo, o navegador em produção ainda a envia.
      const base = String(body?.base || (body?.staging === true ? 'triagem' : 'raiz'));
      if (!['raiz', 'triagem', 'verificacao', 'descartados'].includes(base)) {
        return json({ error: 'base inválida' }, 400);
      }

      const { data: settings } = await admin
        .from('noradocs_settings')
        .select('drive_root_folder_id, drive_staging_folder_id, drive_verificacao_folder_id, drive_descartados_folder_id')
        .eq('tenant_company_id', tenantId)
        .maybeSingle();

      if (!settings?.drive_root_folder_id) {
        return json({ error: 'O escritório ainda não escolheu a pasta raiz no Google Drive.' }, 400);
      }

      let rootId: string | null | undefined = {
        raiz: settings.drive_root_folder_id,
        triagem: settings.drive_staging_folder_id,
        verificacao: settings.drive_verificacao_folder_id,
        descartados: settings.drive_descartados_folder_id,
      }[base];

      // Escritório que configurou a raiz antes de _verificação (ou
      // _descartados) existir não tem a pasta. Criar aqui, na primeira
      // necessidade, evita obrigá-lo a reconfigurar a conexão só para ganhar
      // uma subpasta.
      if (!rootId && (base === 'verificacao' || base === 'descartados')) {
        const nome = base === 'verificacao' ? VERIFICACAO_FOLDER_NAME : DESCARTADOS_FOLDER_NAME;
        rootId = await ensureChildFolder(accessToken, settings.drive_root_folder_id, nome);
        const coluna = base === 'verificacao' ? 'drive_verificacao_folder_id' : 'drive_descartados_folder_id';
        await admin.from('noradocs_settings')
          .update({ [coluna]: rootId })
          .eq('tenant_company_id', tenantId);
      }
      if (!rootId) {
        return json({ error: 'A pasta de trabalho do escritório não foi encontrada no Drive.' }, 400);
      }

      // Documento duvidoso vai inteiro para _triagem, sem árvore: o caminho
      // definitivo só é conhecido depois que alguém confirma a classificação.
      // Já em _verificação a árvore É construída — a empresa foi identificada,
      // o que falta é o cadastro dela.
      if (base === 'triagem' || segments.length === 0) return json({ folderId: rootId, path: null });

      // O prefixo da base entra na chave do cache: "Aurora/2026/08" dentro de
      // _verificação é uma pasta diferente de "Aurora/2026/08" na raiz, e sem
      // isto a segunda reusaria o id da primeira e o documento iria parar na
      // árvore errada.
      const path = segments.join('/');
      const chaveCache = base === 'raiz' ? path : `${base}:${path}`;

      // O que volta daqui vira a coluna "Destino" na tela. Devolver
      // "Aurora/2026/08" para algo que está dentro de _verificação mandaria o
      // contador procurar a pasta na árvore de clientes, onde ela não está.
      const pathExibido = base === 'verificacao' ? `${VERIFICACAO_FOLDER_NAME}/${path}` : path;

      // Cache: evita percorrer o Drive a cada arquivo do mesmo cliente e
      // mês — que é o padrão real de uso, lotes de dezenas de uma vez. Mas só
      // vale se a pasta ainda existir — ver folderAindaExiste.
      const { data: cached } = await admin
        .from('noradocs_drive_folders')
        .select('drive_folder_id')
        .eq('tenant_company_id', tenantId)
        .eq('path', chaveCache)
        .maybeSingle();
      if (cached?.drive_folder_id && await folderAindaExiste(accessToken, cached.drive_folder_id)) {
        return json({ folderId: cached.drive_folder_id, path: pathExibido, cached: true });
      }

      // Caminha a árvore criando o que faltar, e memoriza cada nível — não só
      // o final: o próximo documento do mesmo cliente em outro mês já acha o
      // caminho do cliente pronto.
      let parentId = rootId;
      const acumulado: string[] = [];
      for (const segment of segments) {
        acumulado.push(segment);
        const parcial = base === 'raiz' ? acumulado.join('/') : `${base}:${acumulado.join('/')}`;

        const { data: cachedLevel } = await admin
          .from('noradocs_drive_folders')
          .select('drive_folder_id')
          .eq('tenant_company_id', tenantId)
          .eq('path', parcial)
          .maybeSingle();

        if (cachedLevel?.drive_folder_id && await folderAindaExiste(accessToken, cachedLevel.drive_folder_id)) {
          parentId = cachedLevel.drive_folder_id;
          continue;
        }

        parentId = await ensureChildFolder(accessToken, parentId, segment);

        // upsert, não insert: dois uploads simultâneos podem ter criado a
        // mesma linha entre a leitura acima e agora.
        await admin.from('noradocs_drive_folders').upsert(
          { tenant_company_id: tenantId, path: parcial, drive_folder_id: parentId },
          { onConflict: 'tenant_company_id,path' },
        );
      }

      return json({ folderId: parentId, path: pathExibido });
    }

    if (action === 'upload-token') {
      // Empresta ao navegador um access_token de curta duração (1h) para ele
      // enviar os bytes direto ao Google.
      //
      // O desenho original era outro: o servidor abria uma sessão resumable e
      // passava só a URL, sem token nenhum no navegador. Não funciona — a URL
      // de sessão é servida por um host do Google (UploadServer) que NÃO
      // responde cabeçalhos CORS, então o PUT do navegador morre em "Failed
      // to fetch". Já o endpoint de upload multipart responde CORS e aceita
      // `authorization`. Detalhe em docs/noradocs/spike-e0.md.
      //
      // O que se preserva: os bytes continuam indo direto ao Google, sem
      // passar por servidor da NoraTech. O que se cede: um token de 1h,
      // limitado a drive.file, fica na memória do navegador de um funcionário
      // já autenticado. O refresh token continua exclusivamente no servidor.
      return json({ accessToken, expiresIn: refreshed.data.expires_in ?? 3600 });
    }

    if (action === 'move-file') {
      const fileId = String(body?.fileId || '');
      const destinoId = String(body?.folderId || '');
      if (!fileId || !destinoId) return json({ error: 'fileId e folderId são obrigatórios' }, 400);

      // Mover no Drive é trocar o pai, não copiar: o arquivo mantém o mesmo
      // id, o mesmo link e o mesmo histórico. Por isso é preciso saber de
      // qual pasta ele sai — addParents sozinho deixaria o arquivo nas duas.
      const atualRes = await fetch(
        `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,parents&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!atualRes.ok) {
        const errBody = await atualRes.text().catch(() => '');
        console.error('[noradocs-drive] move: file lookup failed', atualRes.status, errBody);
        return json({ error: 'O arquivo não foi encontrado no Drive. Ele pode ter sido movido ou excluído por fora do NoraDocs.' }, 404);
      }
      const atual = await atualRes.json();
      const paisAtuais = (atual.parents || []).join(',');

      // Já está no destino: nada a fazer. Acontece quando alguém confirma
      // duas vezes, ou reconfirma sem mudar os campos.
      if ((atual.parents || []).includes(destinoId)) {
        return json({ fileId, folderId: destinoId, semMudanca: true });
      }

      const moveRes = await fetch(
        `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(destinoId)}`
        + `${paisAtuais ? `&removeParents=${encodeURIComponent(paisAtuais)}` : ''}`
        + '&fields=id,name,webViewLink&supportsAllDrives=true',
        { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!moveRes.ok) {
        const errBody = await moveRes.text().catch(() => '');
        console.error('[noradocs-drive] move failed', moveRes.status, errBody);
        return json({ error: 'Não foi possível mover o arquivo para a pasta de destino.' }, 502);
      }

      const movido = await moveRes.json();
      return json({ fileId: movido.id, folderId: destinoId, webViewLink: movido.webViewLink ?? null });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    console.error('[noradocs-drive]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
