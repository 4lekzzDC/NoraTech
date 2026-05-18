import { useState, useEffect } from 'react';

/**
 * Three-stage loading screen:
 *   0 → slowThreshold ms : plain spinner (no text, no alarm)
 *   slowThreshold → timeout ms : spinner + "still loading" soft notice
 *   timeout ms+ : full error state with retry / home buttons
 *
 * Defaults are intentionally generous to absorb Supabase cold-starts and
 * multi-step auth chains (auth → admin check → subscription check).
 */
export default function LoadingScreen({
  slowThreshold = 8000,
  timeout = 22000,
}) {
  const [stage, setStage] = useState(0); // 0 = spinner | 1 = slow | 2 = error

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), slowThreshold);
    const t2 = setTimeout(() => setStage(2), timeout);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [slowThreshold, timeout]);

  if (stage === 2) {
    return (
      <div style={{
        minHeight: '100vh', background: '#08080a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: 24, fontFamily: "'Inter', sans-serif", color: '#eeede9',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#eeede9' }}>
          Não foi possível carregar
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.52)', fontSize: '0.85rem',
          textAlign: 'center', maxWidth: 340, lineHeight: 1.65, margin: 0,
        }}>
          A verificação de sessão demorou mais que o esperado. Verifique sua conexão e tente novamente.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px', borderRadius: 10, background: '#7C3AED', border: 'none',
              color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
              fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            style={{
              padding: '10px 22px', borderRadius: 10, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit',
            }}
          >
            Voltar para início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#08080a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {stage === 1 && (
        <p style={{
          color: 'rgba(255,255,255,0.38)', fontSize: '0.8rem',
          fontFamily: "'Inter', sans-serif", margin: 0, textAlign: 'center',
          animation: 'fadeIn 0.4s ease',
        }}>
          Verificando sessão…
          <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </p>
      )}
    </div>
  );
}
