import { createPortal } from 'react-dom';

const KIND = {
  success: { fg: '#00d48a', bg: 'rgba(0,212,138,0.12)', bd: 'rgba(0,212,138,0.25)' },
  error:   { fg: '#ff6b6b', bg: 'rgba(255,107,107,0.12)', bd: 'rgba(255,107,107,0.25)' },
};

/**
 * Renderiza a fila de toasts no canto superior direito, no mesmo idioma
 * visual do painel admin (cores/pills de AdminLayout, cartão escuro de Modal).
 * A fila vem do hook `useToasts` (src/lib/useToasts.js).
 */
export function ToastHost({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 11000,
        display: 'flex', flexDirection: 'column', gap: 10,
        width: 'min(360px, calc(100vw - 40px))',
        fontFamily: "'Inter', sans-serif",
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes admin-toast-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes admin-toast-bar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
        .admin-toast-close { background: none; border: none; color: rgba(255,255,255,0.35); cursor: pointer; padding: 2px; border-radius: 6px; display: inline-flex; flex-shrink: 0; transition: color 0.15s, background 0.15s; }
        .admin-toast-close:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); }
      `}</style>
      {toasts.map((t) => {
        const c = KIND[t.type] || KIND.success;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '13px 14px', borderRadius: 12,
              background: '#101015', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.2)',
              animation: 'admin-toast-in 0.2s cubic-bezier(0.16,1,0.3,1) both',
              pointerEvents: 'auto',
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1,
              background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.type === 'error' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>

            <span style={{ flex: 1, minWidth: 0, color: '#eeede9', fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.45, paddingTop: 2 }}>
              {t.message}
            </span>

            {onDismiss && (
              <button
                type="button"
                className="admin-toast-close"
                onClick={() => onDismiss(t.id)}
                aria-label="Fechar notificação"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 2,
              background: c.fg, opacity: 0.55, transformOrigin: 'left',
              animation: 'admin-toast-bar 5s linear forwards',
            }} />
          </div>
        );
      })}
    </div>,
    document.body
  );
}
