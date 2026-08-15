import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';
import { TICKET_CATEGORY } from '../../lib/supportChat';
import { sanitizeBioHtml, bioPlainText } from '../../lib/richText';

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

// Só a resposta da equipe é composta em rich text; mensagens do cliente/IA/
// sistema continuam texto puro como sempre foram, então só o remetente
// "admin" precisa passar pelo sanitizador antes de virar HTML na tela.
function MessageBody({ message, sender }) {
  if (sender === 'admin') {
    return <div className="sup-msg sup-msg-rich" dangerouslySetInnerHTML={{ __html: sanitizeBioHtml(message) }} />;
  }
  return <div className="sup-msg">{message}</div>;
}

const REPLY_TOOLS = [
  { cmd: 'bold',          titulo: 'Negrito (Ctrl+B)',    rotulo: <strong>N</strong> },
  { cmd: 'italic',        titulo: 'Itálico (Ctrl+I)',    rotulo: <em>I</em> },
  { cmd: 'underline',     titulo: 'Sublinhado (Ctrl+U)', rotulo: <span style={{ textDecoration: 'underline' }}>S</span> },
  { cmd: 'strikeThrough', titulo: 'Riscado',             rotulo: <span style={{ textDecoration: 'line-through' }}>R</span> },
  { sep: true },
  { cmd: 'insertUnorderedList', titulo: 'Lista com marcadores', rotulo: '•' },
  { cmd: 'insertOrderedList',   titulo: 'Lista numerada',       rotulo: '1.' },
  { sep: true },
  { cmd: 'removeFormat',  titulo: 'Limpar formatação',   rotulo: '✕' },
];

