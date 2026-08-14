import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AdminLayout, { Card, Spinner, EmptyState } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_META = {
  open:         { label: 'Aberto',      fg: '#ff8a3d', bg: 'rgba(255,138,61,0.12)',  bd: 'rgba(255,138,61,0.25)' },
  in_progress:  { label: 'Em análise',  fg: '#60a5fa', bg: 'rgba(37,99,235,0.12)',   bd: 'rgba(37,99,235,0.25)' },
  waiting_user: { label: 'Aguardando',  fg: '#a78bfa', bg: 'rgba(124,58,237,0.12)',  bd: 'rgba(124,58,237,0.25)' },
  resolved:     { label: 'Resolvido',   fg: '#00d48a', bg: 'rgba(0,212,138,0.12)',   bd: 'rgba(0,212,138,0.25)' },
  closed:       { label: 'Fechado',     fg: '#bbb',    bg: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.12)' },
};

const PRIORITY_META = {
  urgent: { label: 'Urgente', fg: '#ff6b6b' },
  high:   { label: 'Alta',    fg: '#ff8a3d' },
  medium: { label: 'Média',   fg: '#bbb' },
  low:    { label: 'Baixa',   fg: '#777' },
};

const SENDER_META = {
  user:   { label: 'Cliente', fg: '#eeede9', bg: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.10)' },
  ai:     { label: 'IA',      fg: '#818cf8', bg: 'rgba(99,102,241,0.12)',  bd: 'rgba(99,102,241,0.28)' },
  admin:  { label: 'Equipe',  fg: '#00d48a', bg: 'rgba(0,212,138,0.10)',   bd: 'rgba(0,212,138,0.24)' },
  system: { label: 'Sistema', fg: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  bd: 'rgba(245,158,11,0.26)' },
};

