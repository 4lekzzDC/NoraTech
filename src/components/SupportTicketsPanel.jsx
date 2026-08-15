import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchMyTickets, fetchChatMessages,
  TICKET_STATUS, TICKET_CATEGORY, SENDER_LABEL,
} from '../lib/supportChat';

const FONT_INTER = "'Inter', sans-serif";
const PAGE_SIZES = [5, 10, 15];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "há 2 horas" comunica melhor que um timestamp quando o ponto é saber se a
// conversa esfriou; acima de uma semana a data absoluta volta a ser mais útil.
function formatRelative(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return formatDate(iso);
}

// Larguras fixas (tableLayout:'fixed') para as colunas curtas; só "Assunto"
// fica elástica. 118px no status cabe "Aguardando" + a bolinha sem encostar
// na data da coluna seguinte.
const COLUMNS = [
  { key: 'status',       label: 'Status',    width: 118,  sortable: true },
  { key: 'created_at',   label: 'Criado em', width: 100,  sortable: true },
  { key: 'ticket_number', label: 'ID',       width: 58,   sortable: true },
  { key: 'subject',      label: 'Assunto',   width: null, sortable: true },
  { key: 'category',     label: 'Categoria', width: 150,  sortable: false },
  { key: 'last',         label: 'Último trâmite', width: 168, sortable: true },
];

