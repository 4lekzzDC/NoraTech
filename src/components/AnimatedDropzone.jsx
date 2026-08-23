import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../lib/palette';

// Dropzone animada, compartilhada por qualquer sistema da NoraTech que
// receba arquivo (NoraDocs, Codificador, Conciliador de Extratos, etc.).
//
// A UI é só apresentação: quem chama continua dono do upload de verdade
// (Drive, Storage, parse local — o que for). Este componente recebe os
// arquivos brutos via onFiles e devolve progresso controlado via `items`
// — [{ id, name, size, progress, status: 'uploading'|'done'|'error', message }].
// `id` pode ser omitido: por padrão usa o nome do arquivo, o mesmo esquema
// que o NoraDocs já usava antes deste componente existir.
//
// Duas coisas fazem a animação: cada linha nova VOA do ponto onde o
// usuário soltou o arquivo até seu lugar na lista (Web Animations API, sem
// depender de nenhuma lib de spring); e a miniatura de imagem se revela
// conforme o progresso sobe — a própria foto é a barra, sem elemento de
// barra separado. Isso só funciona porque `--p` é registrada como
// @property: sem isso o navegador troca o número no talo em vez de
// interpolar, e a revelação fica em degrau.

let progressPropertyRegistered = false;
function ensureProgressProperty() {
  if (progressPropertyRegistered || typeof document === 'undefined') return;
  progressPropertyRegistered = true;
  const style = document.createElement('style');
  style.textContent = `
    @property --p { syntax: '<number>'; inherits: true; initial-value: 0; }
    @keyframes adz-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

// Aproximação de mola sem dependência: um back-ease com um leve overshoot,
// o suficiente pra linha parecer que "chega" no lugar em vez de deslizar
// uniformemente até ele.
const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function IUpload({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IFile({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function ICheck({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IRetry({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
function IX({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner({ p, size = 13 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `2px solid ${p.border2}`, borderTopColor: p.primary, borderRadius: '50%',
      animation: 'adz-spin 0.7s linear infinite',
    }} />
  );
}

export default function AnimatedDropzone({
  items = [],
  onFiles,
  onRetry,
  onRemove,
  onClear,
  accept,
  multiple = true,
  disabled = false,
  title,
  hint,
}) {
  const { theme } = useTheme();
  const p = getPalette(theme);
  useEffect(() => { ensureProgressProperty(); }, []);

  const [dragOver, setDragOver] = useState(false);
  // object URL de imagem por id — precisa ser state (não ref) porque é lido
  // durante o render, pra desenhar a miniatura.
  const [previewUrls, setPreviewUrls] = useState({});
  const inputRef = useRef(null);
  const zoneRef = useRef(null);
  const fromRef = useRef(null); // {x,y} de onde o(s) arquivo(s) mais recente(s) entraram
  const fileCacheRef = useRef(new Map()); // id -> File, só pra gerar miniatura
  const animatedRef = useRef(new Set()); // ids cuja entrada já animou

  // Mesmo esquema que os chamadores já usam pra chavear progresso: o nome
  // do arquivo. Precisa bater com o `id` (ou `name`) que vem em `items`,
  // senão a miniatura gerada aqui nunca encontra o item que deveria pintar.
  function idFor(file) {
    return file.name;
  }

  function centerOfZone() {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + 28 };
  }

  // Todo object URL já criado, vivo ou não — só existe pra garantir que o
  // unmount revoga tudo que sobrou, sem depender de um closure que poderia
  // ficar preso no estado de um render antigo (ref é mutável, sempre lida
  // "ao vivo").
  const allUrlsRef = useRef(new Set());

  function acceptFiles(fileList, originPoint) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    fromRef.current = originPoint || centerOfZone();
    const novasPreviews = {};
    files.forEach((f) => {
      const id = idFor(f);
      fileCacheRef.current.set(id, f);
      if (f.type?.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        novasPreviews[id] = url;
        allUrlsRef.current.add(url);
      }
    });
    if (Object.keys(novasPreviews).length) {
      setPreviewUrls((prev) => ({ ...prev, ...novasPreviews }));
    }
    onFiles?.(files);
  }

  // Limpa miniaturas de itens que saíram da lista (ex.: depois de "Limpar"),
  // pra não vazar object URL. Também libera o id pra poder animar de novo
  // se o mesmo arquivo for solto outra vez.
  useEffect(() => {
    const currentIds = new Set(items.map((it) => it.id || it.name));
    setPreviewUrls((prev) => {
      let mudou = false;
      const next = { ...prev };
      for (const id of Object.keys(prev)) {
        if (!currentIds.has(id)) {
          URL.revokeObjectURL(prev[id]);
          allUrlsRef.current.delete(prev[id]);
          delete next[id];
          fileCacheRef.current.delete(id);
          animatedRef.current.delete(id);
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, [items]);

  useEffect(() => () => {
    allUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function rowRef(id) {
    return (el) => {
      if (!el || animatedRef.current.has(id)) return;
      animatedRef.current.add(id);
      const from = fromRef.current;
      if (!from || typeof el.animate !== 'function') return;
      const rect = el.getBoundingClientRect();
      const dx = from.x - (rect.left + rect.width / 2);
      const dy = from.y - (rect.top + rect.height / 2);
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0.5 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 460, easing: SPRING_EASING, fill: 'both' }
      );
    };
  }

  const doneCount = items.filter((it) => it.status === 'done').length;

  return (
    <div>
      <div
        ref={zoneRef}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          acceptFiles(e.dataTransfer.files, { x: e.clientX, y: e.clientY });
        }}
        onPaste={(e) => {
          if (disabled) return;
          const files = Array.from(e.clipboardData?.files || []);
          if (files.length) acceptFiles(files, centerOfZone());
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragOver ? p.primary : p.border2}`,
          background: dragOver ? p.primarySoft : p.surface,
          borderRadius: 14, padding: '22px 20px', textAlign: 'center',
          cursor: disabled ? 'progress' : 'pointer', outline: 'none',
          transition: 'background 0.15s, border-color 0.15s',
          fontFamily: FONT_INTER,
        }}
      >
        <input
          ref={inputRef} type="file" hidden multiple={multiple} accept={accept}
          onChange={(e) => { acceptFiles(e.target.files, null); e.target.value = ''; }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: p.primarySoft, color: p.primaryText,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IUpload size={15} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: p.text }}>
              {dragOver ? 'Solte os arquivos aqui' : (title || 'Arraste os arquivos aqui')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: p.muted }}>
              {dragOver ? '' : (hint || 'ou clique para escolher · você também pode colar')}
            </p>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{
          marginTop: 12, border: `1px solid ${p.border}`, borderRadius: 12,
          background: p.surface, overflow: 'hidden',
        }}>
          {items.map((item) => {
            const id = item.id || item.name;
            const previewUrl = previewUrls[id];
            const isDone = item.status === 'done';
            const isError = item.status === 'error';
            const pct = Math.max(0, Math.min(100, Math.round(item.progress ?? (isDone ? 100 : 0))));
            const pFrac = pct / 100;
            const ringColor = isError ? p.red : isDone ? p.green : p.border;

            return (
              <div
                key={id}
                ref={rowRef(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 14px', borderBottom: `1px solid ${p.border}`,
                  fontFamily: FONT_INTER,
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0, position: 'relative',
                  overflow: 'hidden', border: `1.5px solid ${ringColor}`, background: p.surface2,
                }}>
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="" style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                        filter: 'grayscale(1) brightness(.4)',
                      }} />
                      <img src={previewUrl} alt="" style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                        '--p': pFrac,
                        clipPath: 'inset(0 calc((1 - var(--p)) * 100%) 0 0)',
                        transition: 'clip-path 0.25s linear',
                      }} />
                    </>
                  ) : (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isError ? p.red : isDone ? p.green : p.muted,
                    }}>
                      <IFile size={16} />
                      {!isDone && !isError && (
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 8,
                          background: `conic-gradient(${p.primary} calc(${pFrac} * 360deg), transparent 0)`,
                          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
                          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
                          transition: 'background 0.2s linear',
                        }} />
                      )}
                    </div>
                  )}
                  {isDone && (
                    <div style={{
                      position: 'absolute', bottom: -1, right: -1, width: 15, height: 15, borderRadius: '50%',
                      background: p.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1.5px solid ${p.surface}`,
                    }}>
                      <ICheck size={8} />
                    </div>
                  )}
                </div>

                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div title={item.name} style={{
                    fontSize: 13, fontWeight: 600, color: p.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </div>
                  <div style={{
                    fontSize: 11.5, marginTop: 1, color: isError ? p.red : p.muted, fontFamily: FONT_MONO,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {isError
                      ? (item.message || 'Falhou')
                      : [fmtSize(item.size), item.message || (!isDone ? `${pct}%` : null)].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {isError && onRetry && (
                  <button
                    type="button" title="Tentar novamente" onClick={() => onRetry(id)}
                    style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
                      border: `1px solid ${p.border2}`, background: p.surface2, color: p.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IRetry />
                  </button>
                )}
                {!isError && onRemove && item.status !== 'uploading' && (
                  <button
                    type="button" title="Remover" onClick={() => onRemove(id)}
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                      border: 'none', background: 'transparent', color: p.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IX />
                  </button>
                )}
              </div>
            );
          })}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px', fontSize: 12, color: p.muted,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {disabled && <Spinner p={p} />}
              {doneCount} de {items.length} enviado{items.length === 1 ? '' : 's'}
            </span>
            {onClear && !disabled && (
              <button
                type="button" onClick={onClear}
                style={{ background: 'none', border: 'none', color: p.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
