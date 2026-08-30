// Painel da nota — abre à direita quando alguém clica na lupa.
//
// Responde a uma pergunta só: "de onde saiu este número?". Por isso mostra o
// que a nota diz (identificação, partes, totais, o item cru) e, na última
// aba, o XML como o motor leu — se o parser entendeu errado, o erro aparece
// aqui em vez de ficar escondido atrás do arquivo original.
//
// É só leitura. Nenhum botão daqui muda a apuração: a correção de rota é nos
// parâmetros da tela, e o painel serve para decidir se ela é necessária.

import { useEffect, useState } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import { identarXml, xmlDoItem } from './nfeXml';
import {
  CRT_EMITENTE, CSOSN, CST_ICMS, DESTINO_OPERACAO, FINALIDADE_NFE,
  IND_IE_DESTINATARIO, ORIGEM_MERCADORIA, ROTULO_FINALIDADE, descreverCodigo,
  explicarCalculo, fmtBRL, fmtCnpj, fmtData, fmtNcm, fmtPct, fmtQtd,
  rotuloOrigemAliquota, rotuloSituacao, rotuloTributacaoIcms,
} from './difalFormato';

const SAIDA_MS = 180;

function ILupa({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function Campo({ rotulo, children, P, largo }) {
  if (children == null || children === '' || children === '—') return null;
  return (
    <div style={{ gridColumn: largo ? '1 / -1' : 'auto' }}>
      <span style={{
        display: 'block', fontSize: '0.68rem', fontWeight: 600, color: P.muted2,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>{rotulo}</span>
      <div style={{ fontSize: '0.85rem', color: P.text, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Bloco({ titulo, children, P }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: P.primary, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 12,
      }}>{titulo}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
    </section>
  );
}

function Valor({ children, P }) {
  return <span style={{ fontFamily: FONT_MONO, fontSize: '0.82rem', color: P.text }}>{children}</span>;
}

// Totais da nota x soma dos itens: quando o emitente erra o total, a
// diferença aparece aqui em vez de virar dúvida sobre o cálculo.
function TotaisNota({ nota, P }) {
  const t = nota.totaisNota || {};
  return (
    <Bloco titulo="Totais da nota" P={P}>
      <Campo rotulo="Produtos" P={P}><Valor P={P}>{fmtBRL(t.vProd)}</Valor></Campo>
      <Campo rotulo="Valor total da NF-e" P={P}><Valor P={P}>{fmtBRL(t.vNF)}</Valor></Campo>
      {t.vFrete > 0 && <Campo rotulo="Frete" P={P}><Valor P={P}>{fmtBRL(t.vFrete)}</Valor></Campo>}
      {t.vSeg > 0 && <Campo rotulo="Seguro" P={P}><Valor P={P}>{fmtBRL(t.vSeg)}</Valor></Campo>}
      {t.vDesc > 0 && <Campo rotulo="Desconto" P={P}><Valor P={P}>{fmtBRL(t.vDesc)}</Valor></Campo>}
      {t.vOutro > 0 && <Campo rotulo="Outras despesas" P={P}><Valor P={P}>{fmtBRL(t.vOutro)}</Valor></Campo>}
      {t.vIPI > 0 && <Campo rotulo="IPI" P={P}><Valor P={P}>{fmtBRL(t.vIPI)}</Valor></Campo>}
    </Bloco>
  );
}

function AbaNota({ nota, itens, onSelecionarItem, P }) {
  return (
    <>
      <Bloco titulo="Identificação" P={P}>
        <Campo rotulo="Número" P={P}><Valor P={P}>{nota.numero || '—'}</Valor></Campo>
        <Campo rotulo="Série" P={P}><Valor P={P}>{nota.serie || '—'}</Valor></Campo>
        <Campo rotulo="Emissão" P={P}>{fmtData(nota.dataEmissao)}</Campo>
        <Campo rotulo="Modelo" P={P}>{nota.modelo === '55' ? '55 — NF-e' : nota.modelo || '—'}</Campo>
        <Campo rotulo="Natureza da operação" P={P} largo>{nota.naturezaOperacao || '—'}</Campo>
        <Campo rotulo="Finalidade" P={P}>{descreverCodigo(FINALIDADE_NFE, nota.finNFe)}</Campo>
        <Campo rotulo="Destino declarado" P={P}>{descreverCodigo(DESTINO_OPERACAO, nota.idDest)}</Campo>
        <Campo rotulo="Chave de acesso" P={P} largo>
          <span style={{ fontFamily: FONT_MONO, fontSize: '0.76rem', wordBreak: 'break-all', color: P.muted }}>
            {nota.chave || '—'}
          </span>
        </Campo>
      </Bloco>

      <Bloco titulo="Emitente" P={P}>
        <Campo rotulo="Razão social" P={P} largo>{nota.emitente?.nome || '—'}</Campo>
        <Campo rotulo="CNPJ" P={P}><Valor P={P}>{fmtCnpj(nota.emitente?.cnpj)}</Valor></Campo>
        <Campo rotulo="UF" P={P}><Valor P={P}>{nota.emitente?.uf || '—'}</Valor></Campo>
        <Campo rotulo="Regime tributário" P={P} largo>{descreverCodigo(CRT_EMITENTE, nota.emitente?.crt)}</Campo>
      </Bloco>

      <Bloco titulo="Destinatário" P={P}>
        <Campo rotulo="Razão social" P={P} largo>{nota.destinatario?.nome || '—'}</Campo>
        <Campo rotulo="CNPJ" P={P}><Valor P={P}>{fmtCnpj(nota.destinatario?.cnpj)}</Valor></Campo>
        <Campo rotulo="UF" P={P}><Valor P={P}>{nota.destinatario?.uf || '—'}</Valor></Campo>
        <Campo rotulo="Inscrição estadual" P={P} largo>
          {descreverCodigo(IND_IE_DESTINATARIO, nota.destinatario?.indIEDest)}
        </Campo>
      </Bloco>

      <TotaisNota nota={nota} P={P} />

      {itens.length > 0 && (
        <section>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: P.primary, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 12,
          }}>Itens ({itens.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {itens.map((i) => {
              const situacao = rotuloSituacao(i.situacao);
              return (
                <button
                  key={i.nItem}
                  onClick={() => onSelecionarItem(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${P.border}`, background: 'transparent',
                    color: P.text, fontFamily: FONT_INTER, fontSize: '0.82rem',
                  }}
                >
                  <span style={{ fontFamily: FONT_MONO, color: P.muted2, flexShrink: 0 }}>{i.nItem}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.descricao}
                  </span>
                  <span style={{ color: P[situacao.cor] || P.muted, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                    {situacao.curto}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, color: P.muted, flexShrink: 0 }}>
                    {i.valores?.vTotal ? fmtBRL(i.valores.vTotal) : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function AbaItem({ item, P }) {
  const fonte = item.fonte || {};
  const icms = fonte.icms || {};
  const origem = rotuloOrigemAliquota(item.aliquotas);
  const conta = explicarCalculo(item);
  const situacao = rotuloSituacao(item.situacao);

  return (
    <>
      <Bloco titulo={`Item ${item.nItem} — o que a nota diz`} P={P}>
        <Campo rotulo="Descrição" P={P} largo>{fonte.descricao || item.descricao}</Campo>
        <Campo rotulo="Código no fornecedor" P={P}><Valor P={P}>{fonte.codigo || '—'}</Valor></Campo>
        <Campo rotulo="NCM" P={P}><Valor P={P}>{fmtNcm(fonte.ncm || item.ncm)}</Valor></Campo>
        <Campo rotulo="CFOP" P={P}><Valor P={P}>{fonte.cfop || item.cfop}</Valor></Campo>
        {fonte.cest && <Campo rotulo="CEST" P={P}><Valor P={P}>{fonte.cest}</Valor></Campo>}
        <Campo rotulo="Quantidade" P={P}>
          <Valor P={P}>{fmtQtd(fonte.quantidade)} {fonte.unidade}</Valor>
        </Campo>
        <Campo rotulo="Valor do produto" P={P}><Valor P={P}>{fmtBRL(fonte.vProd)}</Valor></Campo>
        {fonte.vFrete > 0 && <Campo rotulo="Frete" P={P}><Valor P={P}>{fmtBRL(fonte.vFrete)}</Valor></Campo>}
        {fonte.vSeg > 0 && <Campo rotulo="Seguro" P={P}><Valor P={P}>{fmtBRL(fonte.vSeg)}</Valor></Campo>}
        {fonte.vDesc > 0 && <Campo rotulo="Desconto" P={P}><Valor P={P}>{fmtBRL(fonte.vDesc)}</Valor></Campo>}
        {fonte.vOutro > 0 && <Campo rotulo="Outras despesas" P={P}><Valor P={P}>{fmtBRL(fonte.vOutro)}</Valor></Campo>}
        {fonte.vIpi > 0 && <Campo rotulo="IPI" P={P}><Valor P={P}>{fmtBRL(fonte.vIpi)}</Valor></Campo>}
      </Bloco>

      <Bloco titulo="ICMS na origem" P={P}>
        <Campo rotulo="Grupo no XML" P={P}><Valor P={P}>{icms.grupo || '—'}</Valor></Campo>
        <Campo rotulo="Base destacada" P={P}><Valor P={P}>{fmtBRL(icms.vBC)}</Valor></Campo>
        <Campo rotulo="Alíquota destacada" P={P}>
          <Valor P={P}>{icms.pICMS != null ? fmtPct(icms.pICMS) : 'não destacada'}</Valor>
        </Campo>
        <Campo rotulo="ICMS destacado" P={P}><Valor P={P}>{fmtBRL(icms.vICMS)}</Valor></Campo>
        <Campo rotulo="Situação tributária" P={P} largo>{rotuloTributacaoIcms(icms)}</Campo>
        <Campo rotulo="Origem da mercadoria" P={P} largo>
          {descreverCodigo(ORIGEM_MERCADORIA, icms.origem)}
        </Campo>
      </Bloco>

      <Bloco titulo="O que o motor fez com isso" P={P}>
        <Campo rotulo="Situação" P={P}>
          <span style={{ color: P[situacao.cor] || P.text, fontWeight: 700 }}>{situacao.label}</span>
        </Campo>
        <Campo rotulo="Finalidade" P={P}>{ROTULO_FINALIDADE[item.finalidade] || '—'}</Campo>
        {item.motivo && <Campo rotulo="Motivo" P={P} largo>{item.motivo}</Campo>}
        {item.aliquotas && (
          <>
            <Campo rotulo="Alíquota interna" P={P}>
              <Valor P={P}>{fmtPct(item.aliquotas.interna)}</Valor> · {origem.curto}
            </Campo>
            <Campo rotulo="Alíquota interestadual" P={P}>
              <Valor P={P}>{fmtPct(item.aliquotas.interestadual)}</Valor>
            </Campo>
            <Campo rotulo="Fundamento da alíquota interna" P={P} largo>{origem.longo}</Campo>
          </>
        )}
        {conta && (
          <Campo rotulo="Cálculo" P={P} largo>
            <div style={{ fontFamily: FONT_MONO, fontSize: '0.8rem', lineHeight: 1.7 }}>{conta.difal}</div>
            {conta.fcp && <div style={{ fontFamily: FONT_MONO, fontSize: '0.8rem', lineHeight: 1.7 }}>{conta.fcp}</div>}
          </Campo>
        )}
        {(item.alertas || []).length > 0 && (
          <Campo rotulo="Alertas" P={P} largo>
            {item.alertas.map((a, i) => (
              <div key={i} style={{ color: P.gold, marginBottom: 4 }}>{a}</div>
            ))}
          </Campo>
        )}
      </Bloco>
    </>
  );
}

function AbaXml({ xml, item, P }) {
  const [escopo, setEscopo] = useState(item ? 'item' : 'nota');
  const [copiado, setCopiado] = useState(false);

  const conteudo = (() => {
    if (!xml) return null;
    try {
      return escopo === 'item' && item ? xmlDoItem(xml, item.nItem) : identarXml(xml);
    } catch (erro) {
      return `Não foi possível formatar o XML: ${erro.message}`;
    }
  })();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(conteudo || '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* sem área de transferência: o texto continua selecionável */ }
  }

  const botao = (id, rotulo) => (
    <button
      onClick={() => setEscopo(id)}
      style={{
        padding: '5px 11px', borderRadius: 7, fontFamily: FONT_INTER, fontSize: 11.5,
        fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${escopo === id ? P.primaryBorder : P.border}`,
        background: escopo === id ? P.primarySoft : 'transparent',
        color: escopo === id ? P.primaryText : P.muted,
      }}
    >{rotulo}</button>
  );

  if (!xml) {
    return (
      <div style={{ fontSize: '0.85rem', color: P.muted, lineHeight: 1.6 }}>
        O arquivo desta nota não está mais em memória — envie o XML de novo para vê-lo aqui.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {item && botao('item', `Item ${item.nItem}`)}
        {botao('nota', 'Nota completa')}
        <button
          onClick={copiar}
          style={{
            marginLeft: 'auto', padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
            fontFamily: FONT_INTER, fontSize: 11.5, fontWeight: 600,
            border: `1px solid ${P.border}`, background: 'transparent', color: P.muted,
          }}
        >{copiado ? 'Copiado' : 'Copiar'}</button>
      </div>
      <pre style={{
        margin: 0, padding: 14, borderRadius: 10, background: P.surface2,
        border: `1px solid ${P.border}`, color: P.text, fontFamily: FONT_MONO,
        fontSize: '0.72rem', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre',
      }}>{conteudo || 'Item não encontrado no XML.'}</pre>
      <div style={{ fontSize: 11, color: P.muted2, marginTop: 10, lineHeight: 1.5 }}>
        Este é o XML como o motor leu — declaração, comentários e assinatura ficam de fora.
      </div>
    </>
  );
}

export default function NotaDrawer({ nota, item, xml, onFechar, onSelecionarItem }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [reduceMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [aberto, setAberto] = useState(() => reduceMotion);
  const [saindo, setSaindo] = useState(false);
  const [aba, setAba] = useState(item ? 'item' : 'nota');

  useEffect(() => {
    if (reduceMotion) return undefined;
    const raf = requestAnimationFrame(() => setAberto(true));
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  function fechar() {
    if (reduceMotion) { onFechar(); return; }
    setSaindo(true);
    setTimeout(onFechar, SAIDA_MS);
  }

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  });

  const visivel = aberto && !saindo;
  const dados = nota?.nota || null;
  const itens = nota?.itens || [];

  const abas = [
    { id: 'nota', label: 'Nota' },
    ...(item ? [{ id: 'item', label: `Item ${item.nItem}` }] : []),
    { id: 'xml', label: 'XML' },
  ];

  return (
    <>
      <div
        onClick={fechar}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
          opacity: visivel ? 1 : 0,
          transition: reduceMotion ? 'none' : 'opacity 220ms ease-out',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(580px, 100vw)',
          background: P.surfaceSolid, borderLeft: `1px solid ${P.border2}`, zIndex: 201,
          display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 48px rgba(0,0,0,0.3)',
          fontFamily: FONT_INTER, color: P.text,
          transform: visivel ? 'translateX(0)' : 'translateX(100%)',
          transition: reduceMotion ? 'none' : `transform ${saindo ? SAIDA_MS : 260}ms cubic-bezier(0.2, 0, 0, 1)`,
        }}
      >
        <header style={{
          padding: '18px 22px 0', borderBottom: `1px solid ${P.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: P.primary, display: 'flex' }}><ILupa /></span>
                {dados?.numero ? `NF-e ${dados.numero}` : nota?.arquivo || 'Nota'}
              </h2>
              <div style={{ fontSize: '0.78rem', color: P.muted, marginTop: 4 }}>
                {dados?.emitente?.nome || '—'}
                {dados?.emitente?.uf && dados?.destinatario?.uf
                  ? ` · ${dados.emitente.uf} → ${dados.destinatario.uf}`
                  : ''}
              </div>
            </div>
            <button
              onClick={fechar}
              aria-label="Fechar"
              style={{ background: 'none', border: 'none', color: P.muted, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {abas.map((a) => {
              const ativa = aba === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  style={{
                    padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
                    fontFamily: FONT_INTER, fontSize: 12.5, fontWeight: 600,
                    color: ativa ? P.primaryText : P.muted,
                    borderBottom: `2px solid ${ativa ? P.primary : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >{a.label}</button>
              );
            })}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 32px' }}>
          {!nota?.ok && (
            <div style={{ fontSize: '0.85rem', color: P.red, lineHeight: 1.6, marginBottom: 18 }}>
              Este arquivo não pôde ser lido: {nota?.erro}
            </div>
          )}
          {nota?.ok && !nota.processada && (
            <div style={{
              fontSize: '0.85rem', color: P.muted, lineHeight: 1.6, marginBottom: 20,
              padding: '11px 13px', borderRadius: 9, background: P.surface2, border: `1px solid ${P.border}`,
            }}>
              Fora da apuração: {nota.motivo}
            </div>
          )}

          {aba === 'nota' && dados && (
            <AbaNota
              nota={dados}
              itens={itens}
              // Escolher um item na lista leva junto para a aba dele: quem
              // clicou no item quer o item, não continuar na lista.
              onSelecionarItem={(escolhido) => { onSelecionarItem(escolhido); setAba('item'); }}
              P={P}
            />
          )}
          {aba === 'item' && item && <AbaItem item={item} P={P} />}
          {aba === 'xml' && <AbaXml xml={xml} item={item} P={P} />}
        </div>
      </aside>
    </>
  );
}
