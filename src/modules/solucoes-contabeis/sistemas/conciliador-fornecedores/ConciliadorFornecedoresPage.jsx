import { createContext, useContext, useRef, useState } from 'react';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import {
  parseFile, processGroups, getStatus,
  exportToXlsx, fmtBRL, loadLastSummary, saveLastSummary,
} from './cfornEngine';

// ── Palette context ──────────────────────────────────────────────────
const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// ── Shared UI ────────────────────────────────────────────────────────
function NavBtn({ active, onClick, children }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 8, fontFamily: FONT_INTER,
      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>
      {children}
    </button>
  );
}

function FilterTab({ active, onClick, children }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 7, fontFamily: FONT_INTER,
      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.14s',
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>
      {children}
    </button>
  );
}

// ── Dropzone ─────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const P = useP();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handle = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'txt', 'csv'].includes(ext)) {
      alert('Formatos aceitos: XLSX, XLS, TXT, CSV');
      return;
    }
    onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? P.primary : P.border2}`,
        borderRadius: 14, padding: '44px 32px', textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? P.primarySoft : P.surface,
        transition: 'all 0.18s', opacity: disabled ? 0.6 : 1,
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.txt,.csv"
        style={{ display: 'none' }} onChange={(e) => handle(e.target.files[0])} disabled={disabled} />
      <div style={{ fontSize: '2rem', marginBottom: 10 }}>📂</div>
      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: P.text, marginBottom: 5 }}>
        {disabled ? 'Processando…' : 'Arraste o razão aqui ou clique para selecionar'}
      </div>
      <div style={{ fontSize: '0.78rem', color: P.muted }}>
        Formatos: XLSX, XLS, TXT, CSV · Os históricos devem conter o número da NF entre {'<'} e {'>'}
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────
const STATUS_CFG = {
  conciliado: { label: 'Conciliado',  bg: 'rgba(52,211,153,.12)',  color: '#34d399' },
  pendente:   { label: 'Pendente',    bg: 'rgba(251,146,60,.12)',  color: '#f97316' },
  excesso:    { label: 'Pago a mais', bg: 'rgba(255,92,92,.12)',   color: '#ff5c5c' },
};
const STATUS_ORDER = { excesso: 0, pendente: 1, conciliado: 2 };

function Badge({ status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
      borderRadius: 100, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── Home panel ────────────────────────────────────────────────────────
function HomePanel({ lastSummary, onGoTo }) {
  const P = useP();

  const statsFromSummary = lastSummary ? [
    { label: 'NFs analisadas',  value: lastSummary.total,    color: P.text },
    { label: 'Conciliadas',     value: lastSummary.ok,       color: '#34d399',  acBg: 'rgba(52,211,153,.06)',  acBo: 'rgba(52,211,153,.14)' },
    { label: 'Pendentes',       value: lastSummary.pendente, color: '#f97316',  acBg: 'rgba(251,146,60,.06)', acBo: 'rgba(251,146,60,.14)' },
    { label: 'Pagas a mais',    value: lastSummary.excesso,  color: '#ff5c5c',  acBg: 'rgba(255,92,92,.06)',  acBo: 'rgba(255,92,92,.14)' },
  ] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {lastSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {statsFromSummary.map((s, i) => (
            <div key={i} style={{
              background: s.acBg || P.surface, border: `1px solid ${s.acBo || P.border}`,
              borderRadius: 12, padding: '18px 20px', boxShadow: P.shadow,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Como funciona */}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: '22px 26px', boxShadow: P.shadow }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '0.8rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Como funciona
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { icon: '📁', title: 'Envie o razão',        desc: 'Carregue o razão contábil da conta de fornecedores em XLSX ou TXT.' },
            { icon: '🔍', title: 'Extração por NF',      desc: 'O sistema identifica cada NF pelo padrão <NF> no histórico e separa compras de pagamentos.' },
            { icon: '✅', title: 'Resultado visual',     desc: 'Veja quais NFs estão conciliadas, pendentes ou pagas a mais. Exporte o relatório.' },
          ].map((s, i) => (
            <div key={i} style={{ background: P.surface2, borderRadius: 10, padding: '16px', border: `1px solid ${P.border}` }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, color: P.text, marginBottom: 5 }}>{s.title}</div>
              <div style={{ fontSize: '0.76rem', color: P.muted, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, borderRadius: 10, padding: '13px 16px', fontSize: '0.81rem', color: P.primaryText, lineHeight: 1.6 }}>
        <strong>Padrão esperado:</strong> O histórico de cada lançamento deve conter o número da nota fiscal entre colchetes angulares — ex: <code style={{ fontFamily: FONT_MONO, fontSize: '0.78rem' }}>&lt;NF 1234&gt;</code>.
        Lançamentos sem esse padrão são ignorados.
      </div>

      {lastSummary && (
        <button onClick={() => onGoTo('resultado')} style={{
          alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 9,
          background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
          color: P.primaryText, fontFamily: FONT_INTER, fontSize: '0.84rem',
          fontWeight: 700, cursor: 'pointer',
        }}>
          Ver último resultado →
        </button>
      )}
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────
function UploadPanel({ onProcessed }) {
  const P = useP();
  const [processing, setProcessing] = useState(false);
  const [fileName,   setFileName]   = useState('');
  const [preview,    setPreview]    = useState(null); // { txs, count }
  const [error,      setError]      = useState('');

  const handleFile = async (file) => {
    setProcessing(true);
    setPreview(null);
    setError('');
    setFileName(file.name);
    try {
      const txs = await parseFile(file);
      if (txs.length === 0) {
        setError('Nenhum lançamento com padrão <NF> encontrado. Verifique se os históricos contêm o número da nota entre < e >.');
        return;
      }
      setPreview({ txs, count: txs.length });
    } catch (err) {
      setError('Erro ao ler arquivo: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = () => {
    if (!preview) return;
    const groups = processGroups(preview.txs);
    const summary = saveLastSummary(groups);
    onProcessed({ groups, transactions: preview.txs, summary });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <DropZone onFile={handleFile} disabled={processing} />

      {processing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: P.surface, borderRadius: 12, border: `1px solid ${P.border}` }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${P.primaryBorder}`, borderTopColor: P.primary, animation: 'cforn-spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.86rem', color: P.muted }}>Lendo arquivo…</span>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(255,92,92,.08)', border: '1px solid rgba(255,92,92,.20)', borderRadius: 10, padding: '13px 16px', color: '#ff5c5c', fontSize: '0.84rem' }}>
          ⚠️ {error}
        </div>
      )}

      {preview && (
        <>
          {/* Preview dos primeiros lançamentos */}
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: P.shadow }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Preview · {preview.count} lançamento{preview.count !== 1 ? 's' : ''} detectado{preview.count !== 1 ? 's' : ''}
                </span>
                {preview.count > 20 && <span style={{ fontSize: '0.74rem', color: P.muted2, marginLeft: 8 }}>(exibindo 20)</span>}
              </div>
              <span style={{ fontSize: '0.78rem', color: P.muted, fontFamily: FONT_MONO }}>{fileName}</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: FONT_INTER }}>
                <thead>
                  <tr style={{ background: P.surface2 }}>
                    {['NF', 'Data', 'Histórico', 'Tipo', 'Valor'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: i >= 3 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: P.surface2 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.txs.slice(0, 20).map((tx, i) => {
                    const isPay = tx.debit > 0;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '7px 12px', fontFamily: FONT_MONO, fontSize: '0.76rem', color: '#f0b429', fontWeight: 700 }}>{tx.nf}</td>
                        <td style={{ padding: '7px 12px', color: P.muted, whiteSpace: 'nowrap', fontFamily: FONT_MONO, fontSize: '0.76rem' }}>{tx.date || '—'}</td>
                        <td style={{ padding: '7px 12px', color: P.text, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description.substring(0, 80)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 100, background: isPay ? 'rgba(52,211,153,.1)' : 'rgba(251,146,60,.1)', color: isPay ? '#34d399' : '#f97316' }}>
                            {isPay ? 'Pagamento' : 'Compra'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', color: isPay ? '#34d399' : '#f97316' }}>
                          {fmtBRL(isPay ? tx.debit : tx.credit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleProcess} style={{ padding: '10px 24px', borderRadius: 10, background: P.primary, border: 'none', color: '#fff', fontFamily: FONT_INTER, fontSize: '0.87rem', fontWeight: 700, cursor: 'pointer' }}>
              Analisar conciliação →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Result panel ──────────────────────────────────────────────────────
function ResultPanel({ groups, transactions }) {
  const P = useP();
  const [filter,   setFilter]   = useState('todos');
  const [expanded, setExpanded] = useState(new Set());

  const toggleRow = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const tot     = groups.length;
  const ok      = groups.filter((g) => getStatus(g) === 'conciliado').length;
  const pend    = groups.filter((g) => getStatus(g) === 'pendente').length;
  const exc     = groups.filter((g) => getStatus(g) === 'excesso').length;
  const totOpen = groups.filter((g) => getStatus(g) === 'pendente').reduce((s, g) => s + (g.totalCompras - g.totalPagamentos), 0);
  const totExc  = groups.filter((g) => getStatus(g) === 'excesso').reduce((s, g) => s + Math.abs(g.totalCompras - g.totalPagamentos), 0);

  const tabCounts = { todos: tot, conciliado: ok, pendente: pend, excesso: exc };
  const filtered = groups
    .filter((g) => filter === 'todos' || getStatus(g) === filter)
    .sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 18px', boxShadow: P.shadow }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Total NFs analisadas</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: P.text }}>{tot}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <span style={{ fontSize: '0.76rem', color: '#34d399' }}>✅ {ok}</span>
            <span style={{ fontSize: '0.76rem', color: '#f97316' }}>⏳ {pend}</span>
            <span style={{ fontSize: '0.76rem', color: '#ff5c5c' }}>❌ {exc}</span>
          </div>
        </div>
        <div style={{ background: 'rgba(251,146,60,.06)', border: '1px solid rgba(251,146,60,.15)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Total em aberto</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f97316', fontFamily: FONT_MONO }}>{fmtBRL(totOpen)}</div>
          <div style={{ fontSize: '0.72rem', color: P.muted, marginTop: 4 }}>{pend} NF{pend !== 1 ? 's' : ''} com pagamento pendente</div>
        </div>
        <div style={{ background: 'rgba(255,92,92,.06)', border: '1px solid rgba(255,92,92,.15)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Total pago a mais</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ff5c5c', fontFamily: FONT_MONO }}>{fmtBRL(totExc)}</div>
          <div style={{ fontSize: '0.72rem', color: P.muted, marginTop: 4 }}>{exc} NF{exc !== 1 ? 's' : ''} com excesso de pagamento</div>
        </div>
      </div>

      {/* Filtros + exportar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['todos', 'conciliado', 'pendente', 'excesso'].map((f) => (
            <FilterTab key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === 'todos' ? 'Todos' : f === 'conciliado' ? 'Conciliados' : f === 'pendente' ? 'Pendentes' : 'Pago a mais'}
              <span style={{ marginLeft: 5, fontSize: '0.7rem', opacity: 0.75 }}>({tabCounts[f]})</span>
            </FilterTab>
          ))}
        </div>
        <button
          onClick={() => exportToXlsx(groups, transactions)}
          style={{ padding: '7px 16px', borderRadius: 8, background: P.primary, border: 'none', color: '#fff', fontFamily: FONT_INTER, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Exportar Excel ↓
        </button>
      </div>

      {/* Tabela */}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: P.shadow }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: P.muted, fontSize: '0.88rem' }}>
            Nenhuma NF neste filtro.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  <th style={{ width: 28 }} />
                  {['NF', 'Fornecedor', 'Total Compras', 'Total Pago', 'Diferença', 'Status'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const st   = getStatus(g);
                  const diff = g.totalCompras - g.totalPagamentos;
                  const open = expanded.has(g.key);
                  return [
                    // Linha principal
                    <tr key={g.key}
                      onClick={() => toggleRow(g.key)}
                      style={{ borderBottom: `1px solid ${P.border}`, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '9px 6px 9px 14px', color: P.muted2, fontSize: '0.76rem', textAlign: 'center' }}>
                        {open ? '▼' : '▶'}
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: FONT_MONO, fontSize: '0.8rem', fontWeight: 700, color: '#f0b429' }}>{g.nf}</td>
                      <td style={{ padding: '9px 14px', color: P.muted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{g.supplier || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', color: P.text }}>{fmtBRL(g.totalCompras)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', color: P.text }}>{fmtBRL(g.totalPagamentos)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem' }}>
                        {st === 'conciliado'
                          ? <span style={{ color: P.muted2 }}>—</span>
                          : st === 'pendente'
                            ? <span style={{ color: '#f97316' }}>− {fmtBRL(diff)}</span>
                            : <span style={{ color: '#ff5c5c' }}>+ {fmtBRL(Math.abs(diff))}</span>}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}><Badge status={st} /></td>
                    </tr>,
                    // Linha de detalhe (expandível)
                    open && (
                      <tr key={g.key + '-detail'} style={{ borderBottom: `1px solid ${P.border}` }}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: '12px 16px 16px 42px', background: P.surface2, borderBottom: `1px solid ${P.border}` }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: P.muted, marginBottom: 10 }}>
                              Lançamentos da NF {g.nf}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Data', 'Histórico', 'Tipo', 'Valor'].map((h, i) => (
                                    <th key={i} style={{ padding: '4px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 600, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.transactions.map((tx, ti) => {
                                  const ip = tx.debit > 0;
                                  return (
                                    <tr key={ti} style={{ borderTop: `1px solid ${P.border}` }}>
                                      <td style={{ padding: '5px 10px', color: P.muted, whiteSpace: 'nowrap', fontFamily: FONT_MONO, fontSize: '0.75rem' }}>{tx.date || '—'}</td>
                                      <td style={{ padding: '5px 10px', color: P.text, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }} title={tx.description}>{tx.description.substring(0, 120)}</td>
                                      <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 100, background: ip ? 'rgba(52,211,153,.1)' : 'rgba(251,146,60,.1)', color: ip ? '#34d399' : '#f97316' }}>
                                          {ip ? 'Pagamento' : 'Compra'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.78rem', color: ip ? '#34d399' : '#f97316' }}>
                                        {fmtBRL(ip ? tx.debit : tx.credit)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function ConciliadorFornecedoresPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [panel,       setPanel]       = useState('home');
  const [lastSummary, setLastSummary] = useState(() => loadLastSummary());
  const [result,      setResult]      = useState(null); // { groups, transactions }

  const handleProcessed = ({ groups, transactions, summary }) => {
    setResult({ groups, transactions });
    setLastSummary(summary);
    setPanel('resultado');
  };

  const navItems = [
    { key: 'home',      label: 'Início' },
    { key: 'upload',    label: 'Carregar razão' },
    { key: 'resultado', label: 'Resultado', disabled: !result },
  ];

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          @keyframes cforn-spin { to { transform: rotate(360deg); } }
        `}</style>

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
              Conciliador de Fornecedores
            </h1>
            <p style={{ fontSize: '0.88rem', color: P.muted }}>
              Concilie automaticamente compras e pagamentos agrupados por nota fiscal.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {navItems.map((n) => (
              <NavBtn
                key={n.key}
                active={panel === n.key}
                onClick={() => !n.disabled && setPanel(n.key)}
              >
                {n.label}
              </NavBtn>
            ))}
          </div>

          {panel === 'home'      && <HomePanel lastSummary={lastSummary} onGoTo={setPanel} />}
          {panel === 'upload'    && <UploadPanel onProcessed={handleProcessed} />}
          {panel === 'resultado' && result && <ResultPanel groups={result.groups} transactions={result.transactions} />}
          {panel === 'resultado' && !result && (
            <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center', color: P.muted, fontSize: '0.9rem' }}>
              Nenhuma análise realizada ainda. Carregue um arquivo de razão para começar.
            </div>
          )}
        </main>
      </div>
    </PaletteCtx.Provider>
  );
}
