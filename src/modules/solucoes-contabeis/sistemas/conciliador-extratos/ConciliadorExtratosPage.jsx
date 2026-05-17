import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import { parseXlsx, match as runMatch, exportResult } from './concEngine';

// =============================================================================
// Página: /solucoes-contabeis/conciliador-extratos
// Migração funcional do Conciliador de Extratos do Autonomy v9.0
// (dashboard.html, view-conciliacao, linhas 1015–1159 + 5012–5362).
//
// Sub-painéis: Início (instruções + último resultado) · Importar (2 dropzones
// razão + extrato) · Resultado (4 métricas + tabela filtrável + export XLSX).
//
// Estado totalmente em memória (mesmo do Autonomy, que não persistia nada
// entre sessões). PDF do extrato fica para etapa posterior (pdfjs-dist).
// =============================================================================

const PANELS = [
  { id: 'home',      label: 'Início',    icon: '🏠' },
  { id: 'upload',    label: 'Importar',  icon: '📂' },
  { id: 'resultado', label: 'Resultado', icon: '📋' },
];

const PANEL_SUB = {
  home:      'Compare o razão contábil com o extrato bancário.',
  upload:    'Importe os dois arquivos para iniciar.',
  resultado: 'Resultado da conciliação — analise as divergências.',
};

const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// =============================================================================
// Página
// =============================================================================

