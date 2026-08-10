import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import {
  loadFile, processAll, saveParsed, loadParsed, clearParsed,
  fmt, pct, buildChartConfigs, buildDreRows, buildBalancoRows,
  buildResumo, buildDiagnostico, buildEvolucao, buildTopDespesas,
} from './ademEngine';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';

Chart.register(...registerables);

// ── Palette context ──────────────────────────────────────────────────
const PaletteCtx   = createContext(null);
const useP         = () => useContext(PaletteCtx);
const CompanyCtx   = createContext(null);
const useCompanyId = () => useContext(CompanyCtx);

// Rampa monocromática roxa para as etapas de saída do faturamento — o verde
// fica reservado ao que efetivamente sobrou, para o olho ir direto nele.
const FLOW = {
  impostos: 'rgba(124,58,237,0.85)',
  custos:   'rgba(124,58,237,0.60)',
  despesas: 'rgba(124,58,237,0.38)',
  ir:       'rgba(124,58,237,0.20)',
};

const brl = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Primitivos de layout ─────────────────────────────────────────────
const card = (P) => ({
  background: P.surface,
  border: `1px solid ${P.border}`,
  borderRadius: 16,
  boxShadow: P.shadow,
});

function Section({ title, hint, children }) {
  const P = useP();
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: '0.98rem', fontWeight: 700, letterSpacing: -0.2, color: P.text }}>{title}</h2>
        {hint && <p style={{ fontSize: '0.79rem', color: P.muted, marginTop: 3, lineHeight: 1.5 }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Eyebrow({ children }) {
  const P = useP();
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {children}
    </div>
  );
}

// ── Nav / filter buttons ─────────────────────────────────────────────
function NavBtn({ active, onClick, disabled, children }) {
  const P = useP();
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 16px', borderRadius: 8, fontFamily: FONT_INTER,
      fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', opacity: disabled ? 0.45 : 1,
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>{children}</button>
  );
}

function TabBtn({ active, onClick, children }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 7, fontFamily: FONT_INTER,
      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.14s',
      border: active ? `1px solid ${P.primaryBorder}` : `1px solid ${P.border}`,
      background: active ? P.primarySoft : 'transparent',
      color: active ? P.primaryText : P.muted,
    }}>{children}</button>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────────────
