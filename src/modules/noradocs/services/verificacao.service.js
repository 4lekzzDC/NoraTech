import { supabase } from '../../../lib/supabase';
import { promoverCaminho } from '../domain/promocao';
import { confirmarDocumento } from './review.service';

// A fila de empresas detectadas que ainda não são clientes.
//
// Um cliente provisório nasce da entrada por e-mail quando o remetente aponta
// para uma empresa que ninguém cadastrou. Ele vive sob a raiz _verificação e
// tem duas saídas, só duas:
//
//   confirmar  é mesmo um cliente novo → vira confirmado e a PASTA INTEIRA
//              muda de lugar, de _verificação para a árvore real
//   fundir     é um cliente que já existe com outro nome → os documentos
//              passam para ele, arquivo por arquivo, e o provisório some
//
// Confirmar move uma pasta; fundir move arquivos. A diferença não é capricho:
// ao confirmar, a árvore por baixo já está na forma final (foi montada com o
// mesmo template), então mover o topo leva tudo de uma vez. Ao fundir, o nome
// do cliente muda — e o nome do cliente é o primeiro segmento do caminho —,
// então cada arquivo precisa de um destino recalculado.

const PREFIXO_VERIFICACAO = '_verificação/';
const CHAVE_CACHE = 'verificacao:';

async function invocarDrive(body) {
  const { data, error } = await supabase.functions.invoke('noradocs-drive', { body });
  if (error) {
    let mensagem = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const corpo = await error.context.json();
        if (corpo?.error) mensagem = corpo.error;
      } catch { /* corpo não era JSON */ }
    }
    throw new Error(mensagem);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// `%` e `_` são curingas em ILIKE. Nome de empresa raramente os tem, mas um