export default function ConciliadorExtratosPage() {
  const { theme } = useTheme();
  const P = useMemo(() => getPalette(theme), [theme]);
  const [panel, setPanel] = useState('home');
  const [razao, setRazao] = useState([]);
  const [extrato, setExtrato] = useState([]);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('todos');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast({ id: Date.now(), msg }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const handleProcess = useCallback(() => {
    if (!razao.length || !extrato.length) {
      showToast('⚠️ Importe os dois arquivos primeiro.');
      return;
    }
    showToast('⚡ Processando conciliação…');
    try {
      const r = runMatch(razao, extrato);
      setResult(r);
      setTab('todos');
      setPanel('resultado');
      showToast(`✅ ${r.matched.length} conciliados, ${r.somenteExtrato.length} só extrato, ${r.somenteRazao.length} só razão`);
    } catch (err) {
      console.error(err);
      showToast('❌ Erro: ' + err.message);
    }
  }, [razao, extrato, showToast]);

  const handleExport = useCallback(() => {
    if (!result) {
      showToast('⚠️ Nenhum resultado para exportar.');
      return;
    }
    try {
      const fname = exportResult(result);
      showToast('✅ Relatório exportado: ' + fname);
    } catch (err) {
      showToast('❌ Erro ao exportar: ' + err.message);
    }
  }, [result, showToast]);

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          .conc-tab-btn { transition: all 0.18s ease; }
          .conc-tab-btn:hover { background: ${P.primarySoft}; color: ${P.primaryText}; }
          .conc-card { transition: all 0.18s ease; }
          .conc-card:hover { border-color: ${P.primaryBorder}; }
          .conc-dropzone { transition: all 0.18s ease; }
          .conc-dropzone.over { border-color: ${P.primary} !important; background: ${P.primarySoft} !important; }
          .conc-btn-primary { transition: all 0.15s ease; }
          .conc-btn-primary:hover { filter: brightness(1.1); }
          .conc-btn-ghost { transition: all 0.15s ease; }
          .conc-btn-ghost:hover { background: ${P.surface2} !important; border-color: ${P.border2} !important; }
          .conc-row:hover { background: ${P.rowHover}; }
          .conc-stat-card { cursor: pointer; transition: all 0.18s ease; }
          .conc-stat-card:hover { border-color: ${P.primaryBorder}; transform: translateY(-1px); }
          @keyframes conc-toast-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        `}</style>

        {theme === 'dark' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
            <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37,99,235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
          </div>
        )}

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px', position: 'relative', zIndex: 1 }}>
          <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
                🧮 Conciliador de Extratos
              </h1>
              <p style={{ fontSize: '0.88rem', color: P.muted, maxWidth: 680 }}>
                {PANEL_SUB[panel]}
              </p>
            </div>

            <nav style={{ display: 'flex', gap: 6, padding: 6, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, flexWrap: 'wrap', boxShadow: P.shadow }}>
              {PANELS.map((p) => {
                const active = p.id === panel;
                const disabled = p.id === 'resultado' && !result;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !disabled && setPanel(p.id)}
                    disabled={disabled}
                    className="conc-tab-btn"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 14px', borderRadius: 8,
                      background: active ? P.primarySoft : 'transparent',
                      border: `1px solid ${active ? P.primaryBorder : 'transparent'}`,
                      color: active ? P.primaryText : P.muted,
                      fontSize: '0.84rem', fontWeight: 600,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span>{p.icon}</span> {p.label}
                  </button>
                );
              })}
            </nav>
          </header>

          {panel === 'home' && (
            <HomePanel result={result} onGoUpload={() => setPanel('upload')} onGoResult={() => setPanel('resultado')} />
          )}
          {panel === 'upload' && (
            <UploadPanel
              razao={razao} extrato={extrato}
              setRazao={setRazao} setExtrato={setExtrato}
              onProcess={handleProcess}
              showToast={showToast}
            />
          )}
          {panel === 'resultado' && result && (
            <ResultPanel result={result} tab={tab} setTab={setTab} onExport={handleExport} />
          )}
        </main>

        {toast && (
          <div
            style={{
              position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200,
              background: P.surfaceSolid,
              border: `1px solid ${P.primaryBorder}`,
              color: P.text,
              padding: '12px 20px', borderRadius: 10,
              fontSize: '0.86rem', fontWeight: 500,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              animation: 'conc-toast-in 0.2s ease',
            }}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </PaletteCtx.Provider>
  );
}

// =============================================================================
// Panel: Início
// =============================================================================

function HomePanel({ result, onGoUpload, onGoResult }) {
  const P = useP();
  const matched = result?.matched.length || 0;
  const sExt = result?.somenteExtrato.length || 0;
  const sRaz = result?.somenteRazao.length || 0;
  const pct = matched + sExt > 0 ? Math.round((matched / (matched + sExt)) * 100) : 0;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Metric color={P.gold}    value={result ? matched + sExt : '—'} label="Total extrato" />
        <Metric color={P.green}   value={result ? matched : '—'}        label="Conciliados" />
        <Metric color={P.primary} value={result ? sExt : '—'}           label="Só no extrato" />
        <Metric color={P.gold}    value={result ? sRaz : '—'}           label="Só no razão" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <Card title="Como funciona">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Step n={1} title="Importe o Razão Contábil" desc="Exporte do seu sistema contábil (Domínio, Alterdata…) o razão da conta bancária no período desejado. Aceita .xlsx." />
            <Step n={2} title="Importe o Extrato Bancário" desc="Extratos em .xlsx diretamente do banco. O sistema detecta datas e valores automaticamente. (PDF em breve.)" />
            <Step n={3} title="Veja as divergências"        desc="O sistema compara data e valor de cada lançamento. O que estiver no extrato mas não no razão — e vice-versa — é exibido separadamente." />
            <Step n={4} title="Exporte o relatório"         desc="Gere um arquivo .xlsx com todos os lançamentos categorizados: conciliados, só no extrato e só no razão." />
            <button
              type="button"
              onClick={onGoUpload}
              className="conc-btn-primary"
              style={{
                marginTop: 4, alignSelf: 'flex-start',
                padding: '10px 18px', borderRadius: 8,
                background: P.primary, color: '#fff',
                border: 'none', fontSize: '0.86rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📂 Iniciar conciliação →
            </button>
          </div>
        </Card>

        <Card title="Última conciliação">
          {!result ? (
            <Empty icon="📊" text="Nenhuma conciliação realizada ainda." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: `conic-gradient(${P.green} ${pct * 3.6}deg, ${P.border2} 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: P.surfaceSolid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.88rem', fontWeight: 800, color: P.text,
                  }}>{pct}%</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700 }}>Taxa de conciliação</div>
                  <div style={{ fontSize: '0.8rem', color: P.muted }}>
                    {matched} de {matched + sExt} lançamentos do extrato conciliados
                  </div>
                </div>
              </div>
              {sExt > 0 && (
                <div style={{ padding: 10, background: P.primarySoft, borderLeft: `3px solid ${P.primary}`, borderRadius: 4, fontSize: '0.82rem' }}>
                  <b>{sExt} lançamento(s)</b> no extrato sem correspondência no razão
                </div>
              )}
              {sRaz > 0 && (
                <div style={{ padding: 10, background: `${P.gold}1a`, borderLeft: `3px solid ${P.gold}`, borderRadius: 4, fontSize: '0.82rem' }}>
                  <b>{sRaz} lançamento(s)</b> no razão sem correspondência no extrato
                </div>
              )}
              <button
                type="button"
                onClick={onGoResult}
                className="conc-btn-primary"
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 14px', borderRadius: 8,
                  background: P.primary, color: '#fff',
                  border: 'none', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Ver resultado completo →
              </button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Step({ n, title, desc }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: P.primary, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '0.88rem',
        flexShrink: 0,
      }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: P.muted, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Panel: Upload
