import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate, formatDateTime } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY = {
  user_id: '',
  subscription_id: '',
  no_subscription_reason: '',
  description: '',
  amount: '',
  currency: 'BRL',
  status: 'pending',
  due_date: '',
  paid_at: '',
  payment_method: '',
  manual_settlement: false,
  external_id: '',
};

const MANUAL_METHODS = ['PIX', 'Boleto', 'Dinheiro', 'Transferência', 'Outro'];

const EVENT_META = {
  created_system: { label: 'Fatura gerada automaticamente pelo sistema', color: '#60a5fa' },
  created_manual: { label: 'Fatura criada manualmente', color: '#a78bfa' },
  recobranca:     { label: 'Recobrança registrada', color: '#f59e0b' },
  desconto:       { label: 'Desconto aplicado', color: '#00d48a' },
  juros:          { label: 'Juros aplicado', color: '#ff6b6b' },
  ajuste_valor:   { label: 'Valor renegociado', color: '#f59e0b' },
  baixa_manual:   { label: 'Baixa manual registrada', color: '#00d48a' },
  marcado_pago:   { label: 'Marcada como paga', color: '#00d48a' },
  nota:           { label: 'Observação', color: 'rgba(255,255,255,0.5)' },
};

const ACTION_TYPES = [
  { id: 'recobranca',   label: 'Recobrança' },
  { id: 'desconto',     label: 'Desconto' },
  { id: 'juros',        label: 'Juros' },
  { id: 'ajuste_valor', label: 'Ajuste de valor' },
  { id: 'baixa_manual', label: 'Baixa manual' },
];

