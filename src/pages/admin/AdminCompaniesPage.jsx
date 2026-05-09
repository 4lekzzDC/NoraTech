import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/admin';

const EMPTY = { id: null, name: '', owner_id: '' };

export default function AdminCompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing) return;
    const name = (editing.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }
    setSaving(true);
    setError('');

    const rpc = editing.id
      ? supabase.rpc('admin_update_company', {
          p_id: editing.id,
          p_name: name,
          p_owner_id: editing.owner_id || null,
        })
      : supabase.rpc('admin_create_company', {
          p_name: name,
          p_owner_id: editing.owner_id || null,
        });

    const { error: err } = await rpc;
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEditing(null);
    await load();
  };

  const handleDelete = async (c) => {
    if (!confirm(`Excluir empresa "${c.name}"? Os membros perderão o vínculo.`)) return;
    const { error: err } = await supabase.rpc('admin_delete_company', { p_id: c.id });
    if (err) { setError(err.message); return; }
    await load();
  };

  return (
    <AdminLayout
      title="Empresas"
      subtitle="Gerencie empresas cadastradas e seus donos."
      actions={
        <>
          <input
            className="admin-input"
            style={{ maxWidth: 260 }}
            placeholder="Buscar por nome, código, dono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-btn primary" onClick={() => setEditing({ ...EMPTY })}>+ Nova</button>
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
                          <button className="admin-btn" onClick={() => setEditing({ id: c.id, name: c.name, owner_id: c.owner_id })}>Editar</button>
                          <button className="admin-btn danger" onClick={() => handleDelete(c)}>Excluir</button>
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
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Editar empresa' : 'Nova empresa'}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="company-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="company-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome">
              <input
                className="admin-input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: Acme S/A"
                required
                autoFocus
              />
            </Field>
            <Field label="Dono">
              <Dropdown
                searchable
                value={editing.owner_id || ''}
                onChange={(v) => setEditing({ ...editing, owner_id: v })}
                options={[
                  { value: '', label: editing.id ? '(manter atual)' : 'Você (admin)' },
                  ...users.map((u) => ({ value: u.id, label: u.name || u.id.slice(0, 8) })),
                ]}
                placeholder="Selecione o dono..."
                emptyText="Nenhum usuário encontrado"
              />
            </Field>
          </form>
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
