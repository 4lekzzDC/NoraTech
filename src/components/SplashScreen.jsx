import { useState, useEffect, useCallback } from 'react';

/**
 * Tela de entrada da NoraTech.
 *
 * Cobre o app na primeira carga da sessão enquanto a marca se desenha, e sai
 * revelando a página — que já montou embaixo, então a splash não atrasa nada,
 * só ocupa o tempo que o app levaria carregando de qualquer jeito.
 *
 * Aparece UMA vez por sessão (sessionStorage): splash que repete a cada
 * navegação vira pedágio. Para exibir em toda carga, troque sessionStorage por
 * uma variável em memória; para desligar, remova o componente do main.jsx.
 */

// Mesma marca do favicon.svg — a splash tem que ser o logo oficial, não uma
// releitura, senão a identidade racha entre os pontos de contato.
const N_PATH = 'M10 40 V10 H17 L32 30 V10 H38 V40 H31 L16 20 V40 Z';
const SHARD_PATH = 'M32 10 H38 V22 L32 16 Z';

const SESSION_KEY = 'nt-splash-shown';
const HOLD_MS = 1850;        // até começar a sair
const HOLD_REDUCED_MS = 600; // sem animação, só o tempo de reconhecer a marca
const EXIT_MS = 560;         // duração da saída (casa com o transition do CSS)

