import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SalasAtivas from '../components/SalasAtivas.jsx';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  SITE_NORATECH,
  codigoValido,
  gerarCodigoDeSala,
  iniciaisDe,
  noraScreenRoute,
  normalizarCodigo,
} from '../constants.js';

// ═══════════════════════════════════════════════════════════════
// Nora Screen — home
//
// Tela única, sem rolagem: à esquerda a apresentação do produto, à
// direita o cartão que dá acesso à sala. É a porta do subdomínio
// transmissao.noratech.com.br, e por isso não tem menu: quem chega aqui
// vem para criar ou entrar numa sala, não para navegar.
// ═══════════════════════════════════════════════════════════════

const BENEFICIOS = [
  {
    titulo: 'Crie uma sala em um clique',
    desc: 'Comece a transmitir em segundos.',
    icone: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  },
  {
    titulo: 'Compartilhe a tela direto do navegador',
    desc: 'Funciona no seu navegador, sem instalar nada.',
    icone: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /></>,
  },
  {
    titulo: 'Convide outras pessoas com um link ou código',
    desc: 'Compartilhe e colabore com quem você quiser.',
    icone: <><circle cx="9" cy="8" r="3.4" /><path d="M2.5 19.5c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" /><path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18.5 19.5c0-2.2-.8-4-2.2-5.2" /></>,
  },
];

