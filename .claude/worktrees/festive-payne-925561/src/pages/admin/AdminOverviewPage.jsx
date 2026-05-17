import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout, { Card, Spinner, StatusPill } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate } from '../../lib/admin';

function StatCard({ label, value, hint, accent = '#7C3AED' }) {
  return (
    <Card style={{ padding: '22px 24px' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: -1, marginTop: 8, color: accent }}>{value}</div>
      {hint && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{hint}</div>}
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    activeSubs: 0,
    mrr: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    overdueInvoices: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [usersRes, subsRes, invoicesRes, recentInvRes, recentUsersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('amount, billing_cycle, status').eq('status', 'active'),
        supabase.from('invoices').select('amount, status'),
        supabase.from('invoices').select('id, description, amount, status, due_date, user_id, profiles:user_id(name, role)').order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('id, name, role, updated_at').order('updated_at', { ascending: false }).limit(5),
      ]);

      if (!active) return;

      const subs = subsRes.data || [];
      const mrr = subs.reduce((acc, s) => {
        const amount = Number(s.amount) || 0;
        if (s.billing_cycle === 'yearly') return acc + amount / 12;
        if (s.billing_cycle === 'one_time') return acc;
        return acc + amount;
      }, 0);

      const invoices = invoicesRes.data || [];
      const pending = invoices.filter((i) => i.status === 'pending');
      const overdue = invoices.filter((i) => i.status === 'overdue');
      const pendingAmount = [...pending, ...overdue].reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

      setStats({
        users: usersRes.count || 0,
        activeSubs: subs.length,
        mrr,
        pendingInvoices: pending.length,
        pendingAmount,
        overdueInvoices: overdue.length,
      });
      setRecentInvoices(recentInvRes.data || []);
      setRecentUsers(recentUsersRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <AdminLayout title="Visão geral" subtitle="Resumo da operação: clientes, receita recorrente e cobranças.">
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Usuários" value={stats.users} hint="Total cadastrados" />
            <StatCard label="Assinaturas ativas" value={stats.activeSubs} accent="#00d48a" />
            <StatCard label="MRR" value={formatBRL(stats.mrr)} hint="Receita mensal recorrente" accent="#7C3AED" />
            <StatCard label="Faturas pendentes" value={stats.pendingInvoices} hint={formatBRL(stats.pendingAmount)} accent="#ff8a3d" />
            <StatCard label="Faturas vencidas" value={stats.overdueInvoices} accent="#ff6b6b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Faturas recentes</h3>
                <Link to="/admin/faturas" style={{ fontSize: '0.78rem', color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {recentInvoices.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem' }}>Sem faturas registradas.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Vence</th></tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((i) => (
                        <tr key={i.id}>
                          <td>{i.profiles?.name || '—'}</td>
                          <td>{i.description}</td>
                          <td>{formatBRL(i.amount)}</td>
                          <td><StatusPill status={i.status} /></td>
                          <td>{formatDate(i.due_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card style={{ padding: 0 }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Usuários recentes</h3>
                <Link to="/admin/usuarios" style={{ fontSize: '0.78rem', color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {recentUsers.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem' }}>Sem usuários ainda.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr><th>Nome</th><th>Role</th><th>Atualizado</th></tr>
                    </thead>
                    <tbody>
                      {recentUsers.map((u) => (
                        <tr key={u.id}>
                          <td>{u.name || '—'}</td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
