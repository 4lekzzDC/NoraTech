import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SolucoesHeader from '../../components/SolucoesHeader';
import AnimatedDropzone from '../../../../components/AnimatedDropzone';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';
import { moduleRoute } from '../../constants';
import { RAMO_LABEL_BY_ID } from '../gestao-clientes/gcService';
import { getClientes } from '../../services/clients.service';
import {
  PRESUNCAO_POR_RAMO, ALIQUOTAS, LIMITE_ADICIONAL_MENSAL, LIMITE_COMPENSACAO_PREJUIZO,
  TRIMESTRES, CAMPOS_PRESUMIDO, CAMPOS_REAL,
  LINHAS_RESULTADO_PRESUMIDO, LINHAS_RESULTADO_REAL,
  fmtBRL,
} from './irpjCsllDomain';

const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// ── Ícones ────────────────────────────────────────────────────────────────
function IBuilding({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M10 21v-5h4v5" /><path d="M9 8h.01M12 8h.01M15 8h.01" /><path d="M9 12h.01M12 12h.01M15 12h.01" />
    </svg>
  );
}
function IUpload({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IKeyboard({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}
function ICheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IAlert({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" />
    </svg>
  );
}

// ── UI base ───────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  const P = useP();
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14,
      boxShadow: P.shadow, ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children, hint }) {
  const P = useP();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </div>
      {hint && <div style={{ fontSize: 12, color: P.muted, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

// Trilha de etapas. Só navega para trás ou para etapas já liberadas — pular
// adiante sem empresa escolhida deixaria o formulário sem saber qual regime
// renderizar.
function Steps({ current, maxReached, onGo }) {
  const P = useP();
  const steps = ['Empresa', 'Período e origem', 'Dados', 'Resultado'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <div style={{ width: 18, height: 1, background: P.border2 }} />}
            <button
              onClick={() => reachable && onGo(i)}
              disabled={!reachable}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 13px', borderRadius: 8, fontFamily: FONT_INTER,
                fontSize: 12.5, fontWeight: 600, cursor: reachable ? 'pointer' : 'not-allowed',
                border: `1px solid ${active ? P.primaryBorder : P.border}`,
                background: active ? P.primarySoft : 'transparent',
                color: active ? P.primaryText : reachable ? P.muted : P.muted2,
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 800,
                background: done ? P.primary : active ? P.primarySoft : 'transparent',
                border: `1px solid ${done || active ? P.primaryBorder : P.border2}`,
                color: done ? '#fff' : active ? P.primaryText : P.muted2,
              }}>
                {done ? <ICheck size={11} /> : i + 1}
              </span>
              {s}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }) {
  const P = useP();
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 20px', borderRadius: 9, fontFamily: FONT_INTER,
      fontSize: 13.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${disabled ? P.border : P.primaryBorder}`,
      background: disabled ? 'transparent' : P.primary,
      color: disabled ? P.muted2 : '#fff', transition: 'all 0.15s',
    }}>{children}</button>
  );
}

function GhostBtn({ children, onClick }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      padding: '10px 18px', borderRadius: 9, fontFamily: FONT_INTER,
      fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${P.border}`, background: 'transparent', color: P.muted,
    }}>{children}</button>
  );
}

// ── Etapa 1 — Empresa ─────────────────────────────────────────────────────
function RegimeBadge({ regime }) {
  const P = useP();
  const suportado = regime === 'Lucro Presumido' || regime === 'Lucro Real';
  const cor = suportado ? P.primary : P.gold;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: `${cor}1f`, color: cor, border: `1px solid ${cor}44`,
    }}>{regime || 'Regime não informado'}</span>
  );
}