// que tivesse produziria uma colisão falsa — e a mensagem resultante mandaria
// o contador fundir com um cliente que não existe.
function escaparLike(valor) {
  return String(valor ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listarProvisorios(tenantId) {
  const { data: provisorios, error } = await supabase
    .from('noradocs_clients')
    .select('id, nome, origem_deteccao, created_at')
    .eq('tenant_company_id', tenantId)
    .eq('status', 'provisorio')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!provisorios?.length) return [];

  // Duas consultas em vez de uma contagem embutida: a forma agregada do
  // PostgREST depende de detalhes de relacionamento que mudam sem aviso, e
  // são poucas linhas para contar aqui.
  const { data: docs } = await supabase
    .from('noradocs_documents')
    .select('client_id')
    .eq('tenant_company_id', tenantId)
    .in('client_id', provisorios.map((c) => c.id));

  const porCliente = new Map();
  for (const d of docs || []) {
    porCliente.set(d.client_id, (porCliente.get(d.client_id) || 0) + 1);
  }

  return provisorios.map((c) => ({ ...c, documentos: porCliente.get(c.id) || 0 }));
}

// Descobre a pasta do provisório no Drive pelo cache de caminhos. Pode não
// existir: um provisório cujos documentos todos caíram em triagem nunca teve
// pasta criada, e confirmar continua fazendo sentido.
async function pastaDoProvisorio(tenantId, nome) {
  const { data } = await supabase
    .from('noradocs_drive_folders')
    .select('drive_folder_id')
    .eq('tenant_company_id', tenantId)
    .eq('path', `${CHAVE_CACHE}${nome}`)
    .maybeSingle();
  return data?.drive_folder_id || null;
}

/**
 * Promove um cliente provisório a confirmado e traz a pasta dele para a
 * árvore real.
 *
 * @param {object} args { tenantId, cliente, dados: {nome, cnpj, ...} }
 */
export async function confirmarProvisorio({ tenantId, cliente, dados }) {
  const nomeFinal = String(dados?.nome || cliente.nome).trim();
  if (!nomeFinal) throw new Error('Informe o nome do cliente.');

  // Colisão de nome é o único jeito de este movimento estragar o Drive: o
  // Google aceita duas pastas irmãs com o mesmo nome sem reclamar, e o
  // escritório ficaria com duas "Padaria Aurora" lado a lado, sem saber qual
  // é qual. Quando o nome já existe, o que o contador quer é fundir.
  const { data: colisao } = await supabase
    .from('noradocs_clients')
    .select('id, nome')
    .eq('tenant_company_id', tenantId)
    .eq('status', 'confirmado')
    .ilike('nome', escaparLike(nomeFinal))
    .maybeSingle();
  if (colisao) {
    throw new Error(
      `Já existe um cliente chamado "${colisao.nome}". `
      + 'Para juntar os documentos, use Fundir em vez de Confirmar.'
    );
  }

  const { data: settings } = await supabase
    .from('noradocs_settings')
    .select('drive_root_folder_id')
    .eq('tenant_company_id', tenantId)
    .maybeSingle();
  if (!settings?.drive_root_folder_id) {
    throw new Error('O escritório ainda não escolheu a pasta raiz no Google Drive.');
  }

  // 1) A pasta muda de lugar ANTES do banco. Se o Drive recusar, nada foi
  // prometido: o provisório continua provisório e dá para tentar de novo.
  // Na ordem inversa, o cliente viraria confirmado com a pasta ainda em
  // _verificação — e o caminho gravado passaria a mentir.
  const folderId = await pastaDoProvisorio(tenantId, cliente.nome);
  if (folderId) {
    await invocarDrive({
      action: 'move-file',
      fileId: folderId,
      folderId: settings.drive_root_folder_id,
    });
  }

  // 2) O cliente vira confirmado, com o que o contador preencheu.
  const { error: erroCliente } = await supabase
    .from('noradocs_clients')
    .update({ ...dados, nome: nomeFinal, status: 'confirmado' })
    .eq('id', cliente.id);
  if (erroCliente) throw new Error(erroCliente.message);

  // 3) O cache de pastas e os caminhos gravados perdem o prefixo. Sem isto,
  // o próximo documento deste cliente procuraria a pasta por uma chave que
  // não existe mais e criaria uma segunda árvore.
  await reescreverCaminhos(tenantId, cliente.nome, nomeFinal);

  // 4) Os documentos que só estavam em revisão POR SEREM de um provisório
  // não têm mais motivo de estar. Os que têm campo faltando continuam.
  const promovidos = await revisarDocumentosDoCliente(tenantId, cliente.id);

  await registrarEventos(tenantId, cliente.id, 'confirmado', {
    nome: nomeFinal, pasta_movida: Boolean(folderId), documentos_organizados: promovidos,
  });

  return { promovidos, pastaMovida: Boolean(folderId) };
}

// Tira o prefixo de verificação das chaves de cache e dos caminhos exibidos,
// e troca o nome se o contador corrigiu a grafia ao confirmar.
async function reescreverCaminhos(tenantId, nomeAntigo, nomeNovo) {
  const { data: pastas } = await supabase
    .from('noradocs_drive_folders')
    .select('id, path')
    .eq('tenant_company_id', tenantId)
    .like('path', `${CHAVE_CACHE}${escaparLike(nomeAntigo)}%`);

  for (const pasta of pastas || []) {
    const novo = promoverCaminho(pasta.path, CHAVE_CACHE, nomeAntigo, nomeNovo);
    if (novo) await supabase.from('noradocs_drive_folders').update({ path: novo }).eq('id', pasta.id);
  }

  const { data: docs } = await supabase
    .from('noradocs_documents')
    .select('id, drive_path')
    .eq('tenant_company_id', tenantId)
    .like('drive_path', `${PREFIXO_VERIFICACAO}${escaparLike(nomeAntigo)}%`);

  for (const doc of docs || []) {
    const novo = promoverCaminho(doc.drive_path, PREFIXO_VERIFICACAO, nomeAntigo, nomeNovo);
    if (novo) await supabase.from('noradocs_documents').update({ drive_path: novo }).eq('id', doc.id);
  }
}

// Reavalia os documentos de um cliente recém-confirmado. Devolve quantos
// passaram a 'organizado'.
async function revisarDocumentosDoCliente(tenantId, clientId) {
  const { data: docs } = await supabase
    .from('noradocs_documents')
    .select('id, competencia, category_id, drive_file_id, status')
    .eq('tenant_company_id', tenantId)
    .eq('client_id', clientId)
    .eq('status', 'revisar');

  let promovidos = 0;
  for (const doc of docs || []) {
    const completo = Boolean(doc.competencia && doc.category_id && doc.drive_file_id);
    if (completo) {
      await supabase.from('noradocs_documents').update({
        status: 'organizado',
        review_reason: null,
        organized_at: new Date().toISOString(),
      }).eq('id', doc.id);
      promovidos += 1;
    } else {
      // O motivo antigo ("empresa ainda não é cliente") virou mentira no
      // instante em que ela virou cliente. Trocar por um motivo verdadeiro é
      // o mínimo: senão o contador procura um problema que não existe mais.
      const faltando = [
        !doc.competencia && 'competência',
        !doc.category_id && 'categoria',
        !doc.drive_file_id && 'o arquivo no Drive',
      ].filter(Boolean);
      await supabase.from('noradocs_documents').update({
        review_reason: `Falta ${faltando.join(' e ')} para arquivar.`,
      }).eq('id', doc.id);
    }
  }
  return promovidos;
}

async function registrarEventos(tenantId, clientId, tipo, payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: docs } = await supabase
    .from('noradocs_documents')
    .select('id')
    .eq('tenant_company_id', tenantId)
    .eq('client_id', clientId);

  // A trilha é por documento, não por cliente — é onde o contador vai
  // procurar quando perguntar "por que este arquivo mudou de pasta?".
  const linhas = (docs || []).map((d) => ({
    tenant_company_id: tenantId,
    document_id: d.id,
    type: tipo === 'confirmado' ? 'confirmado' : 'reprocessado',
    actor_type: 'user',
    actor_id: user?.id ?? null,
    payload: { motivo: `cliente ${tipo}`, ...payload },
  }));
  if (linhas.length) await supabase.from('noradocs_events').insert(linhas);
}

