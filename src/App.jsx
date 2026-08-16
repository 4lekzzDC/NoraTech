import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import MeetingScheduler from "./components/MeetingScheduler";
import NoriRobot from "./components/NoriRobot";
import ThemeToggle from "./components/ThemeToggle";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";

// ═══════════════════════════════════════════════════════════════
// Noratech — Institutional website
// Engenharia de software, automação e integrações para empresas.
// ═══════════════════════════════════════════════════════════════

const SERVICES = [
  {
    num: "S.01",
    icon: "🛠️",
    title: "Desenvolvimento de sistemas personalizados",
    desc: "Aplicações web e mobile construídas sob medida para o fluxo da sua empresa — com arquitetura escalável, código proprietário e manutenção contínua pela nossa equipe.",
    tags: ["Web & Mobile", "API & Backend", "Arquitetura escalável"],
  },
  {
    num: "S.02",
    icon: "⚙️",
    title: "Automação de processos",
    desc: "Transformamos tarefas manuais e repetitivas em fluxos automáticos — operações internas, atendimento, notificações e aprovações — reduzindo custo operacional e erro humano.",
    tags: ["Workflows", "RPA", "Triggers & eventos"],
  },
  {
    num: "S.03",
    icon: "📊",
    title: "Dashboards e indicadores",
    desc: "Painéis em tempo real que consolidam dados de vendas, finanças e operação em KPIs claros — para decisões rápidas, baseadas em fato e não em planilha desatualizada.",
    tags: ["BI & Analytics", "KPIs em tempo real", "Relatórios automáticos"],
  },
  {
    num: "S.04",
    icon: "🔗",
    title: "Integração entre sistemas",
    desc: "Conectamos ERP, CRM, WhatsApp, gateways de pagamento e APIs externas em um fluxo único — eliminando planilhas intermediárias e retrabalho entre áreas.",
    tags: ["APIs & Webhooks", "ERP / CRM", "Migração de dados"],
  },
];

// O que a automação entrega, em uma linha cada — é a promessa do hero
// traduzida em benefício concreto, logo abaixo da primeira dobra.
const HERO_BENEFITS = [
  {
    title: "Mais rapidez",
    desc: "Processos ágeis que economizam tempo.",
    icon: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />,
  },
  {
    title: "Menos erros",
    desc: "Redução de falhas humanas e retrabalho.",
    icon: <><path d="M12 3l7.5 3v6.2c0 4.6-3.1 8.2-7.5 9.3-4.4-1.1-7.5-4.7-7.5-9.3V6z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.4" /></>,
  },
  {
    title: "Padronização",
    desc: "Fluxos consistentes e dados confiáveis.",
    icon: <><path d="M4 20h16" /><path d="M7.5 20v-7" /><path d="M12 20V6" /><path d="M16.5 20v-10" /></>,
  },
  {
    title: "Escalabilidade",
    desc: "Soluções que crescem com o seu negócio.",
    icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.3l3.4 2" /></>,
  },
];

const HERO_STATS = [
  ["50+", "Clientes"],
  ["200+", "Automações"],
  ["99.9%", "Uptime"],
  ["24/7", "Suporte"],
];

const DIFFERENTIALS = [
  {
    num: "01",
    title: "Foco em resultado, não em hora trabalhada",
    desc: "Contratamos por escopo e impacto. Medimos sucesso em processos automatizados, horas economizadas e redução de custo operacional — não em relatório de horas cobradas.",
  },
  {
    num: "02",
    title: "Sob medida, nunca template",
    desc: "Cada sistema nasce do fluxo real da sua empresa. Código proprietário, arquitetura auditável e evolução guiada pelo seu negócio — sem amarração a ferramentas de terceiros.",
  },
  {
    num: "03",
    title: "Estratégia e execução no mesmo time",
    desc: "Diagnóstico, arquitetura, desenvolvimento e operação conduzidos por uma equipe única. Sem repasse entre fornecedores, sem perda de contexto entre as fases do projeto.",
  },
  {
    num: "04",
    title: "Automação como princípio, não como plugin",
    desc: "Antes de escrever uma linha de código, mapeamos e organizamos o processo. Automatizar o caos só gera caos mais rápido — entregamos fluxo simples antes de virar software.",
  },
  {
    num: "05",
    title: "Engenharia responsável, stack moderno",
    desc: "Tecnologias atuais aplicadas com critério — priorizamos performance, segurança e custo operacional previsível. Nada de stack da moda sem justificativa técnica para o seu caso.",
  },
  {
    num: "06",
    title: "Suporte contínuo e SLA transparente",
    desc: "Após o deploy, o sistema segue sob nosso monitoramento 24/7. SLA definido em contrato, relatórios mensais de saúde da operação e roadmap de melhorias compartilhado com o cliente.",
  },
];

const PRODUCTS = [
  { id: 2, icon: "💬", name: "WhatsApp Bot", desc: "Sistema de atendimento via WhatsApp que categoriza conversas, realiza o pré-atendimento e organiza o fluxo antes da interação humana.", tags: ["Chatbot", "WhatsApp API", "NLP"], color: "#25D366", featured: true, features: ["Atendimento automatizado 24/7", "Categorização por intenção (NLP)", "Pré-atendimento e triagem inteligente", "Transferência fluida para humanos", "Relatórios de atendimento e métricas"] },
  { id: 4, icon: "🌐", name: "Sites para Empresas", desc: "Criação de sites profissionais com IA, adaptados ao modelo e necessidade de cada cliente. Design moderno, responsivo e otimizado para conversão.", tags: ["Web Design", "IA", "SEO"], color: "#ff6b9d", featured: true, features: ["Design personalizado gerado com IA", "Layout 100% responsivo (mobile/tablet/desktop)", "SEO técnico e performance otimizada", "Integrações (pagamento, CRM, analytics)", "Hospedagem, deploy e suporte contínuo"] },
  { id: 1, icon: "💰", name: "Finzo App", desc: "Plataforma de gestão financeira inteligente que conecta contas, organiza movimentações e transforma dados em análises claras sobre gastos, rendimento e oportunidades de economia.", tags: ["FinTech", "Analytics", "Open Finance"], color: "#7C3AED", featured: true, features: ["Integração via Open Finance com bancos", "Categorização automática de transações", "Análises e insights com IA", "Metas de economia e alertas inteligentes", "Dashboard unificado em tempo real"] },
];

const TESTIMONIALS = [
  { name: "Juliana Martins", role: "Empresária — Studio JM", text: "O site que criaram para minha empresa triplicou os contatos pelo WhatsApp no primeiro mês. Design incrível.", initials: "JM" },
  { name: "Ana Ferreira", role: "Gerente — Clínica Vitale", text: "O WhatsApp Bot organiza todo nosso atendimento. O pré-atendimento filtra 70% das dúvidas antes de chegar na recepção.", initials: "AF" },
  { name: "Carlos Mendes", role: "CFO — Grupo Orion", text: "Estou testando o Finzo e a visão que ele dá sobre gastos e rendimentos é algo que nenhum app de banco oferece.", initials: "CM" },
];

