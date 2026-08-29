// Dublê do serviço de propostas — store em memória, sem banco. Espelha a
// mesma lógica de versionamento/status que as RPCs implementam no Postgres
// (migration_20260828_proposals.sql: admin_save_proposal, admin_send_proposal,
// admin_set_proposal_status, get_proposal_by_token, accept/reject_proposal_by_token)
// — só que em JS, pra exercitar o fluxo inteiro (criar → enviar →
// visualizar → aceitar, e o fork de versão ao editar uma proposta já
// enviada) sem precisar de sessão real. Usa a MESMA função pura de cálculo
// que a produção usa (`calcularTotais`), não uma reimplementação.

import { calcularTotais } from '../src/lib/proposalCalc.js';
import { COMPANIES, SISTEMAS } from './supabase.js';

let seq = 0;
const proximoId = () => `prop-${++seq}`;

const companyById = new Map(COMPANIES.map((c) => [c.id, c]));
const systemBySlug = new Map(SISTEMAS.map((s) => [s.slug, s]));
const EMAIL_POR_OWNER = { u1: 'contato@studiofenix.com.br' }; // espelha auth.users.email — só pro dublê de admin_company_contact_email

const proposals = [];
const items = []; // { id, proposal_id, system_slug, name, description, unit_amount, amount, sort_order }
const events = []; // { id, proposal_id, event_type, actor_id, status_before, status_after, notes, created_at }

export const PROPOSAL_STATUS_LABEL = {
  rascunho: 'Rascunho', enviada: 'Enviada', visualizada: 'Visualizada',
  aceita: 'Aceita', recusada: 'Recusada', expirada: 'Expirada',
};

function registrarEvento(proposalId, eventType, { statusBefore = null, statusAfter = null, notes = null, actorId = 'admin-preview' } = {}) {
  events.push({
    id: proximoId(), proposal_id: proposalId, event_type: eventType, actor_id: actorId,
    status_before: statusBefore, status_after: statusAfter, notes, created_at: new Date().toISOString(),
  });
}

function comEmpresa(p) {
  return { ...p, companies: companyById.get(p.company_id) ? { id: p.company_id, name: companyById.get(p.company_id).name } : null };
}

// ── Seed: uma proposta enviada, já visualizada, pronta pra testar aceite
//    e o fork de versão sem precisar montar tudo do zero na preview. ──────
(function seed() {
  const p = {
    id: proximoId(), company_id: COMPANIES[0].id, title: 'Proposta NoraHub + NoraChat',
    status: 'visualizada', valid_until: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    discount_type: 'percent', discount_value: 10, setup_fee: 200,
    notes: 'Implantação em até 10 dias úteis após a assinatura. Suporte incluso no primeiro mês.',
    subtotal: 0, discount_amount: 0, total: 0,
    public_token: 'seed-token-0001', version: 1,
    parent_proposal_id: null, root_proposal_id: null, superseded_by: null,
    sent_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    first_viewed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    decided_at: null, created_by: 'admin-preview',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(), updated_at: new Date().toISOString(),
  };
  const itens = [
    { system_slug: 'solucoes-contabeis', name: 'NoraHub', description: 'Suíte completa para escritórios contábeis.', unit_amount: 499.9, amount: 450 },
    { system_slug: 'whatsapp-bot', name: 'NoraChat', description: 'Atendimento automatizado com transferência para humanos.', unit_amount: 299, amount: 299 },
  ];
  const { subtotal, discountAmount, total } = calcularTotais({ items: itens, discountType: p.discount_type, discountValue: p.discount_value, setupFee: p.setup_fee });
  p.subtotal = subtotal; p.discount_amount = discountAmount; p.total = total;
  proposals.push(p);
  itens.forEach((it, i) => items.push({ id: proximoId(), proposal_id: p.id, sort_order: i, ...it }));
  registrarEvento(p.id, 'criada', { statusAfter: 'rascunho' });
  registrarEvento(p.id, 'enviada', { statusBefore: 'rascunho', statusAfter: 'enviada' });
  registrarEvento(p.id, 'visualizada', { statusBefore: 'enviada', statusAfter: 'visualizada', actorId: null });
}());

// ── Admin: ler ────────────────────────────────────────────────────────