function ChartBox({ title, height = 220, chartKey, configs }) {
  const P = useP();
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const cfg = configs[chartKey];
    if (!canvasRef.current || !cfg) return;
    if (instanceRef.current) instanceRef.current.destroy();
    instanceRef.current = new Chart(canvasRef.current, JSON.parse(JSON.stringify(cfg)));
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [configs, chartKey]);

  const hasCfg = Boolean(configs[chartKey]);

  return (
    <div style={{ ...card(P), padding: '18px 20px' }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 }}>{title}</div>
      {hasCfg ? (
        <div style={{ height, position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.muted2, fontSize: '0.8rem' }}>
          Dados não disponíveis
        </div>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  const P = useP();
  return (
    <div style={{ ...card(P), borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || P.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// VISÃO GERENCIAL
// ══════════════════════════════════════════════════════════════════════

function HeroNum({ eyebrow, valor, cor, sub }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div title={brl(valor)} style={{
        fontSize: 'clamp(1.5rem, 3.2vw, 2.1rem)', fontWeight: 800, letterSpacing: -0.8,
        color: cor || P.text, lineHeight: 1.05, whiteSpace: 'nowrap',
      }}>{fmt(valor)}</div>
      {sub && <div style={{ fontSize: '0.76rem', color: P.muted }}>{sub}</div>}
    </div>
  );
}

// Vendeu → gastou → sobrou, com a barra mostrando em que cada real do
// faturamento foi consumido.
function HeroFluxo({ resumo }) {
  const P = useP();
  const negativo = resumo.resultado < 0;

  // A base é o maior entre o que entrou e o que saiu: assim, quando as saídas
  // estouram o faturamento, a barra fica cheia em vez de transbordar.
  const base = Math.max(resumo.faturamento, resumo.saiu) || 1;
  const w = (v) => `${Math.max(0, (v / base) * 100)}%`;

  const etapas = [
    { key: 'impostos', label: 'Impostos sobre venda', valor: resumo.impostos, cor: FLOW.impostos },
    { key: 'custos',   label: 'Custo da mercadoria',  valor: resumo.custos,   cor: FLOW.custos },
    { key: 'despesas', label: 'Despesas',             valor: resumo.despesas, cor: FLOW.despesas },
    { key: 'ir',       label: 'IR / CSLL',            valor: resumo.ir,       cor: FLOW.ir },
  ].filter((e) => e.valor > 0);

  return (
    <div style={{ ...card(P), padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: 18 }}>
        <HeroNum eyebrow="Quanto vendeu" valor={resumo.faturamento} sub="Faturamento bruto do período" />
        <div aria-hidden style={{ fontSize: '1.3rem', color: P.muted2, fontWeight: 300 }}>→</div>
        <HeroNum eyebrow="Quanto gastou" valor={resumo.saiu} sub="Impostos, custos, despesas e IR" />
        <div aria-hidden style={{ fontSize: '1.3rem', color: P.muted2, fontWeight: 300 }}>→</div>
        <HeroNum
          eyebrow="Quanto sobrou"
          valor={resumo.resultado}
          cor={negativo ? P.red : P.green}
          sub={`Margem de ${pct(resumo.margem)} sobre o que vendeu`}
        />
      </div>

      {/* Barra proporcional: em que o faturamento foi consumido */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: P.surface2 }}>
          {etapas.map((e) => (
            <div key={e.key} title={`${e.label}: ${brl(e.valor)}`} style={{ width: w(e.valor), background: e.cor }} />
          ))}
          {resumo.sobraOperacao > 0 && (
            <div title={`Sobra da operação: ${brl(resumo.sobraOperacao)}`} style={{ width: w(resumo.sobraOperacao), background: P.green }} />
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
          {etapas.map((e) => (
            <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', color: P.muted }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: e.cor, flexShrink: 0 }} />
              {e.label}
              <strong style={{ color: P.text, fontWeight: 600 }}>{pct(e.valor / resumo.faturamento)}</strong>
            </div>
          ))}
          {resumo.sobraOperacao > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', color: P.muted }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: P.green, flexShrink: 0 }} />
              Sobra da operação
              <strong style={{ color: P.text, fontWeight: 600 }}>{pct(resumo.sobraOperacao / resumo.faturamento)}</strong>
            </div>
          )}
        </div>

        {Math.abs(resumo.outros) > 0.01 && (
          <div style={{ fontSize: '0.76rem', color: P.muted, lineHeight: 1.5, paddingTop: 2 }}>
            {resumo.sobraOperacao < 0
              ? `A operação em si fechou ${fmt(Math.abs(resumo.sobraOperacao))} negativa. `
              : ''}
            O resultado final considera {resumo.outros >= 0 ? '+' : '−'}{fmt(Math.abs(resumo.outros))} de
            outros resultados (financeiro e não operacional).
          </div>
        )}
      </div>
    </div>
  );
}

// Semáforo: um indicador por card, com a leitura em português.
function DiagnosticoGrid({ itens }) {
  const P = useP();
  const cores = { bom: P.green, atencao: P.gold, critico: P.red };
  const rotulos = { bom: 'Saudável', atencao: 'Atenção', critico: 'Crítico' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
      {itens.map((it) => (
        <div key={it.chave} style={{ ...card(P), padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Eyebrow>{it.label}</Eyebrow>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100,
              color: cores[it.status], background: `${cores[it.status]}1f`, whiteSpace: 'nowrap',
            }}>{rotulos[it.status]}</span>
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: -0.5, color: cores[it.status], lineHeight: 1 }}>
            {it.valor}
          </div>
          <div style={{ fontSize: '0.78rem', color: P.muted, lineHeight: 1.5 }}>{it.texto}</div>
        </div>
      ))}
    </div>
  );
}

// Onde o dinheiro está indo — barras proporcionais à maior despesa.
function DespesasCard({ despesas, faturamento }) {
  const P = useP();
  const maior = despesas[0]?.valor || 1;

  return (
    <div style={{ ...card(P), padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Eyebrow>Maiores despesas do período</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {despesas.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.81rem' }}>
              <span style={{ color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.desc}>
                {d.desc}
              </span>
              <span title={brl(d.valor)} style={{ color: P.text, fontWeight: 600, fontFamily: FONT_MONO, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                {fmt(d.valor)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: P.surface2, overflow: 'hidden' }}>
                <div style={{ width: `${(d.valor / maior) * 100}%`, height: '100%', background: FLOW.custos, borderRadius: 3 }} />
              </div>
              {faturamento > 0 && (
                <span style={{ fontSize: '0.71rem', color: P.muted2, width: 46, textAlign: 'right', flexShrink: 0 }}>
                  {pct(d.valor / faturamento)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {faturamento > 0 && (
        <div style={{ fontSize: '0.73rem', color: P.muted2, lineHeight: 1.5, paddingTop: 2 }}>
          Percentuais calculados sobre o faturamento do período.
        </div>
      )}
    </div>
  );
}

// Melhorou ou piorou: início × fim do período, a partir do Balancete.
function EvolucaoCard({ linhas }) {
  const P = useP();
  const cores = { bom: P.green, ruim: P.red, neutro: P.muted };

  return (
    <div style={{ ...card(P), padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Eyebrow>Como evoluiu no período</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {linhas.map((l) => (
          <div key={l.chave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.83rem', color: P.text, marginBottom: 2 }}>{l.label}</div>
              <div style={{ fontSize: '0.73rem', color: P.muted2, fontFamily: FONT_MONO }}>
                <span title={brl(l.antes)}>{fmt(l.antes)}</span>
                <span style={{ margin: '0 6px' }}>→</span>
                <span title={brl(l.agora)} style={{ color: P.muted }}>{fmt(l.agora)}</span>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              fontSize: '0.84rem', fontWeight: 700, color: cores[l.status],
            }}>
              <span aria-hidden>{l.subiu ? '▲' : '▼'}</span>
              {pct(Math.abs(l.delta))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.73rem', color: P.muted2, lineHeight: 1.5 }}>
        Comparação entre o saldo de abertura e o de fechamento do período informado no Balancete.
      </div>
    </div>
  );
}

function ResumoPanel({ parsed }) {
  const P = useP();
  const resumo      = buildResumo(parsed);
  const diagnostico = buildDiagnostico(parsed);
  const evolucao    = buildEvolucao(parsed);
  const despesas    = parsed.dre ? buildTopDespesas(parsed.dre, 7) : [];

  const semDados = !resumo && !diagnostico.length && !evolucao.length;
  if (semDados) {
    return (
      <div style={{ ...card(P), padding: '48px 28px', textAlign: 'center', color: P.muted, fontSize: '0.88rem' }}>
        Importe a DRE para ver a visão gerencial do período.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {resumo && (
        <Section title="O resultado do período" hint="O caminho do dinheiro: o que entrou, para onde foi e o que sobrou.">
          <HeroFluxo resumo={resumo} />
        </Section>
      )}

      {diagnostico.length > 0 && (
        <Section title="Como está a saúde do negócio" hint="Leitura rápida dos indicadores — o detalhamento contábil fica nas outras abas.">
          <DiagnosticoGrid itens={diagnostico} />
        </Section>
      )}

      {(despesas.length > 0 || evolucao.length > 0) && (
        <Section title="Onde está gastando e como evoluiu">
          <div style={{
            display: 'grid',
            gridTemplateColumns: despesas.length && evolucao.length ? 'minmax(0,1.25fr) minmax(0,1fr)' : '1fr',
            gap: 16, alignItems: 'start',
          }}>
            {despesas.length > 0 && <DespesasCard despesas={despesas} faturamento={resumo?.faturamento || 0} />}
            {evolucao.length > 0 && <EvolucaoCard linhas={evolucao} />}
          </div>
        </Section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DETALHES CONTÁBEIS
// ══════════════════════════════════════════════════════════════════════

// ── File upload slot ──────────────────────────────────────────────────
function FileSlot({ label, icon, status, fileName, onFile }) {
  const P = useP();
  const inputRef = useRef(null);
  const statusColors = { idle: P.muted2, loaded: P.green, error: P.red };
  const statusLabels = { idle: 'Pendente', loaded: 'Carregado', error: 'Erro' };

  return (
    <div style={{ ...card(P), borderRadius: 12, borderColor: status === 'loaded' ? P.border2 : P.border, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>{icon}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: P.text }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: status === 'loaded' ? 'rgba(52,211,153,.12)' : status === 'error' ? 'rgba(255,92,92,.12)' : P.surface2, color: statusColors[status] }}>
          {statusLabels[status]}
        </span>
      </div>
      {fileName && (
        <div style={{ fontSize: '0.76rem', color: P.muted, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
      )}
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <button onClick={() => inputRef.current?.click()} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${P.border2}`, background: 'transparent', color: P.muted, fontFamily: FONT_INTER, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
        {status === 'loaded' ? 'Trocar arquivo' : 'Selecionar arquivo'}
      </button>
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────
function UploadPanel({ onProcessed, onClear, hasParsed }) {
  const P         = useP();
  const companyId = useCompanyId();
  const [raw,     setRaw]     = useState({ dre: null, balanco: null, balancete: null });
  const [status,  setStatus]  = useState({ dre: 'idle', balanco: 'idle', balancete: 'idle' });
  const [names,   setNames]   = useState({ dre: '', balanco: '', balancete: '' });
  const [loading, setLoading] = useState(false);

  const handleFile = async (type, file) => {
    try {
      const rows = await loadFile(file);
      setRaw((r) => ({ ...r, [type]: rows }));
      setStatus((s) => ({ ...s, [type]: 'loaded' }));
      setNames((n) => ({ ...n, [type]: file.name + ' (' + rows.length + ' linhas)' }));
    } catch {
      setStatus((s) => ({ ...s, [type]: 'error' }));
      setNames((n) => ({ ...n, [type]: 'Erro ao ler arquivo' }));
    }
  };

  const handleProcess = async () => {
    if (!raw.dre && !raw.balanco && !raw.balancete) return;
    setLoading(true);
    try {
      const parsed = processAll(raw);
      saveParsed(parsed, companyId);
      onProcessed(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setRaw({ dre: null, balanco: null, balancete: null });
    setStatus({ dre: 'idle', balanco: 'idle', balancete: 'idle' });
    setNames({ dre: '', balanco: '', balancete: '' });
    clearParsed(companyId);
    onClear();
  };

  const anyLoaded = Object.values(status).some((s) => s === 'loaded');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <FileSlot label="DRE"                  icon="📊" status={status.dre}       fileName={names.dre}       onFile={(f) => handleFile('dre', f)} />
        <FileSlot label="Balanço Patrimonial"  icon="⚖️" status={status.balanco}   fileName={names.balanco}   onFile={(f) => handleFile('balanco', f)} />
        <FileSlot label="Balancete"            icon="📋" status={status.balancete} fileName={names.balancete} onFile={(f) => handleFile('balancete', f)} />
      </div>

      <div style={{ background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: P.primaryText, lineHeight: 1.6 }}>
        <strong>Formato esperado:</strong> planilha XLSX ou PDF com a descrição da linha e os valores da demonstração. Importar pelo menos um dos três arquivos.
        <br />
        A <strong>DRE</strong> alimenta o resultado e as despesas; o <strong>Balancete</strong> permite comparar início e fim do período.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleProcess} disabled={!anyLoaded || loading} style={{ padding: '10px 24px', borderRadius: 10, background: anyLoaded && !loading ? P.primary : P.surface2, border: 'none', color: anyLoaded && !loading ? '#fff' : P.muted, fontFamily: FONT_INTER, fontSize: '0.87rem', fontWeight: 700, cursor: anyLoaded && !loading ? 'pointer' : 'not-allowed', opacity: anyLoaded && !loading ? 1 : 0.6 }}>
          {loading ? 'Processando…' : 'Processar e gerar relatório →'}
        </button>
        {hasParsed && (
          <button onClick={handleClear} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${P.border2}`, background: 'transparent', color: P.muted, fontFamily: FONT_INTER, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
            Limpar dados
          </button>
        )}
      </div>
    </div>
  );
}

// ── Indicadores (KPIs + gráficos) ─────────────────────────────────────
function IndicadoresPanel({ parsed, isDark }) {
  const P = useP();
  const d = parsed.dre;
  const b = parsed.balanco;
  const configs = buildChartConfigs(parsed, isDark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs DRE */}
      {d && (
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>DRE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <KpiCard label="Receita Líquida" value={fmt(d.recLiquida)} />
            <KpiCard label="Lucro Líquido"   value={fmt(d.lucroLiq)} color={d.lucroLiq < 0 ? P.red : P.green} />
            <KpiCard label="Margem Líquida"  value={pct(d.margemLiq)} color={d.margemLiq < 0 ? P.red : undefined} />
            <KpiCard label="EBITDA"          value={fmt(d.ebitda)} />
          </div>
        </div>
      )}

      {/* KPIs Balanço */}
      {b && (
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Balanço Patrimonial</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <KpiCard label="Ativo Total"      value={fmt(b.ativoTotal)} />
            <KpiCard label="Passivo Total"    value={fmt(b.passivoTotal)} />
            <KpiCard label="Patrimônio Líq."  value={fmt(b.pl)} color={b.pl < 0 ? P.red : P.green} />
            <KpiCard label="Endividamento"    value={pct(b.endividamento)} color={b.endividamento > 0.7 ? P.red : undefined} />
          </div>
        </div>
      )}

      {/* Gráficos — linha 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: d ? '1fr 1fr' : '1fr', gap: 16 }}>
        {d && <ChartBox title="Composição da DRE"      chartKey="dre"     height={260} configs={configs} />}
        {b && <ChartBox title="Estrutura Patrimonial"  chartKey="balanco" height={260} configs={configs} />}
      </div>

      {/* Gráficos — linha 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <ChartBox title="Rentabilidade (%)"    chartKey="rentab"    height={200} configs={configs} />
        <ChartBox title="Liquidez"             chartKey="liquidez"  height={200} configs={configs} />
        <ChartBox title="Análise Vertical DRE" chartKey="av"        height={200} configs={configs} />
      </div>

      {/* Gráfico balancete */}
      {parsed.balancete && (
        <ChartBox title="Top 10 Contas — Balancete" chartKey="balancete" height={240} configs={configs} />
      )}
    </div>
  );
}

// ── Details panel ─────────────────────────────────────────────────────
function DetailsPanel({ parsed }) {
  const P = useP();
  const [tab, setTab] = useState(() => parsed.dre ? 'dre' : parsed.balanco ? 'balanco' : 'balancete');

  const dreRows      = parsed.dre       ? buildDreRows(parsed.dre)         : [];
  const balancoRows  = parsed.balanco   ? buildBalancoRows(parsed.balanco)  : [];
  const balancete    = parsed.balancete ? parsed.balancete.contas           : [];

  const hasTab = { dre: Boolean(parsed.dre), balanco: Boolean(parsed.balanco), balancete: Boolean(parsed.balancete) };

  const renderValue = (row) => {
    if (row.type === 'sep')       return null;
    if (row.type === 'head')      return null;
    if (row.val === null)         return null;
    if (row.type === 'pct')       return pct(row.val);
    if (row.type === 'idx')       return row.val.toFixed(2);
    return fmt(row.val);
  };

  const renderAV = (row, recLiquida) => {
    if (!recLiquida || row.type === 'sep' || row.type === 'head' || row.val === null || row.type === 'pct' || row.type === 'idx') return '—';
    return pct(Math.abs(row.val) / recLiquida);
  };

  const rowStyle = (type) => ({
    fontWeight: (type === 'total' || type === 'highlight') ? 700 : 400,
    color: type === 'head' ? P.gold : undefined,
    paddingTop: type === 'head' ? 8 : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {hasTab.dre       && <TabBtn active={tab === 'dre'}       onClick={() => setTab('dre')}>DRE</TabBtn>}
        {hasTab.balanco   && <TabBtn active={tab === 'balanco'}   onClick={() => setTab('balanco')}>Balanço Patrimonial</TabBtn>}
        {hasTab.balancete && <TabBtn active={tab === 'balancete'} onClick={() => setTab('balancete')}>Balancete</TabBtn>}
      </div>

      <div style={{ ...card(P), overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 580, overflowY: 'auto' }}>
          {tab === 'dre' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Descrição', 'Valor', 'AV (%)'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 16px', textAlign: i > 0 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dreRows.map((row, i) => (
                  row.type === 'sep' ? (
                    <tr key={i}><td colSpan={3} style={{ padding: '4px', border: 'none' }} /></tr>
                  ) : (
                    <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
                      <td style={{ padding: '8px 16px', ...rowStyle(row.type), color: row.type === 'head' ? P.gold : P.text }}>{row.desc}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', ...rowStyle(row.type), color: row.val < 0 ? P.red : rowStyle(row.type).color || P.text }}>
                        {renderValue(row) ?? ''}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: P.muted, fontSize: '0.78rem' }}>
                        {renderAV(row, parsed.dre?.recLiquida)}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {tab === 'balanco' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Descrição', 'Valor'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 16px', textAlign: i > 0 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balancoRows.map((row, i) => (
                  row.type === 'sep' ? (
                    <tr key={i}><td colSpan={2} style={{ padding: '4px', border: 'none' }} /></tr>
                  ) : (
                    <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
                      <td style={{ padding: '8px 16px', paddingLeft: row.type === 'sub' ? 32 : 16, color: row.type === 'head' ? P.gold : P.text, fontWeight: (row.type === 'total' || row.type === 'head') ? 700 : 400, paddingTop: row.type === 'head' ? 10 : undefined }}>
                        {row.desc}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '0.8rem', fontWeight: row.type === 'total' ? 700 : 400, color: row.val < 0 ? P.red : P.text }}>
                        {row.val !== null ? (row.type === 'pct' ? pct(row.val) : row.type === 'idx' ? row.val.toFixed(2) : fmt(row.val)) : ''}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {tab === 'balancete' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: FONT_INTER }}>
              <thead>
                <tr style={{ background: P.surface2 }}>
                  {['Código', 'Descrição', 'Débito', 'Crédito', 'Saldo'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`, position: 'sticky', top: 0, background: P.surface2, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balancete.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '7px 14px', fontFamily: FONT_MONO, fontSize: '0.75rem', color: P.muted }}>{c.cod}</td>
                    <td style={{ padding: '7px 14px', color: P.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.desc}>{c.desc}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, color: P.muted }}>{fmt(c.debito)}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, color: P.muted }}>{fmt(c.credito)}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 600, color: P.text }}>{fmt(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function AnaliseDemonstracoesPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const isDark = theme !== 'light';

  // companyId undefined = carregando; null = carregado, sem organização.
  // O parse em cache é lido junto com o companyId (ambos dependem dele), para
  // resolver tudo num setState só, já dentro do callback assíncrono.
  const [{ companyId, parsed }, setDados] = useState({ companyId: undefined, parsed: null });

  useEffect(() => {
    let ativo = true;
    getCurrentTenantCompanyId()
      .then((id) => id || null)
      .catch(() => null)
      .then((id) => { if (ativo) setDados({ companyId: id, parsed: loadParsed(id) }); });
    return () => { ativo = false; };
  }, []);

  // panel null = ainda não houve escolha do usuário: cai no painel que faz
  // sentido para o estado atual (relatório se já há dados, importação se não).
  const [panel, setPanel] = useState(null);

  const setParsed = (p) => setDados((d) => ({ ...d, parsed: p }));
  const handleProcessed = (p) => { setParsed(p); setPanel('resumo'); };
  const handleClear     = () => { setParsed(null); setPanel('upload'); };

  const hasParsed = Boolean(parsed);
  const painelAtivo = panel ?? (hasParsed ? 'resumo' : 'upload');

  const navItems = [
    { key: 'resumo',      label: 'Visão do mês',         disabled: !hasParsed },
    { key: 'indicadores', label: 'Indicadores',          disabled: !hasParsed },
    { key: 'detalhes',    label: 'Detalhamento',         disabled: !hasParsed },
    { key: 'upload',      label: 'Importar arquivos',    disabled: false },
  ];

  return (
    <CompanyCtx.Provider value={companyId}>
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
        `}</style>

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
              Relatório Gerencial
            </h1>
            <p style={{ fontSize: '0.88rem', color: P.muted }}>
              Quanto vendeu, para onde foi o dinheiro e o que sobrou no período.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
            {navItems.map((n) => (
              <NavBtn key={n.key} active={painelAtivo === n.key} disabled={n.disabled} onClick={() => !n.disabled && setPanel(n.key)}>
                {n.label}
              </NavBtn>
            ))}
          </div>

          {companyId === undefined ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: P.muted, fontSize: 14 }}>
              Carregando dados da organização...
            </div>
          ) : (
            <>
              {painelAtivo === 'upload'      && <UploadPanel onProcessed={handleProcessed} onClear={handleClear} hasParsed={hasParsed} />}
              {painelAtivo === 'resumo'      && parsed && <ResumoPanel parsed={parsed} />}
              {painelAtivo === 'indicadores' && parsed && <IndicadoresPanel parsed={parsed} isDark={isDark} />}
              {painelAtivo === 'detalhes'    && parsed && <DetailsPanel parsed={parsed} />}
            </>
          )}
        </main>
      </div>
    </PaletteCtx.Provider>
    </CompanyCtx.Provider>
  );
}
