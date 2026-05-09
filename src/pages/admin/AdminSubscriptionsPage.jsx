import { useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate } from '../../lib/admin';
import { SYSTEMS, getSystem } from '../../lib/systems';

const EMPTY = {
  company_id: '',
  system_slug: '',
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
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const [subsRes, companiesRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name, code').order('name'),
    ]);
    const companyById = new Map((companiesRes.data || []).map((c) => [c.id, c]));
    const subsWithCompany = (subsRes.data || []).map((s) => ({
      ...s,
      company: s.company_id ? companyById.get(s.company_id) || null : null,
    }));
    return { subsRes, companiesRes, subsWithCompany };
  };

  const load = async () => {
    setLoading(true);
    const { subsRes, companiesRes, subsWithCompany } = await fetchAll();
    if (subsRes.error) setError(subsRes.error.message);
    setSubs(subsWithCompany);
    setCompanies(companiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { subsRes, companiesRes, subsWithCompany } = await fetchAll();
      if (!active) return;
      if (subsRes.error) setError(subsRes.error.message);
      setSubs(subsWithCompany);
      setCompanies(companiesRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return [s.plan, s.company?.name, s.company?.code].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [subs, search, statusFilter]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.company_id || !editing.system_slug) {
      setError('Selecione uma empresa e um sistema.');
      return;
    }
    setSaving(true);
    setError('');

    const sys = getSystem(editing.system_slug);
    const payload = {
      company_id: editing.company_id,
      user_id: null,
      system_slug: editing.system_slug,
      plan: (editing.plan || sys?.name || editing.system_slug).trim(),
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
    if (!confirm(`Excluir assinatura "${sub.plan}" de ${sub.company?.name || sub.company_id}?`)) return;
    const { error: e } = await supabase.from('subscriptions').delete().eq('id', sub.id);
    if (e) { setError(e.message); return; }
    await load();
  };

  return (
    <AdminLayout
      title="Assinaturas"
      subtitle="Crie, atualize e cancele assinaturas das empresas."
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
          <button
            className="admin-btn primary"
            onClick={() => setEditing({ ...EMPTY })}
            disabled={companies.length === 0}
            title={companies.length === 0 ? 'Cadastre uma empresa primeiro' : ''}
          >
            + Nova
          </button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {!loading && companies.length === 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, marginBottom: 16, color: '#a78bfa', fontSize: '0.85rem' }}>
          Nenhuma empresa cadastrada. Vá em <strong>Empresas</strong> para criar antes de adicionar assinaturas.
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
                  <th>Empresa</th>
                  <th>Sistema</th>
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
                      <div style={{ fontWeight: 600 }}>{s.company?.name || <span style={{ color: 'rgba(255,255,255,0.4)' }}>(sem empresa)</span>}</div>
                      {s.company?.code && (
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{s.company.code}</div>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const sys = getSystem(s.system_slug);
                        if (!sys) return <span style={{ color: 'rgba(255,255,255,0.4)' }}>—</span>;
                        return (
                          <span className="admin-pill" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.25)' }}>
                            {sys.icon} {sys.name}
                          </span>
                        );
                      })()}
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
                          company_id: s.company_id || '',
                          system_slug: s.system_slug || '',
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
            <Field label="Empresa" full>
              <Dropdown
                searchable
                value={editing.company_id}
                onChange={(v) => setEditing({ ...editing, company_id: v })}
                options={companies.map((c) => ({ value: c.id, label: c.name + (c.code ? ` (${c.code})` : '') }))}
                placeholder="Selecione uma empresa..."
                emptyText="Nenhuma empresa encontrada"
              />
            </Field>
            <Field label="Sistema" full>
              <Dropdown
                value={editing.system_slug}
                onChange={(slug) => {
                  const sys = getSystem(slug);
                  setEditing({ ...editing, system_slug: slug, plan: editing.plan || sys?.name || '' });
                }}
                options={[
                  { value: '', label: 'Selecione um sistema...' },
                  ...SYSTEMS.map((s) => ({ value: s.slug, label: `${s.icon} ${s.name}` })),
                ]}
                placeholder="Selecione um sistema..."
              />
            </Field>
            <Field label="Plano (rótulo interno)" full>
              <input
                className="admin-input"
                value={editing.plan}
                onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
                placeholder="Ex: WhatsApp Bot — Mensal"
              />
            </Field>
            <Field label="Valor">
              <input className="admin-input" type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </Field>
            <Field label="Moeda">
              <input className="admin-input" value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} maxLength={3} />
            </Field>
            <Field label="Ciclo">
              <Dropdown
                value={editing.billing_cycle}
                onChange={(v) => setEditing({ ...editing, billing_cycle: v })}
                options={[
                  { value: 'monthly',  label: 'Mensal' },
                  { value: 'yearly',   label: 'Anual' },
                  { value: 'one_time', label: 'Único' },
                ]}
              />
            </Field>
            <Field label="Status">
              <Dropdown
                value={editing.status}
                onChange={(v) => setEditing({ ...editing, status: v })}
                options={[
                  { value: 'active',   label: 'Ativa' },
                  { value: 'trialing', label: 'Trial' },
                  { value: 'paused',   label: 'Pausada' },
                  { value: 'past_due', label: 'Atrasada' },
                  { value: 'canceled', label: 'Cancelada' },
                ]}
              />
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

      <DropdownStyles />
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
