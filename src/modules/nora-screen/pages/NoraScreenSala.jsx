import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  NICKNAME_MIN,
  NORA_SCREEN_ROUTE,
  codigoValido,
  iniciaisDe,
  normalizarCodigo,
} from '../constants.js';
import { STATUS } from '../services/sinalizacao.js';
import { useSalaAoVivo } from '../hooks/useSalaAoVivo.js';

// ═══════════════════════════════════════════════════════════════
// Nora Screen — a sala.
//
// Topo com identidade e estado, barra lateral com o convite e quem está
// na sala, palco no meio para a tela transmitida e uma barra flutuante
// com os controles. A transmissão é real: WebRTC com sinalização pelo
// Realtime do Supabase (ver hooks/useSalaAoVivo.js).
// ═══════════════════════════════════════════════════════════════

const ROTULO_STATUS = {
  [STATUS.CONECTANDO]: 'Conectando',
  [STATUS.CONECTADO]: 'Conectado',
  [STATUS.RECONECTANDO]: 'Reconectando',
  [STATUS.ERRO]: 'Sem conexão',
};

function Icone({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const ICONES = {
  tela: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /></>,
  parar: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M9.5 9.5h5v5h-5z" /><path d="M8.5 21h7" /></>,
  copiar: <><rect x="9" y="9" width="11.5" height="11.5" rx="2.5" /><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" /></>,
  ok: <path d="M20 6 9 17l-5-5" />,
  tela_cheia: <path d="M8 3.5H4.5A1 1 0 0 0 3.5 4.5V8M16 3.5h3.5a1 1 0 0 1 1 1V8M8 20.5H4.5a1 1 0 0 1-1-1V16M16 20.5h3.5a1 1 0 0 0 1-1V16" />,
  sair: <><path d="M15 17l5-5-5-5M20 12H9" /><path d="M12 3.5H5.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5H12" /></>,
  pessoas: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6s6.2 2.5 6.2 5.6" /><path d="M16.4 5.4a3.2 3.2 0 0 1 0 5.2M21.2 19c0-2-.7-3.7-2-4.9" /></>,
  coroa: <path d="M3.5 17.5 5 7l4.5 4L12 5.5 14.5 11 19 7l1.5 10.5z" />,
};

export default function NoraScreenSala() {
  const { codigo: codigoBruto } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const codigo = normalizarCodigo(codigoBruto);
  const codigoOk = codigoValido(codigo);

  // Quem chega por link colado não trouxe nickname da home: pede aqui,
  // antes de entrar na sala de verdade.
  const [nickname, setNickname] = useState(() => state?.nickname?.trim() || '');
  const [rascunho, setRascunho] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [lateralAberta, setLateralAberta] = useState(false);

  const videoRef = useRef(null);
  const palcoRef = useRef(null);

  const sala = useSalaAoVivo({ codigo, nickname, ativo: codigoOk && Boolean(nickname) });
  const {
    eu, status, participantes, host, souHost,
    transmitindo, quemTransmite, outroTransmitindo,
    streamRemoto, streamLocal, erro, compartilharTela, pararDeTransmitir,
  } = sala;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const anterior = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => { html.style.overflow = anterior[0]; body.style.overflow = anterior[1]; };
  }, []);

  // O vídeo mostra o que estou recebendo ou, se sou eu quem transmite, a
  // minha própria captura — sem isso quem compartilha não vê o que enviou.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const fonte = transmitindo ? streamLocal.current : streamRemoto;
    if (el.srcObject !== fonte) el.srcObject = fonte || null;
  }, [transmitindo, streamRemoto, streamLocal, participantes]);

  const copiarConvite = useCallback(async () => {
    const link = `${window.location.origin}${NORA_SCREEN_ROUTE}/sala/${codigo}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Sem permissão de área de transferência (http, permissão negada):
      // seleciona num campo temporário para a pessoa copiar à mão.
      const campo = document.createElement('textarea');
      campo.value = link;
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      try { document.execCommand('copy'); } catch { /* resta o Ctrl+C */ }
      document.body.removeChild(campo);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }, [codigo]);

  const alternarTelaCheia = useCallback(() => {
    const alvo = palcoRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else alvo.requestFullscreen?.();
  }, []);

  const sair = useCallback(() => {
    if (transmitindo) pararDeTransmitir();
    navigate(NORA_SCREEN_ROUTE);
  }, [navigate, pararDeTransmitir, transmitindo]);

  const temImagem = Boolean(transmitindo || streamRemoto);

  return (
    <div className="nss-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

        .nss-page {
          --nss-violet: #7C3AED;
          --nss-violet-soft: #a78bfa;
          --nss-azul: #3b82f6;
          --nss-bg: #04040a;
          --nss-fg: #f4f3f7;
          --nss-muted: rgba(255,255,255,0.5);
          --nss-line: rgba(255,255,255,0.09);
          --nss-painel: rgba(13,12,22,0.72);

          position: fixed; inset: 0; overflow: hidden;
          background: var(--nss-bg); color: var(--nss-fg);
          font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .nss-page *, .nss-page *::before, .nss-page *::after { box-sizing: border-box; }
        html[data-theme="light"] .nss-page .nss-input { color: var(--nss-fg); }
        html[data-theme="light"] .nss-page strong { color: var(--nss-violet-soft) !important; }

        .nss-fundo {
          position: absolute; inset: 0; pointer-events: none; overflow: hidden;
        }
        .nss-fundo::before, .nss-fundo::after {
          content: ''; position: absolute; border-radius: 50%; filter: blur(90px);
        }
        .nss-fundo::before {
          width: 55vw; height: 55vw; max-width: 780px; max-height: 780px;
          top: -22%; left: -10%;
          background: radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 68%);
        }
        .nss-fundo::after {
          width: 48vw; height: 48vw; max-width: 700px; max-height: 700px;
          bottom: -26%; right: -8%;
          background: radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%);
        }

        /* ══════════ TOPO ══════════ */
        .nss-topo {
          position: relative; z-index: 3;
          display: flex; align-items: center; gap: 14px;
          padding: 14px clamp(14px, 2.4vw, 26px);
          border-bottom: 1px solid var(--nss-line);
          background: rgba(8,8,14,0.72);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        }
        .nss-marca { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .nss-marca-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(167,139,250,0.28);
          color: var(--nss-violet-soft);
        }
        .nss-marca-nome { font-weight: 800; font-size: 0.98rem; letter-spacing: -0.3px; white-space: nowrap; }
        .nss-marca-nome span {
          background: linear-gradient(100deg, var(--nss-violet-soft), var(--nss-azul));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        .nss-chip {
          display: inline-flex; align-items: center; gap: 8px;
          height: 34px; padding: 0 13px; border-radius: 100px;
          background: rgba(255,255,255,0.045); border: 1px solid var(--nss-line);
          font-size: 0.82rem; color: rgba(255,255,255,0.72); white-space: nowrap;
        }
        .nss-chip.codigo { font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: 1.6px; }
        .nss-chip svg { color: var(--nss-violet-soft); }
        .nss-topo-dir { margin-left: auto; display: flex; align-items: center; gap: 10px; }

        .nss-status { gap: 9px; }
        .nss-ponto {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,0.9);
          animation: nss-pulsar 2.6s ease-in-out infinite;
        }
        .nss-status.instavel .nss-ponto { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.9); }
        @keyframes nss-pulsar { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

        /* ══════════ CORPO ══════════ */
        .nss-corpo {
          position: relative; z-index: 2; min-height: 0;
          display: grid; grid-template-columns: 274px minmax(0, 1fr);
          gap: clamp(12px, 1.4vw, 18px);
          padding: clamp(12px, 1.6vw, 20px);
        }

        /* ── Lateral ── */
        .nss-lateral {
          min-height: 0; display: flex; flex-direction: column; gap: 14px;
          padding: 18px; border-radius: 20px;
          background: var(--nss-painel); border: 1px solid var(--nss-line);
          backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
        }
        .nss-rotulo {
          font-family: 'JetBrains Mono', monospace; font-size: 0.62rem;
          font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase;
          color: rgba(255,255,255,0.42);
        }
        .nss-codigo-grande {
          margin-top: 8px; padding: 12px; border-radius: 13px; text-align: center;
          font-family: 'JetBrains Mono', monospace; font-size: 1.12rem; font-weight: 700; letter-spacing: 3px;
          background: rgba(124,58,237,0.1); border: 1px solid rgba(167,139,250,0.24); color: #e9e2ff;
        }
        .nss-page .nss-copiar {
          width: 100%; height: 44px; margin-top: 10px;
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border-radius: 13px; cursor: pointer; font-family: inherit;
          font-size: 0.88rem; font-weight: 600;
          background: rgba(255,255,255,0.05); border: 1px solid var(--nss-line); color: var(--nss-fg);
          transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
        }
        .nss-page .nss-copiar:hover { background: rgba(124,58,237,0.18); border-color: rgba(167,139,250,0.45); }
        .nss-page .nss-copiar.feito { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.4); color: #86efac; }

        .nss-lista {
          min-height: 0; overflow-y: auto; margin: 0 -6px; padding: 0 6px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent;
        }
        .nss-lista::-webkit-scrollbar { width: 5px; }
        .nss-lista::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }

        .nss-pessoa {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 10px; border-radius: 12px;
          transition: background 0.25s ease;
        }
        .nss-pessoa + .nss-pessoa { margin-top: 2px; }
        .nss-pessoa.eu { background: rgba(255,255,255,0.045); }
        .nss-avatar {
          position: relative; flex-shrink: 0;
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.78rem; font-weight: 800; color: #fff;
          background: linear-gradient(140deg, #8b5cf6, #4f46e5);
          border: 1px solid rgba(167,139,250,0.4);
        }
        .nss-avatar.transmite { background: linear-gradient(140deg, #22c55e, #0ea5e9); border-color: rgba(34,197,94,0.5); }
        .nss-pessoa-nome {
          font-size: 0.88rem; font-weight: 600; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nss-pessoa-papel { font-size: 0.74rem; color: rgba(255,255,255,0.42); margin-top: 1px; }
        .nss-tag {
          display: inline-flex; align-items: center; gap: 5px; margin-left: auto; flex-shrink: 0;
          padding: 3px 9px; border-radius: 100px; font-size: 0.68rem; font-weight: 700;
          background: rgba(167,139,250,0.14); border: 1px solid rgba(167,139,250,0.3); color: #d8ccff;
        }
        .nss-tag.aovivo { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.36); color: #86efac; }

        /* ── Palco ── */
        .nss-palco {
          position: relative; min-height: 0; border-radius: 20px; overflow: hidden;
          background: radial-gradient(ellipse 70% 60% at 50% 40%, rgba(124,58,237,0.09) 0%, rgba(6,6,12,0.9) 70%);
          border: 1px solid var(--nss-line);
          display: flex; align-items: center; justify-content: center;
        }
        .nss-palco video {
          width: 100%; height: 100%; object-fit: contain; background: #000; display: block;
        }
        .nss-vazio { text-align: center; padding: 28px; max-width: 430px; }
        .nss-vazio-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 66px; height: 66px; border-radius: 20px; margin-bottom: 20px;
          background: rgba(124,58,237,0.1); border: 1px solid rgba(167,139,250,0.26);
          color: var(--nss-violet-soft);
          animation: nss-respirar 4.5s ease-in-out infinite;
        }
        @keyframes nss-respirar {
          0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,58,237,0.22); }
          50%     { transform: scale(1.04); box-shadow: 0 0 44px 0 rgba(124,58,237,0.24); }
        }
        .nss-vazio-titulo { font-size: 1.12rem; font-weight: 700; letter-spacing: -0.4px; margin: 0 0 8px; }
        .nss-vazio-texto { font-size: 0.88rem; line-height: 1.55; color: var(--nss-muted); margin: 0 0 22px; }

        .nss-page .nss-principal {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          height: 50px; padding: 0 26px; border-radius: 14px; cursor: pointer;
          border: none; font-family: inherit; font-size: 0.94rem; font-weight: 700; color: #fff;
          background: linear-gradient(100deg, #7C3AED 0%, #6d5cf6 52%, #3b82f6 100%);
          box-shadow: 0 18px 38px -18px rgba(99,72,246,0.95);
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s ease, filter 0.28s ease;
        }
        .nss-page .nss-principal:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.07); }
        .nss-page .nss-principal:disabled { opacity: 0.5; cursor: not-allowed; }

        .nss-aovivo {
          position: absolute; top: 14px; left: 14px; z-index: 2;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 13px; border-radius: 100px;
          background: rgba(8,8,14,0.7); border: 1px solid rgba(34,197,94,0.36);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          font-size: 0.76rem; font-weight: 700; color: #86efac;
        }
        .nss-aovivo .nss-ponto { background: #22c55e; }

        /* ── Barra de controles ── */
        .nss-controles {
          position: absolute; left: 50%; bottom: clamp(16px, 3vh, 26px);
          transform: translateX(-50%); z-index: 6;
          display: flex; align-items: center; gap: 8px;
          padding: 8px; border-radius: 100px;
          background: rgba(10,10,18,0.82); border: 1px solid rgba(255,255,255,0.11);
          backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: blur(24px) saturate(1.4);
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .nss-page .nss-controle {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          height: 46px; min-width: 46px; padding: 0 16px; border-radius: 100px;
          border: 1px solid transparent; background: rgba(255,255,255,0.05);
          color: var(--nss-fg); font-family: inherit; font-size: 0.86rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .nss-page .nss-controle:hover:not(:disabled) { background: rgba(255,255,255,0.1); transform: translateY(-1px); }
        .nss-page .nss-controle:disabled { opacity: 0.42; cursor: not-allowed; }
        .nss-page .nss-controle.primario {
          background: linear-gradient(100deg, #7C3AED, #3b82f6); color: #fff;
          box-shadow: 0 12px 28px -12px rgba(99,72,246,0.95);
        }
        .nss-page .nss-controle.ativo {
          background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.4); color: #86efac;
        }
        .nss-page .nss-controle.perigo {
          background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.32); color: #fca5a5;
        }
        .nss-page .nss-controle.perigo:hover { background: rgba(239,68,68,0.24); }
        .nss-controle-rotulo { display: inline; }

        .nss-erro {
          position: absolute; left: 50%; transform: translateX(-50%);
          bottom: calc(clamp(16px, 3vh, 26px) + 66px); z-index: 6;
          display: flex; align-items: center; gap: 9px; max-width: min(92vw, 520px);
          padding: 11px 15px; border-radius: 12px;
          background: rgba(30,8,8,0.9); border: 1px solid rgba(239,68,68,0.34);
          font-size: 0.83rem; line-height: 1.45; color: #fca5a5;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        }

        /* ── Portinha do nickname / código inválido ── */
        .nss-porta {
          position: fixed; inset: 0; z-index: 20;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background: rgba(4,4,10,0.86);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        .nss-porta-cartao {
          width: min(100%, 420px); padding: 32px 28px; border-radius: 24px; text-align: center;
          background: linear-gradient(158deg, rgba(30,26,52,0.72) 0%, rgba(10,10,18,0.86) 100%);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 48px 100px -34px rgba(0,0,0,0.92), 0 0 80px -34px rgba(124,58,237,0.45);
        }
        .nss-porta-titulo { font-size: 1.28rem; font-weight: 800; letter-spacing: -0.6px; margin: 0 0 8px; }
        .nss-porta-texto { font-size: 0.9rem; line-height: 1.55; color: var(--nss-muted); margin: 0 0 22px; }
        .nss-page .nss-input {
          width: 100%; height: 50px; padding: 0 16px; border-radius: 14px; text-align: center;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.13);
          color: var(--nss-fg); font-family: inherit; font-size: 0.95rem; outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .nss-page .nss-input::placeholder { color: rgba(255,255,255,0.3); }
        .nss-page .nss-input:focus {
          border-color: rgba(124,58,237,0.75); background: rgba(124,58,237,0.09);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.16);
        }
        .nss-porta .nss-principal { width: 100%; margin-top: 12px; }
        .nss-page .nss-porta-voltar {
          display: inline-block; margin-top: 16px; font-size: 0.84rem;
          color: rgba(255,255,255,0.46); text-decoration: none;
          transition: color 0.25s ease;
        }
        .nss-page .nss-porta-voltar:hover { color: var(--nss-violet-soft); }

        .nss-page .nss-lateral-toggle { display: none; }

        /* ══════════ RESPONSIVO ══════════ */
        @media (max-width: 1080px) {
          .nss-corpo { grid-template-columns: 240px minmax(0, 1fr); }
        }

        @media (max-width: 860px) {
          .nss-corpo { grid-template-columns: minmax(0, 1fr); }
          /* A lateral vira gaveta: numa tela pequena o palco é o que
             importa, e a lista de participantes vira consulta pontual. */
          .nss-lateral {
            position: fixed; z-index: 12; top: 68px; left: 12px; right: 12px;
            max-height: min(62vh, 460px);
            box-shadow: 0 30px 70px rgba(0,0,0,0.7);
            animation: nss-gaveta 0.3s cubic-bezier(0.16,1,0.3,1) both;
          }
          @keyframes nss-gaveta {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .nss-lateral.fechada { display: none; }
          .nss-page .nss-lateral-toggle { display: inline-flex; }
          .nss-chip.participantes { display: none; }
          .nss-controle-rotulo { display: none; }
          .nss-page .nss-controle { padding: 0 14px; }
          .nss-page .nss-controle.primario { padding: 0 18px; }
          .nss-page .nss-controle.primario .nss-controle-rotulo { display: inline; }
        }

        @media (max-width: 560px) {
          .nss-marca-nome { display: none; }
          .nss-topo { gap: 10px; padding: 12px 14px; }
          .nss-vazio-icone { width: 56px; height: 56px; border-radius: 17px; margin-bottom: 14px; }
          .nss-vazio-titulo { font-size: 1rem; }
          .nss-vazio-texto { font-size: 0.84rem; margin-bottom: 18px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nss-page *, .nss-page *::before, .nss-page *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div className="nss-fundo" aria-hidden="true" />

      {/* ═══ TOPO ═══ */}
      <header className="nss-topo">
        <div className="nss-marca">
          <span className="nss-marca-icone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2.5" y="5" width="12" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.8" opacity="0.55" />
              <rect x="9" y="9.5" width="12.5" height="9.5" rx="2.5" fill="rgba(124,58,237,0.22)" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="nss-marca-nome">Nora <span>Screen</span></span>
        </div>

        <span className="nss-chip codigo" title="Código da sala">{codigo}</span>

        <div className="nss-topo-dir">
          <span className="nss-chip participantes">
            <Icone d={ICONES.pessoas} size={15} />
            {participantes.length} {participantes.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
          <span className={`nss-chip nss-status ${status === STATUS.CONECTADO ? '' : 'instavel'}`}>
            <span className="nss-ponto" />
            {ROTULO_STATUS[status] || 'Conectando'}
          </span>
          <button
            type="button"
            className="nss-chip nss-lateral-toggle"
            onClick={() => setLateralAberta((v) => !v)}
            aria-expanded={lateralAberta}
          >
            <Icone d={ICONES.pessoas} size={15} />
            {participantes.length}
          </button>
        </div>
      </header>

      {/* ═══ CORPO ═══ */}
      <div className="nss-corpo">
        <aside className={`nss-lateral ${lateralAberta ? '' : 'fechada'}`}>
          <div>
            <span className="nss-rotulo">Código da sala</span>
            <div className="nss-codigo-grande">{codigo}</div>
            <button type="button" className={`nss-copiar ${copiado ? 'feito' : ''}`} onClick={copiarConvite}>
              <Icone d={copiado ? ICONES.ok : ICONES.copiar} size={16} />
              {copiado ? 'Link copiado' : 'Copiar convite'}
            </button>
          </div>

          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="nss-rotulo">Na sala · {participantes.length}</span>
            <div className="nss-lista" style={{ marginTop: 8 }}>
              {participantes.map((p) => {
                const souEu = eu && p.id === eu.id;
                const ehHost = host && p.id === host.id;
                return (
                  <div className={`nss-pessoa ${souEu ? 'eu' : ''}`} key={p.id}>
                    <span className={`nss-avatar ${p.transmitindo ? 'transmite' : ''}`}>
                      {iniciaisDe(p.nickname) || '··'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="nss-pessoa-nome">
                        {p.nickname}{souEu ? ' (você)' : ''}
                      </div>
                      <div className="nss-pessoa-papel">{ehHost ? 'Host da sala' : 'Convidado'}</div>
                    </div>
                    {p.transmitindo && <span className="nss-tag aovivo">ao vivo</span>}
                    {!p.transmitindo && ehHost && (
                      <span className="nss-tag"><Icone d={ICONES.coroa} size={12} />host</span>
                    )}
                  </div>
                );
              })}
              {!participantes.length && (
                <div className="nss-pessoa-papel" style={{ padding: '8px 10px' }}>Entrando na sala…</div>
              )}
            </div>
          </div>
        </aside>

        <section className="nss-palco" ref={palcoRef}>
          {temImagem ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted />
              <span className="nss-aovivo">
                <span className="nss-ponto" />
                {transmitindo ? 'Você está compartilhando' : `${quemTransmite?.nickname || 'Alguém'} está compartilhando`}
              </span>
            </>
          ) : (
            <div className="nss-vazio">
              <span className="nss-vazio-icone">
                <Icone d={ICONES.tela} size={28} />
              </span>
              <h2 className="nss-vazio-titulo">Ninguém está compartilhando ainda</h2>
              <p className="nss-vazio-texto">
                {souHost
                  ? 'Você é o host desta sala. Compartilhe sua tela ou convide alguém com o código.'
                  : 'Quando alguém compartilhar a tela, ela aparece aqui. Você também pode começar.'}
              </p>
              <button type="button" className="nss-principal" onClick={compartilharTela} disabled={outroTransmitindo}>
                <Icone d={ICONES.tela} size={18} />
                Compartilhar tela
              </button>
            </div>
          )}
        </section>
      </div>

      {erro && (
        <div role="alert" className="nss-erro">
          <Icone d={<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>} size={16} />
          <span>{erro}</span>
        </div>
      )}

      {/* ═══ CONTROLES ═══ */}
      <div className="nss-controles">
        {transmitindo ? (
          <button type="button" className="nss-controle ativo" onClick={() => pararDeTransmitir()}>
            <Icone d={ICONES.parar} />
            <span className="nss-controle-rotulo">Parar de compartilhar</span>
          </button>
        ) : (
          <button
            type="button"
            className="nss-controle primario"
            onClick={compartilharTela}
            disabled={outroTransmitindo}
            title={outroTransmitindo ? `${quemTransmite?.nickname} está compartilhando` : 'Compartilhar sua tela'}
          >
            <Icone d={ICONES.tela} />
            <span className="nss-controle-rotulo">Compartilhar tela</span>
          </button>
        )}

        <button type="button" className="nss-controle" onClick={alternarTelaCheia} title="Tela cheia">
          <Icone d={ICONES.tela_cheia} />
          <span className="nss-controle-rotulo">Tela cheia</span>
        </button>

        <button type="button" className="nss-controle perigo" onClick={sair} title="Sair da sala">
          <Icone d={ICONES.sair} />
          <span className="nss-controle-rotulo">Sair</span>
        </button>
      </div>

      {/* ═══ PORTA ═══ */}
      {!codigoOk && (
        <div className="nss-porta">
          <div className="nss-porta-cartao">
            <h1 className="nss-porta-titulo">Código inválido</h1>
            <p className="nss-porta-texto">
              O código <strong>{codigoBruto}</strong> não tem o formato de uma sala do Nora Screen.
            </p>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar ao Nora Screen</Link>
          </div>
        </div>
      )}

      {codigoOk && !nickname && (
        <div className="nss-porta">
          <form
            className="nss-porta-cartao"
            onSubmit={(e) => {
              e.preventDefault();
              if (rascunho.trim().length >= NICKNAME_MIN) setNickname(rascunho.trim());
            }}
          >
            <h1 className="nss-porta-titulo">Entrar na sala {codigo}</h1>
            <p className="nss-porta-texto">Escolha um nickname para se identificar para quem já está lá.</p>
            <input
              className="nss-input"
              type="text"
              placeholder="Seu nickname"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value.slice(0, 24))}
              maxLength={24}
              autoFocus
            />
            <button type="submit" className="nss-principal" disabled={rascunho.trim().length < NICKNAME_MIN}>
              Entrar na sala
            </button>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar ao Nora Screen</Link>
          </form>
        </div>
      )}
    </div>
  );
}