export async function listarPropostas() {
  return proposals.filter((p) => !p.superseded_by).map(comEmpresa)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function listarItensDeVariasPropostas(proposalIds) {
  const porProposta = {};
  items
    .filter((it) => proposalIds.includes(it.proposal_id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((it) => { (porProposta[it.proposal_id] = porProposta[it.proposal_id] || []).push(it.name); });
  return porProposta;
}

export async function buscarProposta(id) {
  const p = proposals.find((x) => x.id === id);
  return p ? comEmpresa(p) : null;
}

export async function listarItens(proposalId) {
  return items.filter((it) => it.proposal_id === proposalId).sort((a, b) => a.sort_order - b.sort_order);
}

export async function listarEventos(proposalId) {
  return events.filter((e) => e.proposal_id === proposalId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function listarVersoes(rootProposalId) {
  return proposals
    .filter((p) => p.id === rootProposalId || p.root_proposal_id === rootProposalId)
    .sort((a, b) => b.version - a.version);
}

// ── Admin: escrever ──────────────────────────────────────────────────

export async function salvarProposta(payload) {
  const itensPayload = (payload.items || []).map((it, i) => ({
    system_slug: it.systemSlug, name: it.name, description: it.description || null,
    unit_amount: Number(it.unitAmount) || 0, amount: Number(it.amount) || 0, sort_order: i,
  }));
  if (!payload.title || payload.title.trim().length < 2) throw new Error('Título muito curto');
  if (!payload.companyId) throw new Error('Selecione uma empresa');
  if (!itensPayload.length) throw new Error('Inclua pelo menos um sistema na proposta');

  const { subtotal, discountAmount, total } = calcularTotais({
    items: itensPayload, discountType: payload.discountType || null, discountValue: payload.discountValue, setupFee: payload.setupFee,
  });

  const existente = payload.id ? proposals.find((p) => p.id === payload.id) : null;
  if (payload.id && !existente) throw new Error('Proposta não encontrada');

  let alvo;
  if (!existente) {
    alvo = {
      id: proximoId(), company_id: payload.companyId, title: payload.title.trim(), status: 'rascunho',
      valid_until: payload.validUntil || null, discount_type: payload.discountType || null,
      discount_value: Number(payload.discountValue) || 0, setup_fee: Number(payload.setupFee) || 0,
      notes: payload.notes || null, subtotal, discount_amount: discountAmount, total,
      public_token: proximoId(), version: 1, parent_proposal_id: null, root_proposal_id: null, superseded_by: null,
      sent_at: null, first_viewed_at: null, decided_at: null, created_by: 'admin-preview',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    proposals.push(alvo);
    registrarEvento(alvo.id, 'criada', { statusAfter: 'rascunho' });
  } else if (existente.status === 'rascunho') {
    Object.assign(existente, {
      company_id: payload.companyId, title: payload.title.trim(), valid_until: payload.validUntil || null,
      discount_type: payload.discountType || null, discount_value: Number(payload.discountValue) || 0,
      setup_fee: Number(payload.setupFee) || 0, notes: payload.notes || null,
      subtotal, discount_amount: discountAmount, total, updated_at: new Date().toISOString(),
    });
    alvo = existente;
    registrarEvento(alvo.id, 'editada', { statusBefore: 'rascunho', statusAfter: 'rascunho' });
  } else {
    const statusAntes = existente.status;
    const tokenHerdado = existente.public_token; // captura ANTES de liberar — mesma ordem da RPC
    existente.public_token = null;
    alvo = {
      id: proximoId(), company_id: payload.companyId, title: payload.title.trim(), status: 'rascunho',
      valid_until: payload.validUntil || null, discount_type: payload.discountType || null,
      discount_value: Number(payload.discountValue) || 0, setup_fee: Number(payload.setupFee) || 0,
      notes: payload.notes || null, subtotal, discount_amount: discountAmount, total,
      public_token: tokenHerdado, version: existente.version + 1,
      parent_proposal_id: existente.id, root_proposal_id: existente.root_proposal_id || existente.id, superseded_by: null,
      sent_at: null, first_viewed_at: null, decided_at: null, created_by: 'admin-preview',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    proposals.push(alvo);
    existente.superseded_by = alvo.id;
    registrarEvento(alvo.id, 'nova_versao', {
      statusBefore: statusAntes, statusAfter: 'rascunho',
      notes: `Nova versão (v${alvo.version}) a partir da proposta anterior, que estava "${statusAntes}".`,
    });
  }

  items.filter((it) => it.proposal_id === alvo.id).forEach((it) => { it._remover = true; });
  for (let i = items.length - 1; i >= 0; i -= 1) if (items[i]._remover) items.splice(i, 1);
  itensPayload.forEach((it) => items.push({ id: proximoId(), proposal_id: alvo.id, ...it }));

  return comEmpresa(alvo);
}

export async function enviarProposta(id, email) {
  const p = proposals.find((x) => x.id === id);
  if (!p) throw new Error('Proposta não encontrada');
  const isResend = p.status !== 'rascunho';
  const empresa = companyById.get(p.company_id);
  const destinatario = email || EMAIL_POR_OWNER[empresa?.owner_id] || 'contato@empresa.com.br';

  if (!isResend) {
    p.status = 'enviada';
    p.sent_at = new Date().toISOString();
    registrarEvento(id, 'enviada', { statusBefore: 'rascunho', statusAfter: 'enviada', notes: `Enviado para ${destinatario}` });
  } else {
    registrarEvento(id, 'reenviada', { statusBefore: p.status, statusAfter: p.status, notes: `Reenviado para ${destinatario}` });
  }
  return comEmpresa(p);
}

/** Dublê de admin_company_contact_email — pode voltar null, igual à RPC real. */
export async function buscarEmailContatoEmpresa(companyId) {
  const empresa = companyById.get(companyId);
  return EMAIL_POR_OWNER[empresa?.owner_id] || null;
}

function aplicarAceitacao() {
  // No dublê não existe tabela `subscriptions` pra atualizar de verdade —
  // o importante aqui é exercitar o CAMINHO (status muda, evento é
  // registrado), não persistir uma assinatura que a preview não lê de volta.
}

export async function definirStatusProposta(id, status, notes) {
  if (!['aceita', 'recusada'].includes(status)) throw new Error('Status inválido para decisão manual');
  const p = proposals.find((x) => x.id === id);
  if (!p) throw new Error('Proposta não encontrada');
  if (!['enviada', 'visualizada'].includes(p.status)) throw new Error('Só é possível decidir manualmente uma proposta enviada ou visualizada');
  const antes = p.status;
  p.status = status;
  p.decided_at = new Date().toISOString();
  registrarEvento(id, status, { statusBefore: antes, statusAfter: status, notes: notes || null });
  if (status === 'aceita') aplicarAceitacao(p);
  return comEmpresa(p);
}

export async function excluirProposta(id) {
  const idx = proposals.findIndex((p) => p.id === id);
  if (idx >= 0) proposals.splice(idx, 1);
  for (let i = items.length - 1; i >= 0; i -= 1) if (items[i].proposal_id === id) items.splice(i, 1);
  for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].proposal_id === id) events.splice(i, 1);
}

export function linkPublico(publicToken) {
  return `${window.location.origin}/proposta/${publicToken}`;
}

// ── Página pública ────────────────────────────────────────────────────

export async function buscarPropostaPorToken(token) {
  const p = proposals.find((x) => x.public_token === token);
  if (!p || p.status === 'rascunho') return null;

  if (p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10) && ['enviada', 'visualizada'].includes(p.status)) {
    const antes = p.status;
    p.status = 'expirada';
    registrarEvento(p.id, 'expirada', { statusBefore: antes, statusAfter: 'expirada', actorId: null });
  }

  if (p.status === 'enviada') {
    p.status = 'visualizada';
    p.first_viewed_at = p.first_viewed_at || new Date().toISOString();
    registrarEvento(p.id, 'visualizada', { statusBefore: 'enviada', statusAfter: 'visualizada', actorId: null });
  }

  const empresa = companyById.get(p.company_id);
  const itensDaProposta = items
    .filter((it) => it.proposal_id === p.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => {
      const sistema = systemBySlug.get(it.system_slug);
      return { system_slug: it.system_slug, name: it.name, description: it.description, amount: it.amount, icon: sistema?.icon || null, color: sistema?.color || null };
    });

  return {
    id: p.id, title: p.title, status: p.status, valid_until: p.valid_until,
    subtotal: p.subtotal, discount_type: p.discount_type, discount_value: p.discount_value, discount_amount: p.discount_amount,
    setup_fee: p.setup_fee, total: p.total, notes: p.notes, version: p.version,
    sent_at: p.sent_at, decided_at: p.decided_at,
    company: empresa ? { id: empresa.id, name: empresa.name } : null,
    items: itensDaProposta,
  };
}

export async function aceitarPropostaPorToken(token) {
  const p = proposals.find((x) => x.public_token === token);
  if (!p) throw new Error('Proposta não encontrada');
  if (p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10) && ['enviada', 'visualizada'].includes(p.status)) {
    p.status = 'expirada';
    registrarEvento(p.id, 'expirada', { statusAfter: 'expirada', actorId: null });
    throw new Error('Esta proposta expirou');
  }
  if (!['enviada', 'visualizada'].includes(p.status)) throw new Error('Esta proposta não pode mais ser aceita');
  const antes = p.status;
  p.status = 'aceita';
  p.decided_at = new Date().toISOString();
  registrarEvento(p.id, 'aceita', { statusBefore: antes, statusAfter: 'aceita', actorId: null });
  aplicarAceitacao(p);
}

export async function recusarPropostaPorToken(token, reason) {
  const p = proposals.find((x) => x.public_token === token);
  if (!p) throw new Error('Proposta não encontrada');
  if (!['enviada', 'visualizada'].includes(p.status)) throw new Error('Esta proposta não pode mais ser recusada');
  const antes = p.status;
  p.status = 'recusada';
  p.decided_at = new Date().toISOString();
  registrarEvento(p.id, 'recusada', { statusBefore: antes, statusAfter: 'recusada', actorId: null, notes: reason || null });
}