// Mesmo padrão de contentEditable + execCommand do editor da bio do perfil —
// aqui reimplementado localmente (tema escuro fixo do admin, não teria como
// reaproveitar o componente da bio sem herdar as cores do tema claro/escuro
// do resto do app).
function ReplyEditor({ valueHtml, onChangeHtml, disabled }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (valueHtml || '')) el.innerHTML = valueHtml || '';
  }, [valueHtml]);

  const exec = (cmd) => {
    ref.current?.focus();
    document.execCommand(cmd, false, null);
    onChangeHtml(ref.current?.innerHTML || '');
  };

  return (
    <div className="sup-rt-wrap" aria-disabled={disabled || undefined}>
      <div className="sup-rt-toolbar" role="toolbar" aria-label="Formatação">
        {REPLY_TOOLS.map((t, i) => (
          t.sep
            ? <span key={`sep-${i}`} className="sup-rt-sep" />
            : (
              <button key={t.cmd} type="button" className="sup-rt-btn" title={t.titulo} aria-label={t.titulo}
                disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); exec(t.cmd); }}>
                {t.rotulo}
              </button>
            )
        ))}
      </div>
      <div
        ref={ref}
        className="sup-rt-input"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Responder ao cliente"
        data-placeholder="Responder ao cliente..."
        onInput={(e) => onChangeHtml(e.currentTarget.innerHTML)}
        onPaste={(e) => {
          e.preventDefault();
          const texto = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, texto);
        }}
      />
    </div>
  );
}

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyHtml, setReplyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: tErr }, { data: people }] = await Promise.all([
        supabase.from('support_tickets')
          .select('id, ticket_number, subject, status, priority, category, channel, escalated_at, created_at, updated_at, user_id, company_id')
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
    setReplyHtml('');
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

  const closeModal = useCallback(() => {
    setSelectedId(null);
    setMessages([]);
    setReplyHtml('');
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendReply = async () => {
    const limpo = sanitizeBioHtml(replyHtml);
    const text = bioPlainText(limpo);
    if (!text || !selectedId) return;
    setSending(true);
    setError(null);
    try {
      const { error: iErr } = await supabase.from('support_messages').insert({
        ticket_id: selectedId, sender_type: 'admin', sender_id: user.id, message: limpo,
      });
      if (iErr) throw new Error(iErr.message);
      // Responder assume o ticket: sai da fila de pendentes e passa a
      // aguardar o cliente.
      await supabase.from('support_tickets')
        .update({ status: 'waiting_user', assigned_to: user.id, updated_at: new Date().toISOString() })
        .eq('id', selectedId);
      setReplyHtml('');
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

  const who = useCallback((id) => profiles[id]?.name || profiles[id]?.email || '—', [profiles]);

  const filtered = useMemo(() => {
    let rows = tickets;
    if (tab === 'ia') rows = rows.filter((t) => t.channel === 'chat' && !t.escalated_at && t.status !== 'closed');
    else if (tab === 'pendentes') {
      // A IA ainda conduzindo não é pendência humana — só aparece aqui
      // depois de escalar.
      rows = rows.filter((t) =>
        ['open', 'in_progress'].includes(t.status) &&
        !(t.channel === 'chat' && !t.escalated_at));
    }

    if (statusFilter) rows = rows.filter((t) => t.status === statusFilter);
    if (categoryFilter) rows = rows.filter((t) => t.category === categoryFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((t) =>
        (t.subject || '').toLowerCase().includes(q) ||
        String(t.ticket_number ?? '').includes(q) ||
        who(t.user_id).toLowerCase().includes(q));
    }
    return rows;
  }, [tickets, tab, statusFilter, categoryFilter, search, who]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const counts = useMemo(() => ({
    todos: tickets.length,
    pendentes: tickets.filter((t) => ['open', 'in_progress'].includes(t.status) && !(t.channel === 'chat' && !t.escalated_at)).length,
    ia: tickets.filter((t) => t.channel === 'chat' && !t.escalated_at && t.status !== 'closed').length,
  }), [tickets]);

  const replyEmpty = !bioPlainText(replyHtml);

  return (
    <AdminLayout title="Suporte" subtitle="Tickets e conversas do chat com IA">
      <style>{`
        .sup-row { width:100%; text-align:left; padding:12px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.02); cursor:pointer; font-family:inherit; color:inherit; transition:all .14s; margin-bottom:8px; }
        .sup-row:hover { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.06); }
        .sup-row[data-active="true"] { border-color:rgba(124,58,237,0.55); background:rgba(124,58,237,0.10); }
        .sup-tab { padding:7px 13px; border-radius:9px; border:1px solid rgba(255,255,255,0.09); background:transparent; color:#bbb; font-family:inherit; font-size:.8rem; font-weight:700; cursor:pointer; }
        .sup-tab[data-active="true"] { background:rgba(124,58,237,0.14); border-color:rgba(124,58,237,0.34); color:#a78bfa; }
        .sup-msg { padding:10px 13px; border-radius:11px; font-size:.85rem; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
        .sup-msg-rich { white-space:normal; }
        .sup-msg-rich ul, .sup-msg-rich ol { padding-left:20px; margin:6px 0; }
        .sup-msg-rich li { margin:2px 0; }
        .sup-msg-rich p { margin:6px 0; }
        .sup-msg-rich a { color:#a78bfa; text-decoration:underline; }

        .sup-rt-wrap { border:1px solid rgba(255,255,255,0.1); border-radius:10px; background:rgba(0,0,0,0.25); overflow:hidden; transition:border-color .15s; }
        .sup-rt-wrap:focus-within { border-color:rgba(124,58,237,.55); }
        .sup-rt-toolbar { display:flex; align-items:center; gap:2px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.07); flex-wrap:wrap; }
        .sup-rt-btn { min-width:28px; height:28px; padding:0 7px; border-radius:7px; border:1px solid transparent; background:transparent; color:#eeede9; font-family:inherit; font-size:.82rem; line-height:1; cursor:pointer; transition:all .12s; }
        .sup-rt-btn:hover:not(:disabled) { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.1); }
        .sup-rt-btn:disabled { opacity:.4; cursor:not-allowed; }
        .sup-rt-sep { width:1px; height:18px; margin:0 4px; background:rgba(255,255,255,0.1); }
        .sup-rt-input { min-height:70px; max-height:220px; overflow-y:auto; padding:10px 12px; outline:none; font-family:inherit; font-size:.85rem; line-height:1.55; color:#eeede9; }
        .sup-rt-input:empty::before { content:attr(data-placeholder); color:#777; pointer-events:none; }
        .sup-rt-input ul, .sup-rt-input ol { padding-left:20px; margin:6px 0; }
        .sup-rt-input li { margin:2px 0; }
        .sup-rt-input p { margin:6px 0; }
        .sup-rt-input a { color:#a78bfa; text-decoration:underline; }
      `}</style>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.26)', color: '#ff9ab4', fontSize: '.83rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { key: 'todos', label: `Todos (${counts.todos})` },
          { key: 'pendentes', label: `Precisam de resposta (${counts.pendentes})` },
          { key: 'ia', label: `Com a IA (${counts.ia})` },
        ].map((t) => (
          <button key={t.key} type="button" className="sup-tab" data-active={tab === t.key}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="admin-input" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por assunto, nº ou cliente" style={{ flex: 1, minWidth: 200 }} />
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', flexShrink: 0 }} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="admin-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 'auto', flexShrink: 0 }} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {Object.entries(TICKET_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <Card>
          <div style={{ maxHeight: 620, overflowY: 'auto', padding: 12 }}>
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
                <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#eeede9', marginBottom: 3 }}>
                  {t.ticket_number ? `#${t.ticket_number} · ` : ''}{t.subject}
                </div>
                <div style={{ fontSize: '.74rem', color: '#888' }}>
                  {who(t.user_id)} · {formatDateTime(t.updated_at)}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={closeModal}
        title={selected ? `${selected.ticket_number ? `#${selected.ticket_number} · ` : ''}${selected.subject}` : 'Ticket'}
        width={760}
        footer={selected && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ReplyEditor valueHtml={replyHtml} onChangeHtml={setReplyHtml} disabled={sending} />
            <button type="button" onClick={sendReply} disabled={replyEmpty || sending}
              style={{ alignSelf: 'flex-end', padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.34)', background: 'rgba(124,58,237,0.16)', color: '#a78bfa', fontWeight: 800, fontSize: '.85rem', fontFamily: 'inherit', cursor: sending ? 'wait' : 'pointer', opacity: (replyEmpty || sending) ? 0.5 : 1 }}>
              {sending ? 'Enviando...' : 'Responder'}
            </button>
          </div>
        )}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 12 }}>
              <div style={{ fontSize: '.76rem', color: '#888' }}>
                {who(selected.user_id)} · aberto em {formatDateTime(selected.created_at)}
                {selected.escalated_at && ` · escalado em ${formatDateTime(selected.escalated_at)}`}
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                {['in_progress', 'waiting_user', 'resolved', 'closed'].map((s) => (
                  <button key={s} type="button" className="sup-tab" data-active={selected.status === s}
                    onClick={() => setStatus(s)}>{STATUS_META[s].label}</button>
                ))}
              </div>
            </div>

            <div ref={threadRef} style={{ minHeight: 200, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
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
                    <div style={{ background: meta.bg, border: `1px solid ${meta.bd}`, color: '#eeede9', borderRadius: 11 }}>
                      <MessageBody message={m.message} sender={m.sender_type} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
