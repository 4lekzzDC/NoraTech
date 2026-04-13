import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function SistemasPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const ACCENT = "#c8ff00";

  const sectionStyle = { marginBottom: 56 };
  const h2Style = { fontSize: "1.5rem", fontWeight: 700, color: "#eeede9", marginBottom: 18, letterSpacing: -0.4 };
  const pStyle = { fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 14 };

  const FEATURES = [
    { icon: "🧩", title: "Arquitetura sob medida", desc: "Projetamos a arquitetura do sistema a partir do seu fluxo real — sem templates genéricos nem amarração a ferramentas de terceiros." },
    { icon: "⚡", title: "Código proprietário", desc: "Todo o código-fonte pertence ao cliente. Sem caixa-preta, sem vendor lock-in — auditável, versionado e documentado." },
    { icon: "📱", title: "Web & Mobile", desc: "Aplicações web responsivas e apps mobile nativos ou híbridos, com a mesma base de dados e regras de negócio." },
    { icon: "🔒", title: "Segurança e LGPD", desc: "Autenticação robusta, criptografia ponta-a-ponta e conformidade com LGPD desde o primeiro commit." },
    { icon: "🚀", title: "Escalável em produção", desc: "Infra preparada para crescer — cache, filas, balanceamento e monitoramento contínuo em cloud." },
    { icon: "🛠️", title: "Manutenção contínua", desc: "SLA definido em contrato, relatórios mensais de saúde do sistema e roadmap compartilhado de evolução." },
  ];

  const USE_CASES = [
    "ERP interno para gestão de operação e estoque",
    "Portal do cliente com área restrita e autoatendimento",
    "Sistema de agendamento com calendário e notificações",
    "Plataforma SaaS multiusuário com cobrança recorrente",
    "Marketplace com fluxo de vendedor, comprador e pagamento",
    "Back-office administrativo com permissões granulares",
  ];

  const STACK = [
    { area: "Frontend", techs: ["React", "Next.js", "React Native", "TypeScript"] },
    { area: "Backend", techs: ["Node.js", "Python", "PostgreSQL", "Redis"] },
    { area: "Cloud & DevOps", techs: ["AWS", "Vercel", "Docker", "CI/CD"] },
    { area: "Observabilidade", techs: ["Sentry", "Grafana", "Logs centralizados"] },
  ];

  const PROCESS = [
    { num: "01", title: "Diagnóstico", desc: "Entendemos o fluxo atual, os gargalos e o que precisa ser automatizado ou centralizado." },
    { num: "02", title: "Arquitetura", desc: "Desenhamos a estrutura técnica, o modelo de dados e definimos o stack ideal para o caso." },
    { num: "03", title: "Desenvolvimento", desc: "Entregas semanais em ambiente de homologação — você acompanha a evolução em tempo real." },
    { num: "04", title: "Deploy & Suporte", desc: "Publicação em produção, monitoramento 24/7 e evolução contínua via roadmap compartilhado." },
  ];

  return (
    <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Manrope', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        a { text-decoration: none; color: inherit; }
        .feature-card { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(200,255,0,0.22) !important; }

        @media (max-width: 768px) {
          .svc-header { padding: 16px 20px !important; }
          .svc-hero { padding: 60px 20px 40px !important; }
          .svc-section { padding: 0 20px !important; }
          .svc-grid-2 { grid-template-columns: 1fr !important; }
          .svc-grid-3 { grid-template-columns: 1fr !important; }
          .svc-footer { padding: 24px 20px !important; flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
        }
      `}</style>

      {/* Atmosphere */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: `radial-gradient(circle, ${ACCENT}0D 0%, transparent 55%)`, filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(77,159,255,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header className="svc-header" style={{ position: "sticky", top: 0, zIndex: 100, padding: "20px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,10,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.82rem", color: ACCENT, letterSpacing: -0.5 }}>
          NORA<span style={{ color: "rgba(255,255,255,0.25)" }}>.tech</span>
        </Link>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.3s" }}>
          <span style={{ fontSize: "0.9rem" }}>&larr;</span> Voltar ao início
        </Link>
      </header>

      {/* Hero */}
      <section className="svc-hero" style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "96px 32px 56px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: `${ACCENT}14`, border: `1px solid ${ACCENT}33`, borderRadius: 100, marginBottom: 24 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>S.01 · SERVIÇO</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)", fontWeight: 800, letterSpacing: -1.8, lineHeight: 1.05, marginBottom: 20 }}>
          Sistemas{" "}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>sob medida</span>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, maxWidth: 640, marginBottom: 36 }}>
          Aplicações web e mobile construídas sob medida para o fluxo real da sua empresa — com arquitetura escalável, código proprietário e manutenção contínua pela nossa equipe.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20desenvolvimento%20de%20sistema%20sob%20medida." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.9rem" }}>
            Solicitar orçamento <span style={{ fontSize: "1rem" }}>↗</span>
          </a>
          <Link to="/#produtos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, fontWeight: 600, fontSize: "0.9rem" }}>
            Ver projetos entregues
          </Link>
        </div>
      </section>

      {/* Main content */}
      <main className="svc-section" style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "32px 32px 120px" }}>
        {/* Features */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>O que entregamos</span>
          <h2 style={h2Style}>Engenharia de software aplicada ao seu negócio</h2>
          <p style={{ ...pStyle, marginBottom: 32, maxWidth: 680 }}>
            Cada sistema nasce do fluxo real da sua empresa. Entregamos software que cabe no processo — e não processos que precisam se ajustar a um software de prateleira.
          </p>
          <div className="svc-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: "1.6rem", marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8, letterSpacing: -0.2 }}>{f.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Casos de uso</span>
          <h2 style={h2Style}>Exemplos de sistemas que construímos</h2>
          <div className="svc-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            {USE_CASES.map((uc) => (
              <div key={uc} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>{uc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Stack técnico</span>
          <h2 style={h2Style}>Tecnologias modernas, aplicadas com critério</h2>
          <div className="svc-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 8 }}>
            {STACK.map((s) => (
              <div key={s.area} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.64rem", fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{s.area}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.techs.map((t) => (
                    <span key={t} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.7)" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Como funciona</span>
          <h2 style={h2Style}>Do diagnóstico ao deploy em produção</h2>
          <div className="svc-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 8 }}>
            {PROCESS.map((p) => (
              <div key={p.num} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, color: ACCENT, letterSpacing: 2, marginBottom: 12 }}>{p.num}</div>
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ marginTop: 64, padding: 40, background: `linear-gradient(135deg, ${ACCENT}10 0%, rgba(77,159,255,0.04) 100%)`, border: `1px solid ${ACCENT}22`, borderRadius: 20, textAlign: "center" }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: -0.6, marginBottom: 10 }}>
            Precisa de um sistema <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>sob medida</span>?
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 24px" }}>
            Conversamos sobre o fluxo da sua empresa, avaliamos a viabilidade técnica e apresentamos um escopo com prazo e valor em até 48h.
          </p>
          <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20desenvolvimento%20de%20sistema%20sob%20medida." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem" }}>
            Falar com especialista <span style={{ fontSize: "1rem" }}>↗</span>
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 60px", position: "relative", zIndex: 1 }}>
        <div className="svc-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1080, margin: "0 auto" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>&copy; 2026 Noratech &mdash; Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>Privacidade</Link>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