const FAQS = {
  "Finzo App": [
    { q: "Como funciona o Finzo App?", a: "O Finzo conecta suas contas bancárias via Open Finance, organiza todas as movimentações automaticamente e gera análises visuais sobre seus gastos, rendimento e oportunidades de economia." },
    { q: "O Finzo é seguro para conectar minhas contas?", a: "Sim. A conexão é feita via Open Finance, regulamentado pelo Banco Central. O Finzo não armazena senhas bancárias e todos os dados são criptografados de ponta a ponta." },
    { q: "Posso testar o Finzo gratuitamente?", a: "Sim, o Finzo terá um período de teste gratuito para novos usuários. Você poderá explorar todas as funcionalidades — integração bancária, categorização automática e insights com IA — sem compromisso." },
    { q: "Quais bancos são compatíveis com o Finzo?", a: "O Finzo se integra com todas as instituições participantes do Open Finance no Brasil, incluindo os principais bancos e fintechs. A lista é atualizada automaticamente conforme novas instituições aderem." },
  ],
  "WhatsApp Bot": [
    { q: "O WhatsApp Bot precisa de número comercial?", a: "Sim, utilizamos a API oficial do WhatsApp Business. Configuramos tudo para você — desde a categorização automática de conversas até o fluxo de pré-atendimento antes da interação humana." },
    { q: "O bot consegue atender fora do horário comercial?", a: "Sim, o atendimento automatizado funciona 24/7. O bot realiza a triagem, responde dúvidas frequentes e coleta informações do cliente. Quando necessário, agenda o contato humano para o próximo horário disponível." },
    { q: "É possível personalizar as respostas do bot?", a: "Totalmente. O bot é treinado com o fluxo e a linguagem da sua empresa. Você define os temas, respostas e regras de encaminhamento para que o atendimento reflita a identidade do seu negócio." },
  ],
  "Sites": [
    { q: "Quanto tempo leva para criar um site?", a: "Sites profissionais ficam prontos em 1 a 3 semanas dependendo da complexidade. Cada site é adaptado ao negócio do cliente com design moderno, responsivo e otimizado para conversão." },
    { q: "O site é otimizado para celular e SEO?", a: "Sim. Todos os sites são 100% responsivos (mobile, tablet e desktop) e incluem SEO técnico desde o início — estrutura semântica, performance otimizada e boas práticas para ranqueamento no Google." },
    { q: "O que está incluso após a entrega do site?", a: "O pacote inclui hospedagem, deploy e suporte contínuo. Também realizamos atualizações de conteúdo, monitoramento de performance e ajustes técnicos para manter seu site sempre no ar e atualizado." },
  ],
};

// ═══ Intersection Observer Hook ═══
function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); obs.unobserve(el); }
    }, { threshold: 0.1, rootMargin: "0px 0px -60px 0px", ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, isInView];
}

// ═══ Animated element wrapper ═══
function Reveal({ children, type = "up", delay = 0, className = "", style = {} }) {
  const [ref, inView] = useInView();
  const transforms = { up: "translateY(70px)", left: "translateX(-70px)", right: "translateX(70px)", scale: "scale(0.92)", rotateL: "perspective(900px) rotateY(-6deg) translateX(-30px)", rotateR: "perspective(900px) rotateY(6deg) translateX(30px)" };
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "none" : transforms[type],
      transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      ...style
    }}>
      {children}
    </div>
  );
}

// ═══ Decorative Star SVG ═══
function Star({ size = 20, color = "#7C3AED", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, ...style }}>
      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" />
    </svg>
  );
}

// ═══ Decorative Diamond ═══
function Diamond({ size = 12, color = "rgba(124, 58, 237,0.3)", style = {} }) {
  return <div style={{ width: size, height: size, background: color, transform: "rotate(45deg)", borderRadius: 2, flexShrink: 0, ...style }} />;
}

// ═══ Window Chrome (macOS style) ═══
function WinBar({ title = "", dark = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 14px", background: dark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f57" }} />
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#febc2e" }} />
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#28c840" }} />
      {title && <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginLeft: 6 }}>{title}</span>}
    </div>
  );
}

