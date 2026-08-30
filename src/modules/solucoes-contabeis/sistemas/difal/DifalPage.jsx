// Calculadora de DIFAL — tela de apuração.
//
// A tela é uma casca fina sobre o motor: ela lê os XMLs, entrega o texto para
// `processarLote` e desenha o que voltou. Nenhum cálculo acontece aqui, de
// propósito — o que o contador vê na tela é exatamente o que os testes do
// motor cobrem.
//
// A decisão de UI que manda no resto do arquivo: o XML fica guardado em
// memória, não só o resultado. Trocar a empresa, o método de base ou a
// política de revenda recalcula o lote inteiro na hora, sem novo upload —
// e é isso que torna a conferência um diálogo, e não um formulário.

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SolucoesHeader from '../../components/SolucoesHeader';
import AnimatedDropzone from '../../../../components/AnimatedDropzone';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';
import { getClientes } from '../../services/clients.service';
import NotaDrawer from './NotaDrawer';
import HistoricoApuracoes from './HistoricoApuracoes';
import { VERSAO_MOTOR, processarLote } from './difalPipeline';
import { xmlPorArquivo } from './difalPersistencia';
import {
  carregarApuracao, excluirApuracao, fecharApuracao, listarApuracoes,
  notasJaApuradas, salvarApuracao,
} from '../../services/difal.service';
import { getTabela } from './ncmRegras';
import { carregarTabelaUf } from '../../services/regrasNcm.service';
import { exportarXlsx } from './difalExport';
import {
  ROTULO_FINALIDADE, ROTULO_METODO, achatarItens, competenciaDoLote,
  competenciaLegivel, explicarCalculo, fmtBRL, fmtCnpj, fmtData, fmtNcm, fmtPct,
  rotuloFonteInterestadual, rotuloOrigemAliquota, rotuloSituacao,
} from './difalFormato';

const PaletteCtx = createContext(null);
const useP = () => useContext(PaletteCtx);

