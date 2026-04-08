import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// NEXUS.ai — Immersive AI & Startups Portfolio
// Fusion: ssscript.app (OS UI) + hen-ry.com (editorial luxury)
// ═══════════════════════════════════════════════════════════════

const PRODUCTS = [
  { id: 1, icon: "💰", name: "Finzo App", desc: "Plataforma de gestão financeira inteligente que conecta contas, organiza movimentações e transforma dados em análises claras sobre gastos, rendimento e oportunidades de economia.", tags: ["FinTech", "Analytics", "Open Finance"], color: "#c8ff00", featured: true },
  { id: 2, icon: "💬", name: "WhatsApp Bot", desc: "Sistema de atendimento via WhatsApp que categoriza conversas, realiza o pré-atendimento e organiza o fluxo antes da interação humana.", tags: ["Chatbot", "WhatsApp API", "NLP"], color: "#25D366", featured: true },
  { id: 3, icon: "⚙️", name: "Autonomy", desc: "Plataforma de automação empresarial com 12 sistemas integrados para áreas contábil, financeira, gestão, pessoal e legal.", tags: ["RPA", "Automação", "ERP"], color: "#4d9fff", featured: true },
  { id: 4, icon: "🌐", name: "Sites para Empresas", desc: "Criação de sites profissionais com IA, adaptados ao modelo e necessidade de cada cliente. Design moderno, responsivo e otimizado para conversão.", tags: ["Web Design", "IA", "SEO"], color: "#ff6b9d", featured: true },
];

const STARTUPS = [
  { id: 1, name: "Finzo App", desc: "Gestão financeira inteligente — conecta contas bancárias, organiza movimentações e gera análises claras sobre gastos, rendimento e economia.", status: "dev", category: "FinTech · B2C", year: "2025", color: "#c8ff00", file: "finzo.app" },
  { id: 2, name: "WhatsApp Bot", desc: "Atendimento automatizado via WhatsApp com categorização de conversas, pré-atendimento inteligente e organização do fluxo.", status: "live", category: "SaaS · Atendimento", year: "2024", color: "#25D366", file: "whatsbot.service" },
  { id: 3, name: "Autonomy", desc: "Plataforma de automação empresarial completa com 12 sistemas integrados — contábil, financeiro, gestão, pessoal e legal.", status: "live", category: "ERP · Automação", year: "2024", color: "#4d9fff", file: "autonomy.platform" },
  { id: 4, name: "Sites para Empresas", desc: "Criação de sites profissionais com IA, adaptados ao modelo e necessidade de cada cliente pequeno ou médio.", status: "live", category: "Web · Design", year: "2024", color: "#ff6b9d", file: "sites.service" },
];

const TESTIMONIALS = [
  { name: "Juliana Martins", role: "Empresária — Studio JM", text: "O site que criaram para minha empresa triplicou os contatos pelo WhatsApp no primeiro mês. Design incrível.", initials: "JM" },
  { name: "Ricardo Santos", role: "Sócio — Contábil Vanguarda", text: "O Autonomy automatizou 80% das nossas rotinas fiscais. A equipe agora foca em consultoria, não em burocracia.", initials: "RS" },
  { name: "Ana Ferreira", role: "Gerente — Clínica Vitale", text: "O WhatsApp Bot organiza todo nosso atendimento. O pré-atendimento filtra 70% das dúvidas antes de chegar na recepção.", initials: "AF" },
  { name: "Carlos Mendes", role: "CFO — Grupo Orion", text: "Estou testando o Finzo e a visão que ele dá sobre gastos e rendimentos é algo que nenhum app de banco oferece.", initials: "CM" },
  { name: "Lucia Almeida", role: "Contadora — LA Assessoria", text: "Os 12 módulos do Autonomy cobrem tudo que preciso. Desde folha de pagamento até obrigações legais.", initials: "LA" },
];

