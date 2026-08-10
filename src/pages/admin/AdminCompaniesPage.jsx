import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import ManageCompanyModal from '../../components/ManageCompanyModal';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/admin';

const EMPTY = { name: '', owner_id: '' };

export default function AdminCompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detailsId, setDetailsId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchAll = async () => {
    const [companiesRes, usersRes, membersRes] = await Promise.all([
      supabase.from('companies').select('id, name, code, owner_id, created_at, updated_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, company').order('name'),
      supabase.from('company_members').select('company_id, status'),
    ]);
    const counts = {};
    (membersRes.data || []).forEach((m) => {
      if (m.status !== 'active') return;
      counts[m.company_id] = (counts[m.company_id] || 0) + 1;
    });
    return { companiesRes, usersRes, counts };
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const { companiesRes, usersRes, counts } = await fetchAll();
    if (companiesRes.error) setError(companiesRes.error.message);
    setCompanies(companiesRes.data || []);
    setUsers(usersRes.data || []);
    setMemberCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const userById = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => {
      const owner = userById.get(c.owner_id);
      return [c.name, c.code, owner?.name, c.id].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [companies, search, userById]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!creating) return;
    const name = (creating.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.rpc('admin_create_company', {
      p_name: name,
      p_owner_id: creating.owner_id || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setCreating(null);
    await load();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    const { error: err } = await supabase.rpc('admin_delete_company', { p_id: deleting.id });
    setDeleteBusy(false);
    if (err) { setDeleteError(err.message); return; }
    setDeleting(null);
    await load();
  };

  return (
    <AdminLayout
      title="Empresas"
      subtitle="Gerencie empresas cadastradas, membros e assinaturas."
      actions={
        <>
          <input
            className="admin-input"
            style={{ maxWidth: 260 }}
            placeholder="Buscar por nome, código, dono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-btn primary" onClick={() => setCreating({ ...EMPTY })}>+ Nova</button>
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
          <EmptyState>Nenhuma empresa cadastrada.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Código</th>
                  <th>Dono</th>
                  <th>Membros</th>
                  <th>Criada em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const owner = userById.get(c.owner_id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{c.id.slice(0, 8)}…</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                        <span className="admin-pill" style={{
                          background: 'rgba(124,58,237,0.12)',
                          color: '#a78bfa',
                          borderColor: 'rgba(124,58,237,0.25)',
                        }}>{c.code}</span>
                      </td>
                      <td>{owner?.name || <span style={{ color: 'rgba(255,255,255,0.4)' }}>(desconhecido)</span>}</td>
                      <td>{memberCounts[c.id] || 0}</td>
                      <td>{formatDate(c.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button className="admin-btn" onClick={() => setDetailsId(c.id)}>Detalhes</button>
                          <button className="admin-btn danger" onClick={() => { setDeleteError(''); setDeleting(c); }}>Excluir</button>
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

      {/* ── Modal: nova empresa ── */}
      <Modal
        open={!!creating}
        onClose={() => !saving && setCreating(null)}
        title="Nova empresa"
        footer={
          <>
            <button className="admin-btn" onClick={() => setCreating(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="company-create-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {creating && (
          <form id="company-create-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome">
              <input
                className="admin-input"
                value={creating.name}
                onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                placeholder="Ex: Acme S/A"
                required
                autoFocus
              />
            </Field>
            <Field label="Dono">
              <Dropdown
                searchable
                value={creating.owner_id || ''}
                onChange={(v) => setCreating({ ...creating, owner_id: v })}
                options={[
                  { value: '', label: 'Você (admin)' },
                  ...users.map((u) => ({ value: u.id, label: u.name || u.id.slice(0, 8) })),
                ]}
                placeholder="Selecione o dono..."
                emptyText="Nenhum usuário encontrado"
              />
            </Field>
          </form>
        )}
      </Modal>

      {/* ── Modal: detalhes da empresa (membros + assinaturas) ── */}
      {detailsId && (
        <ManageCompanyModal
          companyId={detailsId}
          onClose={() => setDetailsId(null)}
          onChanged={load}
        />
      )}

      {/* ── Modal: confirmar exclusão ── */}
      <Modal
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir empresa"
        footer={
          <>
            <button className="admin-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancelar</button>
            <button className="admin-btn danger" onClick={handleConfirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          </>
        }
      >
        {deleting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
              Tem certeza que deseja excluir <strong style={{ color: '#eeede9' }}>{deleting.name}</strong>?
              Todos os membros e assinaturas vinculados a esta empresa serão perdidos. Esta ação não pode ser desfeita.
            </p>
            {deleteError && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: '0.82rem' }}>
                {deleteError}
              </div>
            )}
          </div>
        )}
      </Modal>

      <DropdownStyles />
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