function EmpresaStep({ clientes, selectedId, onSelect, onNext }) {
  const P = useP();
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.trade_name || '').toLowerCase().includes(q) ||
      (c.cnpj || '').includes(q));
  }, [clientes, busca]);

  const selecionado = clientes.find((c) => c.id === selectedId) || null;

  // O regime define qual formulário abrir; o ramo define a presunção. Sem os
  // dois o cálculo não tem como sair certo, então a etapa bloqueia aqui e
  // manda completar o cadastro em vez de deixar seguir com dado faltando.
  const faltando = selecionado
    ? [
        !selecionado.tributacao && 'regime tributário',
        !selecionado.ramo_atividade && 'ramo de atividade',
      ].filter(Boolean)
    : [];
  const regimeSuportado = selecionado
    && (selecionado.tributacao === 'Lucro Presumido' || selecionado.tributacao === 'Lucro Real');
  const podeAvancar = Boolean(selecionado) && faltando.length === 0 && regimeSuportado;

  return (
    <Card style={{ padding: 24 }}>
      <SectionTitle hint="A apuração muda conforme o regime — o formulário da próxima etapa é montado a partir do cadastro do cliente.">
        Selecione a empresa
      </SectionTitle>

      {clientes.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: P.muted, marginBottom: 14, lineHeight: 1.6 }}>
            Nenhum cliente cadastrado nesta organização.<br />
            Os clientes são cadastrados na Gestão de Clientes e ficam disponíveis em todos os sistemas.
          </div>
          <Link to={moduleRoute('gestao-clientes')} style={{
            display: 'inline-block', padding: '9px 18px', borderRadius: 9,
            background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
            color: P.primaryText, fontSize: 13, fontWeight: 700,
          }}>Ir para Gestão de Clientes</Link>
        </div>
      ) : (
        <>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por razão social, fantasia ou CNPJ…"
            style={{
              width: '100%', padding: '9px 13px', borderRadius: 9, marginBottom: 12,
              border: `1px solid ${P.border}`, background: P.inputBg, color: P.text,
              fontSize: 13, fontFamily: FONT_INTER, outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ maxHeight: 330, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filtrados.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: P.muted, fontSize: 13 }}>
                Nenhuma empresa encontrada.
              </div>
            )}
            {filtrados.map((c) => {
              const ativo = c.id === selectedId;
              const incompleto = !c.tributacao || !c.ramo_atividade;
              return (
                <button key={c.id} onClick={() => onSelect(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                  border: `1px solid ${ativo ? P.primaryBorder : P.border}`,
                  background: ativo ? P.primarySoft : P.surface2,
                  transition: 'all 0.14s',
                }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: P.primarySoft, color: P.primary,
                  }}><IBuilding size={16} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontSize: 13.5, fontWeight: 700, color: P.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.name}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: P.muted, marginTop: 2 }}>
                      {c.cnpj || 'CNPJ não informado'}
                      {c.ramo_atividade && ` · ${RAMO_LABEL_BY_ID[c.ramo_atividade]}`}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {incompleto && (
                      <span title="Cadastro incompleto" style={{ color: P.gold, display: 'flex' }}><IAlert size={15} /></span>
                    )}
                    <RegimeBadge regime={c.tributacao} />
                  </span>
                </button>
              );
            })}
          </div>

          {selecionado && (faltando.length > 0 || !regimeSuportado) && (
            <div style={{
              marginTop: 14, padding: '13px 15px', borderRadius: 10,
              background: `${P.gold}14`, border: `1px solid ${P.gold}3d`,
              display: 'flex', gap: 11, alignItems: 'flex-start',
            }}>
              <span style={{ color: P.gold, flexShrink: 0, marginTop: 1 }}><IAlert /></span>
              <div style={{ fontSize: 12.5, color: P.text, lineHeight: 1.6 }}>
                {faltando.length > 0 ? (
                  <>
                    Cadastro incompleto: falta informar <strong>{faltando.join(' e ')}</strong>.{' '}
                    <Link to={moduleRoute('gestao-clientes')} style={{ color: P.primaryText, fontWeight: 700, textDecoration: 'underline' }}>
                      Completar na Gestão de Clientes
                    </Link>
                  </>
                ) : (
                  <>
                    Esta calculadora cobre apenas <strong>Lucro Presumido</strong> e <strong>Lucro Real</strong>.{' '}
                    Empresas no {selecionado.tributacao} apuram por outra sistemática.
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <PrimaryBtn onClick={onNext} disabled={!podeAvancar}>Continuar</PrimaryBtn>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Etapa 2 — Período e origem dos dados ──────────────────────────────────
function OrigemCard({ icon, titulo, descricao, ativo, onClick }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 220, padding: 18, borderRadius: 12, textAlign: 'left', cursor: 'pointer',
      border: `1px solid ${ativo ? P.primaryBorder : P.border}`,
      background: ativo ? P.primarySoft : P.surface2,
      transition: 'all 0.15s',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, marginBottom: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: ativo ? P.primary : P.primarySoft, color: ativo ? '#fff' : P.primary,
      }}>{icon}</span>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.55 }}>{descricao}</div>
    </button>
  );
}

