import { createContext, useCallback, useContext, useRef, useState } from 'react';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import { parsePdf, exportToXlsx, fmtBRL, loadHistory, pushHistory, clearHistory } from './transEngine';

const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function ITrendUp({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IList({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6"  x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
function IDollarMinus({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v12M8 10h8"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
    </svg>
  );
}
function IDollarPlus({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8"  y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function IUploadCloud({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}
function IFileDoc({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IExcelIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9"  y1="13" x2="15" y2="19"/>
      <line x1="15" y1="13" x2="9"  y2="19"/>
    </svg>
  );
}
function IDownload({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function ICheck({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IInfo({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8"  x2="12"   y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IShield({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function ITransIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function IHome({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IConvert({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/>
      <path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
    </svg>
  );
}
function IHistoryIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-4"/>
    </svg>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ Icon, label, value, sub, accent }) {
  const P = useP();
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: P.shadow,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        <Icon size={20} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: P.text, lineHeight: 1, letterSpacing: -0.5 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: P.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Nav button ─────────────────────────────────────────────────────────────────
function NavBtn({ active, onClick, Icon, children }) {
  const P = useP();
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '8px 14px', borderRadius: 9,
        border: `1px solid ${active ? P.primaryBorder : 'transparent'}`,
        background: active ? P.primarySoft : 'transparent',
        color: active ? P.primaryText : P.muted,
        fontFamily: FONT_INTER, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

// ── Dropzone ───────────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const P = useP();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Envie apenas arquivos PDF.');
      return;
    }
    onFile(file);
  }, [onFile]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={!disabled ? onDrop : undefined}
      style={{
        border: `2px dashed ${dragging ? '#7C3AED' : P.border2}`,
        borderRadius: 14, padding: '36px 24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? P.primarySoft : (P.surface2 || P.bg),
        transition: 'all 0.18s', opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
        disabled={disabled}
      />
      <div style={{ color: '#7C3AED', marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
        <IUploadCloud size={38} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 6 }}>
        {disabled ? 'Processando…' : 'Arraste e solte seu arquivo aqui'}
      </div>
      {!disabled && (
        <>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 18 }}>
            ou clique no botão abaixo para selecionar
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 22px', borderRadius: 9,
              background: '#7C3AED', color: '#fff', border: 'none',
              fontFamily: FONT_INTER, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <IFileDoc size={14} /> Selecionar arquivo
          </button>
        </>
      )}
    </div>
  );
}

// ── HomePanel ──────────────────────────────────────────────────────────────────
function HomePanel({ history, onNavigate }) {
  const P = useP();
  const totalConversoes = history.length;
  const totalLinhas     = history.reduce((a, h) => a + h.rows, 0);
  const last            = history[0] || null;

  const steps = [
    { Icon: IUploadCloud, title: 'Envie o PDF',         desc: 'Faça upload do extrato bancário em formato PDF.' },
    { Icon: IConvert,     title: 'Extração automática', desc: 'O sistema lê e classifica cada lançamento em Pagar ou Receber.' },
    { Icon: IExcelIcon,   title: 'Exporte para Excel',  desc: 'Baixe a planilha organizada, pronta para o sistema contábil.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <StatCard Icon={ITrendUp}    accent="#7C3AED" label="Conversões realizadas" value={totalConversoes}                       sub="Total de conversões" />
        <StatCard Icon={IList}       accent="#7C3AED" label="Linhas processadas"    value={totalLinhas.toLocaleString('pt-BR')} sub="Total de linhas" />
        <StatCard Icon={IDollarMinus} accent={last ? '#ef4444' : '#7C3AED'} label="Último Total a Pagar"
          value={last ? `R$ ${fmtBRL(last.totalPagar)}` : '—'} sub={last ? 'Último registro' : 'Nenhum registro'} />
        <StatCard Icon={IDollarPlus}  accent={last ? '#10b981' : '#7C3AED'} label="Último Total a Receber"
          value={last ? `R$ ${fmtBRL(last.totalReceber)}` : '—'} sub={last ? 'Último registro' : 'Nenhum registro'} />
      </div>

      {/* Como funciona */}
      <div style={{
        background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 14, padding: '22px 24px', boxShadow: P.shadow,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Como funciona
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              background: P.surface2 || P.bg, borderRadius: 12, padding: '18px 16px',
              border: `1px solid ${P.border}`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, marginBottom: 14,
                background: 'rgba(124,58,237,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED',
              }}>
                <s.Icon size={18} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigate('converter')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderRadius: 14, width: '100%',
          background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
          cursor: 'pointer', fontFamily: FONT_INTER, color: P.primaryText,
          boxShadow: P.shadow, textAlign: 'left', transition: 'filter 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.97)')}
        onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Iniciar conversão</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Acesse o conversor para transformar seu PDF em Excel.</div>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: '#7C3AED', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IConvert size={14} />
        </div>
      </button>

      {/* Format info */}
      <InfoBanner />
    </div>
  );
}

// ── ConverterPanel ─────────────────────────────────────────────────────────────
function ConverterPanel({ onHistoryUpdate, isLight, history }) {
  const P = useP();
  const [processing,   setProcessing]   = useState(false);
  const [rows,         setRows]         = useState(null);
  const [fileName,     setFileName]     = useState('');
  const [fileSize,     setFileSize]     = useState('');
  const [error,        setError]        = useState('');
  const [processedAt,  setProcessedAt]  = useState('');

  const totalConversoes = history.length;
  const totalLinhas     = history.reduce((a, h) => a + h.rows, 0);
  const last            = history[0] || null;

  const totalPagar   = rows ? rows.reduce((a, r) => a + r.pagar,   0) : 0;
  const totalReceber = rows ? rows.reduce((a, r) => a + r.receber, 0) : 0;
  const saldo        = totalReceber - totalPagar;

  const redRgb = isLight ? '220,38,38' : '255,92,92';

  const handleFile = async (file) => {
    setProcessing(true);
    setRows(null);
    setError('');
    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(2) + ' MB');
    setProcessedAt('');

    try {
      const { rows: parsed } = await parsePdf(file);

      if (parsed.length === 0) {
        setError('Nenhum lançamento identificado. Verifique se o PDF é um extrato bancário válido (formato Santander ou similar).');
        return;
      }

      setRows(parsed);
      setProcessedAt(new Date().toLocaleString('pt-BR'));

      const entry = {
        date:         new Date().toLocaleString('pt-BR'),
        fileName:     file.name,
        rows:         parsed.length,
        totalPagar:   parsed.reduce((a, r) => a + r.pagar,   0),
        totalReceber: parsed.reduce((a, r) => a + r.receber, 0),
      };
      onHistoryUpdate(pushHistory(entry, loadHistory()));
    } catch (err) {
      setError('Erro ao processar PDF: ' + err.message);
      console.error('TE Error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <StatCard Icon={ITrendUp}    accent="#7C3AED" label="Conversões realizadas" value={totalConversoes}                       sub="Total de conversões" />
        <StatCard Icon={IList}       accent="#7C3AED" label="Linhas processadas"    value={totalLinhas.toLocaleString('pt-BR')} sub="Total de linhas" />
        <StatCard Icon={IDollarMinus} accent={last ? '#ef4444' : '#7C3AED'} label="Último Total a Pagar"
          value={last ? `R$ ${fmtBRL(last.totalPagar)}` : '—'} sub={last ? 'Último registro' : 'Nenhum registro'} />
        <StatCard Icon={IDollarPlus}  accent={last ? '#10b981' : '#7C3AED'} label="Último Total a Receber"
          value={last ? `R$ ${fmtBRL(last.totalReceber)}` : '—'} sub={last ? 'Último registro' : 'Nenhum registro'} />
      </div>

      {/* Two-column: upload | result */}
      <div className="te-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

        {/* Left: Upload card */}
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 16, boxShadow: P.shadow, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '17px 22px', borderBottom: `1px solid ${P.border}`,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(124,58,237,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED',
            }}>
              <IUploadCloud size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Enviar extrato em PDF</div>
              <div style={{ fontSize: 12, color: P.muted, marginTop: 1 }}>Faça upload do extrato bancário para iniciar a conversão.</div>
            </div>
          </div>

          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DropZone onFile={handleFile} disabled={processing} />

            {processing && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', background: P.primarySoft,
                borderRadius: 10, border: `1px solid ${P.primaryBorder}`,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${P.primaryBorder}`, borderTopColor: '#7C3AED',
                  animation: 'te-spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: 13, color: P.primaryText, fontWeight: 500 }}>Extraindo texto do PDF…</span>
              </div>
            )}

            {error && (
              <div style={{
                background: `rgba(${redRgb},.08)`, border: `1px solid rgba(${redRgb},.20)`,
                borderRadius: 10, padding: '11px 14px',
                color: P.red, fontSize: 13, lineHeight: 1.5,
              }}>
                ⚠️ {error}
              </div>
            )}

            {fileName && !processing && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 10,
                background: P.surface2 || P.bg, border: `1px solid ${P.border}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                }}>
                  <IFileDoc size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 1 }}>{fileSize} · PDF</div>
                </div>
                {rows && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(16,185,129,0.14)', color: '#10b981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ICheck size={11} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Result / download card */}
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 16, boxShadow: P.shadow, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '17px 22px', borderBottom: `1px solid ${P.border}`,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: rows ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: rows ? '#10b981' : '#7C3AED',
              transition: 'all 0.2s',
            }}>
              <IExcelIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>
                {rows ? 'Planilha pronta para download' : 'Aguardando conversão'}
              </div>
              <div style={{ fontSize: 12, color: P.muted, marginTop: 1 }}>
                {rows ? 'Seu Excel foi gerado com sucesso.' : 'Envie um PDF para gerar o arquivo.'}
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {!rows ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', textAlign: 'center',
                border: `2px dashed ${P.border}`, borderRadius: 12,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, marginBottom: 14,
                  background: P.surface2 || P.bg,
                  border: `1px solid ${P.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.muted,
                }}>
                  <IExcelIcon size={22} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: P.muted, marginBottom: 4 }}>Nenhum arquivo gerado</div>
                <div style={{ fontSize: 11, color: P.muted }}>Envie um PDF para iniciar a conversão.</div>
              </div>
            ) : (
              <>
                {/* File info card */}
                <div style={{
                  padding: '16px', borderRadius: 12,
                  border: `1px solid ${P.border}`,
                  background: P.surface2 || P.bg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(16,185,129,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                    }}>
                      <IExcelIcon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fileName.replace(/\.pdf$/i, '.xlsx')}
                      </div>
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 20, flexShrink: 0,
                      background: 'rgba(16,185,129,0.12)', color: '#10b981',
                      fontSize: 11, fontWeight: 700, border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                      <ICheck size={10} /> Pronto
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Linhas detectadas</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: P.text }}>{rows.length.toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Saldo</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: saldo >= 0 ? '#10b981' : P.red }}>
                        R$ {fmtBRL(Math.abs(saldo))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Gerado em</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: P.text, fontFamily: FONT_MONO, lineHeight: 1.4 }}>{processedAt}</div>
                    </div>
                  </div>
                </div>

                {/* Download button */}
                <button
                  onClick={() => exportToXlsx(rows)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', padding: '14px 24px', borderRadius: 12,
                    background: '#7C3AED', color: '#fff', border: 'none',
                    fontFamily: FONT_INTER, fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', transition: 'filter 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                  <IDownload size={18} /> Baixar Excel
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: P.muted, fontSize: 11 }}>
                  <IShield size={12} />
                  Seus dados são processados com segurança e não são armazenados.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview table */}
      {rows && rows.length > 0 && (
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 14, overflow: 'hidden', boxShadow: P.shadow,
        }}>
          <div style={{ padding: '13px 20px', borderBottom: `1px solid ${P.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Preview — {rows.length} lançamentos
            </span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['#', 'Data', 'Descrição', 'A Pagar', 'A Receber'].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 14px', textAlign: i >= 3 ? 'right' : 'left',
                      fontSize: '0.73rem', fontWeight: 700, color: P.muted,
                      textTransform: 'uppercase', letterSpacing: 0.6,
                      borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, background: P.surface2,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: `1px solid ${P.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 14px', color: P.muted2, fontFamily: FONT_MONO, fontSize: '0.74rem' }}>{i + 1}</td>
                    <td style={{ padding: '8px 14px', color: P.muted, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>{r.data}</td>
                    <td style={{ padding: '8px 14px', color: P.text, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descricao}>{r.descricao}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: r.pagar   > 0 ? P.red   : P.muted2, fontFamily: FONT_MONO }}>
                      {r.pagar   > 0 ? `R$ ${fmtBRL(r.pagar)}`   : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: r.receber > 0 ? P.green : P.muted2, fontFamily: FONT_MONO }}>
                      {r.receber > 0 ? `R$ ${fmtBRL(r.receber)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InfoBanner />
    </div>
  );
}

// ── HistoryPanel ───────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClear }) {
  const P = useP();

  if (history.length === 0) {
    return (
      <div style={{
        background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 14, padding: '56px 24px',
        textAlign: 'center', boxShadow: P.shadow,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
          background: P.surface2 || P.bg, border: `1px solid ${P.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.muted,
        }}>
          <IHistoryIcon size={22} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: P.muted, marginBottom: 4 }}>Nenhuma conversão ainda</div>
        <div style={{ fontSize: 12, color: P.muted }}>Converta um arquivo PDF para visualizar o histórico aqui.</div>
      </div>
    );
  }

  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 14, overflow: 'hidden', boxShadow: P.shadow,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {history.length} conversão{history.length !== 1 ? 'ões' : ''}
        </span>
        <button
          onClick={onClear}
          style={{
            padding: '5px 14px', borderRadius: 7,
            border: `1px solid ${P.border}`, background: 'transparent',
            color: P.muted, fontFamily: FONT_INTER, fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Limpar histórico
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: P.surface2 }}>
              {['Data', 'Arquivo', 'Linhas', 'Total a Pagar', 'Total a Receber'].map((h, i) => (
                <th key={i} style={{
                  padding: '9px 16px', textAlign: i >= 3 ? 'right' : 'left',
                  fontSize: '0.73rem', fontWeight: 700, color: P.muted,
                  textTransform: 'uppercase', letterSpacing: 0.6,
                  borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr
                key={i}
                style={{ borderBottom: `1px solid ${P.border}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '9px 16px', color: P.muted, whiteSpace: 'nowrap' }}>{h.date}</td>
                <td style={{ padding: '9px 16px', color: P.text, fontWeight: 600 }}>{h.fileName}</td>
                <td style={{ padding: '9px 16px', color: P.muted }}>{h.rows}</td>
                <td style={{ padding: '9px 16px', textAlign: 'right', color: P.red,   fontFamily: FONT_MONO }}>R$ {fmtBRL(h.totalPagar)}</td>
                <td style={{ padding: '9px 16px', textAlign: 'right', color: P.green, fontFamily: FONT_MONO }}>R$ {fmtBRL(h.totalReceber)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared info banner ─────────────────────────────────────────────────────────
function InfoBanner() {
  const P = useP();
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 18px', borderRadius: 12,
      background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(124,58,237,0.18)', color: '#7C3AED',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IInfo size={13} />
      </div>
      <p style={{ fontSize: 13, color: P.primaryText, lineHeight: 1.6 }}>
        <strong>Formato suportado:</strong> Extratos Santander (PF e PJ). Outros bancos podem ser reconhecidos parcialmente dependendo da estrutura do PDF.
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TransformadorExtratoPage() {
  const { theme } = useTheme();
  const P         = getPalette(theme);
  const isLight   = theme === 'light';

  const [panel,   setPanel]   = useState('home');
  const [history, setHistory] = useState(() => loadHistory());

  const handleClear = () => setHistory(clearHistory());

  const navItems = [
    { key: 'home',      label: 'Início',       Icon: IHome },
    { key: 'converter', label: 'Converter PDF', Icon: IConvert },
    { key: 'historico', label: 'Histórico',     Icon: IHistoryIcon },
  ];

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          @keyframes te-spin { to { transform: rotate(360deg); } }
          @media (max-width: 720px) { .te-two-col { grid-template-columns: 1fr !important; } }
        `}</style>

        {theme === 'dark' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
          </div>
        )}

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px', position: 'relative', zIndex: 1 }}>

          {/* Module header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.primaryText,
              }}>
                <ITransIcon size={26} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 3, color: P.text, lineHeight: 1.15 }}>
                  Transformador de Extrato
                </h1>
                <p style={{ fontSize: '0.84rem', color: P.muted }}>
                  Converta extratos bancários em PDF para planilha Excel organizada.
                </p>
              </div>
            </div>

            <nav style={{ display: 'flex', gap: 4, padding: 5, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, boxShadow: P.shadow, flexShrink: 0 }}>
              {navItems.map((n) => (
                <NavBtn key={n.key} active={panel === n.key} onClick={() => setPanel(n.key)} Icon={n.Icon}>
                  {n.label}
                </NavBtn>
              ))}
            </nav>
          </div>

          {panel === 'home'      && <HomePanel      history={history} isLight={isLight} onNavigate={setPanel} />}
          {panel === 'converter' && <ConverterPanel onHistoryUpdate={setHistory} isLight={isLight} history={history} />}
          {panel === 'historico' && <HistoryPanel   history={history} onClear={handleClear} />}
        </main>
      </div>
    </PaletteCtx.Provider>
  );
}
