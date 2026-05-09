import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const [usersRes, companiesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, photo_url, company, role, updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name'),
    ]);
    return { usersRes, companiesRes };
  };

  const load = async () => {
    setLoading(true);
    const { usersRes, companiesRes } = await fetchAll();
    if (usersRes.error) setError(usersRes.error.message);
    setUsers(usersRes.data || []);
    setCompanies(companiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { usersRes, companiesRes } = await fetchAll();
      if (!active) return;
      if (usersRes.error) setError(usersRes.error.message);
      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.company, u.id].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [users, search]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSavingId(editing.id);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        name: editing.name?.trim() || null,
        company: editing.company?.trim() || null,
        role: editing.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id);
    setSavingId(null);
    if (err) { setError(err.message); return; }
    setEditing(null);
    await load();
  };

  const toggleRole = async (u) => {
    if (u.id === me?.id) {
      setError('Você não pode rebaixar o próprio admin daqui.');
      return;
    }
    const next = u.role === 'admin' ? 'user' : 'admin';
    setSavingId(u.id);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: next, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    setSavingId(null);
    if (err) { setError(err.message); return; }
    await load();
  };

  return (
    <AdminLayout
      title="Usuários"
      subtitle="Lista de todos os clientes cadastrados via Supabase Auth."
      actions={
        <input
          className="admin-input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nome, empresa, id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState>Nenhum usuário encontrado.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Empresa</th>
                  <th>Role</th>
                  <th>Atualizado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                          background: 'rgba(124,58,237,0.15)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          color: '#a78bfa', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {u.photo_url ? (
                            <img src={u.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            (u.name || '?').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{u.name || <span style={{ color: 'rgba(255,255,255,0.4)' }}>(sem nome)</span>}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{u.id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.company || '—'}</td>
                    <td>
                      <span className="admin-pill" style={{
                        background: u.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                        color: u.role === 'admin' ? '#a78bfa' : '#bbb',
                        borderColor: u.role === 'admin' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)',
                      }}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td>{formatDate(u.updated_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          className="admin-btn"
                          onClick={() => toggleRole(u)}
                          disabled={savingId === u.id || u.id === me?.id}
                          title={u.id === me?.id ? 'Não é possível alterar o próprio role' : ''}
                        >
                          {u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                        </button>
                        <button className="admin-btn primary" onClick={() => setEditing({ ...u })}>
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar usuário"
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={!!savingId}>Cancelar</button>
            <button className="admin-btn primary" onClick={handleSave} disabled={!!savingId} type="submit" form="edit-user-form">
              {savingId ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="edit-user-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome">
              <input className="admin-input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Empresa">
              <Dropdown
                searchable
                freeInput
                value={editing.company || ''}
                onChange={(v) => setEditing({ ...editing, company: v })}
                options={companies.map((c) => ({ value: c.name, label: c.name }))}
                placeholder={companies.length ? 'Selecione ou digite...' : 'Nenhuma empresa cadastrada'}
                emptyText={companies.length ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                Empresas cadastradas em <em>Empresas</em> aparecem na lista. Você pode digitar um valor livre.
              </span>
            </Field>
            <Field label="Role">
              <Dropdown
                value={editing.role || 'user'}
                onChange={(v) => setEditing({ ...editing, role: v })}
                options={[
                  { value: 'user',  label: 'user'  },
                  { value: 'admin', label: 'admin' },
                ]}
                disabled={editing.id === me?.id}
              />
            </Field>
            <Field label="ID">
              <input className="admin-input" value={editing.id} disabled style={{ fontFamily: 'monospace', fontSize: '0.78rem' }} />
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
