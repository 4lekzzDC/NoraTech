import { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { competenciaAnterior, isCompetencia } from '../domain/competencia';
import { sugerirPadrao } from '../domain/rules';
import { podeReprocessar } from '../domain/status';
import { getPalette, FONT_MONO } from '../theme';
import EventTrail from './EventTrail';

// Painel de revisão — abre à direita, sobre a lista.
//
// Não é página nova de propósito: quem revisa 40 documentos por dia não pode
// perder o contexto da fila a cada um. E `⌘↵` confirma sem tirar a mão do
// teclado, porque revisão em volume é trabalho de teclado, não de mouse.

function competenciaParaInput(competencia) {
  return isCompetencia(competencia) ? competencia : competenciaAnterior();
}

// Sobe/desce a saída antes de desmontar de verdade, pra não sumir de golpe.
// Só cobre o fechamento explícito (X, esc, clique fora) — confirmar/descartar
// já têm o próprio sinal de conclusão (o toast) e saem direto.
const SAIDA_MS = 180;

export default function ReviewDrawer({
  documento, clients, categories, tenantId, salvando, onConfirmar, onDescartar, onReprocessar, onFechar,
}) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [clientId, setClientId] = useState(documento.client?.id || '');
  const [competencia, setCompetencia] = useState(competenciaParaInput(documento.competencia));
  const [categoryId, setCategoryId] = useState(documento.category?.id || '');
  const [criarRegra, setCriarRegra] = useState(false);
  const [padrao, setPadrao] = useState(() => sugerirPadrao(documento.file_name));

  const [reduceMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  // Nasce fechado e abre no próximo frame — é essa troca de estado que
  // dispara a transição CSS de entrada (dois estados fixos não animam nada).
  // Com reduced-motion já nasce aberto: não há transição pra disparar, só
  // um quadro a mais parado na posição errada.
  const [aberto, setAberto] = useState(() => reduceMotion);
  const [saindo, setSaindo] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);
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

  const completo = Boolean(clientId && categoryId && competencia);

  function confirmar() {
    if (!completo || salvando || preenchendo) return;
    if (reduceMotion) {
      onConfirmar(
        { clientId, competencia, categoryId },
        criarRegra && padrao.trim() ? { pattern: padrao.trim(), clientId, categoryId } : null,
      );
      return;
    }
    setPreenchendo(true);
    setTimeout(() => {
      setPreenchendo(false);
      onConfirmar(
        { clientId, competencia, categoryId },
        criarRegra && padrao.trim() ? { pattern: padrao.trim(), clientId, categoryId } : null,
      );
    }, 180);
  }

  // Escape fecha; Ctrl/Cmd+Enter confirma. Registrado no documento porque o
  // foco costuma estar num campo do formulário, não no painel.
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') fechar();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirmar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  });

  const rotulo = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: P.muted, marginBottom: 5 };
  const campo = {
    width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${P.border2}`,
    background: P.inputBg, color: P.text, fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none',
  };

  // Ver o documento é o que torna a revisão possível: sem olhar o papel, o
  // contador não tem como dizer de quem ele é.
  const previewUrl = documento.drive_file_id
    ? `https://drive.google.com/file/d/${documento.drive_file_id}/preview`
    : null;

  // O link é derivado do id quando o banco não tem o `drive_web_link`. Pela
  // entrada do Gmail ele vem vazio — a resposta do upload retomável não traz
  // esse campo —, e sem isto o único caminho para o arquivo seria uma
  // pré-visualização que pode não carregar.
  const linkDoDrive = documento.drive_web_link
    || (documento.drive_file_id
      ? `https://drive.google.com/file/d/${documento.drive_file_id}/view`
      : null);

  const visivel = aberto && !saindo;

  return (
    <>
      <style>{`
        @keyframes nd-campo-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .nd-campo-cascata { animation: nd-campo-in 220ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .nd-campo-cascata { animation: none; }
        }
      `}</style>
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
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)',
          background: P.surfaceSolid, borderLeft: `1px solid ${P.border2}`, zIndex: 201,
          display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 48px rgba(0,0,0,0.3)',
          transform: visivel ? 'translateX(0)' : 'translateX(100%)',
          transition: reduceMotion ? 'none' : `transform ${saindo ? SAIDA_MS : 260}ms cubic-bezier(0.2, 0, 0, 1)`,
        }}
      >
        <header style={{
          padding: '18px 22px', borderBottom: `1px solid ${P.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, wordBreak: 'break-word' }}>
              {documento.file_name}
            </h2>
            {documento.review_reason && (
              <p style={{ margin: '6px 0 0', color: P.muted, fontSize: '0.79rem' }}>
                {documento.review_reason}
              </p>
            )}
          </div>
          <button
            onClick={fechar}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', color: P.muted, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {documento.status === 'erro' && (
            <div style={{
              marginBottom: 18, padding: '13px 15px', borderRadius: 10,
              border: `1px solid ${P.red}44`, background: `${P.red}12`,
            }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.86rem', color: P.red }}>
                O arquivamento falhou.
              </p>
              {documento.error_message && (
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: P.muted }}>
                  {documento.error_message}
                </p>
              )}
              <p style={{ margin: '10px 0 0', fontSize: '0.79rem', color: P.muted }}>
                {podeReprocessar(documento)
                  ? 'O arquivo chegou ao Drive — dá para tentar arquivar de novo.'
                  : 'O arquivo não chegou ao Drive. Descarte este registro e reenvie o arquivo pela caixa de entrada.'}
              </p>
              {podeReprocessar(documento) && onReprocessar && (
                <button
                  onClick={() => onReprocessar(documento)}
                  disabled={salvando}
                  style={{
                    marginTop: 11, padding: '7px 14px', borderRadius: 8, border: `1px solid ${P.border2}`,
                    background: P.surface, color: P.text, fontSize: '0.81rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {previewUrl && (
            <div style={{ marginBottom: 18 }}>
              {/* O quadro vem do próprio Drive, então depende da conta Google
                  logada NESTE navegador ter acesso ao arquivo. Quando não tem,
                  o Google mostra uma tela de permissão dentro do iframe, e não
                  há como detectar isso de fora (é outra origem).
                  Por isso o link fica sempre visível, e não só quando o quadro
                  falha: é o caminho que funciona em qualquer caso. */}
              <iframe
                src={previewUrl}
                title="Pré-visualização do documento"
                style={{
                  width: '100%', height: 340, border: `1px solid ${P.border}`,
                  borderRadius: 10, background: P.surface2,
                }}
              />
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 10, marginTop: 8, flexWrap: 'wrap',
              }}>
                <a
                  href={linkDoDrive} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.79rem', color: P.primaryText, fontWeight: 600 }}
                >
                  Abrir no Google Drive →
                </a>
                <span style={{ fontSize: '0.72rem', color: P.muted2 }}>
                  Quadro em branco? O navegador está em outra conta Google.
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 14 }}>
            <div className="nd-campo-cascata" style={{ animationDelay: '60ms' }}>
              <label style={rotulo} htmlFor="rev-cliente">Cliente</label>
              <select id="rev-cliente" style={campo} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Selecione…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="nd-campo-cascata" style={{ animationDelay: '100ms' }}>
              <label style={rotulo} htmlFor="rev-competencia">Competência</label>
              <input
                id="rev-competencia" type="month" style={{ ...campo, fontFamily: FONT_MONO }}
                value={competencia} onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>

            <div className="nd-campo-cascata" style={{ animationDelay: '140ms' }}>
              <label style={rotulo} htmlFor="rev-categoria">Categoria</label>
              <select id="rev-categoria" style={campo} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Selecione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={criarRegra}
                  onChange={(e) => setCriarRegra(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: P.primary, cursor: 'pointer' }}
                />
                Criar regra para os próximos
              </label>
              {criarRegra && (
                <div style={{ marginTop: 10 }}>
                  <input
                    style={{ ...campo, fontFamily: FONT_MONO, fontSize: '0.82rem' }}
                    value={padrao} onChange={(e) => setPadrao(e.target.value)}
                    placeholder="trecho do nome do arquivo"
                  />
                  <p style={{ margin: '6px 0 0', fontSize: '0.74rem', color: P.muted2 }}>
                    Todo arquivo cujo nome contenha este trecho passa a ser classificado assim,
                    sem precisar de revisão.
                  </p>
                </div>
              )}
            </div>

            <details style={{ borderTop: `1px solid ${P.border}`, paddingTop: 14 }}>
              <summary style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Trilha do documento
              </summary>
              <div style={{ marginTop: 10 }}>
                <EventTrail doc={documento} tenantId={tenantId} P={P} />
              </div>
            </details>
          </div>
        </div>

        <footer style={{ padding: '14px 22px', borderTop: `1px solid ${P.border}`, display: 'flex', gap: 9 }}>
          <button
            onClick={confirmar} disabled={!completo || salvando}
            style={{
              position: 'relative', overflow: 'hidden',
              flex: 1, padding: '10px 18px', borderRadius: 9, border: 'none',
              background: P.primary, color: '#fff', fontSize: '0.86rem', fontWeight: 700,
              cursor: completo && !salvando ? 'pointer' : 'default',
              opacity: completo && !salvando ? 1 : 0.5, fontFamily: 'inherit',
            }}
          >
            {/* Sensação de confirmação sólida antes do clique de fato disparar
                o salvamento — não é decoração parada, é feedback de que o
                clique "pegou". */}
            <span aria-hidden="true" style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.28)',
              transform: preenchendo ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
              transition: preenchendo ? 'transform 180ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
            }} />
            <span style={{ position: 'relative' }}>
              {salvando ? 'Arquivando…' : 'Confirmar e arquivar'}
            </span>
          </button>
          <button
            onClick={() => onDescartar(documento)} disabled={salvando}
            style={{
              padding: '10px 16px', borderRadius: 9, border: `1px solid ${P.border2}`,
              background: 'transparent', color: P.muted, fontSize: '0.86rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Descartar
          </button>
        </footer>
      </aside>
    </>
  );
}