/**
 * Funde um provisório em um cliente que já existe. Cada documento é
 * rearquivado na árvore do cliente de destino.
 *
 * @param {object} args { tenantId, provisorio, alvoId, settings, clients, categories }
 */
export async function fundirProvisorio({ tenantId, provisorio, alvoId, settings, clients, categories }) {
  const alvo = clients.find((c) => c.id === alvoId);
  if (!alvo) throw new Error('Escolha o cliente com o qual fundir.');

  const { data: docs } = await supabase
    .from('noradocs_documents')
    .select('*')
    .eq('tenant_company_id', tenantId)
    .eq('client_id', provisorio.id);

  const contexto = { tenantId, settings, clients, categories };
  let movidos = 0;
  const pendentes = [];

  for (const doc of docs || []) {
    const completo = Boolean(doc.competencia && doc.category_id && doc.drive_file_id);
    if (completo) {
      // Reaproveita a confirmação normal: ela recalcula o caminho com o nome
      // do cliente de destino e troca o pai do arquivo no Drive.
      await confirmarDocumento(
        doc,
        { clientId: alvoId, competencia: doc.competencia, categoryId: doc.category_id },
        contexto,
      );
      movidos += 1;
    } else {
      // Incompleto não tem destino a calcular. Passa a apontar para o cliente
      // certo e continua na fila — o arquivo fica onde está até alguém
      // completar os campos, e o painel de revisão então o move.
      await supabase.from('noradocs_documents').update({
        client_id: alvoId,
        review_reason: 'Preencha competência e categoria para arquivar.',
      }).eq('id', doc.id);
      pendentes.push(doc.file_name);
    }
  }

  // O provisório sai do caminho. A pasta dele no Drive continua lá, vazia:
  // apagar pasta é destrutivo e o escritório pode ter posto algo nela à mão.
  const { error } = await supabase
    .from('noradocs_clients')
    .delete()
    .eq('id', provisorio.id);
  if (error) throw new Error(error.message);

  await supabase
    .from('noradocs_drive_folders')
    .delete()
    .eq('tenant_company_id', tenantId)
    .like('path', `${CHAVE_CACHE}${escaparLike(provisorio.nome)}%`);

  return { movidos, pendentes };
}
