import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { NORA_SCREEN_ROUTE } from '../constants.js';

// ═══════════════════════════════════════════════════════════════
// Nora Screen — destino das ações da home enquanto o módulo de
// transmissão não existe.
//
// A home é a entrega desta etapa; a sala em si (WebRTC, sinalização,
// lista de participantes) é outro sistema. Esta tela existe para que
// "Criar sala", "Entrar" e "Ver salas" não caiam num 404 — e para deixar
// explícito o que já está pronto e o que não está, em vez de simular uma
// transmissão que não acontece.
// ═══════════════════════════════════════════════════════════════

export default function NoraScreenSala() {
  const { codigo } = useParams();
  const { state } = useLocation();
  const nickname = state?.nickname;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const anterior = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => { html.style.overflow = anterior[0]; body.style.overflow = anterior[1]; };
  }, []);

  return (
    <div className="nscs-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

        .nscs-page {
          position: fixed; inset: 0; overflow: hidden;
          background: #04040a; color: #f4f3f7;
          font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
          display: flex; align-items: center; justify-content: center;
          padding: 28px;
        }
        .nscs-page *, .nscs-page *::before, .nscs-page *::after { box-sizing: border-box; }
        html[data-theme="light"] .nscs-page strong { color: #a78bfa !important; }

        .nscs-brilho {
          position: absolute; width: 70vw; height: 70vw; max-width: 900px; max-height: 900px;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          background: radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(59,130,246,0.06) 45%, transparent 70%);
          filter: blur(80px); pointer-events: none;
        }
        .nscs-cartao {
          position: relative; z-index: 1;
          width: min(100%, 460px); text-align: center;
          padding: 40px 34px; border-radius: 26px;
          background: linear-gradient(158deg, rgba(30,26,52,0.66) 0%, rgba(10,10,18,0.82) 100%);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 48px 100px -34px rgba(0,0,0,0.92), 0 0 80px -34px rgba(124,58,237,0.45);
        }
        .nscs-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 54px; height: 54px; border-radius: 17px; margin-bottom: 20px;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(167,139,250,0.3);
          color: #a78bfa;
        }
        .nscs-titulo { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.7px; margin: 0 0 10px; }
        .nscs-texto { font-size: 0.92rem; line-height: 1.6; color: rgba(255,255,255,0.56); margin: 0; }
        .nscs-codigo {
          display: inline-block; margin: 22px 0 6px; padding: 10px 18px; border-radius: 12px;
          font-family: 'JetBrains Mono', monospace; font-size: 1.05rem; font-weight: 700; letter-spacing: 3px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #e9e2ff;
        }
        .nscs-nick { font-size: 0.84rem; color: rgba(255,255,255,0.44); margin: 0; }
        .nscs-page .nscs-voltar {
          display: inline-flex; align-items: center; gap: 9px; margin-top: 26px;
          height: 46px; padding: 0 22px; border-radius: 100px; text-decoration: none;
          background: rgba(124,58,237,0.14); border: 1px solid rgba(167,139,250,0.3);
          color: #e9e2ff; font-size: 0.9rem; font-weight: 600;
          transition: background 0.28s ease, border-color 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .nscs-page .nscs-voltar:hover { background: rgba(124,58,237,0.24); border-color: rgba(167,139,250,0.6); transform: translateY(-2px); }
        .nscs-rodape {
          position: absolute; left: 0; right: 0; bottom: 22px; text-align: center;
          font-size: 0.8rem; color: rgba(255,255,255,0.3);
        }
      `}</style>

      <div className="nscs-brilho" aria-hidden="true" />

      <section className="nscs-cartao">
        <span className="nscs-icone" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" />
          </svg>
        </span>

        <h1 className="nscs-titulo">Sala em construção</h1>
        <p className="nscs-texto">
          A transmissão ao vivo ainda está sendo construída. Esta página existe para
          o acesso não terminar em erro enquanto isso.
        </p>

        {codigo && <div className="nscs-codigo">{codigo}</div>}
        {nickname && <p className="nscs-nick">Você entraria como <strong>{nickname}</strong>.</p>}

        <Link to={NORA_SCREEN_ROUTE} className="nscs-voltar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.5 19 3.5 12l7-7M3.5 12h17" />
          </svg>
          Voltar ao Nora Screen
        </Link>
      </section>

      <div className="nscs-rodape">NoraTech — Tecnologia que aproxima.</div>
    </div>
  );
}