const FAQS = [
  { q: "Como funciona o Finzo App?", a: "O Finzo conecta suas contas bancárias via Open Finance, organiza todas as movimentações automaticamente e gera análises visuais sobre seus gastos, rendimento e oportunidades de economia." },
  { q: "O WhatsApp Bot precisa de número comercial?", a: "Sim, utilizamos a API oficial do WhatsApp Business. Configuramos tudo para você — desde a categorização automática de conversas até o fluxo de pré-atendimento antes da interação humana." },
  { q: "Quais módulos o Autonomy inclui?", a: "São 12 sistemas integrados cobrindo: contabilidade, fiscal, financeiro, folha de pagamento, gestão de pessoal, contratos, obrigações legais, relatórios gerenciais, conciliação, faturamento, controle de estoque e dashboard executivo." },
  { q: "Quanto tempo leva para criar um site?", a: "Sites profissionais ficam prontos em 1 a 3 semanas dependendo da complexidade. Usamos IA para acelerar o processo sem perder qualidade — cada site é adaptado ao negócio do cliente." },
  { q: "Posso testar antes de contratar?", a: "O Finzo terá período de teste gratuito. Para os demais serviços, fazemos uma demonstração personalizada sem compromisso para você ver o potencial antes de decidir." },
  { q: "Os projetos são customizáveis?", a: "Totalmente. O Autonomy pode ser configurado por módulos, o WhatsApp Bot é treinado com o fluxo da sua empresa, e os sites são 100% personalizados para cada cliente." },
];

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
function Star({ size = 20, color = "#c8ff00", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, ...style }}>
      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" />
    </svg>
  );
}