// Marca do produto: duas telas sobrepostas — a que transmite e a que
// recebe. Desenhada, não importada, para acompanhar a cor do tema.
function MarcaNoraScreen() {
  return (
    <span className="nsc-mark" aria-hidden="true">
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect x="4.5" y="9.5" width="20" height="15" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.55" />
        <rect x="16" y="16" width="21" height="16" rx="4.5" fill="var(--nsc-mark-fill)" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

function Seta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export default function NoraScreenHome() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [salasAbertas, setSalasAbertas] = useState(false);
  const campoNickname = useRef(null);

  const iniciais = useMemo(() => iniciaisDe(nickname), [nickname]);
  const nicknameOk = nickname.trim().length >= NICKNAME_MIN;

  // Sem rolagem enquanto esta tela estiver montada — devolvido ao sair,
  // para não vazar `overflow: hidden` para as outras rotas.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const anterior = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => { html.style.overflow = anterior[0]; body.style.overflow = anterior[1]; };
  }, []);

  // O nickname identifica a pessoa na sala, então ele é exigido nos dois
  // caminhos — criar e entrar. Sem ele não há quem apresentar aos outros.
  const exigirNickname = () => {
    if (nicknameOk) return true;
    setErro(`Escolha um apelido com pelo menos ${NICKNAME_MIN} caracteres para se identificar na sala.`);
    campoNickname.current?.focus();
    return false;
  };

  const criarSala = (e) => {
    e.preventDefault();
    setErro('');
    if (!exigirNickname()) return;
    const novo = gerarCodigoDeSala();
    navigate(noraScreenRoute(`sala/${novo}`), { state: { nickname: nickname.trim(), criador: true } });
  };

  const entrarNaSala = (e) => {
    e.preventDefault();
    setErro('');
    if (!exigirNickname()) return;
    if (!codigoValido(codigo)) {
      setErro('O código da sala tem oito caracteres, no formato XXXX-XXXX.');
      return;
    }
    navigate(noraScreenRoute(`sala/${normalizarCodigo(codigo)}`), { state: { nickname: nickname.trim() } });
  };

  return (
    <div className="nsc-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .nsc-page {
          --nsc-violet: #7C3AED;
          --nsc-violet-soft: #a78bfa;
          --nsc-azul: #3b82f6;
          --nsc-bg: #04040a;
          --nsc-fg: #f4f3f7;
          --nsc-muted: rgba(255,255,255,0.5);
          --nsc-line: rgba(255,255,255,0.1);
          --nsc-mark-fill: rgba(124,58,237,0.22);

          position: fixed; inset: 0; overflow: hidden;
          background: var(--nsc-bg);
          color: var(--nsc-fg);
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .nsc-page *, .nsc-page *::before, .nsc-page *::after { box-sizing: border-box; }

        /* A tela é escura por identidade do produto. As regras globais de
           tema claro (index.css) escureceriam texto que aqui vive no preto. */
        html[data-theme="light"] .nsc-page .nsc-input { color: var(--nsc-fg); }
        html[data-theme="light"] .nsc-page strong { color: var(--nsc-violet-soft) !important; }

        /* ══════════ AMBIENTE ══════════ */
        .nsc-cena { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

        .nsc-brilho {
          position: absolute; border-radius: 50%; filter: blur(90px);
        }
        .nsc-brilho.roxo {
          width: 60vw; height: 60vw; max-width: 900px; max-height: 900px;
          top: -26%; left: -10%;
          background: radial-gradient(circle, rgba(124,58,237,0.4) 0%, rgba(124,58,237,0.09) 45%, transparent 70%);
          animation: nsc-deriva-a 48s ease-in-out infinite;
        }
        .nsc-brilho.azul {
          width: 54vw; height: 54vw; max-width: 820px; max-height: 820px;
          bottom: -30%; right: -8%;
          background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(124,58,237,0.1) 48%, transparent 72%);
          animation: nsc-deriva-b 62s ease-in-out infinite;
        }
        .nsc-brilho.foco {
          width: 40vw; height: 40vw; max-width: 600px; max-height: 600px;
          top: 26%; right: 18%;
          background: radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 66%);
          animation: nsc-deriva-c 74s ease-in-out infinite;
        }
        @keyframes nsc-deriva-a {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(4vw, 4vh, 0) scale(1.1); }
        }
        @keyframes nsc-deriva-b {
          0%,100% { transform: translate3d(0,0,0) scale(1.05); }
          50%     { transform: translate3d(-5vw,-4vh,0) scale(0.95); }
        }
        @keyframes nsc-deriva-c {
          0%,100% { transform: translate3d(0,0,0) scale(0.96); }
          50%     { transform: translate3d(-3vw, 5vh, 0) scale(1.08); }
        }

        .nsc-grade {
          position: absolute; inset: -10%;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 72px 72px;
          -webkit-mask-image: radial-gradient(ellipse 72% 62% at 46% 44%, #000 4%, transparent 74%);
          mask-image: radial-gradient(ellipse 72% 62% at 46% 44%, #000 4%, transparent 74%);
          opacity: 0.5;
          animation: nsc-grade-pan 100s linear infinite;
        }
        @keyframes nsc-grade-pan {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 72px 72px, 72px 72px; }
        }

        /* Fios de sinal atravessando a cena — a transmissão em si,
           sugerida sem literalidade. */
        .nsc-fios { position: absolute; inset: 0; width: 100%; height: 100%; }
        .nsc-fio {
          fill: none; stroke: url(#nsc-grad-fio); stroke-width: 1;
          stroke-dasharray: 5 320; opacity: 0.85;
          animation: nsc-sinal 14s linear infinite;
        }
        .nsc-fio.b { animation-duration: 19s; animation-delay: -6s; }
        .nsc-fio.c { animation-duration: 24s; animation-delay: -11s; }
        .nsc-fio-base { fill: none; stroke: rgba(124,58,237,0.2); stroke-width: 1; }
        @keyframes nsc-sinal {
          from { stroke-dashoffset: 325; }
          to   { stroke-dashoffset: 0; }
        }

        .nsc-particula {
          position: absolute; border-radius: 50%;
          background: var(--nsc-violet-soft);
          animation: nsc-piscar var(--dur) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        @keyframes nsc-piscar {
          0%,100% { opacity: calc(var(--o) * 0.2); transform: scale(0.8); }
          50%     { opacity: var(--o); transform: scale(1); }
        }

        .nsc-vinheta {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 92% 76% at 50% 48%, transparent 46%, rgba(0,0,0,0.5) 100%),
            linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.55) 100%);
        }

        /* ══════════ PALCO ══════════ */
        .nsc-palco {
          position: relative; z-index: 2;
          height: 100%; width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
          align-items: center;
          gap: clamp(32px, 5vw, 86px);
          max-width: 1320px; margin: 0 auto;
          padding: clamp(40px, 7vh, 76px) clamp(24px, 5vw, 80px) clamp(64px, 9vh, 96px);
        }

        /* ── Apresentação ── */
        .nsc-marca { display: flex; align-items: center; gap: 16px; margin-bottom: clamp(22px, 4vh, 38px); }
        .nsc-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: clamp(48px, 3.4vw, 58px); height: clamp(48px, 3.4vw, 58px);
          flex-shrink: 0; border-radius: 16px;
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(124,58,237,0.26);
          color: var(--nsc-violet-soft);
          box-shadow: 0 14px 34px -16px rgba(124,58,237,0.9);
        }
        .nsc-nome {
          font-size: clamp(1.5rem, 2vw, 1.95rem); font-weight: 800;
          letter-spacing: -0.5px; line-height: 1.05;
        }
        .nsc-nome span {
          background: linear-gradient(100deg, var(--nsc-violet-soft), var(--nsc-azul));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .nsc-by {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem; letter-spacing: 1.6px; color: var(--nsc-muted); margin-top: 4px;
        }

        .nsc-headline {
          font-size: clamp(1.9rem, 3.4vw, 3.2rem); line-height: 1.08;
          font-weight: 800; letter-spacing: -1.6px;
          margin: 0 0 clamp(14px, 2.4vh, 22px); max-width: 24ch;
        }
        .nsc-headline span {
          background: linear-gradient(100deg, #b69bff, var(--nsc-violet));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .nsc-apoio {
          font-size: clamp(0.92rem, 1.05vw, 1.05rem); line-height: 1.6;
          color: var(--nsc-muted); margin: 0 0 clamp(22px, 4vh, 40px); max-width: 44ch;
        }

        .nsc-beneficio { display: flex; align-items: flex-start; gap: 15px; }
        .nsc-beneficio + .nsc-beneficio { margin-top: clamp(13px, 2.2vh, 20px); }
        .nsc-beneficio-icone {
          flex-shrink: 0; margin-top: 1px;
          display: inline-flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 13px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.09);
          color: var(--nsc-violet-soft);
        }
        .nsc-beneficio-titulo { font-size: 0.95rem; font-weight: 700; letter-spacing: -0.2px; line-height: 1.35; }
        .nsc-beneficio-desc {
          font-size: 0.86rem; line-height: 1.45; color: rgba(255,255,255,0.52); margin-top: 3px;
        }

        .nsc-acoes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: clamp(24px, 4.4vh, 42px); }
        .nsc-page .nsc-acao {
          display: inline-flex; align-items: center; gap: 10px;
          height: 48px; padding: 0 22px; border-radius: 100px; white-space: nowrap;
          font-family: inherit; font-size: 0.9rem; font-weight: 600;
          text-decoration: none; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.035); color: var(--nsc-fg);
          transition: background 0.28s ease, border-color 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .nsc-page .nsc-acao:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
        .nsc-page .nsc-acao.destaque {
          background: rgba(124,58,237,0.14); border-color: rgba(167,139,250,0.34); color: #e9e2ff;
        }
        .nsc-page .nsc-acao.destaque:hover { background: rgba(124,58,237,0.24); border-color: rgba(167,139,250,0.6); }
        .nsc-acao svg { flex-shrink: 0; }

        /* ── Cartão de acesso ── */
        .nsc-cartao-wrap { position: relative; justify-self: center; width: min(100%, 470px); }
        .nsc-cartao {
          position: relative; z-index: 2;
          padding: clamp(26px, 3.4vh, 38px) clamp(22px, 2.4vw, 34px);
          border-radius: 26px;
          background: linear-gradient(158deg, rgba(30,26,52,0.66) 0%, rgba(10,10,18,0.8) 56%, rgba(16,14,34,0.72) 100%);
          backdrop-filter: blur(28px) saturate(1.4);
          -webkit-backdrop-filter: blur(28px) saturate(1.4);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow:
            0 48px 100px -34px rgba(0,0,0,0.92),
            0 0 80px -34px rgba(124,58,237,0.5),
            inset 0 1px 0 rgba(255,255,255,0.11);
          animation: nsc-entrada 0.9s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nsc-entrada {
          from { opacity: 0; transform: translateY(18px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Energia percorrendo o contorno, como no resto da identidade. */
        @supports ((-webkit-mask-composite: xor) or (mask-composite: exclude)) {
          .nsc-borda {
            position: absolute; inset: 0; border-radius: inherit; overflow: hidden;
            padding: 1px; pointer-events: none;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask-composite: exclude;
          }
          .nsc-borda::after {
            content: ''; position: absolute; left: 50%; top: 50%;
            width: 190%; height: 190%; margin: -95% 0 0 -95%;
            background: conic-gradient(from 0deg,
              transparent 0deg, transparent 186deg,
              rgba(59,130,246,0.32) 232deg,
              rgba(167,139,250,0.95) 266deg,
              rgba(255,255,255,0.9) 274deg,
              rgba(124,58,237,0.4) 304deg,
              transparent 346deg);
            animation: nsc-giro 8s linear infinite;
          }
        }
        @keyframes nsc-giro { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .nsc-titulo { font-size: clamp(1.4rem, 1.7vw, 1.7rem); font-weight: 800; letter-spacing: -0.8px; margin: 0; }
        .nsc-sub {
          font-size: 0.88rem; line-height: 1.5; color: rgba(255,255,255,0.56);
          margin: 7px 0 clamp(18px, 2.8vh, 26px);
        }

        .nsc-rotulo {
          display: block; font-family: 'JetBrains Mono', monospace;
          font-size: 0.66rem; font-weight: 600; letter-spacing: 1.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.54); margin-bottom: 10px;
        }

        .nsc-nick-linha { display: flex; align-items: center; gap: 12px; }
        .nsc-avatar {
          position: relative; flex-shrink: 0;
          width: 52px; height: 52px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 800; letter-spacing: -0.4px; color: #fff;
          background: linear-gradient(140deg, #8b5cf6, #4f46e5);
          border: 1px solid rgba(167,139,250,0.45);
          box-shadow: 0 12px 28px -12px rgba(124,58,237,0.95);
          transition: filter 0.3s ease;
        }
        .nsc-avatar.vazio { filter: grayscale(0.55) brightness(0.7); }
        /* Ponto de presença: verde só quando há nickname — antes disso não
           há ninguém para apresentar na sala. */
        .nsc-avatar::after {
          content: ''; position: absolute; right: -1px; bottom: 1px;
          width: 13px; height: 13px; border-radius: 50%;
          background: #22c55e; border: 2.5px solid #0b0a12;
          opacity: 0; transform: scale(0.6);
          transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nsc-avatar:not(.vazio)::after { opacity: 1; transform: scale(1); }

        .nsc-campo { position: relative; flex: 1; min-width: 0; }
        .nsc-page .nsc-input {
          width: 100%; height: 52px; padding: 0 16px; border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.13);
          color: var(--nsc-fg); font-family: inherit; font-size: 0.95rem; outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .nsc-page .nsc-input::placeholder { color: rgba(255,255,255,0.3); }
        .nsc-page .nsc-input:hover:not(:focus) { border-color: rgba(255,255,255,0.22); }
        .nsc-page .nsc-input:focus {
          border-color: rgba(124,58,237,0.75); background: rgba(124,58,237,0.09);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.16);
        }
        .nsc-input.codigo {
          font-family: 'JetBrains Mono', monospace; letter-spacing: 3px; text-transform: uppercase;
        }
        .nsc-input.codigo::placeholder { letter-spacing: 3px; }
        .nsc-contador {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          font-family: 'JetBrains Mono', monospace; font-size: 0.72rem;
          color: rgba(255,255,255,0.38); pointer-events: none;
        }
        .nsc-input.tem-contador { padding-right: 62px; }

        .nsc-page .nsc-primario {
          position: relative;
          width: 100%; height: 54px; margin-top: 16px;
          /* Espaço reservado nas laterais para a seta, que sai do fluxo: assim
             o par "+ Criar sala" fica centrado de verdade e nunca encosta nela. */
          padding: 0 46px;
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          border: none; border-radius: 15px; cursor: pointer;
          background: linear-gradient(100deg, #7C3AED 0%, #6d5cf6 52%, #3b82f6 100%);
          color: #fff; font-family: inherit; font-size: 0.97rem; font-weight: 700;
          box-shadow: 0 18px 38px -18px rgba(99,72,246,0.95);
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s ease, filter 0.28s ease;
        }
        .nsc-page .nsc-primario:hover { transform: translateY(-2px); box-shadow: 0 24px 46px -18px rgba(99,72,246,1); filter: brightness(1.07); }
        .nsc-page .nsc-primario:active { transform: translateY(0); }
        .nsc-primario .mais { font-size: 1.15rem; line-height: 1; margin-top: -2px; }
        /* A seta é ornamento: fora do fluxo, ela não desloca o rótulo. */
        .nsc-primario .seta {
          position: absolute; right: 18px; top: 50%; margin-top: -8px;
          display: flex; opacity: 0.85;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease;
        }
        .nsc-page .nsc-primario:hover .seta { transform: translateX(4px); opacity: 1; }
        .nsc-primario .rotulo { letter-spacing: 0.1px; }

        .nsc-ou {
          display: flex; align-items: center; gap: 14px;
          margin: clamp(16px, 2.6vh, 24px) 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem; letter-spacing: 2px; color: rgba(255,255,255,0.34);
        }
        .nsc-ou::before, .nsc-ou::after { content: ''; height: 1px; flex: 1; background: var(--nsc-line); }

        .nsc-entrada-linha { display: flex; gap: 10px; align-items: stretch; }
        .nsc-entrada-linha .nsc-campo { flex: 1; }
        .nsc-page .nsc-secundario {
          flex-shrink: 0; height: 52px; padding: 0 20px; border-radius: 14px;
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
          background: rgba(124,58,237,0.14); border: 1px solid rgba(167,139,250,0.3);
          color: #e9e2ff; font-family: inherit; font-size: 0.92rem; font-weight: 700;
          transition: background 0.28s ease, border-color 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .nsc-page .nsc-secundario:hover { background: rgba(124,58,237,0.24); border-color: rgba(167,139,250,0.6); transform: translateY(-2px); }
        .nsc-page .nsc-secundario svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nsc-page .nsc-secundario:hover svg { transform: translateX(3px); }

        .nsc-erro {
          display: flex; gap: 9px; margin-top: 14px; padding: 11px 13px;
          background: rgba(255,80,80,0.09); border: 1px solid rgba(255,80,80,0.26);
          border-radius: 12px; font-size: 0.83rem; line-height: 1.45; color: #ff9090;
        }

        .nsc-selo {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: clamp(16px, 2.6vh, 24px);
          font-size: 0.78rem; line-height: 1.4; color: rgba(255,255,255,0.46);
        }
        .nsc-selo svg { color: var(--nsc-violet-soft); flex-shrink: 0; }

        /* ── Rodapé ── */
        .nsc-rodape {
          position: absolute; left: 0; right: 0; bottom: clamp(18px, 3vh, 28px);
          z-index: 2; text-align: center;
          font-size: 0.8rem; color: rgba(255,255,255,0.32);
        }

        /* ══════════ RESPONSIVO ══════════ */
        @media (max-width: 1080px) {
          .nsc-palco { gap: clamp(24px, 3vw, 48px); }
          .nsc-headline { letter-spacing: -1.1px; }
        }

        @media (max-width: 940px) {
          .nsc-palco {
            grid-template-columns: minmax(0, 1fr);
            align-content: center; justify-items: center; text-align: center;
            gap: clamp(16px, 2.6vh, 26px);
            padding: clamp(22px, 3.4vh, 38px) 20px clamp(48px, 7vh, 60px);
            overflow-x: hidden; overflow-y: auto; scrollbar-width: none;
          }
          .nsc-palco::-webkit-scrollbar { display: none; }
          .nsc-apresentacao { display: flex; flex-direction: column; align-items: center; }
          .nsc-marca { margin-bottom: 16px; }
          .nsc-headline { max-width: 18ch; font-size: clamp(1.6rem, 6.2vw, 2.2rem); }
          .nsc-apoio { max-width: 40ch; margin-bottom: 20px; font-size: 0.9rem; }
          .nsc-beneficio { text-align: left; max-width: 380px; }
          .nsc-beneficio + .nsc-beneficio { margin-top: 11px; }
          .nsc-beneficio-icone { width: 38px; height: 38px; border-radius: 11px; }
          .nsc-acoes { margin-top: 18px; }
          .nsc-acoes { justify-content: center; }
          .nsc-cartao-wrap { width: min(100%, 430px); }
          .nsc-cartao { text-align: left; }
        }

        /* Em telas baixas os benefícios são o que menos faz falta: a decisão
           (criar ou entrar) mora no cartão. */
        /* Empilhado, os benefícios e o texto de apoio não cabem junto com o
           cartão sem gerar rolagem — e a página não pode rolar. Como a
           decisão (criar ou entrar) mora no cartão, é o apoio que sai.
           Medido: com eles visíveis, sobram 70px em 390x844. */
        @media (max-width: 940px) and (max-height: 1060px) {
          .nsc-beneficios { display: none; }
        }
        @media (max-width: 940px) and (max-height: 900px) {
          .nsc-apoio { display: none; }
        }

        /* Celulares baixos: tudo encolhe junto, em vez de cortar conteúdo. */
        @media (max-width: 940px) and (max-height: 720px) {
          .nsc-palco { gap: 12px; padding-top: 16px; padding-bottom: 40px; }
          .nsc-rodape { bottom: 12px; font-size: 0.74rem; }
          .nsc-marca { margin-bottom: 10px; gap: 12px; }
          .nsc-mark { width: 42px; height: 42px; border-radius: 13px; }
          .nsc-mark svg { width: 34px; height: 34px; }
          .nsc-headline { font-size: clamp(1.4rem, 5.6vw, 1.8rem); margin-bottom: 0; }
          .nsc-acoes { margin-top: 14px; }
          .nsc-page .nsc-acao { height: 42px; font-size: 0.85rem; }
          .nsc-cartao { padding: 20px 18px; }
          .nsc-sub { margin-bottom: 14px; }
          .nsc-page .nsc-input { height: 46px; }
          .nsc-avatar { width: 46px; height: 46px; font-size: 0.9rem; }
          .nsc-page .nsc-primario { height: 48px; margin-top: 12px; }
          .nsc-page .nsc-secundario { height: 46px; }
          .nsc-ou { margin: 12px 0; }
          .nsc-selo { margin-top: 14px; font-size: 0.74rem; }
        }

        @media (max-width: 420px) {
          .nsc-entrada-linha { flex-direction: column; }
          .nsc-page .nsc-secundario { justify-content: center; width: 100%; }
          .nsc-acoes { width: 100%; }
          .nsc-page .nsc-acao { flex: 1; justify-content: center; padding: 0 16px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nsc-page *, .nsc-page *::before, .nsc-page *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      {/* ═══ AMBIENTE ═══ */}
      <div className="nsc-cena" aria-hidden="true">
        <div className="nsc-brilho roxo" />
        <div className="nsc-brilho azul" />
        <div className="nsc-brilho foco" />
        <div className="nsc-grade" />

        <svg className="nsc-fios" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <defs>
            <linearGradient id="nsc-grad-fio" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[
            'M-40 250 C 320 130, 640 330, 1480 140',
            'M-40 520 C 380 640, 700 380, 1480 600',
            'M-40 760 C 300 700, 820 840, 1480 720',
          ].map((d, i) => (
            <g key={d}>
              <path className="nsc-fio-base" d={d} />
              <path className={`nsc-fio ${['', 'b', 'c'][i]}`} d={d} />
            </g>
          ))}
        </svg>

        {[
          [12, 22, 2.4, 0.5, 7], [26, 68, 1.8, 0.4, 9], [44, 14, 2.1, 0.45, 6],
          [58, 82, 2.6, 0.55, 11], [71, 31, 1.9, 0.35, 8], [84, 62, 2.2, 0.5, 10],
          [33, 46, 1.7, 0.3, 12], [67, 8, 2.3, 0.4, 9],
        ].map(([top, left, size, o, dur]) => (
          <span
            key={`${top}-${left}`}
            className="nsc-particula"
            style={{
              top: `${top}%`, left: `${left}%`, width: size, height: size,
              '--o': o, '--dur': `${dur}s`, '--delay': `${(top % 5)}s`,
            }}
          />
        ))}

        <div className="nsc-vinheta" />
      </div>

      {/* ═══ PALCO ═══ */}
      <main className="nsc-palco">
        <section className="nsc-apresentacao">
          <div className="nsc-marca">
            <MarcaNoraScreen />
            <div>
              <div className="nsc-nome">NORA <span>SCREEN</span></div>
              <div className="nsc-by">by NoraTech</div>
            </div>
          </div>

          <h1 className="nsc-headline">
            Compartilhe sua tela,<br />
            <span>ao vivo</span>, em segundos.
          </h1>

          <p className="nsc-apoio">
            Crie uma sala, transmita sua tela pelo navegador e colabore em tempo real.
            Sem instalar nada, sem complicação.
          </p>

          <div className="nsc-beneficios">
            {BENEFICIOS.map((b) => (
              <div className="nsc-beneficio" key={b.titulo}>
                <span className="nsc-beneficio-icone">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {b.icone}
                  </svg>
                </span>
                <div>
                  <div className="nsc-beneficio-titulo">{b.titulo}</div>
                  <div className="nsc-beneficio-desc">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="nsc-acoes">
            <Link to={SITE_NORATECH} className="nsc-acao">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6M20 4l-8.5 8.5" /><path d="M19 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5h4.5" />
              </svg>
              Conhecer NoraTech
            </Link>
            <button type="button" className="nsc-acao destaque" onClick={() => setSalasAbertas(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6s6.2 2.5 6.2 5.6" /><path d="M16.4 5.4a3.2 3.2 0 0 1 0 5.2M21.2 19c0-2-.7-3.7-2-4.9" />
              </svg>
              Ver salas
            </button>
          </div>
        </section>

        {/* ═══ CARTÃO DE ACESSO ═══ */}
        <div className="nsc-cartao-wrap">
          <section className="nsc-cartao" aria-label="Acesso à sala">
            <div className="nsc-borda" aria-hidden="true" />

            <h2 className="nsc-titulo">Entrar</h2>
            <p className="nsc-sub">Escolha um apelido para se identificar na sala.</p>

            <form onSubmit={criarSala} noValidate>
              <label className="nsc-rotulo" htmlFor="nsc-nickname">Apelido</label>
              <div className="nsc-nick-linha">
                <span className={`nsc-avatar ${iniciais ? '' : 'vazio'}`} aria-hidden="true">
                  {iniciais || '··'}
                </span>
                <div className="nsc-campo">
                  <input
                    id="nsc-nickname"
                    ref={campoNickname}
                    className="nsc-input tem-contador"
                    type="text"
                    placeholder="Seu apelido"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value.slice(0, NICKNAME_MAX)); setErro(''); }}
                    maxLength={NICKNAME_MAX}
                    autoComplete="nickname"
                    enterKeyHint="go"
                  />
                  <span className="nsc-contador">{Array.from(nickname).length}/{NICKNAME_MAX}</span>
                </div>
              </div>

              <button type="submit" className="nsc-primario">
                <span className="mais" aria-hidden="true">+</span>
                <span className="rotulo">Criar sala</span>
                <span className="seta"><Seta /></span>
              </button>
            </form>

            <div className="nsc-ou">OU</div>

            <form onSubmit={entrarNaSala} noValidate>
              <label className="nsc-rotulo" htmlFor="nsc-codigo">Código da sala</label>
              <div className="nsc-entrada-linha">
                <div className="nsc-campo">
                  <input
                    id="nsc-codigo"
                    className="nsc-input codigo"
                    type="text"
                    placeholder="XXXX - XXXX"
                    value={codigo}
                    onChange={(e) => { setCodigo(normalizarCodigo(e.target.value)); setErro(''); }}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck="false"
                    enterKeyHint="go"
                  />
                </div>
                <button type="submit" className="nsc-secundario">
                  Entrar <Seta />
                </button>
              </div>
            </form>

            {erro && (
              <div role="alert" className="nsc-erro">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{erro}</span>
              </div>
            )}

            <div className="nsc-selo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7.5 3v6.2c0 4.6-3.1 8.2-7.5 9.3-4.4-1.1-7.5-4.7-7.5-9.3V6z" />
              </svg>
              Conexão segura e criptografada pela NoraTech.
            </div>
          </section>
        </div>
      </main>

      <SalasAtivas
        aberto={salasAbertas}
        aoFechar={() => setSalasAbertas(false)}
        aoEntrar={(codigoDaSala) => {
          setSalasAbertas(false);
          // Sem nickname ainda? A sala pede na porta — não vale barrar aqui
          // quem clicou em "Entrar" numa sala que já está na tela.
          navigate(noraScreenRoute(`sala/${codigoDaSala}`), {
            state: nicknameOk ? { nickname: nickname.trim() } : undefined,
          });
        }}
        aoCriarSala={() => {
          setSalasAbertas(false);
          if (!exigirNickname()) return;
          const novo = gerarCodigoDeSala();
          navigate(noraScreenRoute(`sala/${novo}`), { state: { nickname: nickname.trim(), criador: true } });
        }}
      />

      <div className="nsc-rodape">NoraTech — Tecnologia que aproxima.</div>
    </div>
  );
}
