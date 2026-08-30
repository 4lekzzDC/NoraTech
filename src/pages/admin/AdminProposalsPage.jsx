// Lista de propostas comerciais — cliente, valor, sistemas, status,
// validade e ações. Cada linha é a ponta atual de uma linhagem de versões
// (listarPropostas já filtra as substituídas) — editar aqui abre
// AdminProposalEditorPage.jsx, uma tela cheia (não modal: o formulário tem
// empresa + tabela de sistemas + preços + desconto + histórico, o mesmo
// motivo que fez AdminSystemEditorPage virar tela própria).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { formatBRL, formatDate } from '../../lib/admin';
import {
  listarPropostas, listarItensDeVariasPropostas, excluirProposta, linkPublico,
} from '../../lib/proposals';

// "abertas" = as etapas antes da decisão. Não é um status do banco: é o
// atalho que a Visão geral usa ao mandar o admin pra cá pelo KPI
// "Propostas em aberto", e tem que casar com a contagem daquele KPI.
const STATUS_ABERTOS = ['rascunho', 'enviada', 'visualizada'];

export default function AdminProposalsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [propostas, setPropostas] = useState([]);
  const [itensPorProposta, setItensPorProposta] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const lista = await listarPropostas();
      setPropostas(lista);
      const itens = await listarItensDeVariasPropostas(lista.map((p) => p.id));
      setItensPorProposta(itens);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return propostas.filter((p) => {
      if (statusFilter === 'abertas') {
        if (!STATUS_ABERTOS.includes(p.status)) return false;
      } else if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      const sistemas = (itensPorProposta[p.id] || []).join(' ');
      return [p.title, p.companies?.name, sistemas].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [propostas, search, statusFilter, itensPorProposta]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await excluirProposta(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AdminLayout
      title="Propostas"
      subtitle="Monte, envie e acompanhe propostas comerciais — o cliente aceita por um link, sem precisar de login."
      actions={
        <>
          <input className="admin-input" style={{ maxWidth: 240 }} placeholder="Buscar por cliente, título, sistema..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="admin-select" style={{ maxWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos status</option>
            <option value="abertas">Em aberto</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviada">Enviada</option>
            <option value="visualizada">Visualizada</option>
            <option value="aceita">Aceita</option>
            <option value="recusada">Recusada</option>
            <option value="expirada">Expirada</option>
          </select>
          <button className="admin-btn primary" onClick={() => navigate('/admin/propostas/novo')}>+ Nova proposta</button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState>
            {propostas.length === 0 ? 'Nenhuma proposta ainda.' : 'Nada encontrado com esse filtro.'}
          </EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Sistemas</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sistemas = itensPorProposta[p.id] || [];
                  const token = p.public_token;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.companies?.name || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                          {p.title}{p.version > 1 && <span style={{ marginLeft: 6, color: '#a78bfa' }}>v{p.version}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', maxWidth: 240 }}>
                        {sistemas.length ? sistemas.join(', ') : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(p.total)}</td>
                      <td><StatusPill status={p.status} /></td>
                      <td>{p.valid_until ? formatDate(p.valid_until) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {token && p.status !== 'rascunho' && (
                            <a className="admin-btn" href={linkPublico(token)} target="_blank" rel="noreferrer">Ver página</a>
                          )}
                          <button className="admin-btn" onClick={() => navigate(`/admin/propostas/${p.id}`)}>
                            {p.status === 'rascunho' ? 'Editar' : 'Abrir'}
                          </button>
                          {p.status === 'rascunho' && (
                            <button className="admin-btn danger" onClick={() => { setDeleteError(''); setDeleting(p); }}>Excluir</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir proposta"
        footer={
          <>
            <button className="admin-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancelar</button>
            <button className="admin-btn danger" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          </>
        }
      >
        {deleting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
              Excluir o rascunho <strong style={{ color: '#eeede9' }}>{deleting.title}</strong> ({deleting.companies?.name})?
              Esta ação não pode ser desfeita.
            </p>
            {deleteError && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: '0.82rem' }}>
                {deleteError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
