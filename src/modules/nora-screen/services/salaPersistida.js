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