// =============================================================================

function UploadPanel({ razao, extrato, setRazao, setExtrato, onProcess, showToast }) {
  const P = useP();

  const handleFile = async (file, tipo) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      showToast('⚠️ PDF ainda não suportado — em breve. Use .xlsx por enquanto.');
      return;
    }
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('⚠️ Formato não suportado. Use .xlsx');
      return;
    }
    showToast('🔄 Lendo ' + file.name + '…');
    try {
      const rows = await parseXlsx(file, tipo);
      if (!rows.length) {
        showToast('⚠️ Nenhum lançamento encontrado no arquivo.');
        return;
      }
      if (tipo === 'razao') setRazao(rows);
      else setExtrato(rows);
      showToast(`✅ ${rows.length} lançamentos carregados!`);
    } catch (err) {
      console.error(err);
      showToast('❌ Erro ao ler arquivo: ' + err.message);
    }
  };

  const ready = razao.length > 0 && extrato.length > 0;
  const status = !razao.length && !extrato.length
    ? 'Importe os dois arquivos para continuar.'
    : !razao.length ? 'Aguardando o arquivo de razão…'
    : !extrato.length ? 'Aguardando o arquivo de extrato…'
    : 'Tudo pronto! Clique em "Processar" para iniciar a conciliação.';

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, marginBottom: 14 }}>
        <DropCard
          tipo="razao"
          title="📒 Razão Contábil"
          desc="Exporte o razão da conta bancária do seu sistema contábil. Deve conter colunas de data, histórico e valor (débito/crédito)."
          accepted=".xlsx"
          accept=".xlsx,.xls,.csv"
          rows={razao}
          badgeColor={P.green}
          onFile={(f) => handleFile(f, 'razao')}
        />
        <DropCard
          tipo="extrato"
          title="🏦 Extrato Bancário"
          desc="Importe o extrato bancário diretamente do banco. O sistema detecta automaticamente as colunas de data e valor."
          accepted=".xlsx (PDF em breve)"
          accept=".xlsx,.xls,.csv"
          rows={extrato}
          badgeColor={P.primary}
          onFile={(f) => handleFile(f, 'extrato')}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Pronto para conciliar?</div>
            <div style={{ fontSize: '0.8rem', color: P.muted }}>{status}</div>
          </div>
          <button
            type="button"
            onClick={onProcess}
            disabled={!ready}
            className="conc-btn-primary"
            style={{
              padding: '10px 18px', borderRadius: 8,
              background: P.primary, color: '#fff',
              border: 'none', fontSize: '0.86rem', fontWeight: 700,
              cursor: ready ? 'pointer' : 'not-allowed',
              opacity: ready ? 1 : 0.4,
              fontFamily: 'inherit',
            }}
          >
            ⚡ Processar conciliação
          </button>
        </div>
      </Card>
    </>
  );
}