function Pill({ meta }) {
  return (
    <span className="admin-pill" style={{ background: meta.bg, color: meta.fg, borderColor: meta.bd }}>
      {meta.label}
    </span>
  );
}

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('pendentes');
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: tErr }, { data: people }] = await Promise.all([
        supabase.from('support_tickets')
          .select('id, subject, status, priority, category, channel, escalated_at, created_at, updated_at, user_id, company_id')
          .order('updated_at', { ascending: false })
          .limit(200),
        supabase.from('profiles').select('id, name, email'),
      ]);
      if (tErr) throw new Error(tErr.message);
      setTickets(rows || []);
      setProfiles(Object.fromEntries((people || []).map((p) => [p.id, p])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openThread = useCallback(async (ticketId) => {
    setSelectedId(ticketId);
    setLoadingThread(true);
    setReply('');
    try {
      const { data, error: mErr } = await supabase
        .from('support_messages')
        .select('id, sender_type, sender_id, message, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (mErr) throw new Error(mErr.message);
      setMessages(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selectedId) return;
    setSending(true);
    setError(null);
    try {
      const { error: iErr } = await supabase.from('support_messages').insert({
        ticket_id: selectedId, sender_type: 'admin', sender_id: user.id, message: text,
      });
      if (iErr) throw new Error(iErr.message);
      // Responder assume o ticket: sai da fila de pendentes e passa a
      // aguardar o cliente.
      await supabase.from('support_tickets')
        .update({ status: 'waiting_user', assigned_to: user.id, updated_at: new Date().toISOString() })
        .eq('id', selectedId);
      setReply('');
      await openThread(selectedId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    if (!selectedId) return;
    try {
      const patch = { status, updated_at: new Date().toISOString() };
      if (status === 'closed' || status === 'resolved') patch.closed_at = new Date().toISOString();
      await supabase.from('support_tickets').update(patch).eq('id', selectedId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'todos') return tickets;
    if (filter === 'ia') return tickets.filter((t) => t.channel === 'chat' && !t.escalated_at && t.status !== 'closed');
    if (filter === 'pendentes') {
      // A IA ainda conduzindo não é pendência humana — só aparece aqui
      // depois de escalar.
      return tickets.filter((t) =>
        ['open', 'in_progress'].includes(t.status) &&
        !(t.channel === 'chat' && !t.escalated_at));
    }
    return tickets;
  }, [tickets, filter]);

  const selected = tickets.find((t) => t.id === selectedId) || null;
  const who = (id) => profiles[id]?.name || profiles[id]?.email || '—';

  const counts = useMemo(() => ({
    pendentes: tickets.filter((t) => ['open', 'in_progress'].includes(t.status) && !(t.channel === 'chat' && !t.escalated_at)).length,
    ia: tickets.filter((t) => t.channel === 'chat' && !t.escalated_at && t.status !== 'closed').length,
    todos: tickets.length,
  }), [tickets]);

  return (
    <AdminLayout title="Suporte" subtitle="Tickets e conversas do chat com IA">
      <style>{`
        .sup-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr); gap:16px; align-items:start; }
        @media (max-width:1080px) { .sup-grid { grid-template-columns:minmax(0,1fr); } }
        .sup-row { width:100%; text-align:left; padding:12px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.02); cursor:pointer; font-family:inherit; color:inherit; transition:all .14s; margin-bottom:8px; }
        .sup-row:hover { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.06); }
        .sup-row[data-active="true"] { border-color:rgba(124,58,237,0.55); background:rgba(124,58,237,0.10); }
        .sup-tab { padding:7px 13px; border-radius:9px; border:1px solid rgba(255,255,255,0.09); background:transparent; color:#bbb; font-family:inherit; font-size:.8rem; font-weight:700; cursor:pointer; }
        .sup-tab[data-active="true"] { background:rgba(124,58,237,0.14); border-color:rgba(124,58,237,0.34); color:#a78bfa; }
        .sup-msg { padding:10px 13px; border-radius:11px; font-size:.85rem; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
      `}</style>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.26)', color: '#ff9ab4', fontSize: '.83rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'pendentes', label: `Precisam de resposta (${counts.pendentes})` },
          { key: 'ia', label: `Com a IA (${counts.ia})` },
          { key: 'todos', label: `Todos (${counts.todos})` },
        ].map((t) => (
          <button key={t.key} type="button" className="sup-tab" data-active={filter === t.key}
            onClick={() => setFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="sup-grid">
          <Card>
            <div style={{ maxHeight: 620, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <EmptyState>Nenhum ticket nesta visão.</EmptyState>
              ) : filtered.map((t) => (
                <button key={t.id} type="button" className="sup-row" data-active={t.id === selectedId}
                  onClick={() => openThread(t.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <Pill meta={STATUS_META[t.status] || STATUS_META.open} />
                    {t.channel === 'chat' && (
                      <Pill meta={t.escalated_at
                        ? { label: 'Escalado pela IA', fg: '#f59e0b', bg: 'rgba(245,158,11,0.1)', bd: 'rgba(245,158,11,0.26)' }
                        : SENDER_META.ai} />
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: PRIORITY_META[t.priority]?.fg || '#777', fontWeight: 700 }}>
                      {PRIORITY_META[t.priority]?.label || t.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#eeede9', marginBottom: 3 }}>{t.subject}</div>
                  <div style={{ fontSize: '.74rem', color: '#888' }}>
                    {who(t.user_id)} · {formatDateTime(t.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {!selected ? (
              <EmptyState>Selecione um ticket para ver a conversa.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 480 }}>
                <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 12 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#eeede9', marginBottom: 4 }}>{selected.subject}</div>
                  <div style={{ fontSize: '.76rem', color: '#888' }}>
                    {who(selected.user_id)} · aberto em {formatDateTime(selected.created_at)}
                    {selected.escalated_at && ` · escalado em ${formatDateTime(selected.escalated_at)}`}
                  </div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                    {['in_progress', 'resolved', 'closed'].map((s) => (
                      <button key={s} type="button" className="sup-tab" data-active={selected.status === s}
                        onClick={() => setStatus(s)}>{STATUS_META[s].label}</button>
                    ))}
                  </div>
                </div>

                <div ref={threadRef} style={{ flex: 1, minHeight: 0, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
                  {loadingThread ? <Spinner /> : messages.length === 0 ? (
                    <EmptyState>Sem mensagens.</EmptyState>
                  ) : messages.map((m) => {
                    const meta = SENDER_META[m.sender_type] || SENDER_META.system;
                    return (
                      <div key={m.id} style={{ alignSelf: m.sender_type === 'user' ? 'flex-start' : 'flex-end', maxWidth: '88%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, justifyContent: m.sender_type === 'user' ? 'flex-start' : 'flex-end' }}>
                          <Pill meta={meta} />
                          <span style={{ fontSize: '.68rem', color: '#777' }}>{formatDateTime(m.created_at)}</span>
                        </div>
                        <div className="sup-msg" style={{ background: meta.bg, border: `1px solid ${meta.bd}`, color: '#eeede9' }}>
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Responder ao cliente..." rows={2}
                    style={{ flex: 1, resize: 'vertical', minHeight: 44, maxHeight: 160, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#eeede9', outline: 'none', fontFamily: 'inherit', fontSize: '.85rem', lineHeight: 1.5, boxSizing: 'border-box' }} />
                  <button type="button" onClick={sendReply} disabled={!reply.trim() || sending}
                    style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.34)', background: 'rgba(124,58,237,0.16)', color: '#a78bfa', fontWeight: 800, fontSize: '.85rem', fontFamily: 'inherit', cursor: sending ? 'wait' : 'pointer', opacity: (!reply.trim() || sending) ? 0.5 : 1, flexShrink: 0 }}>
                    {sending ? 'Enviando...' : 'Responder'}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
