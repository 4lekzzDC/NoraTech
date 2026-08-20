import { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { competenciaAnterior, isCompetencia } from '../domain/competencia';
import { sugerirPadrao } from '../domain/rules';
import { podeReprocessar } from '../domain/status';
import { getPalette, FONT_MONO } from '../theme';

// Painel de revisão — abre à direita, sobre a lista.
//
// Não é página nova de propósito: quem revisa 40 documentos por dia não pode
// perder o contexto da fila a cada um. E `⌘↵` confirma sem tirar a mão do
// teclado, porque revisão em volume é trabalho de teclado, não de mouse.

function competenciaParaInput(competencia) {
  return isCompetencia(competencia) ? competencia : competenciaAnterior();
}

export default function ReviewDrawer({
  documento, clients, categories, salvando, onConfirmar, onDescartar, onReprocessar, onFechar,
}) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [clientId, setClientId] = useState(documento.client?.id || '');
  const [competencia, setCompetencia] = useState(competenciaParaInput(documento.competencia));
  const [categoryId, setCategoryId] = useState(documento.category?.id || '');
  const [criarRegra, setCriarRegra] = useState(false);
  const [padrao, setPadrao] = useState(() => sugerirPadrao(documento.file_name));

  const completo = Boolean(clientId && categoryId && competencia);

  function confirmar() {
    if (!completo || salvando) return;
    onConfirmar(
      { clientId, competencia, categoryId },
      criarRegra && padrao.trim() ? { pattern: padrao.trim(), clientId, categoryId } : null,
    );
  }

  // Escape fecha; Ctrl/Cmd+Enter confirma. Registrado no documento porque o
  // foco costuma estar num campo do formulário, não no painel.
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') onFechar();
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

  const previewUrl = documento.drive_file_id
    ? `https://drive.google.com/file/d/${documento.drive_file_id}/preview`
    : null;

  return (
    <>
      <div
        onClick={onFechar}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)',
          background: P.surfaceSolid, borderLeft: `1px solid ${P.border2}`, zIndex: 201,
          display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 48px rgba(0,0,0,0.3)',
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
            onClick={onFechar}
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
              {/* O preview vem do próprio Drive. Se o funcionário não tiver
                  acesso àquele arquivo com a conta Google do navegador, o
                  quadro fica vazio — daí o link ao lado, que sempre resolve. */}
              <iframe
                src={previewUrl}
                title="Pré-visualização do documento"
                style={{
                  width: '100%', height: 260, border: `1px solid ${P.border}`,
                  borderRadius: 10, background: P.surface2,
                }}
              />
              {documento.drive_web_link && (
                <a
                  href={documento.drive_web_link} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: '0.79rem', color: P.primaryText }}
                >
                  Abrir no Google Drive →
                </a>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="rev-cliente">Cliente</label>
              <select id="rev-cliente" style={campo} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Selecione…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={rotulo} htmlFor="rev-competencia">Competência</label>
              <input
                id="rev-competencia" type="month" style={{ ...campo, fontFamily: FONT_MONO }}
                value={competencia} onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>

            <div>
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
          </div>
        </div>

        <footer style={{ padding: '14px 22px', borderTop: `1px solid ${P.border}`, display: 'flex', gap: 9 }}>
          <button
            onClick={confirmar} disabled={!completo || salvando}
            style={{
              flex: 1, padding: '10px 18px', borderRadius: 9, border: 'none',
              background: P.primary, color: '#fff', fontSize: '0.86rem', fontWeight: 700,
              cursor: completo && !salvando ? 'pointer' : 'default',
              opacity: completo && !salvando ? 1 : 0.5, fontFamily: 'inherit',
            }}
          >
            {salvando ? 'Arquivando…' : 'Confirmar e arquivar'}
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