function DropCard({ title, desc, accepted, accept, rows, badgeColor, onFile }) {
  const P = useP();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  return (
    <Card
      title={title}
      actions={
        <span style={{
          fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20,
          background: rows.length ? `${badgeColor}22` : P.surface2,
          color: rows.length ? badgeColor : P.muted2,
          fontWeight: 600,
        }}>
          {rows.length ? `${rows.length} lançamentos` : 'não carregado'}
        </span>
      }
    >
      <p style={{ fontSize: '0.82rem', color: P.muted, marginBottom: 12, lineHeight: 1.5 }}>{desc}</p>
      <div
        className={'conc-dropzone' + (dragOver ? ' over' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          border: `2px dashed ${P.border2}`,
          borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer',
          background: P.surface2,
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>{title.split(' ')[0]}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Clique ou arraste o arquivo</div>
        <div style={{ fontSize: '0.75rem', color: P.muted }}>Formato aceito: {accepted}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: badgeColor, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
            Prévia (5 primeiros registros)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr>{['Data', 'Descrição', 'Valor (R$)'].map((h) => <Th key={h} align={h === 'Valor (R$)' ? 'right' : 'left'}>{h}</Th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <Td mono>{r.dateStr}</Td>
                    <Td truncate>{r.desc || '—'}</Td>
                    <Td mono align="right" style={{ color: r.value < 0 ? P.red : P.green }}>
                      {(r.value >= 0 ? '+' : '') + r.value.toFixed(2).replace('.', ',')}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.75rem', color: P.muted, marginTop: 6 }}>
            {rows.length} lançamentos lidos no total.
          </div>
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// Panel: Resultado
// =============================================================================

const TABS = [
  { id: 'todos',   label: 'Todos',           icon: '📊' },
  { id: 'extrato', label: 'Só no extrato',   icon: '🔵' },
  { id: 'razao',   label: 'Só no razão',     icon: '🟡' },
  { id: 'match',   label: 'Conciliados',     icon: '✅' },
];

function ResultPanel({ result, tab, setTab, onExport }) {
  const P = useP();
  const { matched, somenteExtrato, somenteRazao } = result;

  const statusCfg = {
    match:   { label: '✅ Conciliado',  color: P.green },
    extrato: { label: '🔵 Só extrato', color: P.primary },
    razao:   { label: '🟡 Só razão',   color: P.gold },
  };

  const rows = useMemo(() => {
    const out = [];
    if (tab === 'todos' || tab === 'match')
      out.push(...matched.map((m) => ({ status: 'match', extrato: m.extrato, razao: m.razao })));
    if (tab === 'todos' || tab === 'extrato')
      out.push(...somenteExtrato.map((e) => ({ status: 'extrato', extrato: e, razao: null })));
    if (tab === 'todos' || tab === 'razao')
      out.push(...somenteRazao.map((r) => ({ status: 'razao', extrato: null, razao: r })));
    out.sort((a, b) => {
      const da = (a.extrato || a.razao).date;
      const db = (b.extrato || b.razao).date;
      return db - da;
    });
    return out;
  }, [tab, matched, somenteExtrato, somenteRazao]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
        <StatCard color={P.green}   value={matched.length}            label="✅ Conciliados"    onClick={() => setTab('match')} />
        <StatCard color={P.primary} value={somenteExtrato.length}     label="🔵 Só no extrato" onClick={() => setTab('extrato')} />
        <StatCard color={P.gold}    value={somenteRazao.length}       label="🟡 Só no razão"   onClick={() => setTab('razao')} />
        <StatCard color={P.gold}    value={matched.length + somenteExtrato.length + somenteRazao.length} label="📊 Total" onClick={() => setTab('todos')} />
      </div>

      <Card
        actions={
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="conc-tab-btn"
                    style={{
                      padding: '6px 12px', borderRadius: 7,
                      background: active ? P.primarySoft : 'transparent',
                      border: `1px solid ${active ? P.primaryBorder : P.border}`,
                      color: active ? P.primaryText : P.muted,
                      fontSize: '0.78rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onExport}
              className="conc-btn-primary"
              style={{
                padding: '7px 14px', borderRadius: 8,
                background: P.primary, color: '#fff',
                border: 'none', fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ⬇️ Exportar XLSX
            </button>
          </>
        }
      >
        <div style={{ overflowX: 'auto', maxHeight: 540, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: P.surfaceSolid, zIndex: 1 }}>
                {['Status', 'Data extrato', 'Descrição extrato', 'Valor', 'Data razão', 'Histórico razão'].map((h, i) => (
                  <Th key={h} align={i === 3 ? 'right' : 'left'}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><Td colSpan={6}><Empty icon="✅" text="Nenhum lançamento nesta categoria." /></Td></tr>
              ) : rows.map((r, i) => {
                const cfg = statusCfg[r.status];
                const val = (r.extrato || r.razao).value;
                return (
                  <tr key={i} className="conc-row">
                    <Td><Pill color={cfg.color}>{cfg.label}</Pill></Td>
                    <Td mono>{r.extrato?.dateStr || '—'}</Td>
                    <Td truncate title={r.extrato?.desc || ''}>{r.extrato?.desc || '—'}</Td>
                    <Td mono align="right" style={{ fontWeight: 700, color: val < 0 ? P.red : P.green }}>
                      {(val >= 0 ? '+' : '') + val.toFixed(2).replace('.', ',')}
                    </Td>
                    <Td mono>{r.razao?.dateStr || '—'}</Td>
                    <Td truncate title={r.razao?.desc || ''}>{r.razao?.desc || '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatCard({ color, value, label, onClick }) {
  const P = useP();
  return (
    <button
      type="button"
      onClick={onClick}
      className="conc-stat-card"
      style={{
        textAlign: 'left',
        background: P.surface, border: `1px solid ${P.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12, padding: '16px 18px',
        boxShadow: P.shadow,
        fontFamily: 'inherit', color: 'inherit',
      }}
    >
      <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.5, color }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: P.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </button>
  );
}

// =============================================================================
// Building blocks
// =============================================================================

function Card({ title, actions, children }) {
  const P = useP();
  return (
    <section className="conc-card" style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 14, marginBottom: 14, boxShadow: P.shadow,
    }}>
      {(title || actions) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${P.border}`,
          gap: 12, flexWrap: 'wrap',
        }}>
          {title && <h3 style={{ fontSize: '0.92rem', fontWeight: 700, letterSpacing: -0.2 }}>{title}</h3>}
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
        </header>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function Metric({ color, value, label }) {
  const P = useP();
  return (
    <div className="conc-card" style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: '16px 18px',
      boxShadow: P.shadow,
    }}>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.5, color }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: P.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Empty({ icon, text }) {
  const P = useP();
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center', color: P.muted2 }}>
      <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      <p style={{ fontSize: '0.85rem' }}>{text}</p>
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 700,
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Th({ children, align }) {
  const P = useP();
  return (
    <th style={{
      padding: '10px 12px', textAlign: align || 'left',
      fontSize: '0.72rem', fontWeight: 700, color: P.muted,
      textTransform: 'uppercase', letterSpacing: 0.6,
      borderBottom: `1px solid ${P.border}`,
      whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}

function Td({ children, mono, muted, align, truncate, colSpan, title, style }) {
  const P = useP();
  return (
    <td
      colSpan={colSpan}
      title={title}
      style={{
        padding: '9px 12px',
        borderBottom: `1px solid ${P.border}`,
        fontFamily: mono ? FONT_MONO : 'inherit',
        color: muted ? P.muted : P.text,
        textAlign: align || 'left',
        fontSize: '0.8rem',
        ...(truncate ? { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
        ...style,
      }}
    >
      {children}
    </td>
  );
}