// ═══ Decorative Diamond ═══
function Diamond({ size = 12, color = "rgba(200,255,0,0.3)", style = {} }) {
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
  const config = { live: { bg: "rgba(0,212,138,0.1)", color: "#00d48a", border: "rgba(0,212,138,0.2)", label: "● Operacional" }, dev: { bg: "rgba(77,159,255,0.1)", color: "#4d9fff", border: "rgba(77,159,255,0.2)", label: "● Em Dev" }, soon: { bg: "rgba(255,138,61,0.1)", color: "#ff8a3d", border: "rgba(255,138,61,0.2)", label: "● Em Breve" } };
  const c = config[status];
  return <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}</span>;
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeFaqTab, setActiveFaqTab] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [formStep, setFormStep] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY); setNavScrolled(window.scrollY > 60); };
    const onMouse = (e) => setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("mousemove", onMouse); };
  }, []);

  const faqTabs = ["Produtos", "Serviços", "Preços"];
  const faqsByTab = [FAQS.slice(0, 2), FAQS.slice(2, 4), FAQS.slice(4, 6)];

  return (
    <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Manrope', sans-serif", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
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
        .form-option:hover { border-color: rgba(200,255,0,0.4) !important; background: rgba(200,255,0,0.04) !important; }
        a { text-decoration: none; color: inherit; }

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
            background: #c8ff00 !important;
            color: #08080a !important;
            font-weight: 700 !important;
          }

          .hero-section {
            grid-template-columns: 1fr !important;
            padding: 100px 20px 60px !important;
            min-height: auto !important;
            gap: 0px !important;
          }
          .hero-windows { display: none !important; }
          .hero-stats {
            flex-wrap: wrap !important;
            gap: 20px !important;
          }
          .hero-stats > div { min-width: calc(50% - 20px); }
          .hero-buttons { flex-wrap: wrap !important; }
          .hero-buttons a { flex: 1; text-align: center; justify-content: center; min-width: 140px; }

          .section-padding { padding: 80px 20px !important; }

          .products-grid {
            grid-template-columns: 1fr !important;
          }
          .featured-span { grid-column: span 1 !important; }
          .featured-inner {
            grid-template-columns: 1fr !important;
          }
          .featured-code {
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.06) !important;
            border-radius: 0 0 18px 18px !important;
          }

          .startups-grid { grid-template-columns: 1fr !important; }

          .process-grid { grid-template-columns: 1fr 1fr !important; }

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
          .hero-stats { gap: 16px !important; }
        }
      `}</style>

      {/* ═══ ATMOSPHERE ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", animation: "grain 8s steps(10) infinite" }} />
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: "radial-gradient(circle, rgba(200,255,0,0.035) 0%, transparent 55%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(77,159,255,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 50% 30%, black 10%, transparent 60%)" }} />
      </div>

      {/* ═══ FLOATING DECORATIVE ELEMENTS ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Star size={14} color="rgba(200,255,0,0.15)" style={{ position: "absolute", top: "12%", left: "8%", animation: "float1 7s ease-in-out infinite" }} />
        <Star size={10} color="rgba(77,159,255,0.12)" style={{ position: "absolute", top: "35%", right: "12%", animation: "float2 9s ease-in-out infinite" }} />
        <Diamond size={10} color="rgba(255,107,157,0.15)" style={{ position: "absolute", top: "60%", left: "5%", animation: "float3 8s ease-in-out infinite" }} />
        <Star size={8} color="rgba(200,255,0,0.1)" style={{ position: "absolute", top: "75%", right: "8%", animation: "float1 11s ease-in-out infinite" }} />
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
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.82rem", color: "#c8ff00", marginRight: 12, letterSpacing: -0.5, whiteSpace: "nowrap" }}>NEXUS<span style={{ color: "rgba(255,255,255,0.25)" }}>.ai</span></span>
          <a href="#produtos" className="nav-link nav-links">Produtos</a>
          <a href="#startups" className="nav-link nav-links">Startups</a>
          <a href="#processo" className="nav-link nav-links">Processo</a>
          <a href="#depoimentos" className="nav-link nav-links">Clientes</a>
          <a href="#contato" className="nav-link nav-cta-desktop" style={{ padding: "8px 18px", background: "#c8ff00", color: "#08080a", fontWeight: 700, borderRadius: 100 }}>Contato</a>
          {/* Hamburger — hidden on desktop */}
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "none",
            borderRadius: "50%", cursor: "pointer", flexShrink: 0
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: menuOpen ? 0 : 4, alignItems: "center" }}>
              <span style={{ display: "block", width: 16, height: 2, background: "#eeede9", borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(1px)" : "none" }} />
              {!menuOpen && <span style={{ display: "block", width: 16, height: 2, background: "#eeede9", borderRadius: 2, transition: "all 0.3s" }} />}
              <span style={{ display: "block", width: 16, height: 2, background: "#eeede9", borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-1px)" : "none" }} />
            </div>
          </button>
        </nav>
      </div>

      {/* ═══ MOBILE MENU OVERLAY ═══ */}
      {menuOpen && (
        <div className="mobile-menu" style={{ display: "none" }}>
          <a href="#produtos" className="nav-link" onClick={() => setMenuOpen(false)}>Produtos</a>
          <a href="#startups" className="nav-link" onClick={() => setMenuOpen(false)}>Startups</a>
          <a href="#processo" className="nav-link" onClick={() => setMenuOpen(false)}>Processo</a>
          <a href="#depoimentos" className="nav-link" onClick={() => setMenuOpen(false)}>Clientes</a>
          <a href="#contato" className="nav-link mobile-cta" onClick={() => setMenuOpen(false)}>Contato</a>
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className="hero-section" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center", padding: "120px 60px 80px", gap: 60, maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div>
          <Reveal delay={0.1}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px 6px 10px", background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.12)", borderRadius: 100, marginBottom: 28 }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 8, height: 8, background: "#c8ff00", borderRadius: "50%" }} />
                <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "1px solid #c8ff00", animation: "pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite" }} />
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#c8ff00", textTransform: "uppercase", letterSpacing: 2 }}>Disponível para projetos</span>
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <h1 style={{ fontSize: "clamp(2.8rem, 5.2vw, 4.8rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, marginBottom: 24 }}>
              Construo{" "}
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#c8ff00" }}>inteligências</span>
              <br />que escalam negócios
            </h1>
          </Reveal>

          <Reveal delay={0.4}>
            <p style={{ fontSize: "1.08rem", lineHeight: 1.7, color: "rgba(255,255,255,0.45)", maxWidth: 460, marginBottom: 40 }}>
              Desenvolvo soluções com IA para gestão financeira, atendimento automatizado, 
              automação empresarial e presença digital. Conheça meu ecossistema.
            </p>
          </Reveal>

          <Reveal delay={0.55}>
            <div className="hero-buttons" style={{ display: "flex", gap: 12 }}>
              <a href="#produtos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 30px", background: "#c8ff00", color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem", transition: "all 0.3s" }}>
                Explorar Produtos <span style={{ fontSize: "1.1rem" }}>↗</span>
              </a>
              <a href="#startups" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, fontWeight: 600, fontSize: "0.92rem", transition: "all 0.3s" }}>
                Ver Startups
              </a>
            </div>
          </Reveal>

          {/* Stats row */}
          <Reveal delay={0.7}>
            <div className="hero-stats" style={{ display: "flex", gap: 40, marginTop: 56, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {[["4", "Projetos"], ["50+", "Clientes"], ["200+", "Automações"], ["100%", "Dedicação"]].map(([val, label], i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.5rem", fontWeight: 700, color: "#c8ff00" }}>{val}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Hero right — floating windows with mouse parallax */}
        <div className="hero-windows" style={{ position: "relative", height: 520, perspective: 1200 }}>
          {/* Terminal window */}
          <div style={{
            position: "absolute", width: 340, top: 0, left: 0, background: "#141416", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)", zIndex: 3, animation: "float1 8s ease-in-out infinite",
            transform: `translate(${(mousePos.x - 0.5) * 15}px, ${(mousePos.y - 0.5) * 12}px)`
          }}>
            <WinBar title="terminal — nexus" />
            <div style={{ padding: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", lineHeight: 2 }}>
              <div><span style={{ color: "#c8ff00" }}>▸</span> <span style={{ color: "#eeede9" }}>autonomy start</span> <span style={{ color: "#4d9fff" }}>--all-modules</span></div>
              <div style={{ color: "#00d48a" }}>✓ 12 sistemas carregados</div>
              <div style={{ color: "#00d48a" }}>✓ WhatsApp Bot conectado</div>
              <div style={{ color: "#00d48a" }}>✓ Finzo sync — 3 contas ativas</div>
              <div><span style={{ color: "#c8ff00" }}>▸</span> <span style={{ color: "#eeede9" }}>status</span></div>
              <div style={{ color: "#00d48a" }}>● Todos os serviços online</div>
              <div><span style={{ color: "#c8ff00" }}>▸</span> <span style={{ display: "inline-block", width: 7, height: 14, background: "#c8ff00", animation: "blink 1s step-end infinite", verticalAlign: "middle" }} /></div>
            </div>
          </div>

          {/* AI Store window */}
          <div style={{
            position: "absolute", width: 260, top: 50, right: 0, background: "#141416", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)", zIndex: 2, animation: "float2 10s ease-in-out infinite",
            transform: `translate(${(mousePos.x - 0.5) * -10}px, ${(mousePos.y - 0.5) * 8}px)`
          }}>
            <WinBar title="ai-store.app" />
            <div style={{ padding: 10 }}>
              {PRODUCTS.slice(0, 3).map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, marginBottom: 4, border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.3s" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", background: `${p.color}12`, flexShrink: 0 }}>{p.icon}</div>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>{p.tags.join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics window */}
          <div style={{
            position: "absolute", width: 200, bottom: 10, left: 60, background: "#141416", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5)", zIndex: 4, animation: "float3 9s ease-in-out infinite",
            transform: `translate(${(mousePos.x - 0.5) * 18}px, ${(mousePos.y - 0.5) * -10}px)`
          }}>
            <WinBar title="metrics.live" />
            <div style={{ padding: "8px 14px" }}>
              {[["Projetos", "4"], ["Clientes", "50+"], ["Automações", "200+"], ["Uptime", "99.9%"]].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>{k}</span>
                  <span style={{ fontSize: "0.76rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "#c8ff00" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative glow behind windows */}
          <div style={{ position: "absolute", width: 300, height: 300, top: "30%", left: "30%", background: "radial-gradient(circle, rgba(200,255,0,0.06) 0%, transparent 60%)", filter: "blur(50px)", pointerEvents: "none" }} />
        </div>
      </section>

      {/* ═══ MARQUEE ═══ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 0", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 48, animation: "marquee 30s linear infinite", width: "max-content" }}>
          {[...Array(2)].flatMap((_, ri) =>
            ["💰 Gestão Financeira", "💬 WhatsApp Bot", "⚙️ Automação Empresarial", "🌐 Criação de Sites", "📊 Análise de Gastos", "🤖 Pré-Atendimento IA", "📋 12 Módulos ERP", "🎨 Design com IA", "🔗 Open Finance"].map((t, i) =>
              <span key={`${ri}-${i}`} style={{ fontSize: "0.82rem", fontWeight: 500, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <Diamond size={5} color="rgba(200,255,0,0.3)" /> {t}
              </span>
            )
          )}
        </div>
      </div>

      {/* ═══ AI PRODUCTS ═══ */}
      <section id="produtos" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#c8ff00" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#c8ff00", textTransform: "uppercase", letterSpacing: 3 }}>Produtos</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            IAs prontas para <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>escalar</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6, marginBottom: 64 }}>
            Cada projeto resolve um problema real — gestão financeira, atendimento, automação e presença digital.
          </p>
        </Reveal>

        {/* Bento Grid */}
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.id} type={i % 2 === 0 ? "up" : "scale"} delay={i * 0.08}>
              <div className={`product-card ${p.featured ? "featured-inner" : ""}`}
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
                    <div style={{ padding: 32 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: `${p.color}12`, border: `1px solid ${p.color}18`, marginBottom: 18 }}>{p.icon}</div>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 10, letterSpacing: -0.5 }}>{p.name}</h3>
                      <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 16 }}>{p.desc}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {p.tags.map(t => <span key={t} style={{ padding: "3px 9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100, fontSize: "0.65rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.4)" }}>{t}</span>)}
                      </div>
                    </div>
                    <div className="featured-code" style={{ background: "#0c0c0e", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", borderRadius: "0 18px 18px 0" }}>
                      <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: `${p.color}15`, filter: "blur(40px)", top: "20%", left: "30%", animation: "float1 6s ease-in-out infinite" }} />
                      <div style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", background: "rgba(77,159,255,0.1)", filter: "blur(40px)", bottom: "20%", right: "25%", animation: "float2 8s ease-in-out infinite" }} />

                      {/* Finzo App */}
                      {p.id === 1 && (
                        <div style={{ zIndex: 1, padding: 24, width: "100%", maxWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>Contas conectadas</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #820ad1, #9b30ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>Nu</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Nubank</div>
                                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Conta corrente</div>
                              </div>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(76,217,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: "#4cd964" }}>✓</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #ff7a00, #ff9533)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: "#fff" }}>Inter</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Inter</div>
                                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Conta corrente</div>
                              </div>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(76,217,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: "#4cd964" }}>✓</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <div style={{ flex: 1, padding: "10px 12px", background: "rgba(200,255,0,0.05)", border: "1px solid rgba(200,255,0,0.1)", borderRadius: 10 }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Economia</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c8ff00" }}>+12%</div>
                            </div>
                            <div style={{ flex: 1, padding: "10px 12px", background: "rgba(77,159,255,0.05)", border: "1px solid rgba(77,159,255,0.1)", borderRadius: 10 }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Gastos</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#4d9fff" }}>R$ 2.4k</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.58rem", color: "rgba(76,217,100,0.6)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginTop: 2 }}>● Sincronizado em tempo real</div>
                        </div>
                      )}

                      {/* WhatsApp Bot */}
                      {p.id === 2 && (
                        <div style={{ zIndex: 1, padding: 24, width: "100%", maxWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>Conversas recentes</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ padding: "10px 14px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.12)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Maria Silva</div>
                                <span style={{ padding: "2px 8px", background: "rgba(37,211,102,0.15)", borderRadius: 100, fontSize: "0.5rem", fontWeight: 600, color: "#25D366" }}>Resolvido</span>
                              </div>
                              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Agendamento confirmado automaticamente</div>
                            </div>
                            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>João Santos</div>
                                <span style={{ padding: "2px 8px", background: "rgba(255,180,0,0.15)", borderRadius: 100, fontSize: "0.5rem", fontWeight: 600, color: "#ffb400" }}>Pré-atendimento</span>
                              </div>
                              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Coletando informações do cliente...</div>
                            </div>
                            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Ana Costa</div>
                                <span style={{ padding: "2px 8px", background: "rgba(77,159,255,0.15)", borderRadius: 100, fontSize: "0.5rem", fontWeight: 600, color: "#4d9fff" }}>Encaminhado</span>
                              </div>
                              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Transferido para atendente humano</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Filtradas</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#25D366" }}>70%</div>
                            </div>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Tempo médio</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>8s</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Autonomy */}
                      {p.id === 3 && (
                        <div style={{ zIndex: 1, padding: 24, width: "100%", maxWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>Módulos ativos</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {[
                              { icon: "📊", name: "Contábil", status: true },
                              { icon: "💰", name: "Financeiro", status: true },
                              { icon: "📋", name: "Fiscal", status: true },
                              { icon: "👥", name: "Pessoal", status: true },
                              { icon: "⚖️", name: "Legal", status: true },
                              { icon: "📦", name: "Estoque", status: true },
                            ].map((m, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                                <span style={{ fontSize: "0.75rem" }}>{m.icon}</span>
                                <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", flex: 1 }}>{m.name}</span>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4cd964" }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: "10px 14px", background: "rgba(77,159,255,0.05)", border: "1px solid rgba(77,159,255,0.1)", borderRadius: 10, marginTop: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Rotinas automatizadas</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#4d9fff" }}>80%</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Módulos</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>12</div>
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.58rem", color: "rgba(77,159,255,0.6)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginTop: 2 }}>● Todos os módulos operacionais</div>
                        </div>
                      )}

                      {/* Sites para Empresas */}
                      {p.id === 4 && (
                        <div style={{ zIndex: 1, padding: 24, width: "100%", maxWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>Projeto em andamento</div>
                          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #ff6b9d, #ff8fb5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff" }}>🏪</div>
                              <div>
                                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Loja Bella</div>
                                <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>E-commerce · Moda</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {[
                                { label: "Design com IA", done: true },
                                { label: "Layout responsivo", done: true },
                                { label: "SEO otimizado", done: true },
                                { label: "Integração pagamento", done: false },
                              ].map((step, idx) => (
                                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: step.done ? "rgba(76,217,100,0.15)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", color: step.done ? "#4cd964" : "rgba(255,255,255,0.2)" }}>{step.done ? "✓" : ""}</div>
                                  <span style={{ fontSize: "0.62rem", color: step.done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)", textDecoration: step.done ? "none" : "none" }}>{step.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(255,107,157,0.05)", border: "1px solid rgba(255,107,157,0.1)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Progresso</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ff6b9d" }}>75%</div>
                            </div>
                            <div style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, textAlign: "center" }}>
                              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Entrega</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>5 dias</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.58rem", color: "rgba(255,107,157,0.6)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginTop: 2 }}>● Design gerado por IA</div>
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

      {/* ═══ STARTUPS ═══ */}
      <section id="startups" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#4d9fff" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#4d9fff", textTransform: "uppercase", letterSpacing: 3 }}>Portfolio</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            Projetos que <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>construí</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6, marginBottom: 64 }}>
            Soluções criadas do zero — cada uma focada em resolver um problema real com tecnologia e IA.
          </p>
        </Reveal>

        <div className="startups-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {STARTUPS.map((s, i) => (
            <Reveal key={s.id} type={i % 2 === 0 ? "rotateL" : "rotateR"} delay={i * 0.1}>
              <div className="startup-card" style={{
                background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden", position: "relative"
              }}>
                {/* Top accent line */}
                <div style={{ height: 2, background: `linear-gradient(to right, ${s.color}, transparent)` }} />

                {/* File header — OS style */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${s.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Diamond size={8} color={s.color} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)" }}>{s.file}</span>
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                <div style={{ padding: "24px 20px" }}>
                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: -0.5, marginBottom: 10 }}>{s.name}</h3>
                  <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 16 }}>{s.desc}</p>
                  <div style={{ display: "flex", gap: 12, fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>
                    <span>{s.category}</span>
                    <span>·</span>
                    <span>{s.year}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ PROCESS — hen-ry editorial style ═══ */}
      <section id="processo" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#ff6b9d" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#ff6b9d", textTransform: "uppercase", letterSpacing: 3 }}>Processo</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 64 }}>
            Do briefing ao <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>deploy</span>
          </h2>
        </Reveal>

        <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, borderRadius: 18, overflow: "hidden" }}>
          {[
            { num: "01", icon: "🔍", title: "Diagnóstico", desc: "Mapeamos gargalos e identificamos onde a IA gera mais impacto no seu negócio." },
            { num: "02", icon: "🔧", title: "Arquitetura", desc: "Stack, modelos e integrações. Protótipo funcional em 2 semanas." },
            { num: "03", icon: "🧪", title: "Treinamento", desc: "IA treinada com seus dados, fluxos e regras. Refinamento até 95%+ accuracy." },
            { num: "04", icon: "🚀", title: "Deploy", desc: "Produção com monitoramento 24/7, suporte dedicado e otimização contínua." },
          ].map((step, i) => (
            <Reveal key={i} type="up" delay={i * 0.1}>
              <div style={{ background: "#111114", padding: "36px 24px", height: "100%", transition: "all 0.3s", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.15)", fontWeight: 600, letterSpacing: 2 }}>{step.num}</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                </div>
                <div style={{ fontSize: "2rem", marginBottom: 14 }}>{step.icon}</div>
                <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 10 }}>{step.title}</h4>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.65 }}>{step.desc}</p>

                {/* Decorative star */}
                <Star size={8} color="rgba(255,107,157,0.15)" style={{ position: "absolute", top: 20, right: 20 }} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ TESTIMONIALS — iMessage window ═══ */}
      <section id="depoimentos" className="section-padding" style={{ padding: "140px 60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Star size={12} color="#00d48a" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "#00d48a", textTransform: "uppercase", letterSpacing: 3 }}>Clientes</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 14 }}>
            Quem já <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>transformou</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6, marginBottom: 64 }}>
            Resultados reais de quem confiou no meu trabalho.
          </p>
        </Reveal>

        <Reveal type="scale" delay={0.2}>
          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 22, overflow: "hidden", maxWidth: 720, margin: "0 auto", boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
            <WinBar title="mensagens — clientes" />
            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14, maxHeight: 440, overflowY: "auto" }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: i % 2 === 0 ? "flex-start" : "flex-end", maxWidth: "78%" }}>
                  <div style={{
                    padding: "12px 16px", borderRadius: 18, fontSize: "0.86rem", lineHeight: 1.55,
                    background: i % 2 === 0 ? "#1a1a1e" : "rgba(200,255,0,0.1)",
                    color: i % 2 === 0 ? "rgba(255,255,255,0.7)" : "#c8ff00",
                    borderBottomLeftRadius: i % 2 === 0 ? 4 : 18,
                    borderBottomRightRadius: i % 2 !== 0 ? 4 : 18,
                  }}>
                    {t.text}
                  </div>
                  <span style={{ fontSize: "0.64rem", color: "rgba(255,255,255,0.2)", padding: "0 6px", textAlign: i % 2 === 0 ? "left" : "right" }}>
                    {t.name} — {t.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
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
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, letterSpacing: -1.5, marginBottom: 40 }}>
            Perguntas <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>frequentes</span>
          </h2>
        </Reveal>

        <Reveal delay={0.2}>
          <div style={{ maxWidth: 700 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {faqTabs.map((tab, i) => (
                <button key={i} onClick={() => { setActiveFaqTab(i); setOpenFaq(null); }} style={{
                  padding: "8px 20px", borderRadius: 100, border: "1px solid", cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif", fontSize: "0.78rem", fontWeight: 600, transition: "all 0.3s",
                  background: activeFaqTab === i ? "#c8ff00" : "transparent",
                  color: activeFaqTab === i ? "#08080a" : "rgba(255,255,255,0.4)",
                  borderColor: activeFaqTab === i ? "#c8ff00" : "rgba(255,255,255,0.08)"
                }}>{tab}</button>
              ))}
            </div>

            {/* FAQ items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {faqsByTab[activeFaqTab].map((faq, i) => (
                <div key={`${activeFaqTab}-${i}`} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 22px",
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
      <section id="contato" className="cta-section" style={{ padding: "100px 60px 160px", maxWidth: 1440, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Decorative elements — hen-ry style */}
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", width: 400, height: 400, background: "radial-gradient(circle, rgba(200,255,0,0.04) 0%, transparent 55%)", filter: "blur(40px)", pointerEvents: "none" }} />

        <Reveal type="scale">
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
              <Star size={16} color="#c8ff00" style={{ animation: "float1 4s ease-in-out infinite" }} />
              <Star size={12} color="#4d9fff" style={{ animation: "float2 5s ease-in-out infinite" }} />
              <Star size={14} color="#ff6b9d" style={{ animation: "float3 6s ease-in-out infinite" }} />
            </div>

            <h2 style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.05, marginBottom: 20 }}>
              Pronto pra construir<br />algo <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#c8ff00" }}>extraordinário</span>?
            </h2>
            <p style={{ fontSize: "1.08rem", color: "rgba(255,255,255,0.4)", maxWidth: 460, margin: "0 auto 44px", lineHeight: 1.6 }}>
              Agende uma conversa sem compromisso e descubra como IA pode acelerar seus resultados.
            </p>
            <div className="cta-buttons" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: "#c8ff00", color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.95rem" }}>
                Agendar Reunião <span>↗</span>
              </a>
              <a href="https://wa.me/5511932227752" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 30px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, fontWeight: 600, fontSize: "0.95rem" }}>
                WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer-section" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "60px", maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.9rem", color: "#c8ff00" }}>NEXUS<span style={{ color: "rgba(255,255,255,0.2)" }}>.ai</span></span>
            <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 300, marginTop: 12 }}>Criando soluções inteligentes que resolvem problemas reais. Do código ao produto.</p>
          </div>
          {[
            { title: "Produtos", links: ["Finzo App", "WhatsApp Bot", "Autonomy", "Sites para Empresas"] },
            { title: "Serviços", links: ["Automação", "Atendimento IA", "Gestão Financeira", "Web Design"] },
            { title: "Contato", links: ["contato@nexus.ai", "LinkedIn", "GitHub", "WhatsApp"] },
          ].map((col, i) => (
            <div key={i}>
              <h5 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>{col.title}</h5>
              {col.links.map(link => {
                const isWhatsappLink = link === "WhatsApp";
                return (
                  <a
                    key={link}
                    href={isWhatsappLink ? "https://wa.me/5511932227752" : "#"}
                    target={isWhatsappLink ? "_blank" : undefined}
                    rel={isWhatsappLink ? "noopener noreferrer" : undefined}
                    style={{ display: "block", color: "rgba(255,255,255,0.35)", fontSize: "0.86rem", padding: "3px 0", transition: "color 0.2s" }}
                  >
                    {link}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="footer-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>© 2026 NEXUS.ai — Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="#" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Privacidade</a>
            <a href="#" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Termos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