// ── Ícones ────────────────────────────────────────────────────────────────
function IReceipt({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function IBuilding({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M10 21v-5h4v5" /><path d="M9 8h.01M12 8h.01M15 8h.01" /><path d="M9 12h.01M12 12h.01M15 12h.01" />
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
function IDownload({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function ISalvar({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IChevron({ size = 14, aberto }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function ILupa({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ISearch({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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

function SectionTitle({ children, hint, acao }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {children}
        </div>
        {hint && <div style={{ fontSize: 12, color: P.muted, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      {acao}
    </div>
  );
}

function Badge({ cor = 'muted', children, title }) {
  const P = useP();
  const fundo = { green: 'rgba(16,185,129,0.12)', gold: 'rgba(240,180,41,0.14)', muted: P.surface2 }[cor];
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
      borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: fundo, color: cor === 'muted' ? P.muted : P[cor],
      border: `1px solid ${cor === 'muted' ? P.border : 'transparent'}`,
    }}>{children}</span>
  );
}

function Botao({ children, onClick, disabled, variante = 'primario', style = {} }) {
  const P = useP();
  const primario = variante === 'primario';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
        borderRadius: 9, fontFamily: FONT_INTER, fontSize: 12.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${primario ? P.primaryBorder : P.border}`,
        background: primario ? P.primarySoft : 'transparent',
        color: primario ? P.primaryText : P.muted,
        transition: 'all 0.15s', ...style,
      }}
    >{children}</button>
  );
}

// A lupa é o mesmo gesto em toda a tela: abre a nota de onde aquela linha
// veio. Fica sempre na última coluna, para que o olho a encontre sem procurar.
function BotaoLupa({ onClick, titulo }) {
  const P = useP();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={titulo}
      aria-label={titulo}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
        border: `1px solid ${P.border}`, background: 'transparent', color: P.muted,
        transition: 'all 0.15s',
      }}
    ><ILupa /></button>
  );
}

function Campo({ label, hint, children }) {
  const P = useP();
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: P.muted, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: P.muted2, marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </label>
  );
}

function Select({ value, onChange, children }) {
  const P = useP();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 11px', borderRadius: 9, fontFamily: FONT_INTER,
        fontSize: 13, background: P.inputBg, color: P.text,
        border: `1px solid ${P.border2}`, outline: 'none', cursor: 'pointer',
      }}
    >{children}</select>
  );
}

// ── Parâmetros da apuração ────────────────────────────────────────────────
// Empresa é opcional de propósito: filtrar pelo CNPJ do destinatário evita
// que uma nota de outro cliente entre na guia por engano, mas o contador
// também usa a tela para conferir um XML avulso, sem cadastro nenhum.
function ParametrosCard({
  clientes, clienteId, setClienteId, metodoBase, setMetodoBase,
  politicaRevenda, setPoliticaRevenda, ufDestino, competencia, setCompetencia,
  tabela, carregandoTabela,
}) {
  const P = useP();
  const padraoMetodo = tabela ? ROTULO_METODO[tabela.metodoBase] : 'definido pela UF';

  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <SectionTitle
        hint="A UF de destino e a data de emissão saem da própria nota. O que fica aqui é o que o XML não diz."
        acao={
          <Link to="ajuste-fiscal" style={{ fontSize: 11.5, fontWeight: 600, color: P.primaryText, whiteSpace: 'nowrap' }}>
            Ajustar alíquotas deste escritório →
          </Link>
        }
      >
        Parâmetros da apuração
      </SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }} className="difal-params">
        <Campo
          label="Empresa em apuração"
          hint={clienteId ? 'Notas de outro destinatário serão descartadas do lote.' : 'Sem empresa escolhida, todo XML enviado é processado.'}
        >
          <Select value={clienteId} onChange={setClienteId}>
            <option value="">Não filtrar por empresa</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.cnpj ? ` — ${fmtCnpj(c.cnpj)}` : ''}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Método de base de cálculo" hint={`Padrão da UF de destino: ${padraoMetodo}.`}>
          <Select value={metodoBase} onChange={setMetodoBase}>
            <option value="">Usar o padrão da UF</option>
            <option value="base_simples">Base simples</option>
            <option value="base_dupla">Base dupla (por dentro)</option>
          </Select>
        </Campo>

        <Campo
          label="Mercadoria para revenda"
          hint="Estados que cobram antecipação parcial na entrada para revenda (BA, PE, RN e outros) mudam esta chave."
        >
          <Select value={politicaRevenda} onChange={setPoliticaRevenda}>
            <option value="">Usar o padrão da UF</option>
            <option value="nao_incide">Não incide na revenda</option>
            <option value="antecipacao_parcial">Cobrar antecipação parcial</option>
          </Select>
        </Campo>

        <Campo
          label="Competência"
          hint="Preenchida pelo mês da maioria das notas do lote. É por ela que a apuração é guardada e procurada depois."
        >
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            style={{
              width: '100%', padding: '9px 11px', borderRadius: 9, fontFamily: FONT_INTER,
              fontSize: 13, background: P.inputBg, color: P.text,
              border: `1px solid ${P.border2}`, outline: 'none',
            }}
          />
        </Campo>
      </div>

      {ufDestino && !carregandoTabela && !tabela && (
        <div style={{ marginTop: 14, fontSize: 12, color: P.gold, display: 'flex', alignItems: 'center', gap: 7 }}>
          <IAlert size={14} /> Não há tabela de alíquotas internas cadastrada para {ufDestino}.
        </div>
      )}
      {tabela && tabela.origemDados !== 'seed' && (
        <div style={{ marginTop: 14, fontSize: 11.5, color: P.muted2 }}>
          Alíquotas de {ufDestino} carregadas do banco{tabela.temAjusteDoEscritorio ? ', com ajuste deste escritório' : ''}.
        </div>
      )}
      {tabela?.origemDados === 'seed' && (
        <div style={{ marginTop: 14, fontSize: 11.5, color: P.muted2 }}>
          Alíquotas de {ufDestino} vindas do arquivo de exemplo (nada cadastrado no banco para esta UF ainda).
        </div>
      )}
    </Card>
  );
}

// ── Resumo ────────────────────────────────────────────────────────────────
function Kpi({ label, valor, destaque, sub }) {
  const P = useP();
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
      <div style={{
        fontSize: destaque ? '1.5rem' : '1.15rem', fontWeight: 800, marginTop: 6,
        color: destaque ? P.primaryText : P.text, fontFamily: FONT_MONO, letterSpacing: -0.5,
      }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function Resumo({ resultado, onExportar, onSalvar, salvando, podeSalvar, motivoSemSalvar }) {
  const P = useP();
  const { totais } = resultado;
  const notasProcessadas = resultado.notas.filter((n) => n.ok && n.processada).length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Total a recolher" valor={fmtBRL(totais.vTotal)} destaque
          sub={totais.vFcp > 0 ? `${fmtBRL(totais.vDifal)} de DIFAL + ${fmtBRL(totais.vFcp)} de FCP` : 'DIFAL, sem FCP no lote'} />
        <Kpi label="Base de cálculo" valor={fmtBRL(totais.vBase)} sub={`${totais.calculados} itens calculados`} />
        <Kpi label="Notas processadas" valor={String(notasProcessadas)}
          sub={`${resultado.notas.length} arquivos enviados`} />
        <Kpi label="Itens pendentes" valor={String(totais.pendentes)}
          sub={totais.pendentes ? 'precisam de decisão manual' : 'nada travado'} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Botao onClick={onExportar} disabled={!totais.itens} variante="secundario">
          <IDownload /> Exportar planilha
        </Botao>
        <Botao onClick={onSalvar} disabled={!podeSalvar || salvando} style={{ opacity: podeSalvar ? 1 : 0.5 }}>
          <ISalvar /> {salvando ? 'Salvando…' : 'Salvar apuração'}
        </Botao>
      </div>
      {motivoSemSalvar && (
        <div style={{ fontSize: 11.5, color: P.muted2, textAlign: 'right', marginTop: -12, marginBottom: 18 }}>
          {motivoSemSalvar}
        </div>
      )}

      {totais.itens > 0 && totais.calculados === 0 && (
        <Card style={{ padding: 16, marginBottom: 20, borderColor: P.primaryBorder }}>
          <div style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.6 }}>
            Nenhum item do lote gerou diferencial. Isso é resultado, não erro: pode ser ST já
            retido na origem, mercadoria para revenda em estado que não cobra antecipação, ou
            alíquota interna igual à interestadual. A coluna <b>Situação</b> diz qual foi o caso
            em cada item.
          </div>
        </Card>
      )}
    </>
  );
}

// ── Pendências ────────────────────────────────────────────────────────────
function Pendencias({ pendencias, erros }) {
  const P = useP();
  if (!pendencias.length && !erros.length) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 20, borderColor: 'rgba(240,180,41,0.35)' }}>
      <SectionTitle hint="O motor não chuta: item que ele não sabe classificar com certeza para aqui, com o motivo. Resolva antes de fechar a guia.">
        <span style={{ color: P.gold, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IAlert size={13} /> Pendências ({pendencias.length + erros.length})
        </span>
      </SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {erros.map((e, i) => (
          <div key={`erro-${i}`} style={{ fontSize: 12.5, color: P.text, lineHeight: 1.5 }}>
            <span style={{ fontFamily: FONT_MONO, color: P.red }}>{e.arquivo || 'arquivo sem nome'}</span>
            <span style={{ color: P.muted }}> — não foi possível ler: {e.erro}</span>
          </div>
        ))}
        {pendencias.map((p, i) => (
          <div key={`pend-${i}`} style={{ fontSize: 12.5, color: P.text, lineHeight: 1.5 }}>
            <span style={{ fontFamily: FONT_MONO, color: P.gold }}>
              {p.numeroNota ? `NF ${p.numeroNota}` : p.arquivo || '—'}{p.nItem ? ` · item ${p.nItem}` : ''}
            </span>
            <span style={{ color: P.muted }}> — {p.descricao ? `${p.descricao}: ` : ''}{p.motivo}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Detalhe do item ───────────────────────────────────────────────────────
function LinhaDetalhe({ rotulo, valor }) {
  const P = useP();
  if (valor == null || valor === '') return null;
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.55 }}>
      <span style={{ color: P.muted2, minWidth: 118, flexShrink: 0 }}>{rotulo}</span>
      <span style={{ color: P.text }}>{valor}</span>
    </div>
  );
}

function DetalheItem({ item }) {
  const P = useP();
  const origem = rotuloOrigemAliquota(item.aliquotas);
  const conta = explicarCalculo(item);
  const parcelas = item.base?.parcelas;

  return (
    <div style={{
      padding: '16px 18px', background: P.surface2, borderTop: `1px solid ${P.border}`,
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          Como a alíquota foi encontrada
        </div>
        <LinhaDetalhe rotulo="Interna" valor={item.aliquotas ? `${fmtPct(item.aliquotas.interna)} — ${origem.curto}` : '—'} />
        <LinhaDetalhe rotulo="Fundamento" valor={origem.longo} />
        {item.aliquotas && (
          <LinhaDetalhe
            rotulo="Interestadual"
            valor={`${fmtPct(item.aliquotas.interestadual)} — ${rotuloFonteInterestadual(item.aliquotas.fonteInterestadual)}`}
          />
        )}
        <LinhaDetalhe rotulo="Finalidade" valor={ROTULO_FINALIDADE[item.finalidade]} />
        <LinhaDetalhe rotulo="Motivo" valor={item.motivo} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          Composição da base
        </div>
        {parcelas ? (
          <>
            <LinhaDetalhe rotulo="Produto" valor={fmtBRL(parcelas.vProd)} />
            {parcelas.vFrete > 0 && <LinhaDetalhe rotulo="Frete" valor={fmtBRL(parcelas.vFrete)} />}
            {parcelas.vSeg > 0 && <LinhaDetalhe rotulo="Seguro" valor={fmtBRL(parcelas.vSeg)} />}
            {parcelas.vOutro > 0 && <LinhaDetalhe rotulo="Outras despesas" valor={fmtBRL(parcelas.vOutro)} />}
            {parcelas.vDesc < 0 && <LinhaDetalhe rotulo="Desconto" valor={fmtBRL(parcelas.vDesc)} />}
            {parcelas.vIpi > 0 && (
              <LinhaDetalhe
                rotulo="IPI"
                valor={item.base.ipiIntegra
                  ? `${fmtBRL(parcelas.vIpi)} — integra a base (consumidor final)`
                  : `${fmtBRL(parcelas.vIpi)} — fora da base (mercadoria para revenda)`}
              />
            )}
            <LinhaDetalhe rotulo="Base" valor={fmtBRL(item.valores.vBase)} />
          </>
        ) : (
          <div style={{ fontSize: 12, color: P.muted }}>Item sem base apurada.</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          A conta
        </div>
        {conta ? (
          <>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: P.text, lineHeight: 1.7 }}>{conta.difal}</div>
            {conta.fcp && <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: P.text, lineHeight: 1.7 }}>{conta.fcp}</div>}
            <div style={{ fontSize: 11.5, color: P.muted2, marginTop: 2 }}>{ROTULO_METODO[item.metodoBase]}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6 }}>
            Sem cálculo para este item.
          </div>
        )}
        {(item.alertas || []).map((a, i) => (
          <div key={i} style={{ fontSize: 11.5, color: P.gold, lineHeight: 1.5, display: 'flex', gap: 6, marginTop: 4 }}>
            <IAlert size={13} /> <span>{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tabela de itens ───────────────────────────────────────────────────────
const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'calculado', label: 'Calculados' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'nao_aplicavel', label: 'Não aplicáveis' },
];

function TabelaItens({ itens, onInspecionar }) {
  const P = useP();
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (filtro !== 'todos' && i.situacao !== filtro) return false;
      if (!termo) return true;
      return [i.descricao, i.ncm, i.codigo, i.cfop, i.numeroNota]
        .some((campo) => String(campo ?? '').toLowerCase().includes(termo));
    });
  }, [itens, filtro, busca]);

  const contagem = (id) => (id === 'todos' ? itens.length : itens.filter((i) => i.situacao === id).length);
  const chaveItem = (i) => `${i.chave}-${i.nItem}`;

  const th = {
    textAlign: 'left', padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
    color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 12px', fontSize: 12.5, borderBottom: `1px solid ${P.border}`, verticalAlign: 'top' };

  return (
    <Card style={{ overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontFamily: FONT_INTER, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1px solid ${ativo ? P.primaryBorder : P.border}`,
                  background: ativo ? P.primarySoft : 'transparent',
                  color: ativo ? P.primaryText : P.muted,
                }}
              >
                {f.label} <span style={{ opacity: 0.65 }}>{contagem(f.id)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 8, border: `1px solid ${P.border}`, background: P.inputBg }}>
          <span style={{ color: P.muted2, display: 'flex' }}><ISearch /></span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Produto, NCM, CFOP ou nota"
            style={{
              border: 'none', outline: 'none', background: 'transparent', color: P.text,
              fontFamily: FONT_INTER, fontSize: 12.5, width: 190,
            }}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 34 }} />
              <th style={th}>Nota / item</th>
              <th style={th}>Produto</th>
              <th style={th}>NCM</th>
              <th style={th}>CFOP</th>
              <th style={th}>Situação</th>
              <th style={th}>Origem da alíquota</th>
              <th style={{ ...th, textAlign: 'right' }}>Base</th>
              <th style={{ ...th, textAlign: 'right' }}>Interna × Inter.</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={{ ...th, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item) => {
              const chave = chaveItem(item);
              const expandido = aberto === chave;
              const situacao = rotuloSituacao(item.situacao);
              const origem = rotuloOrigemAliquota(item.aliquotas);
              return (
                <Fragment key={chave}>
                  <tr
                    onClick={() => setAberto(expandido ? null : chave)}
                    style={{ cursor: 'pointer', background: expandido ? P.rowHover : 'transparent' }}
                  >
                    <td style={{ ...td, width: 34, color: P.muted2 }}><IChevron aberto={expandido} /></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 12 }}>NF {item.numeroNota}</div>
                      <div style={{ fontSize: 11, color: P.muted2 }}>item {item.nItem} · {fmtData(item.dataEmissao)}</div>
                    </td>
                    <td style={{ ...td, minWidth: 200 }}>
                      <div>{item.descricao}</div>
                      <div style={{ fontSize: 11, color: P.muted2, fontFamily: FONT_MONO }}>{item.codigo}</div>
                    </td>
                    <td style={{ ...td, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>{fmtNcm(item.ncm)}</td>
                    <td style={{ ...td, fontFamily: FONT_MONO }}>{item.cfop}</td>
                    <td style={td}>
                      <Badge cor={situacao.cor} title={item.motivo || ''}>{situacao.label}</Badge>
                    </td>
                    <td style={{ ...td, color: item.situacao === 'calculado' ? P.text : P.muted2, fontSize: 12 }}>
                      {item.situacao === 'calculado' ? origem.curto : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                      {item.valores.vBase ? fmtBRL(item.valores.vBase) : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, whiteSpace: 'nowrap', color: P.muted }}>
                      {item.aliquotas ? `${fmtPct(item.aliquotas.interna)} × ${fmtPct(item.aliquotas.interestadual)}` : '—'}
                    </td>
                    <td style={{
                      ...td, textAlign: 'right', fontFamily: FONT_MONO, whiteSpace: 'nowrap',
                      fontWeight: item.valores.vTotal ? 700 : 400,
                      color: item.valores.vTotal ? P.text : P.muted2,
                    }}>
                      {item.valores.vTotal ? fmtBRL(item.valores.vTotal) : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <BotaoLupa
                        onClick={() => onInspecionar(item)}
                        titulo={`Ver a nota ${item.numeroNota}, item ${item.nItem}`}
                      />
                    </td>
                  </tr>
                  {expandido && (
                    <tr>
                      <td colSpan={11} style={{ padding: 0 }}><DetalheItem item={item} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visiveis.length && (
              <tr>
                <td colSpan={11} style={{ padding: '34px 12px', textAlign: 'center', color: P.muted, fontSize: 13 }}>
                  Nenhum item com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Consolidação por NCM ──────────────────────────────────────────────────
// A lista de "quais NCM verificar na Econet" não precisa vir da tabela NCM
// inteira do Brasil: ela sai daqui — os produtos que, no lote de verdade dos
// clientes, não bateram com nenhuma faixa cadastrada e caíram na regra geral
// da UF. É o motor mesmo que aponta onde vale a pena olhar exceção.
function TabelaPorNcm({ porNcm }) {
  const P = useP();
  const [soRegraGeral, setSoRegraGeral] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (!porNcm.length) return null;

  const regraGeral = porNcm.filter((l) => l.origemInterna === 'regra_geral');
  const visiveis = soRegraGeral ? regraGeral : porNcm;

  async function copiarNcmsRegraGeral() {
    const lista = regraGeral.map((l) => fmtNcm(l.ncm)).join('\n');
    try {
      await navigator.clipboard.writeText(lista);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie a lista de NCMs (Ctrl+C, Enter):', lista);
    }
  }

  const th = {
    textAlign: 'left', padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
    color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${P.border}`,
  };
  const td = { padding: '11px 12px', fontSize: 12.5, borderBottom: `1px solid ${P.border}` };

  return (
    <Card style={{ overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <SectionTitle hint="Quebra do lote por produto. Os que caíram na regra geral (sem faixa de NCM cadastrada) são os candidatos a virar exceção — verifique na Econet e cadastre.">
          Consolidado por NCM
        </SectionTitle>
        {regraGeral.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSoRegraGeral((v) => !v)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontFamily: FONT_INTER, fontSize: 12,
                fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                border: `1px solid ${soRegraGeral ? P.primaryBorder : P.border}`,
                background: soRegraGeral ? P.primarySoft : 'transparent',
                color: soRegraGeral ? P.primaryText : P.muted,
              }}
            >
              Só regra geral <span style={{ opacity: 0.65 }}>{regraGeral.length}</span>
            </button>
            <Botao onClick={copiarNcmsRegraGeral} variante="secundario">
              {copiado ? 'Copiado!' : `Copiar ${regraGeral.length} NCM(s)`}
            </Botao>
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr>
              <th style={th}>NCM</th>
              <th style={th}>Alíquota interna</th>
              <th style={th}>Origem</th>
              <th style={{ ...th, textAlign: 'right' }}>Itens</th>
              <th style={{ ...th, textAlign: 'right' }}>Base</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const origem = rotuloOrigemAliquota({
                origemInterna: l.origemInterna, ncmRegra: l.ncmRegra,
                nivelNcm: l.ncmRegra ? l.ncmRegra.length : 0,
              });
              return (
                <tr key={l.ncm}>
                  <td style={{ ...td, fontFamily: FONT_MONO }}>{fmtNcm(l.ncm)}</td>
                  <td style={td}>{fmtPct(l.aliquotaInterna)}</td>
                  <td style={{ ...td, color: P.muted }}>{origem.curto}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO }}>{l.itens}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO }}>{fmtBRL(l.vBase)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700 }}>{fmtBRL(l.vTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Notas do lote ─────────────────────────────────────────────────────────
// Todas as notas enviadas, inclusive as que o motor descartou na triagem e as
// que nem conseguiu ler. Nota que some sem explicação vira desconfiança na
// apuração inteira — aqui cada arquivo diz o que virou, e a lupa abre a nota.
function TabelaNotas({ notas, onInspecionar }) {
  const P = useP();
  if (!notas.length) return null;

  const th = {
    textAlign: 'left', padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
    color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 12px', fontSize: 12.5, borderBottom: `1px solid ${P.border}` };

  return (
    <Card style={{ overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '18px 20px 4px' }}>
        <SectionTitle hint="Cada arquivo enviado e o que ele virou. A lupa abre a nota: identificação, partes, totais e o XML como o motor leu.">
          Notas do lote ({notas.length})
        </SectionTitle>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Arquivo</th>
              <th style={th}>Nota</th>
              <th style={th}>Emitente</th>
              <th style={th}>Rota</th>
              <th style={th}>Situação</th>
              <th style={{ ...th, textAlign: 'right' }}>Itens</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={{ ...th, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {notas.map((nota, i) => {
              const dados = nota.nota;
              const situacao = !nota.ok
                ? { label: 'Ilegível', cor: 'muted', detalhe: nota.erro }
                : nota.processada
                  ? { label: 'Processada', cor: 'green', detalhe: null }
                  : {
                    label: nota.situacao === 'pendente' ? 'Pendente' : 'Fora da apuração',
                    cor: nota.situacao === 'pendente' ? 'gold' : 'muted',
                    detalhe: nota.motivo,
                  };
              return (
                <tr key={`${nota.arquivo || 'nota'}-${i}`}>
                  <td style={{ ...td, fontFamily: FONT_MONO, fontSize: 11.5, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nota.arquivo || '—'}
                  </td>
                  <td style={{ ...td, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                    {dados?.numero ? `${dados.numero}/${dados.serie || '1'}` : '—'}
                    <div style={{ fontSize: 11, color: P.muted2 }}>{fmtData(dados?.dataEmissao)}</div>
                  </td>
                  <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dados?.emitente?.nome || '—'}
                  </td>
                  <td style={{ ...td, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                    {dados?.emitente?.uf && dados?.destinatario?.uf
                      ? `${dados.emitente.uf} → ${dados.destinatario.uf}`
                      : '—'}
                  </td>
                  <td style={td}>
                    <Badge cor={situacao.cor} title={situacao.detalhe || ''}>{situacao.label}</Badge>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO }}>
                    {nota.processada ? `${nota.totais.calculados}/${nota.totais.itens}` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: nota.totais.vTotal ? 700 : 400 }}>
                    {nota.totais.vTotal ? fmtBRL(nota.totais.vTotal) : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <BotaoLupa
                      onClick={() => onInspecionar(nota)}
                      titulo={dados?.numero ? `Ver a nota ${dados.numero}` : 'Ver o arquivo'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Nota já apurada antes ─────────────────────────────────────────────────
// Pagar DIFAL duas vezes pela mesma nota é o erro clássico deste processo, e
// acontece de um jeito banal: o mesmo XML volta no lote do mês seguinte. O
// motor não tem como perceber (ele só vê o lote da vez) — quem sabe é o banco.
function AvisoRepetidas({ repetidas, notas }) {
  const P = useP();
  const chaves = Object.keys(repetidas || {});
  if (!chaves.length) return null;

  const porChave = new Map(
    notas.filter((n) => n.ok && n.nota?.chave).map((n) => [n.nota.chave, n]),
  );

  return (
    <Card style={{ padding: 20, marginBottom: 20, borderColor: 'rgba(240,180,41,0.35)' }}>
      <SectionTitle hint="Estas notas já entraram em uma apuração salva. Confira antes de recolher: a mesma nota em duas competências é DIFAL pago em dobro.">
        <span style={{ color: P.gold, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IAlert size={13} /> Notas já apuradas antes ({chaves.length})
        </span>
      </SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chaves.map((chave) => {
          const nota = porChave.get(chave);
          const onde = repetidas[chave];
          return (
            <div key={chave} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ fontFamily: FONT_MONO, color: P.gold }}>
                {nota?.nota?.numero ? `NF ${nota.nota.numero}` : chave.slice(0, 12) + '…'}
              </span>
              <span style={{ color: P.muted }}>
                {' '}— já consta na competência {competenciaLegivel(onde.competencia)}
                {onde.status === 'fechada' ? ', que está fechada' : ''}.
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Apuração carregada do histórico ───────────────────────────────────────
function FaixaApuracao({ apuracao, onSair }) {
  const P = useP();
  const fechada = apuracao.status === 'fechada';
  return (
    <Card style={{
      padding: '14px 18px', marginBottom: 20,
      borderColor: fechada ? P.border2 : P.primaryBorder,
      background: fechada ? P.surface2 : P.primarySoft,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, fontSize: 12.5, lineHeight: 1.6, color: P.text }}>
          <b>Apuração de {competenciaLegivel(apuracao.competencia)}</b>
          {apuracao.cliente?.nome ? ` · ${apuracao.cliente.nome}` : ''}
          {fechada ? (
            <div style={{ color: P.muted, marginTop: 2 }}>
              Fechada — os números são os que foram gravados, com o motor v{apuracao.versao_motor}
              {apuracao.versao_tabela ? ` e a tabela ${apuracao.versao_tabela}` : ''}. Reabra no
              histórico para reprocessar.
            </div>
          ) : (
            <div style={{ color: P.muted, marginTop: 2 }}>
              Aberta — as notas voltaram para a tela e estão sendo processadas com as regras de
              hoje. Salvar de novo regrava esta competência.
            </div>
          )}
        </div>
        <Botao variante="secundario" onClick={onSair}>Começar uma apuração nova</Botao>
      </div>
    </Card>
  );
}

// ── Estado vazio ──────────────────────────────────────────────────────────
function ComoFunciona() {
  const P = useP();
  const passos = [
    ['Produto a produto', 'Cada <det> do XML é apurado sozinho: uma nota mistura item de 25%, item de 18% e item com ST já retido.'],
    ['Hierarquia de NCM', 'A alíquota interna é buscada do específico para o genérico — 8, 6, 4 dígitos e, por último, a regra geral do estado.'],
    ['Sem chute', 'Item que o motor não classifica com certeza vira pendência com o motivo escrito, nunca um valor aproximado.'],
  ];
  return (
    <Card style={{ padding: 22 }}>
      <SectionTitle>Como esta apuração funciona</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {passos.map(([titulo, texto]) => (
          <div key={titulo}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>{titulo}</div>
            <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6 }}>{texto}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Página ────────────────────────────────────────────────────────────────
export default function DifalPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [companyId, setCompanyId] = useState(undefined);
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

  const [clienteId, setClienteId] = useState('');
  const [metodoBase, setMetodoBase] = useState('');
  const [politicaRevenda, setPoliticaRevenda] = useState('');
  // O XML fica aqui, não só o resultado: é o que permite recalcular o lote
  // quando um parâmetro muda, sem pedir o arquivo de novo.
  const [entradas, setEntradas] = useState([]);
  const [lendo, setLendo] = useState(false);
  // Nota (e, quando veio de uma linha de item, o item) aberta na lupa.
  const [inspecao, setInspecao] = useState(null);

  // ── Persistência ────────────────────────────────────────────────────────
  const [competencia, setCompetencia] = useState('');
  // Apuração carregada do histórico. Quando ela está fechada, a tela mostra
  // `resultadoSalvo` — os números como foram gravados — em vez de reprocessar
  // com as regras de hoje: uma guia já recolhida não pode mudar sozinha
  // porque a tabela de NCM foi corrigida depois.
  const [apuracaoAberta, setApuracaoAberta] = useState(null);
  const [resultadoSalvo, setResultadoSalvo] = useState(null);
  const [xmlsSalvos, setXmlsSalvos] = useState({});
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroPersistencia, setErroPersistencia] = useState(null);
  const [repetidas, setRepetidas] = useState({});

  const cliente = clientes.find((c) => String(c.id) === clienteId) || null;
  const fechada = apuracaoAberta?.status === 'fechada';

  // A UF de destino só é conhecida DEPOIS de um primeiro processamento (ela
  // vem do XML das notas) — por isso este estado nasce antes de `aoVivo` mas
  // só é preenchido de verdade depois que `ufDestino`, calculada mais abaixo
  // a partir do resultado, aparece pela primeira vez. Na passada zero, o
  // motor cai no próprio fallback dele (o arquivo de exemplo).
  const [tabelaUf, setTabelaUf] = useState(null);
  const [carregandoTabela, setCarregandoTabela] = useState(false);

  const aoVivo = useMemo(() => processarLote(entradas, {
    cnpjCliente: cliente?.cnpj || null,
    metodoBase: metodoBase || undefined,
    politicaRevenda: politicaRevenda || undefined,
    tabela: tabelaUf || undefined,
  }), [entradas, cliente, metodoBase, politicaRevenda, tabelaUf]);

  const resultado = fechada && resultadoSalvo ? resultadoSalvo : aoVivo;
  const itens = useMemo(() => achatarItens(resultado.notas), [resultado]);

  // UF de destino observada no lote — quando ainda não há nota, cai no estado
  // cadastrado da empresa, que é o palpite honesto disponível.
  const ufDestino = resultado.notas.find((n) => n.ok && n.processada)?.operacao.ufDestino
    || cliente?.estado || '';

  // A tabela vem do banco (global + ajuste do escritório, ver
  // regrasNcm.service.js); o arquivo `ncmRegras.js` só entra como rede de
  // segurança quando o banco não tem NADA cadastrado para a UF — cobre o
  // período de transição e uma eventual falha de rede.
  useEffect(() => {
    let ativo = true;
    if (!ufDestino) { setTabelaUf(null); return undefined; }
    setCarregandoTabela(true);
    carregarTabelaUf(ufDestino, companyId || null)
      .then((doBanco) => {
        if (!ativo) return;
        if (doBanco) {
          setTabelaUf({
            ...doBanco,
            origemDados: 'banco',
            temAjusteDoEscritorio: doBanco.regras.some((r) => r.origemAjuste === 'tenant'),
          });
        } else {
          const doArquivo = getTabela(ufDestino);
          setTabelaUf(doArquivo ? { ...doArquivo, origemDados: 'seed' } : null);
        }
      })
      .catch(() => {
        if (!ativo) return;
        const doArquivo = getTabela(ufDestino);
        setTabelaUf(doArquivo ? { ...doArquivo, origemDados: 'seed' } : null);
      })
      .finally(() => { if (ativo) setCarregandoTabela(false); });
    return () => { ativo = false; };
  }, [ufDestino, companyId]);

  const recarregarHistorico = useCallback(async () => {
    if (!companyId) { setHistorico([]); return; }
    setCarregandoHistorico(true);
    try {
      setHistorico(await listarApuracoes(companyId));
    } catch (erro) {
      setErroPersistencia(erro.message);
    } finally {
      setCarregandoHistorico(false);
    }
  }, [companyId]);

  useEffect(() => { recarregarHistorico(); }, [recarregarHistorico]);

  // Competência sugerida pelo lote — só preenche o que está vazio, para não
  // atropelar a escolha de quem já digitou.
  const competenciaDoConteudo = competenciaDoLote(resultado.notas);
  useEffect(() => {
    if (competenciaDoConteudo) setCompetencia((atual) => atual || competenciaDoConteudo);
  }, [competenciaDoConteudo]);

  // Nota que já entrou em outra apuração da equipe.
  const chavesDoLote = resultado.notas
    .filter((n) => n.ok && n.nota?.chave)
    .map((n) => n.nota.chave)
    .join(',');
  useEffect(() => {
    let ativo = true;
    const chaves = chavesDoLote ? chavesDoLote.split(',') : [];
    if (!companyId || !chaves.length) { setRepetidas({}); return undefined; }
    notasJaApuradas(companyId, chaves, { exceto: apuracaoAberta?.id || null })
      .then((achadas) => { if (ativo) setRepetidas(achadas); })
      .catch(() => { if (ativo) setRepetidas({}); });
    return () => { ativo = false; };
  }, [companyId, chavesDoLote, apuracaoAberta]);

  async function receberArquivos(files) {
    setLendo(true);
    try {
      const novas = await Promise.all(files.map(async (file) => {
        try {
          return { nome: file.name, tamanho: file.size, xml: await file.text() };
        } catch {
          return { nome: file.name, tamanho: file.size, xml: '', erroLeitura: 'Não foi possível ler o arquivo.' };
        }
      }));
      // Reenviar o mesmo arquivo substitui a versão anterior em vez de somar
      // duas vezes na guia.
      setEntradas((atuais) => [
        ...atuais.filter((e) => !novas.some((n) => n.nome === e.nome)),
        ...novas,
      ]);
    } finally {
      setLendo(false);
    }
  }

  // A dropzone mostra, em cada arquivo, o que aquele arquivo virou — resumo
  // do que foi calculado ou o motivo do descarte.
  const itensUpload = resultado.notas.map((nota) => {
    const entrada = entradas.find((e) => e.nome === nota.arquivo);
    const base = { id: nota.arquivo, name: nota.arquivo, size: entrada?.tamanho };
    if (!nota.ok) return { ...base, status: 'error', message: nota.erro };
    if (!nota.processada) return { ...base, status: 'done', progress: 100, message: nota.motivo };
    const t = nota.totais;
    return {
      ...base,
      status: 'done',
      progress: 100,
      message: `${t.calculados} de ${t.itens} itens · ${fmtBRL(t.vTotal)}${t.pendentes ? ` · ${t.pendentes} pendente(s)` : ''}`,
    };
  });

  const exportar = () => exportarXlsx(resultado.notas, competencia || competenciaDoLote(resultado.notas));

  // ── Ações do histórico ──────────────────────────────────────────────────

  // Só faz sentido salvar o que foi processado nesta sessão: uma apuração
  // fechada aberta para consulta já está gravada, e regravá-la a partir do
  // que está na tela seria escrever de volta o que acabou de ser lido.
  const podeSalvar = Boolean(companyId) && !fechada && entradas.length > 0
    && /^\d{4}-\d{2}$/.test(competencia);
  const motivoSemSalvar = (() => {
    if (fechada) return 'Apuração fechada — reabra no histórico para alterar.';
    if (!entradas.length) return null;
    if (!companyId) return 'Sem equipe ativa: não é possível gravar.';
    if (!/^\d{4}-\d{2}$/.test(competencia)) return 'Informe a competência para salvar.';
    return null;
  })();

  async function salvar() {
    setSalvando(true);
    setErroPersistencia(null);
    try {
      const id = await salvarApuracao(
        resultado,
        {
          tenantCompanyId: companyId,
          apuracaoId: apuracaoAberta?.id || null,
          accountingCompanyId: cliente?.id || null,
          competencia,
          ufDestino,
          metodoBase: resultado.notas.find((n) => n.processada)?.operacao.metodoBase || metodoBase || 'base_simples',
          politicaRevenda: resultado.notas.find((n) => n.processada)?.operacao.politicaRevenda || politicaRevenda || 'nao_incide',
          versaoMotor: VERSAO_MOTOR,
          versaoTabela: tabelaUf?.versao || null,
          status: apuracaoAberta?.status || 'aberta',
        },
        xmlPorArquivo(entradas),
      );
      await recarregarHistorico();
      setApuracaoAberta((atual) => ({
        ...(atual || {}),
        id,
        competencia,
        status: atual?.status || 'aberta',
        cliente: cliente ? { id: cliente.id, nome: cliente.name, cnpj: cliente.cnpj } : null,
      }));
    } catch (erro) {
      setErroPersistencia(erro.message);
    } finally {
      setSalvando(false);
    }
  }

  // Abrir uma apuração ABERTA devolve os XMLs para a tela: o motor reprocessa
  // e a partir daí ela é editável como qualquer lote. Fechada fica como está
  // gravada — sem XML de volta, sem reprocessamento.
  async function abrirApuracao(linha) {
    setErroPersistencia(null);
    setInspecao(null);
    try {
      const { apuracao, resultado: salvo, xmls } = await carregarApuracao(linha.id);
      setApuracaoAberta(apuracao);
      setResultadoSalvo(salvo);
      setXmlsSalvos(xmls);
      setCompetencia(apuracao.competencia || '');
      setClienteId(apuracao.accounting_company_id ? String(apuracao.accounting_company_id) : '');
      setMetodoBase(apuracao.metodo_base || '');
      setPoliticaRevenda(apuracao.politica_revenda || '');
      setEntradas(apuracao.status === 'fechada'
        ? []
        : Object.entries(xmls).map(([nome, xml]) => ({ nome, xml, tamanho: xml.length })));
    } catch (erro) {
      setErroPersistencia(erro.message);
    }
  }

  function sairDaApuracao() {
    setApuracaoAberta(null);
    setResultadoSalvo(null);
    setXmlsSalvos({});
    setEntradas([]);
    setCompetencia('');
    setInspecao(null);
  }

  async function alternarStatus(linha) {
    setErroPersistencia(null);
    try {
      await fecharApuracao(linha.id, linha.status !== 'fechada');
      await recarregarHistorico();
      if (apuracaoAberta?.id === linha.id) await abrirApuracao(linha);
    } catch (erro) {
      setErroPersistencia(erro.message);
    }
  }

  async function removerApuracao(linha) {
    const rotulo = competenciaLegivel(linha.competencia);
    if (!window.confirm(`Excluir a apuração de ${rotulo}? As notas e os XMLs guardados vão junto.`)) return;
    setErroPersistencia(null);
    try {
      await excluirApuracao(linha.id);
      if (apuracaoAberta?.id === linha.id) sairDaApuracao();
      await recarregarHistorico();
    } catch (erro) {
      setErroPersistencia(erro.message);
    }
  }

  // A linha achatada guarda de qual nota veio; a lupa precisa do resultado
  // inteiro daquela nota para montar o painel.
  const notaDoItem = (linha) => resultado.notas.find(
    (n) => n.ok && n.processada && n.nota.chave === linha.chave && n.arquivo === linha.arquivo,
  ) || null;

  // O XML pode estar na sessão (upload agora) ou ter vindo guardado com a
  // apuração — é por isso que ele é gravado: a lupa continua funcionando
  // depois de recarregar a página.
  const xmlDaNota = (nota) => entradas.find((e) => e.nome === nota?.arquivo)?.xml
    || xmlsSalvos[nota?.arquivo]
    || null;

  return (
    <PaletteCtx.Provider value={P}>
      <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
          @media (max-width: 720px) {
            .difal-params { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <SolucoesHeader />

        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 28px 80px' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: P.primary, marginTop: 4 }}><IReceipt size={22} /></span>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 5 }}>
                Calculadora de DIFAL
              </h1>
              <p style={{ fontSize: '0.88rem', color: P.muted, lineHeight: 1.6, maxWidth: 720 }}>
                Diferencial de alíquota nas aquisições interestaduais de empresas do Simples
                Nacional, apurado produto a produto a partir do XML da NF-e.
              </p>
            </div>
          </div>

          {companyId === undefined ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: P.muted, fontSize: 14 }}>
              Carregando dados da organização...
            </div>
          ) : (
            <>
              <ParametrosCard
                clientes={clientes}
                clienteId={clienteId}
                setClienteId={setClienteId}
                metodoBase={metodoBase}
                setMetodoBase={setMetodoBase}
                politicaRevenda={politicaRevenda}
                setPoliticaRevenda={setPoliticaRevenda}
                ufDestino={ufDestino}
                competencia={competencia}
                setCompetencia={setCompetencia}
                tabela={tabelaUf}
                carregandoTabela={carregandoTabela}
              />

              {apuracaoAberta && (
                <FaixaApuracao apuracao={apuracaoAberta} onSair={sairDaApuracao} />
              )}

              {erroPersistencia && (
                <Card style={{ padding: '13px 16px', marginBottom: 20, borderColor: P.red }}>
                  <div style={{ fontSize: 12.5, color: P.red, lineHeight: 1.5 }}>
                    {erroPersistencia}
                  </div>
                </Card>
              )}

              <div style={{ marginBottom: 22, display: fechada ? 'none' : 'block' }}>
                <AnimatedDropzone
                  items={itensUpload}
                  onFiles={receberArquivos}
                  onClear={() => setEntradas([])}
                  onRemove={(id) => setEntradas((atuais) => atuais.filter((e) => e.nome !== id))}
                  disabled={lendo}
                  accept=".xml,text/xml,application/xml"
                  title="Arraste os XMLs das notas de entrada"
                  hint="ou clique para selecionar · NF-e modelo 55 · vários arquivos de uma vez"
                />
              </div>

              {!entradas.length && !resultadoSalvo ? (
                <ComoFunciona />
              ) : (
                <>
                  <Resumo
                    resultado={resultado}
                    onExportar={exportar}
                    onSalvar={salvar}
                    salvando={salvando}
                    podeSalvar={podeSalvar}
                    motivoSemSalvar={motivoSemSalvar}
                  />
                  <AvisoRepetidas repetidas={repetidas} notas={resultado.notas} />
                  <Pendencias pendencias={resultado.pendencias} erros={resultado.erros} />
                  <TabelaItens
                    itens={itens}
                    onInspecionar={(linha) => setInspecao({ nota: notaDoItem(linha), item: linha })}
                  />
                  <TabelaPorNcm porNcm={resultado.porNcm} />
                  <TabelaNotas
                    notas={resultado.notas}
                    onInspecionar={(nota) => setInspecao({ nota, item: null })}
                  />

                  <div style={{ fontSize: 11.5, color: P.muted2, lineHeight: 1.6, margin: '4px 0 26px' }}>
                    <IBuilding size={12} /> As alíquotas internas vêm da tabela de regras cadastrada
                    para a UF de destino. Confira o fundamento de cada item antes de recolher —
                    o motor aplica o que está cadastrado, e o cadastro é responsabilidade da
                    equipe fiscal.
                  </div>
                </>
              )}

              <div style={{ marginTop: 26 }}>
                <HistoricoApuracoes
                  P={P}
                  FONT_MONO={FONT_MONO}
                  apuracoes={historico}
                  carregando={carregandoHistorico}
                  abertaId={apuracaoAberta?.id || null}
                  onAbrir={abrirApuracao}
                  onAlternarStatus={alternarStatus}
                  onExcluir={removerApuracao}
                />
              </div>
            </>
          )}
        </main>

        {inspecao?.nota && (
          <NotaDrawer
            nota={inspecao.nota}
            item={inspecao.item}
            xml={xmlDaNota(inspecao.nota)}
            onFechar={() => setInspecao(null)}
            onSelecionarItem={(item) => setInspecao((atual) => ({ ...atual, item }))}
          />
        )}
      </div>
    </PaletteCtx.Provider>
  );
}
