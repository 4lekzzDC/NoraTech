import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate } from '../../lib/admin';

const EMPTY = {
  user_id: '',
  plan: '',
  status: 'active',
  amount: '',
  currency: 'BRL',
  billing_cycle: 'monthly',
  current_period_end: '',
  notes: '',
};

export default function AdminSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const [subsRes, usersRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, company').order('name'),
    ]);
    const profileById = new Map((usersRes.data || []).map((p) => [p.id, p]));
    const subsWithProfile = (subsRes.data || []).map((s) => ({
      ...s,
      profiles: profileById.get(s.user_id) || null,
    }));
    return { subsRes, usersRes, subsWithProfile };
  };

  const load = async () => {
    setLoading(true);
    const { subsRes, usersRes, subsWithProfile } = await fetchAll();
    if (subsRes.error) setError(subsRes.error.message);
    setSubs(subsWithProfile);
    setUsers(usersRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { subsRes, usersRes, subsWithProfile } = await fetchAll();
      if (!active) return;
      if (subsRes.error) setError(subsRes.error.message);
      setSubs(subsWithProfile);
      setUsers(usersRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return [s.plan, s.profiles?.name, s.profiles?.company].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [subs, search, statusFilter]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.user_id || !editing.plan) {
      setError('Selecione um usuário e informe o plano.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      user_id: editing.user_id,
      plan: editing.plan.trim(),
      status: editing.status,
      amount: editing.amount === '' ? 0 : Number(editing.amount),
      currency: editing.currency || 'BRL',
      billing_cycle: editing.billing_cycle,
      current_period_end: editing.current_period_end || null,
      notes: editing.notes?.trim() || null,
    };

    const res = editing.id
      ? await supabase.from('subscriptions').update(payload).eq('id', editing.id)
      : await supabase.from('subscriptions').insert(payload);

    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    await load();
  };

  const handleDelete = async (sub) => {
    if (!confirm(`Excluir assinatura "${sub.plan}" de ${sub.profiles?.name || sub.user_id}?`)) return;
    const { error: e } = await supabase.from('subscriptions').delete().eq('id', sub.id);
    if (e) { setError(e.message); return; }
    await load();
  };

  return (
    <AdminLayout
      title="Assinaturas"
      subtitle="Crie, atualize e cancele assinaturas dos clientes."
      actions={
        <>
          <input
            className="admin-input"
            style={{ maxWidth: 220 }}
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="admin-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos status</option>
            <option value="active">Ativa</option>
            <option value="trialing">Trial</option>
            <option value="paused">Pausada</option>
            <option value="past_due">Atrasada</option>
            <option value="canceled">Cancelada</option>
          </select>
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
          <EmptyState>Nenhuma assinatura encontrada.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Ciclo</th>
                  <th>Status</th>
                  <th>Próx. cobrança</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.profiles?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{s.profiles?.company || ''}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.plan}</td>
                    <td>{formatBRL(s.amount)}</td>
                    <td style={{ textTransform: 'capitalize', color: 'rgba(255,255,255,0.6)' }}>{cycleLabel(s.billing_cycle)}</td>
                    <td><StatusPill status={s.status} /></td>
                    <td>{formatDate(s.current_period_end)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button className="admin-btn" onClick={() => setEditing({
                          ...s,
                          current_period_end: s.current_period_end ? s.current_period_end.slice(0, 10) : '',
                        })}>Editar</button>
                        <button className="admin-btn danger" onClick={() => handleDelete(s)}>Excluir</button>
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
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Editar assinatura' : 'Nova assinatura'}
        width={560}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="sub-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="sub-form" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Cliente" full>
              <select className="admin-select" value={editing.user_id} onChange={(e) => setEditing({ ...editing, user_id: e.target.value })} required>
                <option value="">Selecione...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.id.slice(0, 8)}</option>)}
              </select>
            </Field>
            <Field label="Plano" full>
              <input className="admin-input" value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })} placeholder="Ex: Sites Pro" required />
            </Field>
            <Field label="Valor">
              <input className="admin-input" type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </Field>
            <Field label="Moeda">
              <input className="admin-input" value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} maxLength={3} />
            </Field>
            <Field label="Ciclo">
              <select className="admin-select" value={editing.billing_cycle} onChange={(e) => setEditing({ ...editing, billing_cycle: e.target.value })}>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
                <option value="one_time">Único</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="admin-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="active">Ativa</option>
                <option value="trialing">Trial</option>
                <option value="paused">Pausada</option>
                <option value="past_due">Atrasada</option>
                <option value="canceled">Cancelada</option>
              </select>
            </Field>
            <Field label="Próxima cobrança" full>
              <input className="admin-input" type="date" value={editing.current_period_end || ''} onChange={(e) => setEditing({ ...editing, current_period_end: e.target.value })} />
            </Field>
            <Field label="Notas internas" full>
              <textarea className="admin-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}

function cycleLabel(c) {
  if (c === 'monthly') return 'Mensal';
  if (c === 'yearly') return 'Anual';
  if (c === 'one_time') return 'Único';
  return c || '—';
}

function Field({ label, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
