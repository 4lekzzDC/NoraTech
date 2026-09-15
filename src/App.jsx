import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import MeetingScheduler from "./components/MeetingScheduler";
import ThemeToggle from "./components/ThemeToggle";
import { useAuth } from "./contexts/AuthContext";

// ═══════════════════════════════════════════════════════════════
// Noratech — Home
//
// Uma tela só: 100dvh, sem rolagem e sem rodapé. A home não explica
// o que a Noratech faz — ela apresenta a plataforma e abre a porta
// (login). Tudo que era seção da landing virou ação da hero bar.
// ═══════════════════════════════════════════════════════════════

const HEADLINE_PREFIX = "Ideias que se tornam ";
const HEADLINE_ACCENT = "sistemas.";
const HEADLINE_LENGTH = HEADLINE_PREFIX.length + HEADLINE_ACCENT.length;

// Menus da hero bar. Nada aqui cria conteúdo abaixo da dobra: cada item
// abre um popover curto com as rotas/ações que já existem no site.
const MENUS = {
  servicos: {
    label: "Serviços",
    items: [
      { label: "Sistemas sob medida", to: "/servicos/sistemas-sob-medida" },
      { label: "Automação de processos", to: "/servicos/automacao-de-processos" },
    ],
  },
  produtos: {
    label: "Produtos",
    items: [
      { label: "Soluções Contábeis", to: "/area-do-cliente" },
      { label: "NoraDocs", to: "/area-do-cliente" },
      { label: "WhatsApp Bot", href: "https://whatsapp-mu.vercel.app", external: true },
    ],
  },
  sobre: {
    label: "Sobre",
    text: "Engenharia de software, automação e integrações para empresas que querem operar com eficiência.",
    items: [
      { label: "Termos de uso", to: "/termos" },
      { label: "Política de privacidade", to: "/privacidade" },
    ],
  },
  contato: {
    label: "Contato",
    items: [
      { label: "contato@noratech.com.br", href: "mailto:contato@noratech.com.br" },
      { label: "WhatsApp", href: "https://wa.me/5511932227752", external: true },
      { label: "Agendar uma conversa", action: "scheduler" },
    ],
  },
};
const MENU_KEYS = Object.keys(MENUS);

// ═══ Campo de estrelas ═══
// Gerado uma vez por montagem, com PRNG determinístico: a distribuição é
// sempre a mesma entre renders (nada "pula" quando o React re-renderiza) e
// mesmo assim não fica com cara de grade.
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
    size: 0.8 + rand() * 1.6,
    delay: rand() * 9,
    duration: 4 + rand() * 7,
    opacity: 0.25 + rand() * 0.55,
  }));
}

const PREFERE_MENOS_MOVIMENTO = () =>
  typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ═══ Digitação caractere a caractere ═══
function useTypewriter(total, { speed = 55, startDelay = 500 } = {}) {
  const reduzido = PREFERE_MENOS_MOVIMENTO();
  const [count, setCount] = useState(() => (reduzido ? total : 0));

  useEffect(() => {
    if (reduzido) return undefined;
    let timer;
    let i = 0;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i < total) timer = setTimeout(tick, speed);
    };
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, [total, speed, startDelay, reduzido]);

  return count;
}

function SetaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function OlhoIcon({ aberto }) {
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

// Marca usada no topo da caixa de acesso — mesmo losango/raio da identidade.
function MarcaNora() {
  return (
    <span className="nrx-card-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
    </span>
  );
}

export default function App() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const palcoRef = useRef(null);
  const [menuAberto, setMenuAberto] = useState(null);
  const [menuMobile, setMenuMobile] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const digitados = useTypewriter(HEADLINE_LENGTH, { speed: 52, startDelay: 420 });
  const estrelas = useMemo(() => gerarEstrelas(78, 20240917), []);

  const prefixoVisivel = HEADLINE_PREFIX.slice(0, digitados);
  const acentoVisivel = HEADLINE_ACCENT.slice(0, Math.max(0, digitados - HEADLINE_PREFIX.length));

  // Sem rolagem enquanto a home estiver montada — e devolvido ao sair,
  // para não vazar `overflow: hidden` para as outras rotas.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const anterior = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = anterior[0]; body.style.overflow = anterior[1]; };
  }, []);

  // Parallax: escreve direto em custom properties, sem re-render por frame.
  useEffect(() => {
    if (PREFERE_MENOS_MOVIMENTO()) return undefined;
    let frame = 0;
    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = palcoRef.current;
        if (!el) return;
        el.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(4));
        el.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(4));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, []);

  // Fecha popovers com Esc e com clique fora da hero bar.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setMenuAberto(null);
      setMenuMobile(false);
    };
    const onClick = (e) => {
      if (!e.target.closest?.(".nrx-bar") && !e.target.closest?.(".nrx-sheet")) {
        setMenuAberto(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, []);

  // Rede de segurança herdada: link de recuperação de senha que cai na raiz
  // segue para /redefinir-senha preservando o "code".
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("code")) {
      navigate(`/redefinir-senha${window.location.search}`, { replace: true });
    }
  }, [navigate]);

  const abrirScheduler = useCallback(() => {
    setMenuAberto(null);
    setMenuMobile(false);
    setSchedulerOpen(true);
  }, []);

  // Autenticação real — o mesmo `login` do AuthContext usado em /login.
  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const TIMEOUT_MS = 30000;
    let estourou = false;
    const timeout = setTimeout(() => {
      estourou = true;
      setCarregando(false);
      setErro("A conexão demorou demais. Verifique sua internet e tente novamente.");
    }, TIMEOUT_MS);
    try {
      await login(email, senha);
      clearTimeout(timeout);
      navigate("/area-do-cliente");
    } catch (err) {
      clearTimeout(timeout);
      if (!estourou) setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const renderItemMenu = (item, chave) => {
    const classe = "nrx-pop-item";
    if (item.action === "scheduler") {
      return (
        <button key={item.label} type="button" className={classe} onClick={abrirScheduler}>
          {item.label}
        </button>
      );
    }
    if (item.to) {
      return (
        <Link key={item.label} to={item.to} className={classe} onClick={() => { setMenuAberto(null); setMenuMobile(false); }}>
          {item.label}
        </Link>
      );
    }
    return (
      <a
        key={`${chave}-${item.label}`}
        href={item.href}
        className={classe}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noreferrer" : undefined}
        onClick={() => { setMenuAberto(null); setMenuMobile(false); }}
      >
        {item.label}
      </a>
    );
  };

  return (
    <div className="nrx-home" ref={palcoRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .nrx-home {
          --nrx-violet: #7C3AED;
          --nrx-violet-soft: #b684ff;
          --nrx-bg: #050507;
          --nrx-fg: #f2f1ee;
          --nrx-muted: rgba(255,255,255,0.42);
          --nrx-glass: rgba(16,16,22,0.55);
          --nrx-glass-strong: rgba(13,13,18,0.72);
          --nrx-line: rgba(255,255,255,0.09);
          --nrx-input: rgba(255,255,255,0.035);
          --nrx-star: rgba(255,255,255,0.9);
          --nrx-star-opacity: 1;
          --px: 0; --py: 0;

          position: fixed;
          inset: 0;
          overflow: hidden;
          background: var(--nrx-bg);
          color: var(--nrx-fg);
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .nrx-home *, .nrx-home *::before, .nrx-home *::after { box-sizing: border-box; }

        html[data-theme="light"] .nrx-home {
          --nrx-bg: #0b0a12;
          --nrx-glass: rgba(255,255,255,0.07);
          --nrx-star-opacity: 0.75;
        }
        /* A home é escura nos dois temas, então as regras globais de tema
           claro (index.css) escureceriam texto que aqui vive sobre preto. */
        html[data-theme="light"] .nrx-home .nrx-input { color: var(--nrx-fg); }
        html[data-theme="light"] .nrx-home strong { color: var(--nrx-violet-soft) !important; }

        /* ══════════ ATMOSFERA ══════════ */
        .nrx-layer { position: absolute; inset: -12%; pointer-events: none; }

        .nrx-neb {
          position: absolute; border-radius: 50%; filter: blur(70px);
          will-change: transform;
        }
        .nrx-neb.a {
          width: 62vw; height: 62vw; max-width: 900px; max-height: 900px;
          top: -22%; left: -12%;
          background: radial-gradient(circle, rgba(124,58,237,0.24) 0%, rgba(124,58,237,0.05) 45%, transparent 70%);
          animation: nrx-drift-a 46s ease-in-out infinite;
        }
        .nrx-neb.b {
          width: 55vw; height: 55vw; max-width: 820px; max-height: 820px;
          bottom: -26%; right: -10%;
          background: radial-gradient(circle, rgba(91,33,182,0.22) 0%, rgba(124,58,237,0.05) 48%, transparent 72%);
          animation: nrx-drift-b 58s ease-in-out infinite;
        }
        .nrx-neb.c {
          width: 44vw; height: 44vw; max-width: 620px; max-height: 620px;
          top: 32%; left: 42%;
          background: radial-gradient(circle, rgba(56,24,120,0.22) 0%, transparent 68%);
          animation: nrx-drift-c 72s ease-in-out infinite;
        }
        @keyframes nrx-drift-a {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(5vw, 4vh, 0) scale(1.12); }
        }
        @keyframes nrx-drift-b {
          0%,100% { transform: translate3d(0,0,0) scale(1.05); }
          50%     { transform: translate3d(-6vw,-5vh,0) scale(0.94); }
        }
        @keyframes nrx-drift-c {
          0%,100% { transform: translate3d(0,0,0) scale(0.96); }
          50%     { transform: translate3d(-4vw, 6vh, 0) scale(1.1); }
        }

        .nrx-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
          background-size: 76px 76px;
          -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 5%, transparent 72%);
          mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 5%, transparent 72%);
          opacity: 0.42;
          animation: nrx-grid-pan 90s linear infinite;
        }
        @keyframes nrx-grid-pan {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 76px 76px, 76px 76px; }
        }

        .nrx-star {
          position: absolute; border-radius: 50%;
          background: var(--nrx-star);
          animation: nrx-twinkle var(--dur) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        @keyframes nrx-twinkle {
          0%,100% { opacity: calc(var(--o) * 0.25); transform: scale(0.85); }
          50%     { opacity: var(--o); transform: scale(1); }
        }

        /* Poeira luminosa: pontos maiores subindo devagar pela cena. */
        .nrx-dust {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, rgba(180,132,255,0.9) 0%, rgba(124,58,237,0.15) 60%, transparent 72%);
          animation: nrx-float-up var(--dur) linear infinite;
          animation-delay: var(--delay);
        }
        @keyframes nrx-float-up {
          0%   { transform: translate3d(0, 14vh, 0); opacity: 0; }
          12%  { opacity: 0.75; }
          88%  { opacity: 0.5; }
          100% { transform: translate3d(2vw, -22vh, 0); opacity: 0; }
        }

        .nrx-grain {
          opacity: 0.028;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: nrx-grain 9s steps(8) infinite;
        }
        @keyframes nrx-grain {
          0%,100% { transform: translate(0,0); }
          20% { transform: translate(-2%,-3%); }
          40% { transform: translate(2%,-2%); }
          60% { transform: translate(3%,2%); }
          80% { transform: translate(-1%,2%); }
        }

        .nrx-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 90% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%),
            linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 22%, transparent 74%, rgba(0,0,0,0.55) 100%);
        }

        /* Parallax — cada camada responde num fator diferente. */
        .nrx-par-1 { transform: translate3d(calc(var(--px) * 26px), calc(var(--py) * 20px), 0); transition: transform 1.4s cubic-bezier(0.16,1,0.3,1); }
        .nrx-par-2 { transform: translate3d(calc(var(--px) * -14px), calc(var(--py) * -11px), 0); transition: transform 1.6s cubic-bezier(0.16,1,0.3,1); }
        .nrx-par-3 { transform: translate3d(calc(var(--px) * 9px), calc(var(--py) * 7px), 0); transition: transform 1.8s cubic-bezier(0.16,1,0.3,1); }

        /* ══════════ HERO BAR ══════════ */
        .nrx-bar-wrap {
          position: absolute; top: clamp(14px, 2.2vh, 22px); left: 50%;
          transform: translateX(-50%);
          z-index: 40; max-width: calc(100vw - 24px);
        }
        .nrx-bar {
          display: flex; align-items: center; gap: 4px;
          padding: 7px 7px 7px 24px;
          background: rgba(12,12,16,0.72);
          backdrop-filter: blur(26px) saturate(1.5);
          -webkit-backdrop-filter: blur(26px) saturate(1.5);
          border: 1px solid var(--nrx-line);
          border-radius: 100px;
          box-shadow: 0 14px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .nrx-wordmark {
          font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.88rem;
          letter-spacing: -0.4px; color: var(--nrx-violet); margin-right: 18px;
          text-decoration: none; white-space: nowrap;
        }
        .nrx-wordmark span { color: rgba(255,255,255,0.32); }
        .nrx-home .nrx-wordmark { transition: opacity 0.3s ease; }
        .nrx-home .nrx-wordmark:hover { opacity: 0.82; }

        .nrx-home .nrx-navitem {
          position: relative; background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 0.83rem; font-weight: 500;
          color: rgba(255,255,255,0.55); padding: 10px 17px; border-radius: 100px;
          white-space: nowrap;
          transition: color 0.35s ease, background 0.35s ease;
        }
        .nrx-home .nrx-navitem::after {
          content: ''; position: absolute; left: 50%; bottom: 5px;
          width: 0; height: 1px; background: var(--nrx-violet-soft);
          transform: translateX(-50%); opacity: 0;
          transition: width 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease;
        }
        .nrx-home .nrx-navitem:hover,
        .nrx-home .nrx-navitem[aria-expanded="true"] { color: var(--nrx-fg); background: rgba(255,255,255,0.05); }
        .nrx-home .nrx-navitem:hover::after,
        .nrx-home .nrx-navitem[aria-expanded="true"]::after { width: 16px; opacity: 0.9; }

        .nrx-bar-actions { display: flex; align-items: center; gap: 5px; margin-left: 9px; }

        .nrx-home .nrx-avatar {
          display: flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
          background: rgba(124,58,237,0.10); border: 1px solid rgba(124,58,237,0.22);
          color: var(--nrx-violet-soft);
          transition: background 0.35s ease, border-color 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nrx-home .nrx-avatar:hover { background: rgba(124,58,237,0.2); border-color: rgba(124,58,237,0.45); transform: translateY(-1px); }
        .nrx-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .nrx-home .nrx-burger {
          display: none; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%; padding: 0; cursor: pointer;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          color: var(--nrx-fg);
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .nrx-home .nrx-burger:hover { background: rgba(124,58,237,0.14); border-color: rgba(124,58,237,0.3); }

        /* ══════════ POPOVERS ══════════ */
        .nrx-pop {
          position: absolute; top: calc(100% + 10px); left: 50%;
          transform: translateX(-50%);
          min-width: 232px; padding: 8px;
          background: var(--nrx-glass-strong);
          backdrop-filter: blur(26px) saturate(1.4);
          -webkit-backdrop-filter: blur(26px) saturate(1.4);
          border: 1px solid var(--nrx-line); border-radius: 18px;
          box-shadow: 0 22px 60px rgba(0,0,0,0.55);
          animation: nrx-pop-in 0.34s cubic-bezier(0.16,1,0.3,1) both;
          z-index: 45;
        }
        @keyframes nrx-pop-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .nrx-pop-text {
          display: block; padding: 8px 12px 10px; font-size: 0.78rem; line-height: 1.55;
          color: var(--nrx-muted); border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 6px;
        }
        .nrx-home .nrx-pop-item {
          display: block; width: 100%; text-align: left;
          padding: 9px 12px; border-radius: 11px; border: none; background: none;
          font-family: inherit; font-size: 0.82rem; font-weight: 500;
          color: rgba(255,255,255,0.66); text-decoration: none; cursor: pointer;
          transition: color 0.28s ease, background 0.28s ease, padding-left 0.28s ease;
        }
        .nrx-home .nrx-pop-item:hover {
          color: var(--nrx-fg); background: rgba(124,58,237,0.14); padding-left: 16px;
        }

        /* Folha do menu mobile — fica dentro da viewport, nunca cria rolagem. */
        .nrx-sheet {
          position: absolute; top: clamp(66px, 9vh, 78px); left: 12px; right: 12px;
          z-index: 44; padding: 10px;
          background: var(--nrx-glass-strong);
          backdrop-filter: blur(26px) saturate(1.4);
          -webkit-backdrop-filter: blur(26px) saturate(1.4);
          border: 1px solid var(--nrx-line); border-radius: 22px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
          animation: nrx-sheet-in 0.36s cubic-bezier(0.16,1,0.3,1) both;
          max-height: min(70vh, 470px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none;
          -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 22px), transparent 100%);
          mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 22px), transparent 100%);
        }
        .nrx-sheet::-webkit-scrollbar { display: none; }
        @keyframes nrx-sheet-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nrx-sheet .nrx-pop-item { padding: 8px 12px; }
        .nrx-sheet-group + .nrx-sheet-group { margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); }
        .nrx-sheet-title {
          display: block; padding: 5px 12px 3px; font-size: 0.62rem; font-weight: 700;
          letter-spacing: 1.6px; text-transform: uppercase; color: rgba(255,255,255,0.28);
        }

        /* ══════════ PALCO ══════════ */
        .nrx-stage {
          position: relative; z-index: 10;
          height: 100%; width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          align-items: center;
          gap: clamp(28px, 5vw, 96px);
          /* Rodapé maior que o topo: com align-items: center isso sobe o
             conjunto alguns pixels acima do meio óptico da tela. */
          padding: clamp(92px, 12vh, 128px) clamp(24px, 6vw, 92px) clamp(72px, 16vh, 190px);
          max-width: 1560px; margin: 0 auto;
        }

        /* ── Lado esquerdo ── */
        .nrx-eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: 'JetBrains Mono', monospace; font-size: clamp(0.66rem, 0.72vw, 0.78rem); font-weight: 500;
          letter-spacing: 2.6px; text-transform: uppercase;
          color: rgba(255,255,255,0.38); margin-bottom: clamp(18px, 3vh, 28px);
          animation: nrx-rise 0.9s cubic-bezier(0.16,1,0.3,1) both;
        }
        .nrx-eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%; background: var(--nrx-violet);
          box-shadow: 0 0 10px rgba(124,58,237,0.9);
          animation: nrx-pulse 3.2s ease-in-out infinite;
        }
        @keyframes nrx-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes nrx-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .nrx-headline {
          font-size: clamp(2.1rem, 5.3vw, 5.15rem);
          line-height: 1.06; font-weight: 800; letter-spacing: -2px;
          margin: 0 0 clamp(16px, 2.6vh, 26px);
          max-width: 12ch;
          text-wrap: balance;
        }
        .nrx-headline-accent {
          color: var(--nrx-violet-soft);
          text-shadow: 0 0 44px rgba(124,58,237,0.5);
        }
        .nrx-caret {
          display: inline-block; width: 3px; height: 0.86em;
          margin-left: 6px; vertical-align: -0.08em;
          background: var(--nrx-violet);
          box-shadow: 0 0 14px rgba(124,58,237,0.8);
          animation: nrx-blink 1.05s step-end infinite;
        }
        @keyframes nrx-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

        .nrx-sub {
          font-size: clamp(0.9rem, 1.12vw, 1.16rem); line-height: 1.65;
          color: var(--nrx-muted); margin: 0;
          white-space: nowrap; /* uma linha só no desktop */
          animation: nrx-rise 1.1s cubic-bezier(0.16,1,0.3,1) 0.35s both;
        }

        /* ── Caixa de acesso ── */
        /* O padding do wrap é a folga onde as órbitas vivem: elas ficam
           dentro da caixa (<= 100%), então não geram overflow em lugar
           nenhum — nem no palco, nem no documento. */
        .nrx-auth-wrap {
          position: relative; justify-self: center;
          width: min(100%, clamp(470px, 33vw, 552px));
          padding: clamp(22px, 3.4vh, 40px) clamp(16px, 2.4vw, 40px);
          display: flex; align-items: center; justify-content: center;
        }

        /* Recorte das órbitas: a caixa de layout de uma elipse girando cresce
           (é um retângulo rodando), e esse crescimento entraria na área
           rolável. A elipse desenhada, porém, nunca passa do maior eixo — ou
           seja, o que este overflow: hidden corta são só os cantos vazios. */
        .nrx-orbits { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .nrx-orbits::before {
          content: ''; position: absolute; left: 50%; top: 50%;
          width: 108%; height: 108%; transform: translate(-50%,-50%);
          background: radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.06) 42%, transparent 68%);
          filter: blur(28px);
          animation: nrx-halo 12s ease-in-out infinite;
        }
        @keyframes nrx-halo {
          0%,100% { opacity: 0.65; transform: translate(-50%,-50%) scale(0.97); }
          50%     { opacity: 1; transform: translate(-50%,-50%) scale(1.04); }
        }

        .nrx-orbit {
          position: absolute; top: 50%; left: 50%;
          border: 1px solid rgba(124,58,237,0.34);
          border-radius: 50%; pointer-events: none;
        }
        /* Medidas por largura + aspect-ratio (nunca por height): girando, a
           caixa de uma elipse cresce até o seu maior eixo. Mantendo o maior
           eixo <= 100% da largura do wrap, a órbita nunca escapa da caixa —
           é isso que garante zero rolagem horizontal enquanto ela gira. */
        .nrx-orbit.o1 { width: 100%; aspect-ratio: 1.16; animation: nrx-orbit-spin 34s linear infinite; }
        .nrx-orbit.o2 { width: 84%; aspect-ratio: 0.87; border-color: rgba(180,132,255,0.26); animation: nrx-orbit-spin 52s linear infinite reverse; }
        .nrx-orbit.o3 { width: 100%; aspect-ratio: 1.46; border-color: rgba(124,58,237,0.2); animation: nrx-orbit-spin 76s linear infinite; }
        @keyframes nrx-orbit-spin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        .nrx-orbit-dot {
          position: absolute; top: -3px; left: 50%; margin-left: -3px;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--nrx-violet-soft);
          box-shadow: 0 0 12px 2px rgba(180,132,255,0.75);
        }
        .nrx-orbit.o2 .nrx-orbit-dot { top: auto; bottom: -2.5px; width: 5px; height: 5px; background: #ffffff; box-shadow: 0 0 10px 2px rgba(255,255,255,0.55); }
        .nrx-orbit.o3 .nrx-orbit-dot { left: 100%; top: 50%; margin: -2px 0 0 -2px; width: 4px; height: 4px; box-shadow: 0 0 9px 2px rgba(124,58,237,0.7); }

        .nrx-card {
          position: relative; width: 100%; z-index: 2; text-align: left;
          padding: clamp(24px, 3.4vh, 38px) clamp(22px, 2.6vw, 36px);
          border-radius: 28px;
          background: linear-gradient(155deg, rgba(34,28,56,0.72) 0%, rgba(11,11,18,0.82) 55%, rgba(20,14,34,0.76) 100%);
          backdrop-filter: blur(30px) saturate(1.5);
          -webkit-backdrop-filter: blur(30px) saturate(1.5);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow:
            0 46px 100px -32px rgba(0,0,0,0.9),
            0 0 74px -30px rgba(124,58,237,0.5),
            inset 0 1px 0 rgba(255,255,255,0.12);
          animation: nrx-card-in 1s cubic-bezier(0.16,1,0.3,1) 0.2s both;
        }
        @keyframes nrx-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Energia percorrendo o contorno: cônica girando, recortada na borda. */
        @supports ((-webkit-mask-composite: xor) or (mask-composite: exclude)) {
          .nrx-card-edge {
            position: absolute; inset: 0; border-radius: inherit; overflow: hidden;
            padding: 1px; pointer-events: none;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask-composite: exclude;
          }
          .nrx-card-edge::after {
            content: ''; position: absolute; left: 50%; top: 50%;
            width: 190%; height: 190%; margin: -95% 0 0 -95%;
            background: conic-gradient(from 0deg,
              transparent 0deg, transparent 190deg,
              rgba(124,58,237,0.35) 236deg,
              rgba(180,132,255,0.95) 266deg,
              rgba(255,255,255,0.95) 274deg,
              rgba(124,58,237,0.4) 302deg,
              transparent 344deg);
            animation: nrx-edge-spin 7.5s linear infinite;
          }
        }
        @keyframes nrx-edge-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .nrx-card-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: clamp(40px, 2.5vw, 46px); height: clamp(40px, 2.5vw, 46px); border-radius: 14px;
          background: linear-gradient(140deg, rgba(124,58,237,0.9), rgba(76,29,149,0.85));
          border: 1px solid rgba(180,132,255,0.35);
          color: #fff; box-shadow: 0 10px 26px -10px rgba(124,58,237,0.9);
        }
        .nrx-card-brand {
          display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
        }
        .nrx-card-name {
          font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: clamp(0.92rem, 0.98vw, 1.04rem);
          letter-spacing: -0.3px; color: var(--nrx-violet);
        }
        .nrx-card-name span { color: rgba(255,255,255,0.34); }
        .nrx-card-tagline {
          font-size: clamp(0.86rem, 0.92vw, 0.98rem); color: rgba(255,255,255,0.56);
          margin: 0 0 clamp(16px, 2.4vh, 26px);
        }

        .nrx-field + .nrx-field { margin-top: 12px; }
        .nrx-label {
          display: block; font-size: clamp(0.72rem, 0.76vw, 0.8rem); font-weight: 600; letter-spacing: 0.3px;
          color: rgba(255,255,255,0.6); margin-bottom: 8px;
        }
        .nrx-home .nrx-input {
          width: 100%; height: clamp(42px, 5.2vh, 54px);
          padding: 0 16px; border-radius: 14px;
          background: var(--nrx-input); border: 1px solid rgba(255,255,255,0.14);
          color: var(--nrx-fg); font-family: inherit; font-size: clamp(0.9rem, 0.94vw, 0.98rem); outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .nrx-home .nrx-input::placeholder { color: rgba(255,255,255,0.28); }
        .nrx-home .nrx-input:hover:not(:focus) { border-color: rgba(255,255,255,0.2); }
        .nrx-home .nrx-input:focus {
          border-color: rgba(124,58,237,0.75); background: rgba(124,58,237,0.09);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.16);
        }
        .nrx-home .nrx-eye {
          position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
          width: 34px; height: 34px; border-radius: 9px; border: none; background: none;
          color: rgba(255,255,255,0.42); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: color 0.25s ease, background 0.25s ease;
        }
        .nrx-home .nrx-eye:hover { color: var(--nrx-fg); background: rgba(255,255,255,0.07); }

        .nrx-home .nrx-primary {
          width: 100%; height: clamp(44px, 5.4vh, 56px); margin-top: clamp(16px, 2.4vh, 24px);
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 14px; cursor: pointer;
          background: linear-gradient(120deg, #7C3AED 0%, #9257f5 55%, #6d28d9 100%);
          color: #fff; font-family: inherit; font-size: clamp(0.92rem, 0.96vw, 1rem); font-weight: 700;
          box-shadow: 0 16px 34px -16px rgba(124,58,237,0.95);
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s ease, filter 0.28s ease;
        }
        .nrx-home .nrx-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 22px 44px -16px rgba(124,58,237,1); filter: brightness(1.06); }
        .nrx-home .nrx-primary:active:not(:disabled) { transform: translateY(0); }
        .nrx-home .nrx-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .nrx-home .nrx-primary svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nrx-home .nrx-primary:hover:not(:disabled) svg { transform: translateX(4px); }

        .nrx-divider {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin: clamp(14px, 2.2vh, 22px) 0 11px;
          font-size: clamp(0.78rem, 0.82vw, 0.86rem); color: rgba(255,255,255,0.38);
        }
        .nrx-divider::before, .nrx-divider::after {
          content: ''; height: 1px; flex: 1; background: rgba(255,255,255,0.08);
        }

        .nrx-home .nrx-secondary {
          width: 100%; height: clamp(40px, 4.9vh, 52px);
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 14px; cursor: pointer; text-decoration: none;
          background: rgba(255,255,255,0.035); border: 1px solid rgba(180,132,255,0.26);
          color: rgba(255,255,255,0.88); font-family: inherit; font-size: clamp(0.88rem, 0.92vw, 0.96rem); font-weight: 600;
          transition: background 0.28s ease, border-color 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .nrx-home .nrx-secondary:hover { background: rgba(124,58,237,0.16); border-color: rgba(180,132,255,0.55); transform: translateY(-2px); }
        .nrx-home .nrx-secondary svg { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nrx-home .nrx-secondary:hover svg { transform: translateX(4px); }

        .nrx-home .nrx-forgot {
          font-size: clamp(0.74rem, 0.78vw, 0.82rem); color: rgba(255,255,255,0.44); text-decoration: none;
          transition: color 0.25s ease;
        }
        .nrx-home .nrx-forgot:hover { color: var(--nrx-violet-soft); }

        .nrx-connected {
          font-size: clamp(0.86rem, 0.92vw, 0.98rem); line-height: 1.6;
          color: rgba(255,255,255,0.62); margin: 0;
        }
        .nrx-connected strong { color: var(--nrx-violet-soft); font-weight: 600; }

        .nrx-error {
          display: flex; gap: 8px; margin-top: 14px; padding: 10px 12px;
          background: rgba(255,80,80,0.09); border: 1px solid rgba(255,80,80,0.25);
          border-radius: 11px; font-size: 0.8rem; line-height: 1.45; color: #ff9090;
        }

        /* ══════════ RESPONSIVO ══════════ */
        @media (max-width: 1080px) {
          .nrx-stage { gap: clamp(20px, 3vw, 44px); }
          .nrx-headline { letter-spacing: -1.4px; }
        }

        @media (max-width: 900px) {
          .nrx-bar { padding: 5px 5px 5px 16px; gap: 2px; }
          .nrx-bar .nrx-navitem { display: none; }
          .nrx-home .nrx-burger { display: flex; }

          .nrx-stage {
            grid-template-columns: minmax(0, 1fr);
            align-content: center;
            justify-items: center;
            text-align: center;
            gap: clamp(18px, 3.4vh, 30px);
            padding: clamp(86px, 12vh, 108px) 20px clamp(24px, 4vh, 40px);
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-width: none;
          }
          .nrx-stage::-webkit-scrollbar { display: none; }
          .nrx-copy { display: flex; flex-direction: column; align-items: center; }
          .nrx-headline {
            font-size: clamp(1.75rem, 7.4vw, 2.5rem);
            max-width: 16ch; letter-spacing: -1px; margin-bottom: 10px;
          }
          .nrx-sub { max-width: 30ch; font-size: 0.86rem; white-space: normal; }
          .nrx-eyebrow { margin-bottom: 12px; font-size: 0.6rem; letter-spacing: 2px; }
          .nrx-auth-wrap { width: min(100%, 412px); padding: clamp(14px, 2.2vh, 24px) 22px; }
          .nrx-orbit.o3 { display: none; }
          .nrx-card { border-radius: 22px; }
        }

        @media (max-width: 900px) and (max-height: 720px) {
          .nrx-card-brand { margin-bottom: 10px; }
          .nrx-card-tagline { margin-bottom: 14px; font-size: 0.8rem; }
          .nrx-headline { font-size: clamp(1.5rem, 6.4vw, 2rem); }
          .nrx-sub { display: none; }
        }

        @media (max-width: 380px) {
          .nrx-wordmark { margin-right: 8px; font-size: 0.76rem; }
          .nrx-card { padding: 20px 18px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nrx-home *,
          .nrx-home *::before,
          .nrx-home *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
          .nrx-caret { animation: nrx-blink 1.05s step-end infinite !important; }
        }
      `}</style>

      {/* ═══ ATMOSFERA ═══ */}
      <div className="nrx-layer nrx-par-1" aria-hidden="true">
        <div className="nrx-neb a" />
        <div className="nrx-neb b" />
        <div className="nrx-neb c" />
      </div>

      <div className="nrx-layer nrx-grid nrx-par-3" aria-hidden="true" />

      <div className="nrx-layer nrx-par-2" aria-hidden="true">
        {estrelas.map((e) => (
          <span
            key={e.id}
            className="nrx-star"
            style={{
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              opacity: "var(--nrx-star-opacity)",
              "--o": e.opacity,
              "--dur": `${e.duration}s`,
              "--delay": `${e.delay}s`,
            }}
          />
        ))}
        {estrelas.slice(0, 9).map((e) => (
          <span
            key={`d-${e.id}`}
            className="nrx-dust"
            style={{
              top: `${(e.top + 18) % 100}%`,
              left: `${(e.left + 33) % 100}%`,
              width: e.size * 2.6,
              height: e.size * 2.6,
              "--dur": `${28 + e.duration * 3}s`,
              "--delay": `${e.delay * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="nrx-layer nrx-grain" aria-hidden="true" />
      <div className="nrx-vignette" aria-hidden="true" />

      {/* ═══ HERO BAR ═══ */}
      <div className="nrx-bar-wrap">
        <nav className="nrx-bar" aria-label="Principal">
          <Link to="/" className="nrx-wordmark">NORA<span>TECH</span></Link>

          {MENU_KEYS.map((chave) => (
            <div key={chave} style={{ position: "relative" }}>
              <button
                type="button"
                className="nrx-navitem"
                aria-haspopup="true"
                aria-expanded={menuAberto === chave}
                onClick={() => setMenuAberto((atual) => (atual === chave ? null : chave))}
              >
                {MENUS[chave].label}
              </button>
              {menuAberto === chave && (
                <div className="nrx-pop" role="menu">
                  {MENUS[chave].text && <span className="nrx-pop-text">{MENUS[chave].text}</span>}
                  {MENUS[chave].items.map((item) => renderItemMenu(item, chave))}
                </div>
              )}
            </div>
          ))}

          <div className="nrx-bar-actions">
            <button
              type="button"
              className="nrx-burger"
              aria-label="Abrir menu"
              aria-expanded={menuMobile}
              onClick={() => { setMenuAberto(null); setMenuMobile((v) => !v); }}
            >
              {menuMobile ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
              )}
            </button>
            <ThemeToggle style={{ width: 38, height: 38 }} />
            <Link
              to={user ? "/area-do-cliente" : "/login"}
              className="nrx-avatar"
              title={user ? "Central de Controle" : "Área de membro"}
              aria-label={user ? "Central de Controle" : "Área de membro"}
            >
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="" />
                : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                )}
            </Link>
          </div>
        </nav>
      </div>

      {/* ═══ MENU MOBILE ═══ */}
      {menuMobile && (
        <div className="nrx-sheet">
          {MENU_KEYS.map((chave) => (
            <div className="nrx-sheet-group" key={chave}>
              <span className="nrx-sheet-title">{MENUS[chave].label}</span>
              {MENUS[chave].items.map((item) => renderItemMenu(item, chave))}
            </div>
          ))}
        </div>
      )}

      {/* ═══ PALCO ═══ */}
      <main className="nrx-stage">
        <div className="nrx-copy">
          <div className="nrx-eyebrow">
            <span className="nrx-eyebrow-dot" />
            Noratech • Digital Systems
          </div>

          <h1 className="nrx-headline">
            {prefixoVisivel}
            <span className="nrx-headline-accent">{acentoVisivel}</span>
            <span className="nrx-caret" aria-hidden="true" />
          </h1>

          <p className="nrx-sub">Tecnologia criada para simplificar o complexo.</p>
        </div>

        <div className="nrx-auth-wrap">
          <div className="nrx-orbits" aria-hidden="true">
            <div className="nrx-orbit o1"><span className="nrx-orbit-dot" /></div>
            <div className="nrx-orbit o2"><span className="nrx-orbit-dot" /></div>
            <div className="nrx-orbit o3"><span className="nrx-orbit-dot" /></div>
          </div>

          <section className="nrx-card" aria-label="Acesso">
            <div className="nrx-card-edge" aria-hidden="true" />

            <div className="nrx-card-brand">
              <MarcaNora />
              <span className="nrx-card-name">NORA<span>TECH</span></span>
            </div>
            <p className="nrx-card-tagline">Seu acesso ao próximo nível.</p>

            {user ? (
              <>
                <p className="nrx-connected">
                  Você já está conectado como <strong>{user.email}</strong>.
                </p>
                <Link to="/area-do-cliente" className="nrx-primary" style={{ textDecoration: "none" }}>
                  Entrar na plataforma <SetaIcon />
                </Link>
              </>
            ) : (
              <>
                <form onSubmit={entrar} noValidate>
                  <div className="nrx-field">
                    <label className="nrx-label" htmlFor="nrx-email">E-mail</label>
                    <input
                      id="nrx-email"
                      className="nrx-input"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="nrx-field">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <label className="nrx-label" htmlFor="nrx-senha" style={{ marginBottom: 0 }}>Senha</label>
                      <Link to="/recuperar-senha" className="nrx-forgot">Esqueci minha senha</Link>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        id="nrx-senha"
                        className="nrx-input"
                        type={verSenha ? "text" : "password"}
                        placeholder="Sua senha"
                        value={senha}
                        onChange={(ev) => setSenha(ev.target.value)}
                        autoComplete="current-password"
                        required
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        className="nrx-eye"
                        onClick={() => setVerSenha((v) => !v)}
                        aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                      >
                        <OlhoIcon aberto={verSenha} />
                      </button>
                    </div>
                  </div>

                  {erro && (
                    <div role="alert" className="nrx-error">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{erro}</span>
                    </div>
                  )}

                  <button type="submit" className="nrx-primary" disabled={carregando}>
                    {carregando ? "Entrando..." : <>Entrar <SetaIcon /></>}
                  </button>
                </form>

                <div className="nrx-divider">Não tem conta?</div>

                <Link to="/registro" className="nrx-secondary">
                  Registre-se <SetaIcon />
                </Link>
              </>
            )}
          </section>
        </div>
      </main>

      <MeetingScheduler isOpen={schedulerOpen} onClose={() => setSchedulerOpen(false)} />
    </div>
  );
}
