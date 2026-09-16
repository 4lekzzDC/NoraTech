import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

// ═══════════════════════════════════════════════════════════════
// Noratech — Cadastro
//
// Tela própria (não o shell deslizante de /login): duas áreas lado a
// lado dentro de um único painel escuro, sobre a mesma cena espacial da
// home. A lógica de cadastro é a mesma de sempre — `register` do
// AuthContext, com as validações e o redirect que já existiam.
// ═══════════════════════════════════════════════════════════════

const BENEFICIOS = [
  {
    titulo: 'Soluções completas',
    desc: 'Tudo em um só lugar',
    icone: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  },
  {
    titulo: 'Segurança em primeiro lugar',
    desc: 'Seus dados protegidos',
    icone: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  },
  {
    titulo: 'Feito para crescer',
    desc: 'Da ideia ao resultado',
    icone: <><path d="M5 20V12" /><path d="M12 20V5" /><path d="M19 20v-6" /></>,
  },
];

function Olho({ aberto }) {
  return aberto ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Seta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

// Mesmo campo de estrelas da home: PRNG determinístico para a distribuição
// não mudar a cada render.
function gerarEstrelas(quantidade, semente) {
  let s = semente;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: quantidade }, (_, i) => ({
    id: i,
    top: rand() * 100,
    left: rand() * 100,
    size: 0.8 + rand() * 1.5,
    delay: rand() * 9,
    duration: 4 + rand() * 7,
    opacity: 0.2 + rand() * 0.5,
  }));
}
const ESTRELAS = gerarEstrelas(64, 731121);

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mesmo fluxo da tela antiga: confere as senhas, chama `register` e vai
  // para a área do cliente. A única checagem nova é a dos termos, que o
  // próprio formulário passou a pedir.
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (!aceitouTermos) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/area-do-cliente');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nrxr-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .nrxr-page {
          --nrxr-violet: #7C3AED;
          --nrxr-violet-soft: #b684ff;
          --nrxr-bg: #05050a;
          --nrxr-fg: #f2f1ee;
          --nrxr-muted: rgba(255,255,255,0.46);
          --nrxr-line: rgba(255,255,255,0.09);

          position: relative;
          min-height: 100vh;
          background: var(--nrxr-bg);
          color: var(--nrxr-fg);
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          display: flex; align-items: center; justify-content: center;
          padding: clamp(78px, 11vh, 108px) clamp(16px, 4vw, 48px) clamp(32px, 6vh, 64px);
          overflow-x: hidden;
        }
        .nrxr-page *, .nrxr-page *::before, .nrxr-page *::after { box-sizing: border-box; }

        /* A tela é escura nos dois temas, como a home. As regras globais de
           tema claro (index.css) escureceriam texto que aqui vive no preto. */
        html[data-theme="light"] .nrxr-page .nrxr-input { color: var(--nrxr-fg); }
        html[data-theme="light"] .nrxr-page strong { color: var(--nrxr-violet-soft) !important; }

        /* ══════════ CENA ══════════ */
        .nrxr-scene { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }

        .nrxr-neb {
          position: absolute; border-radius: 50%; filter: blur(80px);
        }
        .nrxr-neb.a {
          width: 58vw; height: 58vw; max-width: 860px; max-height: 860px;
          top: -24%; left: -14%;
          background: radial-gradient(circle, rgba(124,58,237,0.26) 0%, rgba(124,58,237,0.05) 46%, transparent 70%);
          animation: nrxr-drift-a 52s ease-in-out infinite;
        }
        .nrxr-neb.b {
          width: 52vw; height: 52vw; max-width: 780px; max-height: 780px;
          bottom: -28%; right: -12%;
          background: radial-gradient(circle, rgba(91,33,182,0.24) 0%, transparent 70%);
          animation: nrxr-drift-b 64s ease-in-out infinite;
        }
        @keyframes nrxr-drift-a {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(4vw, 4vh, 0) scale(1.1); }
        }
        @keyframes nrxr-drift-b {
          0%,100% { transform: translate3d(0,0,0) scale(1.04); }
          50%     { transform: translate3d(-5vw,-4vh,0) scale(0.95); }
        }

        /* Horizonte: o arco de luz que atravessa a base da cena. */
        /* Medido a partir do topo (72vh), não do rodapé: assim a curva cai
           sempre no mesmo ponto da tela, seja qual for a largura — ancorar
           pelo bottom com um círculo em vw jogava a borda para fora. */
        .nrxr-horizonte {
          position: absolute; top: 72vh; left: 50%;
          width: 220vw; height: 220vw; margin-left: -110vw;
          border-radius: 50%;
          background:
            radial-gradient(circle at 38% 0%, rgba(84,52,142,0.5) 0%, rgba(24,17,42,0.8) 14%, rgba(8,7,14,0.96) 30%, #05050a 46%);
          box-shadow:
            0 -1px 0 0 rgba(206,176,255,0.6),
            0 -12px 44px -6px rgba(180,132,255,0.42);
        }
        /* Bloom rasante acima da borda, do lado esquerdo — a luz da cena. */
        .nrxr-horizonte-luz {
          position: absolute; top: 72vh; left: 4%;
          width: 46vw; height: 26vh; transform: translateY(-62%);
          background: radial-gradient(ellipse 60% 50% at 50% 60%, rgba(196,158,255,0.3) 0%, rgba(124,58,237,0.12) 38%, transparent 70%);
          filter: blur(26px);
        }

        .nrxr-star {
          position: absolute; border-radius: 50%; background: #fff;
          animation: nrxr-twinkle var(--dur) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        @keyframes nrxr-twinkle {
          0%,100% { opacity: calc(var(--o) * 0.25); transform: scale(0.85); }
          50%     { opacity: var(--o); transform: scale(1); }
        }

        /* Órbitas: mesma assinatura da home, aqui passando por trás do painel. */
        .nrxr-orbits {
          position: absolute; top: 50%; right: -7vw;
          width: 44vw; height: 44vw; max-width: 660px; max-height: 660px;
          transform: translateY(-50%);
        }
        .nrxr-orbit {
          position: absolute; top: 50%; left: 50%;
          border: 1px solid rgba(124,58,237,0.3); border-radius: 50%;
        }
        .nrxr-orbit.o1 { width: 100%; aspect-ratio: 1.12; animation: nrxr-spin 44s linear infinite; }
        .nrxr-orbit.o2 { width: 84%; aspect-ratio: 0.9; border-color: rgba(180,132,255,0.24); animation: nrxr-spin 64s linear infinite reverse; }
        @keyframes nrxr-spin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        .nrxr-orbit-dot {
          position: absolute; top: -3px; left: 50%; margin-left: -3px;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--nrxr-violet-soft);
          box-shadow: 0 0 12px 2px rgba(180,132,255,0.75);
        }
        .nrxr-orbit.o2 .nrxr-orbit-dot { top: auto; bottom: -2.5px; background: #fff; box-shadow: 0 0 10px 2px rgba(255,255,255,0.5); }

        /* ══════════ TOPO ══════════ */
        .nrxr-top {
          position: absolute; top: clamp(20px, 3vh, 30px); left: 0; right: 0; z-index: 3;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 clamp(18px, 4vw, 44px); gap: 16px;
        }
        .nrxr-wordmark {
          font-weight: 800; font-size: 1.05rem; letter-spacing: 0.4px;
          color: var(--nrxr-violet); text-decoration: none;
        }
        .nrxr-wordmark span { color: rgba(255,255,255,0.46); }
        .nrxr-top-right { display: flex; align-items: center; gap: 14px; }
        .nrxr-page .nrxr-back {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,0.6); text-decoration: none;
          font-size: 0.88rem; font-weight: 500;
          transition: color 0.25s ease;
        }
        .nrxr-page .nrxr-back:hover { color: var(--nrxr-fg); }
        .nrxr-page .nrxr-back svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nrxr-page .nrxr-back:hover svg { transform: translateX(-3px); }

        /* ══════════ PAINEL ══════════ */
        .nrxr-shell {
          position: relative; z-index: 2;
          width: 100%; max-width: 1180px;
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          border-radius: 26px;
          border: 1px solid rgba(255,255,255,0.12);
          /* Baixa transparência de propósito: mais corpo que um vidro comum,
             para o formulário não competir com as estrelas do fundo. */
          background: linear-gradient(150deg, rgba(16,15,24,0.94) 0%, rgba(9,9,14,0.96) 58%, rgba(15,11,26,0.94) 100%);
          backdrop-filter: blur(26px) saturate(1.3);
          -webkit-backdrop-filter: blur(26px) saturate(1.3);
          box-shadow:
            0 50px 110px -34px rgba(0,0,0,0.92),
            0 0 80px -34px rgba(124,58,237,0.45),
            inset 0 1px 0 rgba(255,255,255,0.1);
          overflow: hidden;
          animation: nrxr-in 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nrxr-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Lado esquerdo ── */
        .nrxr-aside {
          position: relative;
          padding: clamp(34px, 4.6vw, 62px);
          display: flex; flex-direction: column; justify-content: center;
          border-right: 1px solid rgba(255,255,255,0.07);
          background:
            radial-gradient(ellipse 120% 80% at 10% 105%, rgba(124,58,237,0.18) 0%, transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 60%);
        }
        .nrxr-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem; font-weight: 500; letter-spacing: 2.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.4);
          margin-bottom: 20px;
        }
        .nrxr-title {
          font-size: clamp(1.9rem, 2.9vw, 2.9rem); line-height: 1.1;
          font-weight: 800; letter-spacing: -1.4px; margin: 0 0 18px;
          max-width: 13ch;
        }
        .nrxr-title span { color: var(--nrxr-violet-soft); text-shadow: 0 0 40px rgba(124,58,237,0.45); }
        .nrxr-lead {
          font-size: clamp(0.92rem, 1vw, 1.02rem); line-height: 1.6;
          color: var(--nrxr-muted); margin: 0 0 clamp(28px, 5vh, 52px); max-width: 34ch;
        }

        .nrxr-benefit { display: flex; align-items: center; gap: 16px; }
        .nrxr-benefit + .nrxr-benefit { margin-top: clamp(16px, 2.6vh, 24px); }
        .nrxr-benefit-icon {
          flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; border-radius: 14px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--nrxr-violet-soft);
        }
        .nrxr-benefit-title { font-size: 0.94rem; font-weight: 700; letter-spacing: -0.2px; }
        .nrxr-benefit-desc { font-size: 0.86rem; color: rgba(255,255,255,0.42); margin-top: 2px; }

        /* ── Lado direito ── */
        .nrxr-form-side { padding: clamp(30px, 4vw, 52px); display: flex; flex-direction: column; justify-content: center; }
        .nrxr-brand { display: flex; align-items: center; gap: 14px; margin-bottom: clamp(20px, 3vh, 30px); }
        .nrxr-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 50px; height: 50px; border-radius: 15px; flex-shrink: 0;
          background: linear-gradient(140deg, #8b5cf6, #6d28d9);
          border: 1px solid rgba(180,132,255,0.4); color: #fff;
          box-shadow: 0 12px 30px -12px rgba(124,58,237,0.95);
        }
        .nrxr-brand-name { font-weight: 800; font-size: 1.05rem; letter-spacing: 0.4px; color: #fff; }
        .nrxr-brand-sub { font-size: 0.88rem; color: rgba(255,255,255,0.46); margin-top: 3px; }

        .nrxr-field + .nrxr-field { margin-top: 14px; }
        .nrxr-label {
          display: block; font-size: 0.84rem; font-weight: 600;
          color: rgba(255,255,255,0.82); margin-bottom: 8px;
        }
        .nrxr-input-wrap { position: relative; display: flex; align-items: center; }
        .nrxr-input-icon {
          position: absolute; left: 15px; display: flex; pointer-events: none;
          color: rgba(255,255,255,0.32);
          transition: color 0.25s ease;
        }
        .nrxr-input-wrap:focus-within .nrxr-input-icon { color: var(--nrxr-violet-soft); }
        .nrxr-page .nrxr-input {
          width: 100%; height: 52px; padding: 0 46px;
          border-radius: 14px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.13);
          color: var(--nrxr-fg); font-family: inherit; font-size: 0.94rem; outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .nrxr-page .nrxr-input::placeholder { color: rgba(255,255,255,0.3); }
        .nrxr-page .nrxr-input:hover:not(:focus) { border-color: rgba(255,255,255,0.22); }
        .nrxr-page .nrxr-input:focus {
          border-color: rgba(124,58,237,0.75); background: rgba(124,58,237,0.09);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.16);
        }
        .nrxr-page .nrxr-eye {
          position: absolute; right: 7px;
          width: 36px; height: 36px; border-radius: 10px;
          border: none; background: none; cursor: pointer;
          color: rgba(255,255,255,0.42);
          display: flex; align-items: center; justify-content: center;
          transition: color 0.25s ease, background 0.25s ease;
        }
        .nrxr-page .nrxr-eye:hover { color: var(--nrxr-fg); background: rgba(255,255,255,0.07); }

        .nrxr-terms {
          display: flex; align-items: flex-start; gap: 11px;
          margin-top: clamp(18px, 2.6vh, 24px);
          font-size: 0.86rem; line-height: 1.5; color: rgba(255,255,255,0.62);
        }
        .nrxr-page .nrxr-check {
          appearance: none; -webkit-appearance: none;
          flex-shrink: 0; width: 20px; height: 20px; margin: 1px 0 0;
          border-radius: 6px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.24);
          background: rgba(255,255,255,0.04);
          transition: background 0.22s ease, border-color 0.22s ease;
        }
        .nrxr-page .nrxr-check:checked {
          background: var(--nrxr-violet) center/13px no-repeat
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
          border-color: var(--nrxr-violet);
        }
        .nrxr-page .nrxr-check:focus-visible { outline: 2px solid var(--nrxr-violet-soft); outline-offset: 2px; }
        .nrxr-page .nrxr-terms a { color: var(--nrxr-violet-soft); text-decoration: none; transition: color 0.2s ease; }
        .nrxr-page .nrxr-terms a:hover { color: #fff; text-decoration: underline; }

        .nrxr-page .nrxr-submit {
          width: 100%; height: 56px; margin-top: clamp(18px, 2.6vh, 24px);
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          border: none; border-radius: 14px; cursor: pointer;
          background: linear-gradient(120deg, #7C3AED 0%, #9257f5 55%, #6d28d9 100%);
          color: #fff; font-family: inherit; font-size: 1rem; font-weight: 700;
          box-shadow: 0 18px 38px -18px rgba(124,58,237,0.95);
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s ease, filter 0.28s ease;
        }
        .nrxr-page .nrxr-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 24px 48px -18px rgba(124,58,237,1); filter: brightness(1.06); }
        .nrxr-page .nrxr-submit:active:not(:disabled) { transform: translateY(0); }
        .nrxr-page .nrxr-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .nrxr-page .nrxr-submit svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nrxr-page .nrxr-submit:hover:not(:disabled) svg { transform: translateX(4px); }

        .nrxr-or {
          display: flex; align-items: center; gap: 12px;
          margin: clamp(16px, 2.4vh, 22px) 0 14px;
          font-size: 0.84rem; color: rgba(255,255,255,0.35);
        }
        .nrxr-or::before, .nrxr-or::after { content: ''; height: 1px; flex: 1; background: rgba(255,255,255,0.08); }

        .nrxr-switch { text-align: center; font-size: 0.9rem; color: rgba(255,255,255,0.58); }
        .nrxr-page .nrxr-switch a {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--nrxr-violet-soft); font-weight: 700; text-decoration: none;
          transition: color 0.25s ease;
        }
        .nrxr-page .nrxr-switch a:hover { color: #fff; }
        .nrxr-page .nrxr-switch a svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nrxr-page .nrxr-switch a:hover svg { transform: translateX(4px); }

        .nrxr-error {
          display: flex; gap: 9px; margin-top: 16px; padding: 12px 14px;
          background: rgba(255,80,80,0.09); border: 1px solid rgba(255,80,80,0.26);
          border-radius: 12px; font-size: 0.86rem; line-height: 1.45; color: #ff9090;
        }

        /* ══════════ RESPONSIVO ══════════ */
        @media (max-width: 940px) {
          .nrxr-shell { grid-template-columns: minmax(0, 1fr); max-width: 520px; }
          .nrxr-aside {
            border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07);
            padding: clamp(30px, 7vw, 44px);
          }
          .nrxr-title { max-width: none; font-size: clamp(1.7rem, 6.4vw, 2.2rem); }
          .nrxr-lead { margin-bottom: 26px; max-width: none; }
          .nrxr-orbits { right: -26vw; opacity: 0.7; }
        }

        @media (max-width: 560px) {
          .nrxr-top { position: static; padding: 0 0 22px; }
          .nrxr-page { padding: 26px 16px 36px; align-items: flex-start; flex-direction: column; }
          .nrxr-shell { margin: 0 auto; }
          .nrxr-benefit-icon { width: 42px; height: 42px; border-radius: 12px; }
          .nrxr-page .nrxr-input { height: 48px; }
          .nrxr-page .nrxr-submit { height: 52px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nrxr-page *, .nrxr-page *::before, .nrxr-page *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div className="nrxr-scene" aria-hidden="true">
        <div className="nrxr-neb a" />
        <div className="nrxr-neb b" />
        {ESTRELAS.map((e) => (
          <span
            key={e.id}
            className="nrxr-star"
            style={{
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              '--o': e.opacity,
              '--dur': `${e.duration}s`,
              '--delay': `${e.delay}s`,
            }}
          />
        ))}
        <div className="nrxr-orbits">
          <div className="nrxr-orbit o1"><span className="nrxr-orbit-dot" /></div>
          <div className="nrxr-orbit o2"><span className="nrxr-orbit-dot" /></div>
        </div>
        <div className="nrxr-horizonte-luz" />
        <div className="nrxr-horizonte" />
      </div>

      <div className="nrxr-top">
        <Link to="/" className="nrxr-wordmark">NORA<span>TECH</span></Link>
        <div className="nrxr-top-right">
          <Link to="/" className="nrxr-back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 19 3.5 12l7-7M3.5 12h17" />
            </svg>
            <span>Voltar ao site</span>
          </Link>
          <ThemeToggle style={{ width: 38, height: 38 }} />
        </div>
      </div>

      <div className="nrxr-shell">
        {/* ═══ Apresentação ═══ */}
        <aside className="nrxr-aside">
          <div className="nrxr-eyebrow">Tecnologia sem limites</div>
          <h1 className="nrxr-title">Crie sua conta e <span>faça parte.</span></h1>
          <p className="nrxr-lead">
            Acesse todos os sistemas da NoraTech e transforme suas ideias em resultados.
          </p>

          <div>
            {BENEFICIOS.map((b) => (
              <div className="nrxr-benefit" key={b.titulo}>
                <span className="nrxr-benefit-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {b.icone}
                  </svg>
                </span>
                <div>
                  <div className="nrxr-benefit-title">{b.titulo}</div>
                  <div className="nrxr-benefit-desc">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ═══ Formulário ═══ */}
        <div className="nrxr-form-side">
          <div className="nrxr-brand">
            <span className="nrxr-mark" aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
              </svg>
            </span>
            <div>
              <div className="nrxr-brand-name">NORATECH</div>
              <div className="nrxr-brand-sub">Crie seu acesso.</div>
            </div>
          </div>

          <form onSubmit={handleRegister} noValidate>
            <div className="nrxr-field">
              <label className="nrxr-label" htmlFor="nrxr-nome">Nome</label>
              <div className="nrxr-input-wrap">
                <span className="nrxr-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </span>
                <input
                  id="nrxr-nome"
                  className="nrxr-input"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="nrxr-field">
              <label className="nrxr-label" htmlFor="nrxr-email">E-mail</label>
              <div className="nrxr-input-wrap">
                <span className="nrxr-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="nrxr-email"
                  className="nrxr-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="nrxr-field">
              <label className="nrxr-label" htmlFor="nrxr-senha">Senha</label>
              <div className="nrxr-input-wrap">
                <span className="nrxr-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
                  </svg>
                </span>
                <input
                  id="nrxr-senha"
                  className="nrxr-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="nrxr-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Olho aberto={showPass} />
                </button>
              </div>
            </div>

            <div className="nrxr-field">
              <label className="nrxr-label" htmlFor="nrxr-confirmar">Confirmar senha</label>
              <div className="nrxr-input-wrap">
                <span className="nrxr-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
                  </svg>
                </span>
                <input
                  id="nrxr-confirmar"
                  className="nrxr-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="nrxr-eye" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Olho aberto={showConfirm} />
                </button>
              </div>
            </div>

            <label className="nrxr-terms">
              <input
                type="checkbox"
                className="nrxr-check"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
              />
              <span>
                Eu concordo com os <Link to="/termos">Termos de Uso</Link> e{' '}
                <Link to="/privacidade">Política de Privacidade</Link>
              </span>
            </label>

            {error && (
              <div role="alert" className="nrxr-error">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="nrxr-submit" disabled={loading}>
              {loading ? 'Criando conta...' : <>Criar conta <Seta /></>}
            </button>
          </form>

          <div className="nrxr-or">ou</div>

          <div className="nrxr-switch">
            Já tem uma conta? <Link to="/login">Entrar <Seta /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