// ═══ STATUS BADGE ═══
function StatusBadge({ status }) {
  const config = { live: { bg: "rgba(0,212,138,0.1)", color: "#00d48a", border: "rgba(0,212,138,0.2)", label: "● Operacional" }, dev: { bg: "rgba(37, 99, 235,0.1)", color: "#2563EB", border: "rgba(37, 99, 235,0.2)", label: "● Em Dev" }, soon: { bg: "rgba(255,138,61,0.1)", color: "#ff8a3d", border: "rgba(255,138,61,0.2)", label: "● Em Breve" } };
  const c = config[status];
  return <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}</span>;
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeFaqTab, setActiveFaqTab] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [formStep, setFormStep] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY); setNavScrolled(window.scrollY > 60); };
    const onMouse = (e) => setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("mousemove", onMouse); };
  }, []);

  // Rede de segurança: se o link de recuperação de senha cair aqui (porque
  // a redirect_to configurada no Supabase ainda não bate exatamente com
  // /redefinir-senha, e por isso ele volta pra Site URL), reencaminha
  // preservando o "code" pra ResetPasswordPage terminar a troca de sessão.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("code")) {
      navigate(`/redefinir-senha${window.location.search}`, { replace: true });
    }
  }, [navigate]);

  const faqTabs = Object.keys(FAQS);
  const faqsByTab = Object.values(FAQS);
  const faqTabColors = ["#7C3AED", "#25D366", "#2563EB", "#ff6b9d"];

  return (
    <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Inter', sans-serif", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes float1 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(12px,-18px) rotate(3deg); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-15px,12px) rotate(-2deg); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,14px); } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes grain { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-5%,-10%); } 30% { transform: translate(3%,-15%); } 50% { transform: translate(12%,9%); } 70% { transform: translate(9%,4%); } 90% { transform: translate(-1%,7%); } }
        .nav-link { text-decoration: none; color: rgba(255,255,255,0.45); font-size: 0.78rem; font-weight: 500; padding: 7px 14px; border-radius: 100px; transition: all 0.3s; }
        .nav-link:hover { color: #eeede9; background: rgba(255,255,255,0.06); }
        .product-card { transition: all 0.5s cubic-bezier(0.16,1,0.3,1); cursor: pointer; }
        .product-card:hover { transform: translateY(-8px); }
        .startup-card { transition: all 0.5s cubic-bezier(0.16,1,0.3,1); cursor: pointer; }
        .startup-card:hover { transform: translateY(-6px); }
        .faq-item { transition: all 0.3s; cursor: pointer; }
        .faq-item:hover { background: rgba(255,255,255,0.03) !important; }
        .form-option { transition: all 0.3s; cursor: pointer; }
        .form-option:hover { border-color: rgba(124, 58, 237,0.4) !important; background: rgba(124, 58, 237,0.04) !important; }
        a { text-decoration: none; color: inherit; }

        /* ═══ HERO ═══ */
        @keyframes hero-float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
        @keyframes hero-chip { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-14px) rotate(var(--r,0deg)); } }
        @keyframes hero-mesh-drift { 0% { transform: translateX(0); } 100% { transform: translateX(-40px); } }
        @keyframes hero-aura-breathe { 0%,100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }

        .hero-section {
          position: relative; z-index: 1; max-width: 1440px; margin: 0 auto;
          min-height: 100vh; padding: 132px 60px 46px;
          display: grid; grid-template-columns: 1.04fr 0.96fr; grid-template-rows: 1fr auto;
          align-items: center; gap: 34px 44px;
        }

        /* fundo roxo restrito ao hero, dissolvendo no fundo do site */
        /* 100vw + centralização: a seção é limitada a 1440px, mas o fundo
           precisa sangrar até a borda da viewport em telas largas. */
        .hero-aura { position: absolute; top: 0; bottom: 0; left: 50%; width: 100vw; transform: translateX(-50%);
          z-index: -1; overflow: hidden; pointer-events: none;
          background:
            radial-gradient(115% 85% at 68% 18%, rgba(124,58,237,0.30) 0%, rgba(76,29,149,0.15) 38%, transparent 72%),
            linear-gradient(180deg, #150c28 0%, #0d0718 52%, #08080a 100%);
        }
        .hero-aura-glow { position: absolute; border-radius: 50%; filter: blur(70px); animation: hero-aura-breathe 9s ease-in-out infinite; }
        .hero-aura-glow.a { width: 520px; height: 520px; top: 4%; right: 6%; background: radial-gradient(circle, rgba(139,92,246,0.30), transparent 65%); }
        .hero-aura-glow.b { width: 420px; height: 420px; bottom: 6%; left: -4%; background: radial-gradient(circle, rgba(37,99,235,0.18), transparent 65%); animation-delay: 2.5s; }
        .hero-mesh { position: absolute; left: -40px; bottom: 0; width: calc(100% + 80px); height: 300px;
          color: rgba(167,139,250,0.30); animation: hero-mesh-drift 14s linear infinite alternate;
          mask-image: linear-gradient(180deg, transparent, #000 45%, transparent); }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 9px; margin-bottom: 26px;
          padding: 7px 17px 7px 13px; border-radius: 100px;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(167,139,250,0.26);
          font-size: 0.7rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #c4b5fd;
        }
        .hero-badge-dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: #a78bfa; flex-shrink: 0; }
        .hero-badge-dot::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1px solid #a78bfa; animation: pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite; }

        .hero-title { font-size: clamp(2.6rem, 5vw, 4.4rem); font-weight: 800; line-height: 1.03; letter-spacing: -2.4px; margin-bottom: 22px; color: #ffffff; }
        .hero-title-accent { display: block; background: linear-gradient(100deg, #a78bfa 0%, #7C3AED 55%, #6d28d9 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #a78bfa; }
        .hero-sub { font-size: 1.05rem; line-height: 1.7; color: rgba(255,255,255,0.55); max-width: 470px; margin-bottom: 34px; }

        .hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
        .hero-cta-primary, .hero-cta-ghost { display: inline-flex; align-items: center; gap: 8px; border-radius: 100px; font-size: 0.92rem; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
        .hero-cta-primary { padding: 15px 30px; background: #7C3AED; color: #fff; font-weight: 700; box-shadow: 0 14px 40px -12px rgba(124,58,237,0.9); }
        .hero-cta-primary:hover { background: #6d28d9; transform: translateY(-2px); box-shadow: 0 20px 50px -12px rgba(124,58,237,1); }
        .hero-cta-ghost { padding: 15px 28px; border: 1px solid rgba(255,255,255,0.16); font-weight: 600; color: #eeede9; }
        .hero-cta-ghost:hover { border-color: rgba(167,139,250,0.55); background: rgba(124,58,237,0.10); transform: translateY(-2px); }

        /* ── Nori ── */
        .hero-visual { position: relative; display: flex; justify-content: flex-end; align-items: flex-end; min-height: 500px; }
        /* A arte em PNG é quase quadrada (o vetor antigo era mais alto que
           largo), então o mesmo padding-top calculado pro vetor deixava uma
           sobra vazia embaixo do balão e o robô "afundado" perto do rodapé.
           38px é só o necessário pra cabeça não encostar no bico do balão. */
        .nori-stage { position: relative; width: min(392px, 100%); padding-top: 38px; padding-bottom: 26px; transition: transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .nori-figure { animation: hero-float-slow 6s ease-in-out infinite; }

        /* O balão usa o MESMO vidro escuro do visor do Nori (nori-visor) —
           é o que faz os dois lerem como a mesma peça de hardware, em vez de
           um card solto ao lado de um boneco. Quase opaco de propósito: o bico
           é um pseudo-elemento com a mesma cor, e com muita transparência ele
           destoaria do corpo do balão. */
        /* Balão em contorno neon: fio roxo aceso sobre vidro escuro, no mesmo
           material do visor do Nori — é o que faz os dois lerem como a mesma
           peça em vez de um card solto ao lado de um boneco. */
        .nori-bubble {
          position: absolute; top: 0; left: -22%; z-index: 3; width: min(308px, 96%);
          padding: 22px 24px 20px; border-radius: 26px;
          background: linear-gradient(152deg, rgba(26,16,50,0.92) 0%, rgba(13,8,26,0.94) 100%);
          border: 1.5px solid #a78bfa;
          box-shadow:
            0 0 22px rgba(124,58,237,0.45),
            0 0 60px -10px rgba(124,58,237,0.5),
            inset 0 0 26px rgba(124,58,237,0.12);
          transition: transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        /* Bico em duas camadas: a de baixo é o fio neon, a de cima preenche e
           avança 2px sobre a borda do balão para apagar a emenda — sem isso
           fica um risco atravessando a base do bico. */
        .nori-bubble::before, .nori-bubble::after {
          content: ""; position: absolute;
          clip-path: polygon(0 0, 100% 0, 66% 100%);
        }
        .nori-bubble::before {
          right: 32px; bottom: -21px; width: 38px; height: 23px;
          background: #a78bfa;
          filter: drop-shadow(0 3px 9px rgba(124,58,237,0.7));
        }
        .nori-bubble::after {
          right: 34px; bottom: -18px; width: 34px; height: 20px;
          background: #100a20;
        }
        .nori-bubble-icon { display: inline-flex; color: #a78bfa; margin-bottom: 11px; }
        .nori-bubble-title { font-size: 1.14rem; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; line-height: 1.25; margin-bottom: 7px; }
        .nori-bubble-title strong { color: #a78bfa; font-weight: 800; font-style: italic; }
        .nori-bubble-text { font-size: 0.86rem; line-height: 1.62; color: rgba(255,255,255,0.68); }

        .nori-chip {
          position: absolute; z-index: 1; display: flex; align-items: center; justify-content: center;
          width: 52px; height: 52px; border-radius: 16px; color: #a78bfa;
          background: rgba(124,58,237,0.14); border: 1px solid rgba(167,139,250,0.28);
          backdrop-filter: blur(10px); animation: hero-chip 7s ease-in-out infinite;
        }
        .nori-chip.check { left: -6%; bottom: 30%; --r: -8deg; }
        .nori-chip.gear { left: 8%; bottom: 8%; --r: 6deg; animation-delay: 1.2s; }
        .nori-chip.chart { right: -4%; top: 42%; --r: 9deg; animation-delay: 2.4s; }
        .nori-chip.bolt { right: 6%; top: 9%; --r: -7deg; animation-delay: 3.4s; }

        /* ── Barra de benefícios + números ── */
        .hero-bar-slot { grid-column: 1 / -1; }
        .hero-bar {
          display: flex; align-items: center; gap: 26px;
          padding: 20px 26px; border-radius: 22px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(167,139,250,0.18);
          backdrop-filter: blur(18px); box-shadow: 0 26px 70px -40px rgba(124,58,237,0.9);
        }
        /* Os textos têm alturas diferentes (2 ou 3 linhas), então alinhar pelo
           topo deixava a linha visualmente desalinhada — centralizar resolve. */
        .hero-benefits { flex: 1 1 auto; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 20px; align-items: center; }
        .hero-benefit { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .hero-benefit-icon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex-shrink: 0;
          border-radius: 11px; background: rgba(124,58,237,0.16); border: 1px solid rgba(167,139,250,0.24); color: #a78bfa; }
        .hero-benefit-title { font-size: 0.85rem; font-weight: 700; color: #eeede9; margin-bottom: 3px; }
        .hero-benefit-desc { font-size: 0.74rem; line-height: 1.45; color: rgba(255,255,255,0.42); }
        .hero-bar-divider { width: 1px; flex-shrink: 0; align-self: stretch; background: linear-gradient(180deg, transparent, rgba(167,139,250,0.32), transparent); }
        .hero-stats { flex: 0 0 auto; display: grid; grid-template-columns: repeat(2, auto); gap: 10px 26px; align-content: center; }
        .hero-stat-value { font-family: 'JetBrains Mono', monospace; font-size: 1.18rem; font-weight: 700; color: #a78bfa; line-height: 1.15; }
        .hero-stat-label { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.35); margin-top: 1px; }

        @media (prefers-reduced-motion: reduce) {
          .nori-figure, .nori-chip, .hero-mesh, .hero-aura-glow { animation: none; }
        }

        /* Faixa estreita em que a barra ainda tem 4 colunas + números: sem
           apertar, uma das descrições quebra em 3 linhas e desalinha a fila. */
        @media (max-width: 1200px) {
          .hero-bar { gap: 18px; padding: 18px 20px; }
          .hero-benefits { gap: 14px; }
          .hero-benefit { gap: 9px; }
          .hero-benefit-icon { width: 31px; height: 31px; border-radius: 10px; }
          .hero-benefit-desc { font-size: 0.7rem; }
          .hero-stats { gap: 9px 18px; }
          .hero-stat-value { font-size: 1.05rem; }
        }

        /* ═══ TABLET ═══ */
        @media (max-width: 1024px) {
          .section-padding { padding: 100px 32px !important; }
          .cta-section { padding: 100px 32px !important; }
          .footer-section { padding: 60px 32px 40px !important; }
          .hero-section {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
            padding: 118px 32px 48px !important;
            gap: 30px !important;
            justify-items: center; text-align: center;
          }
          .hero-copy { max-width: 640px; }
          .hero-sub { margin-left: auto; margin-right: auto; }
          .hero-buttons { justify-content: center; }
          /* Coluna única: o balão sai do posicionamento absoluto e entra em
             fluxo acima do robô — em layout centralizado não há espaço
             lateral pra ele flutuar sem cobrir alguma coisa. */
          .hero-visual { flex-direction: column; align-items: center; justify-content: flex-start;
            min-height: 0; width: 100%; max-width: 460px; gap: 4px; }
          .nori-stage { padding-top: 0; width: min(320px, 100%); }
          .nori-bubble { position: relative; top: auto; left: auto; width: min(340px, 100%); text-align: left; }
          /* coluna única: o Nori fica exatamente embaixo, então o bico aponta reto */
          .nori-bubble::before, .nori-bubble::after { right: 50%; margin-right: -19px; clip-path: polygon(0 0, 100% 0, 50% 100%); }
          .nori-chip.check { left: -8%; }
          .nori-chip.chart { right: -8%; }
          .nori-chip.bolt { right: 2%; }
        }

        /* ═══ MOBILE RESPONSIVE ═══ */
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-cta-desktop { display: none !important; }
          .hamburger { display: flex !important; }

          .mobile-menu {
            display: flex !important;
            position: fixed;
            inset: 0;
            z-index: 999;
            background: rgba(8,8,10,0.98);
            backdrop-filter: blur(24px);
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .mobile-menu a {
            font-size: 1.1rem !important;
            padding: 14px 32px !important;
            color: rgba(255,255,255,0.7) !important;
            border-radius: 12px !important;
            width: 240px;
            text-align: center;
          }
          .mobile-menu a:hover { background: rgba(255,255,255,0.06); color: #eeede9 !important; }
          .mobile-menu .mobile-cta {
            margin-top: 16px;
            background: #7C3AED !important;
            color: #08080a !important;
            font-weight: 700 !important;
          }

          .hero-section {
            padding: 104px 20px 44px !important;
            min-height: auto !important;
            gap: 26px !important;
          }
          .hero-title { letter-spacing: -1.4px; }
          .nori-stage { width: min(270px, 82%); }
          .nori-bubble { width: 100%; }
          .nori-chip { width: 44px; height: 44px; border-radius: 13px; }
          .hero-bar { flex-direction: column; gap: 20px; padding: 20px; }
          .hero-benefits { grid-template-columns: repeat(2, minmax(0,1fr)); text-align: left; }
          .hero-bar-divider { width: 100%; height: 1px; background: linear-gradient(90deg, transparent, rgba(167,139,250,0.3), transparent); }
          .hero-stats { grid-template-columns: repeat(4, 1fr); justify-items: center; text-align: center; gap: 12px; }
          .hero-buttons a { flex: 1; text-align: center; justify-content: center; min-width: 140px; }

          .section-padding { padding: 72px 20px !important; }

          .products-grid {
            grid-template-columns: 1fr !important;
          }
          .featured-span { grid-column: span 1 !important; }
          .featured-inner {
            grid-template-columns: 1fr !important;
          }
          .featured-text { padding: 28px 22px !important; }
          .featured-mockup { padding: 22px !important; max-width: 100% !important; }
          .featured-code {
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.06) !important;
            border-radius: 0 0 18px 18px !important;
            min-height: 320px;
          }
          .mockup-stats-4 { grid-template-columns: 1fr 1fr !important; }

          .process-grid { grid-template-columns: 1fr 1fr !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .differentials-grid { grid-template-columns: 1fr !important; }
          .differentials-grid > div > div { border-right: none !important; }
          .differentials-header { grid-template-columns: 1fr !important; gap: 20px !important; align-items: start !important; }
          .about-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .about-pillars { grid-template-columns: 1fr !important; }
          .about-pillars > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
          .about-pillars > div:last-child { border-bottom: none !important; }

          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          .footer-bottom { flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }

          .cta-buttons { flex-direction: column !important; align-items: center !important; width: 100%; }
          .cta-buttons a { width: 100%; max-width: 280px; justify-content: center; text-align: center; }

          .cta-section { padding: 80px 20px 100px !important; }
          .footer-section { padding: 40px 20px !important; }
        }

        @media (max-width: 480px) {
          .process-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .hero-benefits { grid-template-columns: 1fr !important; }
          .hero-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 14px !important; }
          .section-padding { padding: 56px 16px !important; }
          .hero-section { padding: 96px 16px 40px !important; }
          .cta-section { padding: 64px 16px 80px !important; }
          .featured-text { padding: 24px 18px !important; }
          .featured-mockup { padding: 18px !important; }
          .mockup-stats-3 { grid-template-columns: 1fr 1fr !important; }
          .mockup-stats-4 { grid-template-columns: 1fr 1fr !important; }
        }

      `}</style>

      {/* ═══ ATMOSPHERE ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", animation: "grain 8s steps(10) infinite" }} />
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: "radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 55%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 50% 30%, black 10%, transparent 60%)" }} />
      </div>

      {/* ═══ FLOATING DECORATIVE ELEMENTS ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Star size={14} color="rgba(124, 58, 237,0.15)" style={{ position: "absolute", top: "12%", left: "8%", animation: "float1 7s ease-in-out infinite" }} />
        <Star size={10} color="rgba(37, 99, 235,0.12)" style={{ position: "absolute", top: "35%", right: "12%", animation: "float2 9s ease-in-out infinite" }} />
        <Diamond size={10} color="rgba(255,107,157,0.15)" style={{ position: "absolute", top: "60%", left: "5%", animation: "float3 8s ease-in-out infinite" }} />
        <Star size={8} color="rgba(124, 58, 237,0.1)" style={{ position: "absolute", top: "75%", right: "8%", animation: "float1 11s ease-in-out infinite" }} />
        <Diamond size={8} color="rgba(255,138,61,0.12)" style={{ position: "absolute", top: "20%", right: "25%", animation: "float2 10s ease-in-out infinite" }} />
      </div>

      {/* ═══ NAV ═══ */}
      <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000, width: "auto", maxWidth: "calc(100% - 28px)" }}>
        <nav style={{
          display: "flex", alignItems: "center", gap: 4, padding: "5px 5px 5px 20px",
          background: navScrolled ? "rgba(12,12,14,0.95)" : "rgba(16,16,18,0.8)",
          backdropFilter: "blur(24px) saturate(1.4)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 100, transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: navScrolled ? "0 8px 40px rgba(0,0,0,0.5)" : "none"
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.82rem", color: "#7C3AED", marginRight: 12, letterSpacing: -0.5 }}>NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span></span>
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <a href="#sobre" className="nav-link">Sobre</a>
            <a href="#servicos" className="nav-link">Serviços</a>
            <a href="#produtos" className="nav-link">Projetos</a>

            <a href="#contato" className="nav-link nav-cta-desktop" style={{ padding: "8px 18px", background: "#7C3AED", color: "#ffffff", fontWeight: 700, borderRadius: 100 }}>Contato</a>
          </div>
          <button
            className="hamburger"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            style={{
              display: "none", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer", padding: 0, marginLeft: 2
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eeede9" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
          </button>
          <ThemeToggle style={{ marginLeft: 2 }} />
          <Link to={user ? "/area-do-cliente" : "/login"} title={user ? "Central de Controle" : "Área de membro"} className="member-badge" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", background: user ? "rgba(124, 58, 237,0.1)" : (theme === "light" ? "rgba(124, 58, 237,0.06)" : "rgba(255,255,255,0.04)"), border: `1px solid ${user ? "rgba(124, 58, 237,0.2)" : (theme === "light" ? "rgba(124, 58, 237,0.18)" : "rgba(255,255,255,0.08)")}`, marginLeft: 2, overflow: "hidden", flexShrink: 0 }}>
            {user?.photoUrl
              ? <img src={user.photoUrl} alt="perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={user ? "#7C3AED" : (theme === "light" ? "#7C3AED" : "rgba(255,255,255,0.35)")} strokeWidth={theme === "light" ? "2.6" : "2"} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </Link>
        </nav>
      </div>

      {/* ═══ MOBILE MENU OVERLAY ═══ */}
      {menuOpen && (
        <div className="mobile-menu" style={{ display: "none" }}>
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#eeede9", cursor: "pointer", fontSize: "1.2rem",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
          </button>
          <a href="#sobre" className="nav-link" onClick={() => setMenuOpen(false)}>Sobre</a>
          <a href="#servicos" className="nav-link" onClick={() => setMenuOpen(false)}>Serviços</a>
          <a href="#produtos" className="nav-link" onClick={() => setMenuOpen(false)}>Projetos</a>

          <a href="#contato" className="nav-link mobile-cta" onClick={() => setMenuOpen(false)}>Contato</a>
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className="hero-section">
        {/* Atmosfera própria do hero: o roxo fica concentrado na primeira
            dobra e se dissolve no #08080a do resto do site. */}
        <div className="hero-aura" aria-hidden="true">
          <div className="hero-aura-glow a" />
          <div className="hero-aura-glow b" />
          <svg className="hero-mesh" viewBox="0 0 1440 340" preserveAspectRatio="none">
            {Array.from({ length: 11 }, (_, i) => (
              <path
                key={i}
                d={`M0 ${96 + i * 21} C 260 ${52 + i * 19}, 470 ${152 + i * 17}, 730 ${112 + i * 19} S 1210 ${64 + i * 21}, 1440 ${124 + i * 19}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity={0.55 - i * 0.03}
              />
            ))}
          </svg>
        </div>

        <div className="hero-copy">
          <Reveal delay={0.05}>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Noratech · Software sob medida
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <h1 className="hero-title">
              Automatizamos processos.
              <span className="hero-title-accent">Potencializamos resultados.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="hero-sub">
              Soluções de software sob medida que eliminam falhas humanas, aumentam a produtividade e aceleram o crescimento da sua empresa.
            </p>
          </Reveal>

          <Reveal delay={0.42}>
            <div className="hero-buttons">
              <a className="hero-cta-primary" href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20um%20or%C3%A7amento%20com%20a%20Noratech." target="_blank" rel="noopener noreferrer">
                Solicitar orçamento <span aria-hidden="true">↗</span>
              </a>
              <a className="hero-cta-ghost" href="#produtos">
                Conhecer soluções
              </a>
            </div>
          </Reveal>

        </div>

        {/* Nori + balão. O parallax do mouse é sutil e em sentidos opostos
            entre o robô e os cartões, o que dá sensação de profundidade. */}
        <div className="hero-visual">
          <div
            className="nori-bubble"
            style={{ transform: `translate(${(mousePos.x - 0.5) * -14}px, ${(mousePos.y - 0.5) * -10}px)` }}
          >
            <span className="nori-bubble-icon" aria-hidden="true">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.6" y="4.2" width="18.8" height="13.6" rx="5" />
                <path d="M8.6 17.8 7.2 21.2l4-3.4" />
                <circle cx="8.2" cy="11" r="1.15" fill="currentColor" stroke="none" />
                <circle cx="12" cy="11" r="1.15" fill="currentColor" stroke="none" />
                <circle cx="15.8" cy="11" r="1.15" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <p className="nori-bubble-title">Eu sou o <strong>Nori!</strong> <span aria-hidden="true">👋</span></p>
            <p className="nori-bubble-text">
              Automatizo seus processos para eliminar falhas humanas e entregar mais rapidez, padronização e precisão.
            </p>
          </div>

          <div
            className="nori-stage"
            style={{ transform: `translate(${(mousePos.x - 0.5) * 16}px, ${(mousePos.y - 0.5) * 10}px)` }}
          >
            <span className="nori-chip check" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <span className="nori-chip gear" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
            </span>
            <span className="nori-chip chart" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M5 19v-5" /><path d="M12 19V7" /><path d="M19 19v-9" /></svg>
            </span>
            <span className="nori-chip bolt" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" /></svg>
            </span>

            <NoriRobot className="nori-figure" />
          </div>
        </div>

        <Reveal delay={0.55} className="hero-bar-slot">
          <div className="hero-bar">
            <div className="hero-benefits">
              {HERO_BENEFITS.map((b) => (
                <div className="hero-benefit" key={b.title}>
                  <span className="hero-benefit-icon" aria-hidden="true">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      {b.icon}
                    </svg>
                  </span>
                  <div>
                    <div className="hero-benefit-title">{b.title}</div>
                    <div className="hero-benefit-desc">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hero-bar-divider" aria-hidden="true" />

            <div className="hero-stats">
              {HERO_STATS.map(([val, label]) => (
                <div className="hero-stat" key={label}>
                  <div className="hero-stat-value">{val}</div>
                  <div className="hero-stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ MARQUEE ═══ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 0", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 48, animation: "marquee 30s linear infinite", width: "max-content" }}>
          {[...Array(2)].flatMap((_, ri) =>
            ["💰 Gestão Financeira", "💬 WhatsApp Bot", "🌐 Criação de Sites", "📊 Análise de Gastos", "🤖 Pré-Atendimento", "🎨 Design Profissional", "🔗 Open Finance"].map((t, i) =>
              <span key={`${ri}-${i}`} style={{ fontSize: "0.82rem", fontWeight: 500, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <Diamond size={5} color="rgba(124, 58, 237,0.3)" /> {t}
              </span>
            )
          )}
        </div>
      </div>

      {/* ═══ ABOUT — institutional editorial ═══ */}
      <section id="sobre" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#eeede9" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#eeede9", textTransform: "uppercase", letterSpacing: 3 }}>Sobre a Noratech</span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.08, marginBottom: 14 }}>
            Engenharia de software a serviço da{" "}
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>operação</span>.
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.6, marginBottom: 64 }}>
            Empresa brasileira de engenharia aplicada — construímos sistemas sob medida, automações e integrações que sustentam operações corporativas em produção.
          </p>
        </Reveal>

        <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 64, alignItems: "start", marginBottom: 72 }}>
          {/* Narrative */}
          <Reveal delay={0.15}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: "1.12rem", lineHeight: 1.65, color: "rgba(255,255,255,0.78)", fontWeight: 400 }}>
                A <strong style={{ color: "#eeede9", fontWeight: 700 }}>Noratech</strong> é uma empresa brasileira de engenharia de software especializada em <strong style={{ color: "#eeede9", fontWeight: 600 }}>automação, sistemas sob medida e integrações</strong> para operações corporativas. Atendemos empresas que precisam escalar sem, na mesma proporção, escalar custo, equipe e complexidade interna.
              </p>
              <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>
                Não entregamos ferramentas soltas — entregamos operação estruturada. Cada projeto começa por um diagnóstico técnico do processo atual, passa por arquitetura e desenvolvimento com a nossa equipe, e termina em produção com monitoramento ativo, relatórios mensais e evolução contínua.
              </p>
              <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>
                Trabalhamos com código proprietário e arquitetura auditável. O cliente conhece o escopo, acompanha a execução e recebe o sistema com autonomia técnica sobre a própria solução.
              </p>
            </div>
          </Reveal>

          {/* Editorial pull-quote card */}
          <Reveal delay={0.3} type="scale">
            <div style={{
              position: "relative", padding: "40px 36px", background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden"
            }}>
              {/* subtle grain / corner accent */}
              <div style={{
                position: "absolute", top: 20, right: 20,
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: "4rem", lineHeight: 0.8, color: "rgba(238,237,233,0.08)"
              }}>
                "
              </div>

              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 2, marginBottom: 18 }}>
                Princípio de engenharia
              </div>

              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: "1.45rem", fontWeight: 500, lineHeight: 1.35,
                color: "#eeede9", letterSpacing: -0.3, marginBottom: 24, position: "relative"
              }}>
                Boa tecnologia não deve ser notada. Ela devolve tempo, reduz fricção e transforma decisão operacional em dado.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 1, background: "rgba(124, 58, 237,0.6)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
                  Noratech — Engenharia de Operação
                </span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Institutional pillars — 3 columns */}
        <Reveal delay={0.2}>
          <div className="about-pillars" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}>
            {[
              {
                label: "O que fazemos",
                body: "Sistemas personalizados, automações de processo, dashboards operacionais e integrações entre ferramentas. Do diagnóstico ao deploy, com uma equipe só.",
              },
              {
                label: "Para quem",
                body: "Pequenas e médias empresas que operam com processos manuais, planilhas paralelas ou ferramentas que não conversam — e que não podem mais pagar por isso.",
              },
              {
                label: "Compromisso",
                body: "Escopo definido, contrato transparente, código entregue ao cliente e SLA ativo após o deploy. Sem letra miúda, sem dependência permanente de fornecedor.",
              },
            ].map((p, i) => (
              <div key={i} style={{
                padding: "36px 28px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Diamond size={6} color="#7C3AED" />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 2 }}>
                    {p.label}
                  </span>
                </div>
                <p style={{ fontSize: "0.92rem", lineHeight: 1.65, color: "rgba(255,255,255,0.55)" }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="servicos" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#2563EB" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#2563EB", textTransform: "uppercase", letterSpacing: 3 }}>Serviços</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            Tecnologia que resolve <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>problemas reais</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.6, marginBottom: 64 }}>
            Quatro frentes de atuação que a Noratech entrega de ponta a ponta — do levantamento técnico ao deploy em produção, com suporte contínuo.
          </p>
        </Reveal>

        <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.num} type={i % 2 === 0 ? "up" : "scale"} delay={i * 0.08}>
              <div style={{
                position: "relative", height: "100%", background: "#111114",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18,
                padding: 32, overflow: "hidden", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)"
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(37, 99, 235,0.22)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(37, 99, 235,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Decorative glow */}
                <div style={{
                  position: "absolute", width: 220, height: 220, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(37, 99, 235,0.10) 0%, transparent 60%)",
                  top: -80, right: -60, filter: "blur(40px)", pointerEvents: "none"
                }} />

                {/* Number + divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, position: "relative" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: "#2563EB", fontWeight: 700, letterSpacing: 2 }}>{s.num}</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                  <Star size={8} color="rgba(37, 99, 235,0.25)" />
                </div>

                <div style={{ fontSize: "2.1rem", marginBottom: 16, position: "relative" }}>{s.icon}</div>

                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: -0.3, marginBottom: 12, position: "relative" }}>
                  {s.title}
                </h3>

                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 22, position: "relative" }}>
                  {s.desc}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, position: "relative" }}>
                  {s.tags.map(t => (
                    <span key={t} style={{
                      padding: "4px 10px", background: "rgba(37, 99, 235,0.06)",
                      border: "1px solid rgba(37, 99, 235,0.14)", borderRadius: 100,
                      fontSize: "0.66rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                      color: "rgba(200,220,255,0.7)"
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Inline CTA strip */}
        <Reveal delay={0.3}>
          <div style={{
            marginTop: 28, padding: "22px 28px",
            background: "linear-gradient(135deg, rgba(37, 99, 235,0.06), rgba(37, 99, 235,0.02))",
            border: "1px solid rgba(37, 99, 235,0.14)", borderRadius: 18,
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(37, 99, 235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>✦</div>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 2 }}>Precisa de um escopo específico?</div>
                <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>Conte o desafio e montamos uma proposta técnica sob medida.</div>
              </div>
            </div>
            <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20Noratech." target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px",
              background: "#2563EB", color: "#ffffff", borderRadius: 100,
              fontWeight: 700, fontSize: "0.86rem", whiteSpace: "nowrap"
            }}>
              Falar com especialista <span style={{ fontSize: "1rem" }}>↗</span>
            </a>
          </div>
        </Reveal>
      </section>

      {/* ═══ DIFFERENTIALS — editorial manifesto style ═══ */}
      <section id="diferenciais" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#b684ff" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#b684ff", textTransform: "uppercase", letterSpacing: 3 }}>Diferenciais</span>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "end", marginBottom: 72 }} className="differentials-header">
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.08 }}>
              Por que escolher a <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#b684ff" }}>Noratech</span>?
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 440 }}>
              Somos uma empresa de engenharia de software focada em eficiência operacional. Construímos sistemas que devolvem tempo, clareza e previsibilidade para quem decide.
            </p>
          </Reveal>
        </div>

        <div className="differentials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {DIFFERENTIALS.map((d, i) => (
            <Reveal key={d.num} type="up" delay={(i % 3) * 0.08}>
              <div style={{
                position: "relative", height: "100%", padding: "40px 28px 36px",
                borderRight: (i % 3 !== 2) ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                transition: "background 0.4s ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(182,132,255,0.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Large editorial number */}
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600,
                  fontSize: "3.6rem", lineHeight: 1, color: "#b684ff", marginBottom: 20,
                  letterSpacing: -2,
                }}>
                  {d.num}<span style={{ color: "rgba(182,132,255,0.35)" }}>.</span>
                </div>

                <h3 style={{
                  fontSize: "1.08rem", fontWeight: 700, lineHeight: 1.35,
                  letterSpacing: -0.3, marginBottom: 12, color: "#eeede9"
                }}>
                  {d.title}
                </h3>

                <p style={{
                  fontSize: "0.88rem", color: "rgba(255,255,255,0.42)",
                  lineHeight: 1.7, marginBottom: 0
                }}>
                  {d.desc}
                </p>

                {/* Corner accent on hover target */}
                <Star size={7} color="rgba(182,132,255,0.2)" style={{ position: "absolute", top: 24, right: 24 }} />
              </div>
            </Reveal>
          ))}
        </div>

        {/* Positioning statement */}
        <Reveal delay={0.2}>
          <div style={{
            marginTop: 56, padding: "28px 32px",
            background: "rgba(182,132,255,0.04)",
            border: "1px solid rgba(182,132,255,0.12)", borderRadius: 18,
            display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap"
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600,
              fontSize: "2.2rem", color: "#b684ff", lineHeight: 1, letterSpacing: -1
            }}>
              ✦
            </div>
            <p style={{
              flex: 1, minWidth: 280, fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic", fontSize: "1.25rem", fontWeight: 500,
              color: "rgba(255,255,255,0.78)", lineHeight: 1.45, letterSpacing: -0.2
            }}>
              "Tecnologia bem feita é aquela que deixa de aparecer. A Noratech existe para essa engenharia — a que sustenta a operação em silêncio e entrega resultado todo dia."
            </p>
          </div>
        </Reveal>
      </section>

      {/* ═══ PRODUCTS ═══ */}
      <section id="produtos" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#7C3AED" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 3 }}>Sistemas</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            Sistemas em <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>destaque</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.6, marginBottom: 64 }}>
            Cada projeto resolve um problema real — gestão financeira, atendimento, automação e presença digital.
          </p>
        </Reveal>

        {/* Bento Grid */}
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.id} type={i % 2 === 0 ? "up" : "scale"} delay={i * 0.08}>
              <div className={`product-card${p.featured ? " featured-inner" : ""}`}
                onMouseEnter={() => setHoveredProduct(p.id)}
                onMouseLeave={() => setHoveredProduct(null)}
                style={{
                  background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: p.featured ? 0 : 28,
                  position: "relative", overflow: "hidden", height: "100%",
                  display: p.featured ? "grid" : "block", gridTemplateColumns: p.featured ? "1fr 1fr" : "none",
                  boxShadow: hoveredProduct === p.id ? `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${p.color}22, inset 0 1px 0 ${p.color}15` : "none",
                  borderColor: hoveredProduct === p.id ? `${p.color}25` : "rgba(255,255,255,0.06)"
                }}>
                {/* Glow orb on hover — hen-ry style */}
                <div style={{
                  position: "absolute", width: 200, height: 200, borderRadius: "50%",
                  background: `radial-gradient(circle, ${p.color}15 0%, transparent 60%)`,
                  top: -60, right: -40, filter: "blur(30px)",
                  opacity: hoveredProduct === p.id ? 1 : 0, transition: "opacity 0.4s",
                  pointerEvents: "none"
                }} />

                {p.featured ? (
                  <>
                    <div className="featured-text" style={{ padding: 36, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: `${p.color}12`, border: `1px solid ${p.color}18`, marginBottom: 18 }}>{p.icon}</div>
                      <h3 style={{ fontSize: "1.55rem", fontWeight: 700, marginBottom: 12, letterSpacing: -0.5 }}>{p.name}</h3>
                      <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 20 }}>{p.desc}</p>
                      {p.features && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                          {p.features.map((f, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${p.color}15`, border: `1px solid ${p.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke={p.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {p.tags.map(t => <span key={t} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100, fontSize: "0.68rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.45)" }}>{t}</span>)}
                      </div>
                    </div>
                    <div className="featured-code" style={{ background: "#0c0c0e", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", borderRadius: "0 18px 18px 0" }}>
                      <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: `${p.color}15`, filter: "blur(40px)", top: "20%", left: "30%", animation: "float1 6s ease-in-out infinite" }} />
                      <div style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", background: "rgba(37, 99, 235,0.1)", filter: "blur(40px)", bottom: "20%", right: "25%", animation: "float2 8s ease-in-out infinite" }} />

                      {/* Finzo App */}
                      {p.id === 1 && (
                        <div className="featured-mockup" style={{ zIndex: 1, padding: 28, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace" }}>Contas conectadas</div>
                            <div style={{ fontSize: "0.58rem", color: "rgba(76,217,100,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>● 3 ativas</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #820ad1, #9b30ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>Nu</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Nubank</div>
                                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Conta corrente</div>
                              </div>
                              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>R$ 4.8k</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #ff7a00, #ff9533)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: "#fff" }}>Inter</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Inter</div>
                                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Poupança</div>
                              </div>
                              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>R$ 12.3k</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #ec1c2e, #ff3b4f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 700, color: "#fff" }}>Itaú</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Itaú</div>
                                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Investimentos</div>
                              </div>
                              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>R$ 28.6k</div>
                            </div>
                          </div>
                          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Categorias do mês</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {[
                                { name: "Alimentação", value: "R$ 840", pct: 85, color: "#7C3AED" },
                                { name: "Transporte", value: "R$ 420", pct: 55, color: "#2563EB" },
                                { name: "Lazer", value: "R$ 310", pct: 38, color: "#ff6b9d" },
                              ].map((c, idx) => (
                                <div key={idx}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.55)" }}>{c.name}</span>
                                    <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.value}</span>
                                  </div>
                                  <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 100, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 100 }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ flex: 1, padding: "10px 12px", background: "rgba(124, 58, 237,0.05)", border: "1px solid rgba(124, 58, 237,0.1)", borderRadius: 10 }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Economia</div>
                              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#7C3AED" }}>+12%</div>
                            </div>
                            <div style={{ flex: 1, padding: "10px 12px", background: "rgba(37, 99, 235,0.05)", border: "1px solid rgba(37, 99, 235,0.1)", borderRadius: 10 }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Gastos</div>
                              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#2563EB" }}>R$ 2.4k</div>
                            </div>
                            <div style={{ flex: 1, padding: "10px 12px", background: "rgba(255,107,157,0.05)", border: "1px solid rgba(255,107,157,0.1)", borderRadius: 10 }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Investido</div>
                              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ff6b9d" }}>R$ 800</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(76,217,100,0.65)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>● Sincronizado em tempo real</div>
                        </div>
                      )}

                      {/* WhatsApp Bot */}
                      {p.id === 2 && (
                        <div className="featured-mockup" style={{ zIndex: 1, padding: 28, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace" }}>Conversas recentes</div>
                            <div style={{ fontSize: "0.58rem", color: "rgba(37,211,102,0.8)", fontFamily: "'JetBrains Mono', monospace" }}>● Online 24/7</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ padding: "10px 14px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.12)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Maria Silva</div>
                                <span style={{ padding: "2px 8px", background: "rgba(37,211,102,0.15)", borderRadius: 100, fontSize: "0.52rem", fontWeight: 600, color: "#25D366" }}>Resolvido</span>
                              </div>
                              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>Agendamento confirmado automaticamente</div>
                            </div>
                            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>João Santos</div>
                                <span style={{ padding: "2px 8px", background: "rgba(255,180,0,0.15)", borderRadius: 100, fontSize: "0.52rem", fontWeight: 600, color: "#ffb400" }}>Pré-atendimento</span>
                              </div>
                              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>Coletando informações do cliente...</div>
                            </div>
                            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Ana Costa</div>
                                <span style={{ padding: "2px 8px", background: "rgba(37, 99, 235,0.15)", borderRadius: 100, fontSize: "0.52rem", fontWeight: 600, color: "#2563EB" }}>Encaminhado</span>
                              </div>
                              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>Transferido para atendente humano</div>
                            </div>
                          </div>
                          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Intenções detectadas (NLP)</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {[
                                { name: "Agendamento", pct: 42, color: "#25D366" },
                                { name: "Dúvidas / Suporte", pct: 30, color: "#2563EB" },
                                { name: "Vendas", pct: 18, color: "#ffb400" },
                                { name: "Outros", pct: 10, color: "#ff6b9d" },
                              ].map((c, idx) => (
                                <div key={idx}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.55)" }}>{c.name}</span>
                                    <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.pct}%</span>
                                  </div>
                                  <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 100, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 100 }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mockup-stats-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                            <div style={{ padding: "8px 10px", background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Filtradas</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#25D366" }}>70%</div>
                            </div>
                            <div style={{ padding: "8px 10px", background: "rgba(37, 99, 235,0.05)", border: "1px solid rgba(37, 99, 235,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Resolução</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2563EB" }}>92%</div>
                            </div>
                            <div style={{ padding: "8px 10px", background: "rgba(255,180,0,0.05)", border: "1px solid rgba(255,180,0,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Hoje</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffb400" }}>247</div>
                            </div>
                            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Tempo</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>8s</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sites para Empresas */}
                      {p.id === 4 && (
                        <div className="featured-mockup" style={{ zIndex: 1, padding: 28, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace" }}>Projeto em andamento</div>
                            <div style={{ fontSize: "0.58rem", color: "rgba(255,107,157,0.8)", fontFamily: "'JetBrains Mono', monospace" }}>● Sprint 3/4</div>
                          </div>
                          <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #ff6b9d, #ff8fb5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", color: "#fff" }}>🏪</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Loja Bella</div>
                                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>E-commerce · Moda feminina</div>
                              </div>
                              <span style={{ padding: "3px 8px", background: "rgba(255,107,157,0.15)", borderRadius: 100, fontSize: "0.52rem", fontWeight: 600, color: "#ff6b9d" }}>Em produção</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {[
                                { label: "Briefing e identidade visual", done: true },
                                { label: "Design personalizado com IA", done: true },
                                { label: "Layout responsivo (mobile/desktop)", done: true },
                                { label: "SEO técnico e performance", done: true },
                                { label: "Integração pagamento e CRM", done: false },
                                { label: "Deploy e domínio", done: false },
                              ].map((step, idx) => (
                                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: step.done ? "rgba(76,217,100,0.15)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.52rem", color: step.done ? "#4cd964" : "rgba(255,255,255,0.25)" }}>{step.done ? "✓" : "○"}</div>
                                  <span style={{ fontSize: "0.64rem", color: step.done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)" }}>{step.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {["Next.js", "Tailwind", "Stripe", "Analytics", "CDN"].map(t => (
                              <span key={t} style={{ padding: "3px 9px", background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.15)", borderRadius: 100, fontSize: "0.56rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,107,157,0.8)" }}>{t}</span>
                            ))}
                          </div>
                          <div className="mockup-stats-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                            <div style={{ padding: "8px 10px", background: "rgba(255,107,157,0.05)", border: "1px solid rgba(255,107,157,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Progresso</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ff6b9d" }}>75%</div>
                            </div>
                            <div style={{ padding: "8px 10px", background: "rgba(124, 58, 237,0.05)", border: "1px solid rgba(124, 58, 237,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Performance</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#7C3AED" }}>98</div>
                            </div>
                            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Entrega</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>5 dias</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,107,157,0.65)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>● Design gerado por IA</div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: `${p.color}12`, border: `1px solid ${p.color}18`, marginBottom: 18 }}>{p.icon}</div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>{p.name}</h3>
                    <p style={{ fontSize: "0.84rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 16 }}>{p.desc}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {p.tags.map(t => <span key={t} style={{ padding: "3px 9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100, fontSize: "0.65rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.4)" }}>{t}</span>)}
                    </div>
                  </>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* ═══ FAQ — Tabbed (hen-ry style) ═══ */}
      <section className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#ff8a3d" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#ff8a3d", textTransform: "uppercase", letterSpacing: 3 }}>FAQ</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            Perguntas <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>frequentes</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.6, marginBottom: 64 }}>
            Respostas objetivas sobre contratação, entrega e operação dos nossos produtos.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div style={{ maxWidth: 700 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {faqTabs.map((tab, i) => (
                <button key={i} onClick={() => { setActiveFaqTab(i); setOpenFaq(null); }} style={{
                  padding: "8px 20px", borderRadius: 100, border: "1px solid", cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", fontWeight: 600, transition: "all 0.3s",
                  background: activeFaqTab === i ? faqTabColors[i] : "transparent",
                  color: activeFaqTab === i ? "#08080a" : "rgba(255,255,255,0.4)",
                  borderColor: activeFaqTab === i ? faqTabColors[i] : "rgba(255,255,255,0.08)"
                }}>{tab}</button>
              ))}
            </div>

            {/* FAQ items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {faqsByTab[activeFaqTab].map((faq, i) => (
                <div key={`${activeFaqTab}-${i}`} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "18px 22px",
                  cursor: "pointer"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.92rem", fontWeight: 600 }}>{faq.q}</span>
                    <span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.2)", transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>+</span>
                  </div>
                  <div style={{
                    maxHeight: openFaq === i ? 200 : 0, overflow: "hidden",
                    transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                    opacity: openFaq === i ? 1 : 0
                  }}>
                    <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.65, paddingTop: 14 }}>{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ CTA — Big editorial statement ═══ */}
      <section id="contato" className="cta-section" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Decorative elements — hen-ry style */}
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", width: 400, height: 400, background: "radial-gradient(circle, rgba(124, 58, 237,0.04) 0%, transparent 55%)", filter: "blur(40px)", pointerEvents: "none" }} />

        <Reveal type="scale">
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
              <Star size={16} color="#7C3AED" style={{ animation: "float1 4s ease-in-out infinite" }} />
              <Star size={12} color="#2563EB" style={{ animation: "float2 5s ease-in-out infinite" }} />
              <Star size={14} color="#ff6b9d" style={{ animation: "float3 6s ease-in-out infinite" }} />
            </div>

            <h2 style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.05, marginBottom: 20, maxWidth: 820, margin: "0 auto 20px" }}>
              Pronto para construir a próxima fase da sua{" "}
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#7C3AED" }}>operação</span>?
            </h2>
            <p style={{ fontSize: "1.08rem", color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto 44px", lineHeight: 1.6 }}>
              Agende uma conversa sem compromisso. Em 30 minutos mapeamos onde a Noratech pode gerar mais impacto na sua operação.
            </p>
            <div className="cta-buttons" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setSchedulerOpen(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 30px", background: "#7C3AED", color: "#ffffff", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem", cursor: "pointer", transition: "all 0.3s" }}>
                Agendar reunião <span style={{ fontSize: "1.1rem" }}>↗</span>
              </a>
              <a href="https://wa.me/5511932227752" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem", transition: "all 0.3s" }}>
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer-section" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 60px 48px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#7C3AED" }}>NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span></span>
            <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 300, marginTop: 12 }}>Engenharia de software, automação e integrações para empresas que querem operar com eficiência.</p>
          </div>
          {[
            {
              title: "Produtos",
              links: [
                { label: "Finzo App", href: "#produtos", external: false },
                { label: "WhatsApp Bot", href: "https://whatsapp-mu.vercel.app", external: true },
                { label: "Criador de Sites", href: "https://criadordesites-rose.vercel.app", external: true },
              ],
            },
            {
              title: "Serviços",
              links: [
                { label: "Sistemas sob medida", href: "/servicos/sistemas-sob-medida", internal: true },
                { label: "Automação de processos", href: "/servicos/automacao-de-processos", internal: true },
                { label: "Dashboards & BI", href: "#servicos", external: false },
                { label: "Integrações", href: "#servicos", external: false },
              ],
            },
            {
              title: "Contato",
              links: [
                { label: "contato@noratech.com.br", href: "mailto:contato@noratech.com.br", external: false },
                { label: "LinkedIn", href: "#", external: false },
                { label: "GitHub", href: "#", external: false },
                { label: "WhatsApp", href: "https://wa.me/5511932227752", external: true },
              ],
            },
          ].map((col, i) => (
            <div key={i}>
              <h5 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>{col.title}</h5>
              {col.links.map(link => {
                const linkStyle = { display: "block", color: "rgba(255,255,255,0.35)", fontSize: "0.86rem", padding: "3px 0", transition: "color 0.2s" };
                if (link.internal) {
                  return (
                    <Link key={link.label} to={link.href} style={linkStyle}>
                      {link.label}
                    </Link>
                  );
                }
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    style={linkStyle}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="footer-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>© 2026 Noratech — Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Privacidade</Link>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Termos</Link>
          </div>
        </div>
      </footer>

      {/* ═══ MEETING SCHEDULER MODAL ═══ */}
      <MeetingScheduler isOpen={schedulerOpen} onClose={() => setSchedulerOpen(false)} />
    </div>
  );
}
