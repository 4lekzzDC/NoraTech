import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
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

function Dropdown({ value, onChange, options, placeholder = 'Selecione...', searchable = false, disabled = false, emptyText = 'Nenhuma opção' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? value ?? '';
  }, [options, value]);

  const commit = (v) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && filtered[activeIdx]) {
        e.preventDefault();
        commit(filtered[activeIdx].value);
      }
    }
  };

  return (
    <div ref={ref} className={`admin-dd ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
      {searchable ? (
        <div className="admin-dd-trigger" onClick={() => !disabled && setOpen(true)}>
          <input
            className="admin-dd-input"
            value={open ? query : (value || '')}
            onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            className="admin-dd-arrow-btn"
            onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((o) => !o); }}
            tabIndex={-1}
            aria-label="Abrir lista"
            disabled={disabled}
          >
            <svg className={`admin-dd-arrow ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="admin-dd-trigger admin-dd-trigger-btn"
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        >
          <span className={`admin-dd-value ${!selectedLabel ? 'placeholder' : ''}`}>
            {selectedLabel || placeholder}
          </span>
          <svg className={`admin-dd-arrow ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {open && !disabled && (
        <div ref={listRef} className="admin-dd-panel" role="listbox">
          {filtered.length === 0 ? (
            <div className="admin-dd-empty">{emptyText}</div>
          ) : (
            filtered.map((o, idx) => {
              const selected = o.value === value;
              const active = idx === activeIdx;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`admin-dd-option ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => commit(o.value)}
                >
                  <span className="admin-dd-option-label">{o.label}</span>
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function DropdownStyles() {
  return (
    <style>{`
      @keyframes admin-dd-in {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      .admin-dd { position: relative; width: 100%; }
      .admin-dd.disabled { opacity: 0.55; pointer-events: none; }
      .admin-dd-trigger {
        position: relative;
        display: flex; align-items: center;
        width: 100%; padding: 0; margin: 0;
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1);
        color: #eeede9; font-size: 0.9rem; font-family: inherit;
        outline: none; cursor: pointer;
        transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
      }
      .admin-dd-trigger:hover { border-color: rgba(124,58,237,0.45); background: rgba(255,255,255,0.05); }
      .admin-dd.open .admin-dd-trigger { border-color: #7C3AED; background: rgba(124,58,237,0.06); box-shadow: 0 0 0 3px rgba(124,58,237,0.18); }
      .admin-dd-trigger-btn {
        padding: 10px 12px;
        justify-content: space-between;
        text-align: left;
      }
      .admin-dd-input {
        flex: 1; min-width: 0;
        padding: 10px 12px;
        background: transparent;
        border: none; outline: none;
        color: inherit; font: inherit;
      }
      .admin-dd-input::placeholder { color: rgba(255,255,255,0.32); }
      .admin-dd-arrow-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 100%; min-height: 38px;
        background: transparent; border: none;
        color: rgba(255,255,255,0.55); cursor: pointer;
        border-left: 1px solid rgba(255,255,255,0.06);
      }
      .admin-dd-arrow-btn:hover { color: #7C3AED; background: rgba(124,58,237,0.06); }
      .admin-dd-arrow {
        transition: transform 0.22s cubic-bezier(0.16,1,0.3,1);
        color: rgba(255,255,255,0.55);
      }
      .admin-dd-trigger-btn .admin-dd-arrow { color: rgba(255,255,255,0.55); margin-left: 10px; }
      .admin-dd-arrow.open { transform: rotate(180deg); color: #7C3AED; }
      .admin-dd-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .admin-dd-value.placeholder { color: rgba(255,255,255,0.32); }
      .admin-dd-panel {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0;
        z-index: 200;
        max-height: 240px; overflow-y: auto;
        background: #15151a;
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px;
        padding: 4px;
        box-shadow:
          0 12px 32px -8px rgba(0,0,0,0.55),
          0 0 0 1px rgba(124,58,237,0.10),
          0 6px 16px -6px rgba(124,58,237,0.20);
        animation: admin-dd-in 0.18s cubic-bezier(0.16,1,0.3,1) both;
      }
      .admin-dd-option {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; padding: 9px 12px;
        background: transparent; border: none;
        color: rgba(255,255,255,0.85); font: inherit; text-align: left;
        border-radius: 7px; cursor: pointer;
        transition: background 0.14s, color 0.14s;
      }
      .admin-dd-option:hover,
      .admin-dd-option.active { background: rgba(124,58,237,0.14); color: #fff; }
      .admin-dd-option.selected { background: rgba(124,58,237,0.20); color: #fff; }
      .admin-dd-option.selected svg { color: #a78bfa; }
      .admin-dd-option-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .admin-dd-empty {
        padding: 14px 12px; text-align: center;
        color: rgba(255,255,255,0.4); font-size: 0.85rem;
      }
      /* scrollbar do panel */
      .admin-dd-panel::-webkit-scrollbar { width: 8px; }
      .admin-dd-panel::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.30); border-radius: 8px; }
    `}</style>
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