function PeriodoStep({ empresa, periodo, setPeriodo, origem, setOrigem, onBack, onNext }) {
  const P = useP();
  const presumido = empresa.tributacao === 'Lucro Presumido';
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3];

  const selectStyle = {
    padding: '9px 13px', borderRadius: 9, border: `1px solid ${P.border}`,
    background: P.inputBg, color: P.text, fontSize: 13, fontFamily: FONT_INTER,
    outline: 'none', cursor: 'pointer', minWidth: 170,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: 24 }}>
        <SectionTitle hint="IRPJ e CSLL são apurados por trimestre em ambos os regimes.">Período de apuração</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={periodo.trimestre} onChange={(e) => setPeriodo({ ...periodo, trimestre: Number(e.target.value) })} style={selectStyle}>
            {TRIMESTRES.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.meses})</option>)}
          </select>
          <select value={periodo.ano} onChange={(e) => setPeriodo({ ...periodo, ano: Number(e.target.value) })} style={selectStyle}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Card>

      <Card style={{ padding: 24 }}>
        <SectionTitle hint={presumido
          ? 'No Lucro Presumido a base sai da receita bruta do trimestre — anexe as apurações ou balancetes, ou informe os valores direto.'
          : 'No Lucro Real a base parte do resultado contábil — anexe a DRE do período ou informe os valores direto.'}>
          Origem dos dados
        </SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <OrigemCard
            icon={<IUpload size={18} />}
            titulo={presumido ? 'Anexar apurações / balancetes' : 'Anexar DRE'}
            descricao={presumido
              ? 'Extrai a receita bruta e as demais receitas dos arquivos do período.'
              : 'Extrai o resultado antes dos tributos a partir da demonstração.'}
            ativo={origem === 'arquivo'}
            onClick={() => setOrigem('arquivo')}
          />
          <OrigemCard
            icon={<IKeyboard size={18} />}
            titulo="Informar valores manualmente"
            descricao="Preencha os campos da apuração diretamente, sem anexar arquivo."
            ativo={origem === 'manual'}
            onClick={() => setOrigem('manual')}
          />
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <GhostBtn onClick={onBack}>Voltar</GhostBtn>
        <PrimaryBtn onClick={onNext} disabled={!origem}>Continuar</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Etapa 3 — Dados ───────────────────────────────────────────────────────
// Só anexa e lista os arquivos por enquanto — a extração ainda não está
// ligada (ver hint no chamador) — por isso cada um já nasce "done": não há
// upload nem leitura assíncrona para acompanhar aqui.
function DropZone({ label, hint, arquivos, onFiles, onRemoveFile }) {
  const items = arquivos.map((f) => ({
    id: f.name,
    name: f.name,
    size: f.size,
    status: 'done',
    progress: 100,
    message: 'Anexado',
  }));

  return (
    <AnimatedDropzone
      items={items}
      onFiles={onFiles}
      onRemove={onRemoveFile}
      multiple
      accept=".xlsx,.xls,.csv,.txt,.pdf"
      title={label}
      hint={hint + ' · XLSX, XLS, CSV, TXT ou PDF'}
    />
  );
}