export default function AdminInvoicesPage() {
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState({});
  const [search, setSearch] = useState('');
  // Inicial vindo da URL: a Visão geral linka pra cá já filtrado (?status=pending / paid).
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('detalhes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Logs tab
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [actionMethod, setActionMethod] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchAll = async () => {
    const [invRes, usersRes, subsRes, pmRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, company').order('name'),
      supabase.from('subscriptions').select('id, plan, user_id, company_id').order('created_at', { ascending: false }),
      supabase.from('payment_methods').select('company_id, brand, last4').eq('is_default', true),
    ]);
    const profileById = new Map((usersRes.data || []).map((p) => [p.id, p]));
    const subById = new Map((subsRes.data || []).map((s) => [s.id, s]));
    const pmByCompany = Object.fromEntries((pmRes.data || []).map((p) => [p.company_id, p]));
    const invoicesWithJoins = (invRes.data || []).map((i) => ({
      ...i,
      profiles: profileById.get(i.user_id) || null,
      subscriptions: i.subscription_id ? subById.get(i.subscription_id) || null : null,
    }));
    return { invRes, usersRes, subsRes, invoicesWithJoins, pmByCompany, profileById };
  };

  const load = async () => {
    const { invRes, usersRes, subsRes, invoicesWithJoins, pmByCompany } = await fetchAll();
    if (invRes.error) setError(invRes.error.message);
    setInvoices(invoicesWithJoins);
    setUsers(usersRes.data || []);
    setSubs(subsRes.data || []);
    setPaymentMethods(pmByCompany);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { invRes, usersRes, subsRes, invoicesWithJoins, pmByCompany } = await fetchAll();
      if (!active) return;
      if (invRes.error) setError(invRes.error.message);
      setInvoices(invoicesWithJoins);
      setUsers(usersRes.data || []);
      setSubs(subsRes.data || []);
      setPaymentMethods(pmByCompany);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const profileById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const loadEvents = async (invoiceId) => {
    setEventsLoading(true);
    const { data, error: e } = await supabase
      .from('invoice_events')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    if (!e) setEvents(data || []);
    setEventsLoading(false);
  };

  const openEdit = (inv) => {
    setEditing({
      ...inv,
      subscription_id: inv.subscription_id || '',
      no_subscription_reason: inv.no_subscription_reason || '',
      due_date: inv.due_date || '',
      paid_at: inv.paid_at ? inv.paid_at.slice(0, 16) : '',
      manual_settlement: !!inv.manual_settlement,
    });
    setActiveTab('detalhes');
    setActionType(null);
    setActionError('');
    setError('');
    if (inv.id) loadEvents(inv.id);
    else setEvents([]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (!q) return true;
      return [i.description, i.profiles?.name, i.external_id].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [invoices, search, statusFilter]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.user_id || !editing.description || editing.amount === '') {
      setError('Preencha cliente, descrição e valor.');
      return;
    }
    if (!editing.subscription_id && !editing.no_subscription_reason?.trim()) {
      setError('Vincule uma assinatura ou informe o motivo da fatura avulsa.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      user_id: editing.user_id,
      subscription_id: editing.subscription_id || null,
      no_subscription_reason: editing.subscription_id ? null : editing.no_subscription_reason.trim(),
      description: editing.description.trim(),
      amount: Number(editing.amount),
      currency: editing.currency || 'BRL',
      status: editing.status,
      due_date: editing.due_date || null,
      paid_at: editing.paid_at ? new Date(editing.paid_at).toISOString() : null,
      payment_method: editing.payment_method?.trim() || null,
      manual_settlement: !!editing.manual_settlement,
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
    await supabase.from('invoice_events').insert({
      invoice_id: inv.id,
      event_type: 'marcado_pago',
      actor_id: me?.id || null,
    });
    await load();
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Excluir fatura "${inv.description}"?`)) return;
    const { error: e } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (e) { setError(e.message); return; }
    await load();
  };

  const submitAction = async () => {
    setActionError('');
    let amountBefore = null;
    let amountAfter = null;
    const invoiceUpdate = {};

    if (actionType === 'desconto') {
      const delta = Number(actionAmount);
      if (!delta || delta <= 0) { setActionError('Informe o valor do desconto.'); return; }
      amountBefore = Number(editing.amount);
      amountAfter = Math.max(0, amountBefore - delta);
      invoiceUpdate.amount = amountAfter;
    } else if (actionType === 'juros') {
      const delta = Number(actionAmount);
      if (!delta || delta <= 0) { setActionError('Informe o valor dos juros.'); return; }
      amountBefore = Number(editing.amount);
      amountAfter = amountBefore + delta;
      invoiceUpdate.amount = amountAfter;
    } else if (actionType === 'ajuste_valor') {
      const novo = Number(actionAmount);
      if (actionAmount === '' || Number.isNaN(novo) || novo < 0) { setActionError('Informe o novo valor da fatura.'); return; }
      if (!actionNotes.trim()) { setActionError('Explique o motivo da renegociação.'); return; }
      amountBefore = Number(editing.amount);
      amountAfter = novo;
      invoiceUpdate.amount = novo;
    } else if (actionType === 'baixa_manual') {
      if (!actionMethod) { setActionError('Selecione a forma de pagamento.'); return; }
      invoiceUpdate.status = 'paid';
      invoiceUpdate.paid_at = new Date().toISOString();
      invoiceUpdate.payment_method = actionMethod;
      invoiceUpdate.manual_settlement = true;
    }
    // recobranca: apenas registra o log, sem alterar a fatura.

    setActionSaving(true);
    try {
      if (Object.keys(invoiceUpdate).length > 0) {
        const { error: upErr } = await supabase.from('invoices').update(invoiceUpdate).eq('id', editing.id);
        if (upErr) throw upErr;
      }

      const notesForEvent = actionType === 'baixa_manual'
        ? `Forma: ${actionMethod}${actionNotes.trim() ? ` — ${actionNotes.trim()}` : ''}`
        : (actionNotes.trim() || null);

      const { error: evErr } = await supabase.from('invoice_events').insert({
        invoice_id: editing.id,
        event_type: actionType,
        actor_id: me?.id || null,
        amount_before: amountBefore,
        amount_after: amountAfter,
        notes: notesForEvent,
      });
      if (evErr) throw evErr;

      setEditing((prev) => ({ ...prev, ...invoiceUpdate }));
      await loadEvents(editing.id);
      await load();
      setActionType(null);
      setActionAmount('');
      setActionNotes('');
      setActionMethod('');
    } catch (err) {
      setActionError(err.message || 'Erro ao registrar ação.');
    } finally {
      setActionSaving(false);
    }
  };

  const companyDefaultMethod = editing?.company_id ? paymentMethods[editing.company_id] : null;

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
          <button className="admin-btn primary" onClick={() => openEdit({ ...EMPTY })}>+ Nova</button>
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
                        <button className="admin-btn" onClick={() => openEdit(i)}>Editar</button>
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
        width={640}
        footer={
          activeTab === 'detalhes' ? (
            <>
              <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
              <button className="admin-btn primary" type="submit" form="inv-form" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <button className="admin-btn" onClick={() => setEditing(null)}>Fechar</button>
          )
        }
      >
        {editing && (
          <>
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 18, gap: 0 }}>
              {['detalhes', 'logs'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  disabled={tab === 'logs' && !editing.id}
                  style={{
                    padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #7C3AED' : '2px solid transparent',
                    color: activeTab === tab ? '#eeede9' : 'rgba(255,255,255,0.42)',
                    fontSize: '0.84rem', fontWeight: 600, cursor: tab === 'logs' && !editing.id ? 'not-allowed' : 'pointer',
                    opacity: tab === 'logs' && !editing.id ? 0.4 : 1,
                    marginBottom: -1,
                  }}
                >
                  {tab === 'detalhes' ? 'Detalhes' : 'Logs'}
                </button>
              ))}
            </div>

            {activeTab === 'detalhes' && (
              <form id="inv-form" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Cliente" full>
                  <Dropdown
                    searchable
                    value={editing.user_id}
                    onChange={(v) => setEditing({ ...editing, user_id: v, subscription_id: '' })}
                    options={users.map((u) => ({ value: u.id, label: u.name || u.id.slice(0, 8) }))}
                    placeholder="Selecione um cliente..."
                    emptyText="Nenhum cliente encontrado"
                  />
                </Field>
                <Field label="Vincular a assinatura" full>
                  <Dropdown
                    searchable
                    value={editing.subscription_id}
                    onChange={(v) => setEditing({ ...editing, subscription_id: v, no_subscription_reason: v ? '' : editing.no_subscription_reason })}
                    options={[
                      { value: '', label: '— sem vínculo —' },
                      ...subs.map((s) => ({ value: s.id, label: s.plan })),
                    ]}
                    placeholder="— sem vínculo —"
                    emptyText="Nenhuma assinatura encontrada"
                  />
                </Field>
                {!editing.subscription_id && (
                  <Field label="Motivo da fatura avulsa (obrigatório sem assinatura)" full>
                    <textarea
                      className="admin-input"
                      rows={2}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      value={editing.no_subscription_reason || ''}
                      onChange={(e) => setEditing({ ...editing, no_subscription_reason: e.target.value })}
                      placeholder="Ex: cobrança de serviço avulso de implantação, não vinculado a uma assinatura recorrente."
                    />
                  </Field>
                )}
                <Field label="Descrição" full>
                  <input className="admin-input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required placeholder="Ex: Mensalidade Setembro/2026" />
                </Field>
                <Field label="Valor">
                  <input className="admin-input" type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} required />
                </Field>
                <Field label="Status">
                  <Dropdown
                    value={editing.status}
                    onChange={(v) => setEditing({ ...editing, status: v })}
                    options={[
                      { value: 'pending',  label: 'Pendente' },
                      { value: 'paid',     label: 'Paga' },
                      { value: 'overdue',  label: 'Vencida' },
                      { value: 'canceled', label: 'Cancelada' },
                      { value: 'refunded', label: 'Reembolso' },
                    ]}
                  />
                </Field>
                <Field label="Vencimento">
                  <input className="admin-input" type="date" value={editing.due_date || ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
                </Field>
                <Field label="Pago em">
                  <input className="admin-input" type="datetime-local" value={editing.paid_at || ''} onChange={(e) => setEditing({ ...editing, paid_at: e.target.value })} />
                </Field>
                <Field label="Método de pagamento" full>
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}>
                    {editing.payment_method
                      ? editing.payment_method
                      : companyDefaultMethod
                        ? `Cartão salvo do cliente: ${companyDefaultMethod.brand?.toUpperCase() || 'Cartão'} •••• ${companyDefaultMethod.last4}`
                        : 'Nenhum método definido pelo cliente ainda.'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                    Definido pelo cliente ao contratar (ou pelo gateway ao cobrar). Para registrar pagamento por outro meio, use "Baixa manual" na aba Logs.
                  </span>
                </Field>
                <Field label="ID externo (gateway)">
                  <input className="admin-input" value={editing.external_id || ''} onChange={(e) => setEditing({ ...editing, external_id: e.target.value })} />
                </Field>
              </form>
            )}

            {activeTab === 'logs' && editing.id && (
              <LogsTab
                editing={editing}
                events={events}
                eventsLoading={eventsLoading}
                profileById={profileById}
                actionType={actionType}
                setActionType={setActionType}
                actionAmount={actionAmount}
                setActionAmount={setActionAmount}
                actionNotes={actionNotes}
                setActionNotes={setActionNotes}
                actionMethod={actionMethod}
                setActionMethod={setActionMethod}
                actionSaving={actionSaving}
                actionError={actionError}
                submitAction={submitAction}
              />
            )}
          </>
        )}
      </Modal>

      <DropdownStyles />
    </AdminLayout>
  );
}

function LogsTab({
  editing, events, eventsLoading, profileById,
  actionType, setActionType, actionAmount, setActionAmount,
  actionNotes, setActionNotes, actionMethod, setActionMethod,
  actionSaving, actionError, submitAction,
}) {
  const creationEvent = events.find((e) => e.event_type === 'created_system' || e.event_type === 'created_manual');
  const otherEvents = events.filter((e) => e !== creationEvent);

  const actorName = (actorId) => {
    if (!actorId) return 'Sistema';
    return profileById.get(actorId)?.name || 'Usuário removido';
  };

  return (
    <div>
      {/* Origem — fixa no topo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, marginBottom: 18,
        background: creationEvent?.event_type === 'created_system' ? 'rgba(96,165,250,0.08)' : 'rgba(167,139,250,0.08)',
        border: `1px solid ${creationEvent?.event_type === 'created_system' ? 'rgba(96,165,250,0.25)' : 'rgba(167,139,250,0.25)'}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: creationEvent?.event_type === 'created_system' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)',
        }}>
          {creationEvent?.event_type === 'created_system' ? '⚙️' : '🧑'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
            {creationEvent?.event_type === 'created_system'
              ? 'Gerada automaticamente pelo sistema'
              : `Gerada por ${actorName(creationEvent?.actor_id)}`}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
            {creationEvent ? formatDateTime(creationEvent.created_at) : formatDateTime(editing.created_at)}
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>
          Registrar ação
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: actionType ? 12 : 0 }}>
          {ACTION_TYPES.map((a) => (
            <button
              key={a.id}
              type="button"
              className="admin-btn"
              onClick={() => { setActionType(actionType === a.id ? null : a.id); setActionAmount(''); setActionNotes(''); setActionMethod(''); }}
              style={actionType === a.id ? { background: 'rgba(124,58,237,0.18)', borderColor: 'rgba(124,58,237,0.4)', color: '#a78bfa' } : undefined}
            >
              {a.label}
            </button>
          ))}
        </div>

        {actionType && (
          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
            {actionType === 'baixa_manual' ? (
              <Field label="Forma de pagamento">
                <Dropdown
                  value={actionMethod}
                  onChange={setActionMethod}
                  options={MANUAL_METHODS.map((m) => ({ value: m, label: m }))}
                  placeholder="Selecione..."
                />
              </Field>
            ) : actionType === 'desconto' || actionType === 'juros' ? (
              <Field label={actionType === 'desconto' ? 'Valor do desconto (R$)' : 'Valor dos juros (R$)'}>
                <input className="admin-input" type="number" step="0.01" min="0" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
              </Field>
            ) : actionType === 'ajuste_valor' ? (
              <Field label="Novo valor total da fatura (R$)">
                <input className="admin-input" type="number" step="0.01" min="0" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
              </Field>
            ) : null}

            <Field label={actionType === 'ajuste_valor' ? 'Motivo da renegociação (obrigatório)' : 'Observação (opcional)'}>
              <textarea
                className="admin-input"
                rows={2}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={actionType === 'recobranca' ? 'Ex: 2ª tentativa de cobrança via WhatsApp' : ''}
              />
            </Field>

            {actionError && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', margin: 0 }}>{actionError}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="admin-btn" onClick={() => setActionType(null)} disabled={actionSaving}>Cancelar</button>
              <button type="button" className="admin-btn primary" onClick={submitAction} disabled={actionSaving}>
                {actionSaving ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>
          Histórico de ações
        </div>
        {eventsLoading ? (
          <Spinner />
        ) : otherEvents.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>Nenhuma ação registrada além da criação.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherEvents.map((ev) => {
              const meta = EVENT_META[ev.event_type] || { label: ev.event_type, color: 'rgba(255,255,255,0.5)' };
              return (
                <div key={ev.id} style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{formatDateTime(ev.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                    Por {actorName(ev.actor_id)}
                    {ev.amount_before !== null && ev.amount_after !== null && (
                      <> · {formatBRL(ev.amount_before)} → {formatBRL(ev.amount_after)}</>
                    )}
                  </div>
                  {ev.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 5, lineHeight: 1.4 }}>{ev.notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
