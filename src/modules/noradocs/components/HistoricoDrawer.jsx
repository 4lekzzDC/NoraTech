import { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { competenciaLegivel } from '../domain/competencia';
import { getPalette, FONT_MONO } from '../theme';
import EventTrail from './EventTrail';

// Painel de detalhes do Histórico — abre à direita, mesma mecânica de
// entrada/saída do painel de revisão. É só leitura (o documento já saiu da
// fila): existe pra responder "o que aconteceu com este arquivo?" sem
// obrigar a abrir o Drive ou vasculhar a trilha inteira pra achar o básico.

const SAIDA_MS = 180;

function dataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Sem geração de miniatura de verdade (o arquivo mora no Drive, não aqui) —
// o quadro mostra um ícone pelo tipo, não uma prévia real.
function IconeArquivo({ mimeType, P }) {
  const ehImagem = mimeType?.startsWith('image/');
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
      background: P.surface2, border: `1px solid ${P.border}`, color: P.muted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {ehImagem ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
    </div>
  );
}

function IconeDrive({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h8l5 9-5 9H8l-5-9z" />
      <path d="M8 3l-5 9 5 9" />
    </svg>
  );
}

function Campo({ rotulo, children, P }) {
  return (
    <div>
      <span style={{
        display: 'block', fontSize: '0.68rem', fontWeight: 600, color: P.muted2,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>
        {rotulo}
      </span>
      <div style={{ fontSize: '0.87rem', color: P.text }}>{children}</div>
    </div>
  );
}

export default function HistoricoDrawer({ documento, tenantId, onFechar, onDescartar, descartando }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [reduceMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [aberto, setAberto] = useState(() => reduceMotion);
  const [saindo, setSaindo] = useState(false);
  const [mostrarLog, setMostrarLog] = useState(false);

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

  const arquivado = documento.status === 'organizado';
  const linkDoDrive = documento.drive_web_link
    || (documento.drive_file_id ? `https://drive.google.com/file/d/${documento.drive_file_id}/view` : null);

  const visivel = aberto && !saindo;

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
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)',
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
          <div>
            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Detalhes do Processamento</h2>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <IconeArquivo mimeType={documento.mime_type} P={P} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', wordBreak: 'break-word' }}>
                {documento.file_name}
              </div>
              <span style={{
                display: 'inline-flex', marginTop: 5, padding: '2px 9px', borderRadius: 999,
                fontSize: '0.68rem', fontWeight: 700,
                color: arquivado ? P.primaryText : P.muted,
                background: arquivado ? P.primarySoft : P.surface2,
                border: `1px solid ${arquivado ? P.primaryBorder : P.border2}`,
              }}>
                {arquivado ? 'Arquivado' : 'Descartado'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Campo rotulo="Cliente" P={P}>
              {documento.client?.nome || <span style={{ color: P.muted2 }}>—</span>}
            </Campo>
            <Campo rotulo="Competência" P={P}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '0.82rem' }}>
                {documento.competencia ? competenciaLegivel(documento.competencia) : '—'}
              </span>
            </Campo>
            <Campo rotulo="Data/hora do envio" P={P}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '0.82rem' }}>{dataHora(documento.received_at)}</span>
            </Campo>
            <Campo rotulo="Regras aplicadas" P={P}>
              {documento.category?.nome || <span style={{ color: P.muted2 }}>Nenhuma regra aplicada</span>}
            </Campo>
            <div style={{ gridColumn: '1 / -1' }}>
              <Campo rotulo="Destino" P={P}>
                {documento.drive_path
                  ? <span style={{ fontFamily: FONT_MONO, fontSize: '0.8rem' }}>{documento.drive_path}</span>
                  : <span style={{ color: P.muted2 }}>{documento.status === 'descartado' ? 'não arquivado' : 'em triagem'}</span>}
              </Campo>
            </div>
          </div>

          {arquivado && onDescartar && (
            <button
              onClick={() => onDescartar(documento)}
              disabled={descartando}
              title="Tira o registro do histórico e libera o arquivo para ser reenviado"
              style={{
                marginTop: 18, background: 'none', border: 'none', color: P.muted,
                fontSize: '0.78rem', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              {descartando ? 'Descartando…' : 'Descartar registro'}
            </button>
          )}

          {mostrarLog && (
            <div style={{ marginTop: 22, borderTop: `1px solid ${P.border}`, paddingTop: 16 }}>
              <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: 10 }}>Log completo</strong>
              <EventTrail doc={documento} tenantId={tenantId} P={P} mostrarVerificar={false} />
            </div>
          )}
        </div>

        <footer style={{ padding: '14px 22px', borderTop: `1px solid ${P.border}`, display: 'flex', gap: 9 }}>
          {linkDoDrive ? (
            <a
              href={linkDoDrive} target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                background: P.primary, color: '#fff', fontSize: '0.85rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                textDecoration: 'none', fontFamily: 'inherit',
              }}
            >
              <IconeDrive /> Abrir no Google Drive
            </a>
          ) : (
            <span style={{
              flex: 1, padding: '10px 16px', borderRadius: 9, textAlign: 'center',
              color: P.muted2, fontSize: '0.82rem', border: `1px solid ${P.border}`,
            }}>
              Sem link do Drive
            </span>
          )}
          <button
            onClick={() => setMostrarLog((v) => !v)}
            style={{
              padding: '10px 16px', borderRadius: 9, border: `1px solid ${P.border2}`,
              background: 'transparent', color: P.text, fontSize: '0.85rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {mostrarLog ? 'Ocultar log' : 'Ver log completo'}
          </button>
        </footer>
      </aside>
    </>
  );
}
