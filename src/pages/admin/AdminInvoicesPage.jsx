import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate } from '../../lib/admin';

const EMPTY = {
  user_id: '',
  subscription_id: '',
  description: '',
  amount: '',
  currency: 'BRL',
  status: 'pending',
  due_date: '',
  paid_at: '',
  payment_method: '',
  external_id: '',
};

export default function AdminInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const [invRes, usersRes, subsRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, company').order('name'),
      supabase.from('subscriptions').select('id, plan, user_id').order('created_at', { ascending: false }),
    ]);
    const profileById = new Map((usersRes.data || []).map((p) => [p.id, p]));
    const subById = new Map((subsRes.data || []).map((s) => [s.id, s]));
    const invoicesWithJoins = (invRes.data || []).map((i) => ({
      ...i,
      profiles: profileById.get(i.user_id) || null,
      subscriptions: i.subscription_id ? subById.get(i.subscription_id) || null : null,
    }));
    return { invRes, usersRes, subsRes, invoicesWithJoins };
  };

  const load = async () => {
    setLoading(true);
    const { invRes, usersRes, subsRes, invoicesWithJoins } = await fetchAll();
    if (invRes.error) setError(invRes.error.message);
    setInvoices(invoicesWithJoins);
    setUsers(usersRes.data || []);
    setSubs(subsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { invRes, usersRes, subsRes, invoicesWithJoins } = await fetchAll();
      if (!active) return;
      if (invRes.error) setError(invRes.error.message);
      setInvoices(invoicesWithJoins);
      setUsers(usersRes.data || []);
      setSubs(subsRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (!q) return true;
      return [i.description, i.profiles?.name, i.external_id].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [invoices, search, statusFilter]);

  const editingUserId = editing?.user_id;
  const userSubs = useMemo(() => {
    if (!editingUserId) return [];
    return subs.filter((s) => s.user_id === editingUserId);
  }, [subs, editingUserId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.user_id || !editing.description || editing.amount === '') {
      setError('Preencha cliente, descrição e valor.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      user_id: editing.user_id,
      subscription_id: editing.subscription_id || null,
      description: editing.description.trim(),
      amount: Number(editing.amount),
      currency: editing.currency || 'BRL',
      status: editing.status,
      due_date: editing.due_date || null,
      paid_at: editing.paid_at ? new Date(editing.paid_at).toISOString() : null,
      payment_method: editing.payment_method?.trim() || null,
      external_id: editing.external_id?.trim() || null,
    };

    const res = editing.id
      ? await supabase.from('invoices').update(payload).eq('id', editing.id)
      : await supabase.from('invoices').insert(payload);

    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    await load();
  };

  const markPaid = async (inv) => {
    const { error: e } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', inv.id);
    if (e) { setError(e.message); return; }
    await load();
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Excluir fatura "${inv.description}"?`)) return;
    const { error: e } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (e) { setError(e.message); return; }
    await load();
  };

  return (
    <AdminLayout
      title="Faturas"
      subtitle="Emissão, marcação de pagamentos e controle de cobranças."
      actions={
        <>
          <input className="admin-input" style={{ maxWidth: 220 }} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="admin-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Paga</option>
            <option value="overdue">Vencida</option>
            <option value="canceled">Cancelada</option>
            <option value="refunded">Reembolso</option>
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
          <EmptyState>Nenhuma fatura encontrada.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Vencimento</th>
                  <th>Pago em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.profiles?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                        {i.subscriptions?.plan ? `Plano: ${i.subscriptions.plan}` : 'Avulsa'}
                      </div>
                    </td>
                    <td>{i.description}</td>
                    <td style={{ fontWeight: 600 }}>{formatBRL(i.amount)}</td>
                    <td><StatusPill status={i.status} /></td>
                    <td>{formatDate(i.due_date)}</td>
                    <td>{formatDate(i.paid_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {i.status !== 'paid' && (
                          <button className="admin-btn" onClick={() => markPaid(i)}>Marcar como paga</button>
                        )}
                        <button className="admin-btn" onClick={() => setEditing({
                          ...i,
                          subscription_id: i.subscription_id || '',
                          due_date: i.due_date || '',
                          paid_at: i.paid_at ? i.paid_at.slice(0, 16) : '',
                        })}>Editar</button>
                        <button className="admin-btn danger" onClick={() => handleDelete(i)}>Excluir</button>
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
        title={editing?.id ? 'Editar fatura' : 'Nova fatura'}
        width={580}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="inv-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="inv-form" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Cliente" full>
              <select className="admin-select" value={editing.user_id} onChange={(e) => setEditing({ ...editing, user_id: e.target.value, subscription_id: '' })} required>
                <option value="">Selecione...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.id.slice(0, 8)}</option>)}
              </select>
            </Field>
            <Field label="Vincular a assinatura (opcional)" full>
              <select className="admin-select" value={editing.subscription_id} onChange={(e) => setEditing({ ...editing, subscription_id: e.target.value })} disabled={!editing.user_id}>
                <option value="">— sem vínculo —</option>
                {userSubs.map((s) => <option key={s.id} value={s.id}>{s.plan}</option>)}
              </select>
            </Field>
            <Field label="Descrição" full>
              <input className="admin-input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required placeholder="Ex: Mensalidade Setembro/2026" />
            </Field>
            <Field label="Valor">
              <input className="admin-input" type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} required />
            </Field>
            <Field label="Status">
              <select className="admin-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="pending">Pendente</option>
                <option value="paid">Paga</option>
                <option value="overdue">Vencida</option>
                <option value="canceled">Cancelada</option>
                <option value="refunded">Reembolso</option>
              </select>
            </Field>
            <Field label="Vencimento">
              <input className="admin-input" type="date" value={editing.due_date || ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
            </Field>
            <Field label="Pago em">
              <input className="admin-input" type="datetime-local" value={editing.paid_at || ''} onChange={(e) => setEditing({ ...editing, paid_at: e.target.value })} />
            </Field>
            <Field label="Método de pagamento">
              <input className="admin-input" value={editing.payment_method || ''} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })} placeholder="PIX, Boleto, Stripe..." />
            </Field>
            <Field label="ID externo (gateway)">
              <input className="admin-input" value={editing.external_id || ''} onChange={(e) => setEditing({ ...editing, external_id: e.target.value })} />
            </Field>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}

function Field({ label, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
