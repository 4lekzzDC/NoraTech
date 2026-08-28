// Propostas comerciais — admin monta, envia um link público
// (`linkPublico`/`/proposta/:token`), o cliente aceita ou recusa sem login.
//
// Toda escrita que muda o CICLO DE VIDA da proposta (criar/editar/bifurcar
// versão, enviar, decidir manualmente, aceitar/recusar pelo link) passa por
// RPC — a lógica de versionamento e a criação/atualização da assinatura
// aprovada moram no banco (migration_20260828_proposals.sql), não aqui.
// Leitura simples (listar, buscar) usa select direto, protegido por RLS
// admin-only.

import { supabase } from './supabase';

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

export const PROPOSAL_STATUS_LABEL = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

// ── Admin: listar/ler ────────────────────────────────────────────────────

/**
 * Uma linha por PROPOSTA (não por versão) — só a ponta atual de cada
 * linhagem (`superseded_by is null`). O histórico de versões fica na aba
 * "Histórico" do editor, não polui a lista.
 */
export async function listarPropostas() {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, status, valid_until, total, version, public_token, sent_at, decided_at, created_at, company_id, companies(name)')
    .is('superseded_by', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(translate(error));
  return data || [];
}

/** Nomes dos sistemas de várias propostas de uma vez, pra coluna "Sistemas" da tabela. */
export async function listarItensDeVariasPropostas(proposalIds) {
  if (!proposalIds?.length) return {};
  const { data, error } = await supabase
    .from('proposal_items')
    .select('proposal_id, name')
    .in('proposal_id', proposalIds)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(translate(error));
  const porProposta = {};
  (data || []).forEach((it) => {
    (porProposta[it.proposal_id] = porProposta[it.proposal_id] || []).push(it.name);
  });
  return porProposta;
}

export async function buscarProposta(id) {
  const { data, error } = await supabase
    .from('proposals')
    .select('*, companies(id, name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(translate(error));
  return data;
}

export async function listarItens(proposalId) {
  const { data, error } = await supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(translate(error));
  return data || [];
}

export async function listarEventos(proposalId) {
  const { data, error } = await supabase
    .from('proposal_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(translate(error));
  return data || [];
}

/** Toda a linhagem de versões (mais recente primeiro), pra aba Histórico mostrar "v2 substituiu v1". */
export async function listarVersoes(rootProposalId) {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, version, status, title, total, created_at, superseded_by')
    .or(`id.eq.${rootProposalId},root_proposal_id.eq.${rootProposalId}`)
    .order('version', { ascending: false });
  if (error) throw new Error(translate(error));
  return data || [];
}

// ── Admin: escrever (via RPC — versionamento e cálculo ficam no banco) ──

/**
 * Cria, atualiza (se ainda em rascunho) ou bifurca uma nova versão (se já
 * enviada) — o banco decide qual dos três com base no status atual.
 * `payload.items`: [{ systemSlug, name, description, unitAmount, amount }]
 */
export async function salvarProposta(payload) {
  const { data, error } = await supabase.rpc('admin_save_proposal', {
    p_id: payload.id || null,
    p_company_id: payload.companyId,
    p_title: payload.title,
    p_valid_until: payload.validUntil || null,
    p_discount_type: payload.discountType || null,
    p_discount_value: Number(payload.discountValue) || 0,
    p_setup_fee: Number(payload.setupFee) || 0,
    p_notes: payload.notes || null,
    p_items: (payload.items || []).map((it, i) => ({
      system_slug: it.systemSlug,
      name: it.name,
      description: it.description || null,
      unit_amount: Number(it.unitAmount) || 0,
      amount: Number(it.amount) || 0,
      sort_order: i,
    })),
  });
  if (error) throw new Error(translate(error));
  return data;
}

export async function enviarProposta(id) {
  const { data, error } = await supabase.rpc('admin_send_proposal', { p_id: id });
  if (error) throw new Error(translate(error));
  return data;
}

/** Decisão manual do admin (negociação fechada fora do link) — só aceita/recusada. */
export async function definirStatusProposta(id, status, notes) {
  const { data, error } = await supabase.rpc('admin_set_proposal_status', {
    p_id: id, p_status: status, p_notes: notes || null,
  });
  if (error) throw new Error(translate(error));
  return data;
}

/** Só faz sentido pra rascunho — a UI gate isso; enviada pra frente vira histórico, não se apaga. */
export async function excluirProposta(id) {
  const { error } = await supabase.from('proposals').delete().eq('id', id);
  if (error) throw new Error(translate(error));
}

export function linkPublico(publicToken) {
  return `${window.location.origin}/proposta/${publicToken}`;
}

// ── Página pública (sem sessão — token é a única chave) ──────────────────

export async function buscarPropostaPorToken(token) {
  const { data, error } = await supabase.rpc('get_proposal_by_token', { p_token: token });
  if (error) throw new Error(translate(error));
  return data;
}

export async function aceitarPropostaPorToken(token) {
  const { error } = await supabase.rpc('accept_proposal_by_token', { p_token: token });
  if (error) throw new Error(translate(error));
}

export async function recusarPropostaPorToken(token, reason) {
  const { error } = await supabase.rpc('reject_proposal_by_token', { p_token: token, p_reason: reason || null });
  if (error) throw new Error(translate(error));
}
