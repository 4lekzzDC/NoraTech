import { supabase } from '../../../lib/supabase';
import { regrasDaLinha } from '../domain/regrasDaSala.js';

// ═══════════════════════════════════════════════════════════════
// Estado autoritativo da sala — tabela nora_screen_salas.
//
// As regras gerais (entradas bloqueadas, só o host compartilha, sala
// encerrada) não moram no navegador: moram aqui, e chegam a todos por
// postgres_changes. Escrever exige o token do host, que só quem abriu a
// sala tem — a anon key sozinha não muda nada (ver a migração
// supabase/migration_20260917_nora_screen_salas.sql).
// ═══════════════════════════════════════════════════════════════

const CHAVE_TOKEN = 'nora-screen:host-token';

function novoToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

// O token fica no sessionStorage: sobrevive a um F5 (recarregar não pode
// custar o comando da sala) e morre com a aba, que é o tempo da sala.
export function tokenDoHost(codigo, { criarSeFaltar = false } = {}) {
  const chave = `${CHAVE_TOKEN}:${codigo}`;
  try {
    const guardado = sessionStorage.getItem(chave);
    if (guardado) return guardado;
    if (!criarSeFaltar) return null;
    const novo = novoToken();
    sessionStorage.setItem(chave, novo);
    return novo;
  } catch {
    // Navegador sem sessionStorage (modo restrito): a sala funciona, só
    // não sobrevive a um recarregamento como host.
    return criarSeFaltar ? novoToken() : null;
  }
}

/** Abre a sala (ou lê a existente, sem tocar nela). */
export async function abrirSala(codigo, token) {
  const { data, error } = await supabase.rpc('nora_screen_abrir_sala', {
    p_codigo: codigo,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return regrasDaLinha(Array.isArray(data) ? data[0] : data);
}

/**
 * Pede ao servidor autorização para entrar na sala.
 *
 * É esta chamada — não a leitura da tabela — que decide a entrada. O
 * banco confere se a sala existe, se não foi encerrada e se as entradas
 * não estão bloqueadas, e só então autoriza. O token vai junto quando
 * existe para o host atravessar o próprio bloqueio.
 *
 * Erro aqui é recusa, nunca liberação: quem chama trata a exceção como
 * "não entra", e não como "entra com as regras padrão".
 */
export async function autorizarEntrada(codigo, token = null, participanteId = null) {
  const { data, error } = await supabase.rpc('nora_screen_entrar_na_sala', {
    p_codigo: codigo,
    p_token: token,
    p_participante_id: participanteId,
  });
  if (error) throw new Error(error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) throw new Error('A sala não respondeu sobre a entrada.');
  return linha;
}

/** Lê as regras atuais sem precisar de token. */
export async function lerSala(codigo) {
  const { data, error } = await supabase
    .from('nora_screen_salas')
    .select('entradas_bloqueadas, somente_host_compartilha, encerrada, max_participantes, admins, dono_id')
    .eq('codigo', codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return regrasDaLinha(data);
}

export async function definirRegras(codigo, token, {
  entradasBloqueadas,
  somenteHostCompartilha,
  maxParticipantes,
} = {}) {
  // `null` em maxParticipantes é "não mexe"; tirar o limite precisa de
  // bandeira própria, senão não haveria como voltar a "sem limite".
  const limparMax = maxParticipantes === null;
  const { data, error } = await supabase.rpc('nora_screen_definir_regras', {
    p_codigo: codigo,
    p_token: token,
    p_entradas_bloqueadas: entradasBloqueadas ?? null,
    p_somente_host: somenteHostCompartilha ?? null,
    p_max_participantes: typeof maxParticipantes === 'number' ? maxParticipantes : null,
    p_limpar_max: limparMax,
  });
  if (error) throw new Error(error.message);
  return regrasDaLinha(Array.isArray(data) ? data[0] : data);
}

/** Promove ou rebaixa um admin. Só o dono, e o banco confere o token. */
export async function definirAdmin(codigo, token, participanteId, admin) {
  const { data, error } = await supabase.rpc('nora_screen_definir_admin', {
    p_codigo: codigo,
    p_token: token,
    p_participante_id: participanteId,
    p_admin: Boolean(admin),
  });
  if (error) throw new Error(error.message);
  return regrasDaLinha(Array.isArray(data) ? data[0] : data);
}

/**
 * Renova a vaga na sala.
 *
 * A contagem do limite mora no Postgres, que não sabe quem continua no
 * canal do Realtime. Sem esta batida, uma aba fechada no meio seguraria
 * a vaga até a linha caducar; com ela, quem está de fato presente se
 * mantém e o resto caduca sozinho.
 */
export async function baterPonto(codigo, participanteId) {
  const { error } = await supabase.rpc('nora_screen_bater_ponto', {
    p_codigo: codigo,
    p_participante_id: participanteId,
  });
  if (error) throw new Error(error.message);
}

/** Larga a vaga ao sair, sem esperar a presença caducar. */
export async function largarVaga(codigo, participanteId, token = null) {
  const { error } = await supabase.rpc('nora_screen_sair_da_sala', {
    p_codigo: codigo,
    p_participante_id: participanteId,
    p_token: token,
  });
  if (error) throw new Error(error.message);
}

export async function encerrarSala(codigo, token) {
  const { data, error } = await supabase.rpc('nora_screen_encerrar_sala', {
    p_codigo: codigo,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return regrasDaLinha(Array.isArray(data) ? data[0] : data);
}

/** Acompanha as mudanças da linha desta sala em tempo real. */
export function assinarRegras(codigo, aoMudar) {
  const canal = supabase
    .channel(`nora-screen-regras:${codigo}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'nora_screen_salas', filter: `codigo=eq.${codigo}` },
      (payload) => aoMudar(regrasDaLinha(payload.new)),
    )
    .subscribe();
  return () => supabase.removeChannel(canal);
}

/**
 * Salas abertas agora, já com quanta gente tem em cada uma.
 *
 * A contagem vem do banco, e não de entrar nos canais do Realtime para
 * espiar a presença: aquilo era lento, às vezes não respondia (e a
 * listagem ficava em "contando…") e mostrava salas que já não tinham
 * ninguém. A RPC também varre as vazias antes de responder.
 *
 * Nunca devolve o host_token_hash — é o material da credencial do dono.
 */
export async function listarSalasAtivas({ limite = 24 } = {}) {
  const { data, error } = await supabase.rpc('nora_screen_salas_ativas', { p_limite: limite });
  if (error) throw new Error(error.message);
  return (data || []).map((linha) => ({
    codigo: linha.codigo,
    entradasBloqueadas: Boolean(linha.entradas_bloqueadas),
    somenteHostCompartilha: Boolean(linha.somente_host_compartilha),
    maxParticipantes: linha.max_participantes || null,
    participantes: Number(linha.participantes) || 0,
    criadaEm: linha.criada_em,
  }));
}