export default function SplashScreen() {
  // Estado inicial resolvido de forma síncrona: se calculássemos depois, a
  // splash piscaria por um frame em quem já a viu nesta sessão.
  const [phase, setPhase] = useState(() => {
    if (typeof window === 'undefined') return 'done';
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return 'done';
    } catch {
      // sessionStorage bloqueado (modo privado/iframe): mostra e segue
    }
    return 'in';
  });

  const dismiss = useCallback(() => {
    setPhase((p) => (p === 'in' ? 'out' : p));
  }, []);

  useEffect(() => {
    if (phase !== 'in') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(dismiss, reduced ? HOLD_REDUCED_MS : HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, dismiss]);

  useEffect(() => {
    if (phase !== 'out') return undefined;
    const t = setTimeout(() => {
      try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
      setPhase('done');
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Trava a rolagem enquanto cobre a tela — sem isso dá pra rolar a página
  // "por baixo" e ela reaparece já fora do topo.
  useEffect(() => {
    if (phase === 'done') return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [phase]);

  // Qualquer clique ou tecla pula: quem já conhece a marca não deve esperar.
  useEffect(() => {
    if (phase !== 'in') return undefined;
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [phase, dismiss]);

  if (phase === 'done') return null;

  return (
    <div className={`nt-splash${phase === 'out' ? ' is-out' : ''}`} role="presentation" aria-hidden="true">
      <style>{`
        .nt-splash {
          position: fixed; inset: 0; z-index: 99999;
          display: flex; align-items: center; justify-content: center;
          background: #08080a; overflow: hidden;
          transition: opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms cubic-bezier(0.65,0,0.35,1);
        }
        .nt-splash.is-out { opacity: 0; transform: scale(1.07); pointer-events: none; }

        .nt-splash-glow {
          position: absolute; width: min(640px, 130vw); aspect-ratio: 1; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 62%);
          filter: blur(48px); pointer-events: none;
          animation: nt-splash-breathe 3.4s ease-in-out infinite;
        }
        @keyframes nt-splash-breathe {
          0%, 100% { opacity: 0.68; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1.06); }
        }

        .nt-splash-stack {
          position: relative; display: flex; flex-direction: column;
          align-items: center; gap: 22px; padding: 24px;
        }

        .nt-splash-mark {
          width: 94px; height: 94px; overflow: visible;
          filter: drop-shadow(0 0 26px rgba(124,58,237,0.45));
          animation: nt-splash-mark-in 0.65s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nt-splash-mark-in {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: none; }
        }

        /* O contorno se desenha primeiro e o preenchimento entra depois.
           pathLength="1" deixa o dasharray em fração do caminho, então não
           preciso medir o comprimento real do path. */
        .nt-splash-trace {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: nt-splash-draw 0.78s cubic-bezier(0.65,0,0.35,1) 0.12s forwards;
        }
        @keyframes nt-splash-draw { to { stroke-dashoffset: 0; } }

        .nt-splash-fill { opacity: 0; animation: nt-splash-appear 0.42s ease 0.78s forwards; }
        .nt-splash-shard { opacity: 0; animation: nt-splash-appear-soft 0.4s ease 1s forwards; }
        @keyframes nt-splash-appear { to { opacity: 1; } }
        @keyframes nt-splash-appear-soft { to { opacity: 0.85; } }

        .nt-splash-word {
          font-family: 'JetBrains Mono', monospace; font-weight: 700;
          font-size: 1.4rem; color: #7C3AED; white-space: nowrap;
          animation: nt-splash-word-in 0.75s cubic-bezier(0.16,1,0.3,1) 0.9s both;
        }
        .nt-splash-word-dim { color: rgba(255,255,255,0.34); }
        /* As letras entram espalhadas e se juntam — dá a sensação de a marca
           "assentar" em vez de só aparecer. */
        @keyframes nt-splash-word-in {
          from { opacity: 0; letter-spacing: 13px; transform: translateY(7px); }
          to { opacity: 1; letter-spacing: 5px; transform: none; }
        }

        .nt-splash-bar {
          width: 118px; height: 2px; border-radius: 2px; overflow: hidden;
          background: rgba(255,255,255,0.08); opacity: 0;
          animation: nt-splash-appear 0.35s ease 1.08s forwards;
        }
        .nt-splash-bar span {
          display: block; height: 100%; width: 100%;
          background: linear-gradient(90deg, #7C3AED, #2563EB);
          transform: scaleX(0); transform-origin: left;
          animation: nt-splash-progress 0.68s cubic-bezier(0.5,0,0.2,1) 1.12s forwards;
        }
        @keyframes nt-splash-progress { to { transform: scaleX(1); } }

        /* ── Tema claro ── */
        html[data-theme="light"] .nt-splash { background: #f6f5f1; }
        html[data-theme="light"] .nt-splash-glow {
          background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 62%);
        }
        html[data-theme="light"] .nt-splash-word-dim { color: rgba(24,24,27,0.42); }
        html[data-theme="light"] .nt-splash-bar { background: rgba(24,24,27,0.10); }
        html[data-theme="light"] .nt-splash-mark { filter: drop-shadow(0 0 22px rgba(124,58,237,0.30)); }

        /* Sem animação: a marca aparece pronta e a tela sai rápido. */
        @media (prefers-reduced-motion: reduce) {
          .nt-splash-glow, .nt-splash-mark, .nt-splash-trace,
          .nt-splash-fill, .nt-splash-shard, .nt-splash-word,
          .nt-splash-bar, .nt-splash-bar span { animation: none !important; }
          .nt-splash-trace { opacity: 0; }
          .nt-splash-fill, .nt-splash-word, .nt-splash-bar { opacity: 1; }
          .nt-splash-shard { opacity: 0.85; }
          .nt-splash-word { letter-spacing: 5px; }
          .nt-splash-bar span { transform: scaleX(1); }
          .nt-splash { transition: opacity 0.25s ease; }
          .nt-splash.is-out { transform: none; }
        }
      `}</style>

      <div className="nt-splash-glow" />

      <div className="nt-splash-stack">
        <svg className="nt-splash-mark" viewBox="0 0 48 48" fill="none">
          <defs>
            <linearGradient id="nt-splash-grad" x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="nt-splash-accent" x1="30" y1="6" x2="42" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <path
            className="nt-splash-trace"
            d={N_PATH}
            pathLength="1"
            fill="none"
            stroke="url(#nt-splash-grad)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path className="nt-splash-fill" d={N_PATH} fill="url(#nt-splash-grad)" />
          <path className="nt-splash-shard" d={SHARD_PATH} fill="url(#nt-splash-accent)" />
        </svg>

        <div className="nt-splash-word">
          NORA<span className="nt-splash-word-dim">TECH</span>
        </div>

        <div className="nt-splash-bar"><span /></div>
      </div>
    </div>
  );
}