function CampoValor({ campo, valor, onChange }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 190px', gap: 12, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: P.text, fontWeight: 500 }}>{campo.label}</div>
        {campo.hint && <div style={{ fontSize: 11, color: P.muted2, marginTop: 2, lineHeight: 1.45 }}>{campo.hint}</div>}
      </div>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, color: P.muted2, pointerEvents: 'none',
        }}>{campo.negativo ? '−R$' : 'R$'}</span>
        <input
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          style={{
            width: '100%', padding: '9px 12px 9px 46px', borderRadius: 9,
            border: `1px solid ${P.border}`, background: P.inputBg, color: P.text,
            fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

function DadosStep({ empresa, periodo, origem, valores, setValores, arquivos, setArquivos, onBack, onNext }) {
  const P = useP();
  const presumido = empresa.tributacao === 'Lucro Presumido';
  const grupos = presumido ? CAMPOS_PRESUMIDO : CAMPOS_REAL;
  const presuncao = PRESUNCAO_POR_RAMO[empresa.ramo_atividade];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {presumido && presuncao && (
        <Card style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: P.muted }}>
            Ramo <strong style={{ color: P.text }}>{RAMO_LABEL_BY_ID[empresa.ramo_atividade]}</strong> — presunção aplicada:
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '4px 11px', borderRadius: 999, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, color: P.primaryText, fontSize: 12, fontWeight: 700, fontFamily: FONT_MONO }}>
              IRPJ {presuncao.irpj}%
            </span>
            <span style={{ padding: '4px 11px', borderRadius: 999, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, color: P.primaryText, fontSize: 12, fontWeight: 700, fontFamily: FONT_MONO }}>
              CSLL {presuncao.csll}%
            </span>
          </span>
        </Card>
      )}

      {origem === 'arquivo' && (
        <Card style={{ padding: 24 }}>
          <SectionTitle hint="Os arquivos ficam listados abaixo. A extração dos valores será ligada quando a lógica de leitura estiver definida.">
            {presumido ? 'Apurações / balancetes do trimestre' : 'DRE do período'}
          </SectionTitle>
          <DropZone
            label="Arraste os arquivos ou clique para selecionar"
            hint={presumido
              ? `Apurações de ${TRIMESTRES.find((t) => t.id === periodo.trimestre)?.meses} de ${periodo.ano}`
              : `Demonstração do resultado do ${periodo.trimestre}º trimestre de ${periodo.ano}`}
            arquivos={arquivos}
            onFiles={(fs) => setArquivos([...arquivos, ...fs])}
            onRemoveFile={(id) => setArquivos(arquivos.filter((f) => f.name !== id))}
          />
        </Card>
      )}

      <Card style={{ padding: 24 }}>
        <SectionTitle hint={origem === 'arquivo'
          ? 'Confira e ajuste os valores extraídos antes de apurar.'
          : 'Informe os valores do período. Campos em branco entram como zero.'}>
          {presumido ? 'Apuração — Lucro Presumido' : 'Apuração — Lucro Real'}
        </SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {grupos.map((g) => (
            <div key={g.grupo}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.text, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${P.border}` }}>
                {g.grupo}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {g.campos.map((campo) => (
                  <CampoValor
                    key={campo.id}
                    campo={campo}
                    valor={valores[campo.id]}
                    onChange={(v) => setValores({ ...valores, [campo.id]: v })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <GhostBtn onClick={onBack}>Voltar</GhostBtn>
        <PrimaryBtn onClick={onNext}>Apurar</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Etapa 4 — Resultado ───────────────────────────────────────────────────
function ResultadoStep({ empresa, periodo, onBack }) {
  const P = useP();
  const presumido = empresa.tributacao === 'Lucro Presumido';
  const linhas = presumido ? LINHAS_RESULTADO_PRESUMIDO : LINHAS_RESULTADO_REAL;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{
        padding: '15px 20px', display: 'flex', gap: 11, alignItems: 'flex-start',
        background: `${P.gold}14`, borderColor: `${P.gold}3d`,
      }}>
        <span style={{ color: P.gold, flexShrink: 0, marginTop: 1 }}><IAlert /></span>
        <div style={{ fontSize: 12.5, color: P.text, lineHeight: 1.6 }}>
          <strong>Layout em validação.</strong> A estrutura do demonstrativo está definida, mas o
          cálculo ainda não foi ligado — os valores aparecem zerados de propósito. Prendemos essa
          etapa até fechar as regras de apuração.
        </div>
      </Card>

      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text }}>{empresa.name}</div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 3 }}>
              {periodo.trimestre}º trimestre de {periodo.ano} · {empresa.tributacao}
            </div>
          </div>
          <RegimeBadge regime={empresa.tributacao} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {linhas.map((l) => (
            <div key={l.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
              padding: l.total ? '15px 0 4px' : '11px 0',
              borderTop: l.total ? `2px solid ${P.border2}` : 'none',
              borderBottom: l.total ? 'none' : `1px solid ${P.border}`,
              marginTop: l.total ? 8 : 0,
            }}>
              <span style={{
                fontSize: l.total ? 14 : 13,
                fontWeight: l.destaque ? 700 : 500,
                color: l.destaque ? P.text : P.muted,
              }}>{l.label}</span>
              <span style={{
                fontSize: l.total ? 17 : 13.5, fontFamily: FONT_MONO,
                fontWeight: l.destaque ? 700 : 500,
                color: l.total ? P.primary : l.destaque ? P.text : P.muted,
              }}>{fmtBRL(0)}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: `1px solid ${P.border}`,
          fontSize: 11.5, color: P.muted2, lineHeight: 1.65,
        }}>
          Parâmetros: IRPJ {ALIQUOTAS.irpj}% · adicional de {ALIQUOTAS.irpjAdicional}% sobre o que exceder{' '}
          {fmtBRL(LIMITE_ADICIONAL_MENSAL * 3)} no trimestre · CSLL {ALIQUOTAS.csll}%
          {!presumido && ` · compensação de prejuízo limitada a ${LIMITE_COMPENSACAO_PREJUIZO}% do lucro`}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <GhostBtn onClick={onBack}>Voltar aos dados</GhostBtn>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────
export default function CalculadoraIrpjCsllPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [companyId, setCompanyId] = useState(undefined); // undefined = carregando
  useEffect(() => {
    getCurrentTenantCompanyId().then((id) => setCompanyId(id || null)).catch(() => setCompanyId(null));
  }, []);

  const [clientes, setClientes] = useState([]);
  useEffect(() => {
    let ativo = true;
    Promise.resolve(companyId ? getClientes(companyId) : [])
      .then((c) => { if (ativo) setClientes(c); })
      .catch(() => { if (ativo) setClientes([]); });
    return () => { ativo = false; };
  }, [companyId]);

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [periodo, setPeriodo] = useState({ trimestre: 1, ano: new Date().getFullYear() });
  const [origem, setOrigem] = useState('');
  const [valores, setValores] = useState({});
  const [arquivos, setArquivos] = useState([]);

  const empresa = clientes.find((c) => c.id === selectedId) || null;

  const go = (n) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  };

  // Trocar de empresa pode trocar o regime, e com ele o formulário inteiro —
  // manter os valores digitados levaria campos de um regime para o outro.
  const selecionarEmpresa = (id) => {
    if (id !== selectedId) { setValores({}); setArquivos([]); setOrigem(''); }
    setSelectedId(id);
  };

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          @media (max-width: 720px) {
            .irpj-campo { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <SolucoesHeader />

        <main style={{ maxWidth: 980, margin: '0 auto', padding: '34px 28px 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 5 }}>
              Calculadora de IRPJ e CSLL
            </h1>
            <p style={{ fontSize: '0.88rem', color: P.muted, lineHeight: 1.6 }}>
              Apuração trimestral para empresas no Lucro Presumido e no Lucro Real.
            </p>
          </div>

          {companyId === undefined ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: P.muted, fontSize: 14 }}>
              Carregando dados da organização...
            </div>
          ) : (
            <>
              <Steps current={step} maxReached={maxReached} onGo={go} />

              {step === 0 && (
                <EmpresaStep
                  clientes={clientes}
                  selectedId={selectedId}
                  onSelect={selecionarEmpresa}
                  onNext={() => go(1)}
                />
              )}

              {step === 1 && empresa && (
                <PeriodoStep
                  empresa={empresa}
                  periodo={periodo}
                  setPeriodo={setPeriodo}
                  origem={origem}
                  setOrigem={setOrigem}
                  onBack={() => go(0)}
                  onNext={() => go(2)}
                />
              )}

              {step === 2 && empresa && (
                <DadosStep
                  empresa={empresa}
                  periodo={periodo}
                  origem={origem}
                  valores={valores}
                  setValores={setValores}
                  arquivos={arquivos}
                  setArquivos={setArquivos}
                  onBack={() => go(1)}
                  onNext={() => go(3)}
                />
              )}

              {step === 3 && empresa && (
                <ResultadoStep empresa={empresa} periodo={periodo} onBack={() => go(2)} />
              )}
            </>
          )}
        </main>
      </div>
    </PaletteCtx.Provider>
  );
}
