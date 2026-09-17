import { supabase } from '../../../lib/supabase';
import { nomeDoCanal } from './sinalizacao.js';
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

/** Lê as regras atuais sem precisar de token. */
export async function lerSala(codigo) {
  const { data, error } = await supabase
    .from('nora_screen_salas')
    .select('entradas_bloqueadas, somente_host_compartilha, encerrada')
    .eq('codigo', codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return regrasDaLinha(data);
}

export async function definirRegras(codigo, token, { entradasBloqueadas, somenteHostCompartilha }) {
  const { data, error } = await supabase.rpc('nora_screen_definir_regras', {
    p_codigo: codigo,
    p_token: token,
    p_entradas_bloqueadas: entradasBloqueadas ?? null,
    p_somente_host: somenteHostCompartilha ?? null,
  });
  if (error) throw new Error(error.message);
  return regrasDaLinha(Array.isArray(data) ? data[0] : data);
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
 * Salas abertas agora.
 *
 * Só o que a listagem precisa ver: nunca o host_token_hash, que é o
 * material da credencial do host. "Ativa" é não encerrada e criada
 * dentro da janela que a varredura preserva — linha velha que ainda não
 * foi varrida não é sala viva.
 */
export async function listarSalasAtivas({ limite = 24, janelaHoras = 24 } = {}) {
  const desde = new Date(Date.now() - janelaHoras * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('nora_screen_salas')
    .select('codigo, entradas_bloqueadas, somente_host_compartilha, criada_em')
    .eq('encerrada', false)
    .gte('criada_em', desde)
    .order('criada_em', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data || []).map((linha) => ({
    codigo: linha.codigo,
    entradasBloqueadas: Boolean(linha.entradas_bloqueadas),
    somenteHostCompartilha: Boolean(linha.somente_host_compartilha),
    criadaEm: linha.criada_em,
  }));
}

/**
 * Conta quem está em cada sala, lendo a presença dos canais.
 *
 * Entra nos canais SEM `track`: a listagem observa, não participa — quem
 * está só olhando a lista não pode aparecer como participante para quem
 * está na sala.
 */
export function contarParticipantes(codigos, aoContar) {
  const canais = codigos.map((codigo) => {
    const canal = supabase.channel(nomeDoCanal(codigo), { config: { presence: { key: '' } } });
    const contar = () => aoContar(codigo, Object.keys(canal.presenceState()).length);
    canal
      .on('presence', { event: 'sync' }, contar)
      .on('presence', { event: 'join' }, contar)
      .on('presence', { event: 'leave' }, contar)
      .subscribe();
    return canal;
  });
  return () => canais.forEach((canal) => supabase.removeChannel(canal));
}