export default function SupportTicketsPanel({ C, isDark, onBack, onNewTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });

  const [openTicket, setOpenTicket] = useState(null);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fetchMyTickets();
        if (active) setTickets(rows);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Qualquer mudança de filtro volta para a primeira página — senão o usuário
  // filtra e cai numa página que já não existe no resultado novo.
  useEffect(() => { setPage(0); }, [search, categoryFilter, pageSize]);

  const toggleSort = useCallback((key) => {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'subject' ? 'asc' : 'desc' }));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = tickets;
    if (categoryFilter) rows = rows.filter((t) => t.category === categoryFilter);
    if (q) {
      rows = rows.filter((t) =>
        (t.subject || '').toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q));
    }

    const val = (t) => {
      switch (sort.key) {
        // Ordena pelo grupo (Aguardando/Respondido/Concluído), não pelo status
        // cru — é o que a coluna mostra.
        case 'status': return TICKET_STATUS[t.status]?.group ?? '';
        case 'subject': return (t.subject || '').toLowerCase();
        case 'ticket_number': return t.ticket_number ?? 0;
        case 'last': return new Date(t.last_message_at || t.created_at).getTime();
        default: return new Date(t.created_at).getTime();
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [tickets, search, categoryFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const openThread = useCallback(async (ticket) => {
    setOpenTicket(ticket);
    setLoadingThread(true);
    try {
      setThread(await fetchChatMessages(ticket.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const inputStyle = {
    padding: '7px 10px', borderRadius: 9, border: `1px solid ${C.cardBd}`,
    background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', color: C.text,
    outline: 'none', fontFamily: FONT_INTER, fontSize: '0.78rem', boxSizing: 'border-box',
  };

  // ── Conversa de um ticket ──
  if (openTicket) {
    const st = TICKET_STATUS[openTicket.status] || TICKET_STATUS.open;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'min(560px, 72vh)', fontFamily: FONT_INTER }}>
        <div style={{ padding: '22px 24px 12px', flexShrink: 0 }}>
          <button type="button" onClick={() => { setOpenTicket(null); setThread([]); }} style={backBtn(C)}>
            <ChevronLeft /> Voltar aos tickets
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text }}>
              #{openTicket.ticket_number} · {openTicket.subject}
            </h2>
          </div>
          <p style={{ fontSize: '0.76rem', color: C.muted }}>
            {st.label} · {TICKET_CATEGORY[openTicket.category] || openTicket.category} · aberto em {formatDate(openTicket.created_at)}
          </p>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {loadingThread ? (
            <div style={{ margin: 'auto', color: C.muted, fontSize: '0.82rem' }}>Carregando...</div>
          ) : thread.length === 0 ? (
            <div style={{ margin: 'auto', color: C.muted, fontSize: '0.82rem' }}>Sem mensagens neste ticket.</div>
          ) : thread.map((m) => {
            const mine = m.sender_type === 'user';
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: '0.66rem', color: C.muted, marginBottom: 3, textAlign: mine ? 'right' : 'left' }}>
                  {SENDER_LABEL[m.sender_type] || m.sender_type} · {formatRelative(m.created_at)}
                </div>
                <div style={{
                  padding: '10px 13px', borderRadius: 13,
                  background: mine ? 'rgba(99,102,241,0.16)' : C.cardBg,
                  border: `1px solid ${mine ? 'rgba(99,102,241,0.3)' : C.cardBd}`,
                  color: C.text, fontSize: '0.84rem', lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Listagem ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'min(600px, 78vh)', fontFamily: FONT_INTER }}>
      <style>{`
        .tk-th { text-align:left; font-size:.66rem; font-weight:800; letter-spacing:.7px; text-transform:uppercase; color:${C.muted}; padding:0 8px 8px; white-space:nowrap; }
        .tk-th[data-sortable="true"] { cursor:pointer; user-select:none; }
        .tk-th[data-sortable="true"]:hover { color:${C.text}; }
        .tk-row { cursor:pointer; transition:background .13s; }
        .tk-row:hover td { background:${isDark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)'}; }
        .tk-td { padding:11px 8px; font-size:.79rem; color:${C.text}; border-top:1px solid ${C.cardBd}; vertical-align:middle; }
        .tk-page-btn:disabled { opacity:.35; cursor:not-allowed; }
      `}</style>

      <div style={{ padding: '22px 24px 14px', flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={backBtn(C)}>
          <ChevronLeft /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.3, color: C.text, marginBottom: 4 }}>Tickets</h2>
            <p style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.45 }}>
              Acompanhe suas solicitações e o que a equipe respondeu.
            </p>
          </div>
          <button type="button" onClick={onNewTicket}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontWeight: 800, fontSize: '0.83rem', fontFamily: FONT_INTER, cursor: 'pointer', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Abrir ticket
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por assunto ou nº"
          style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria"
          style={{ ...inputStyle, cursor: 'pointer', flexShrink: 0 }}>
          <option value="">Todas as categorias</option>
          {Object.entries(TICKET_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ margin: '0 24px 10px', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.26)', color: '#ff9ab4', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '0.82rem' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '0.82rem', lineHeight: 1.6 }}>
            {tickets.length === 0
              ? 'Você ainda não abriu nenhum ticket.'
              : 'Nenhum ticket encontrado com esses filtros.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="tk-th" data-sortable={col.sortable}
                    style={{ width: col.width ?? undefined }}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}>
                    {col.label}
                    {col.sortable && sort.key === col.key && (
                      <span style={{ marginLeft: 4, color: '#a78bfa' }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => {
                const st = TICKET_STATUS[t.status] || TICKET_STATUS.open;
                return (
                  <tr key={t.id} className="tk-row" onClick={() => openThread(t)}>
                    <td className="tk-td">
                      <span title={st.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: C.muted }}>{st.label}</span>
                      </span>
                    </td>
                    <td className="tk-td" style={{ color: C.muted, fontSize: '0.75rem' }}>{formatDate(t.created_at)}</td>
                    <td className="tk-td" style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>#{t.ticket_number}</td>
                    <td className="tk-td" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>
                      {t.subject}
                    </td>
                    <td className="tk-td" style={{ color: C.muted, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {TICKET_CATEGORY[t.category] || t.category}
                    </td>
                    <td className="tk-td" style={{ color: C.muted, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.last_message_sender
                        ? `${SENDER_LABEL[t.last_message_sender] || t.last_message_sender} · ${formatRelative(t.last_message_at)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ padding: '12px 24px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.cardBd}`, marginTop: 8 }}>
          <span style={{ fontSize: '0.74rem', color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} · página {page + 1} de {totalPages}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
              {PAGE_SIZES.map((n, i) => (
                <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {i > 0 && <span style={{ color: C.muted, opacity: 0.5 }}>|</span>}
                  <button type="button" onClick={() => setPageSize(n)} aria-label={`${n} por página`}
                    style={{
                      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: FONT_INTER, fontSize: '0.74rem',
                      fontWeight: pageSize === n ? 800 : 600,
                      color: pageSize === n ? '#a78bfa' : C.muted,
                    }}>
                    {n}
                  </button>
                </span>
              ))}
            </span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="tk-page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              style={pageBtn(C)}>Anterior</button>
            <button type="button" className="tk-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
              style={pageBtn(C)}>Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

const backBtn = (C) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
  background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer',
  fontSize: '0.8rem', fontWeight: 600, fontFamily: FONT_INTER, padding: 0,
});

const pageBtn = (C) => ({
  padding: '6px 13px', borderRadius: 8, border: `1px solid ${C.cardBd}`,
  background: 'transparent', color: C.text, fontSize: '0.76rem', fontWeight: 700,
  fontFamily: FONT_INTER, cursor: 'pointer',
});
