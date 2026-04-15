import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function SistemasPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const ACCENT = "#c8ff00";

  const sectionStyle = { marginBottom: 72 };
  const h2Style = { fontSize: "clamp(1.55rem, 2.4vw, 1.95rem)", fontWeight: 700, color: "#eeede9", marginBottom: 20, letterSpacing: -0.6 };
  const pStyle = { fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: 14 };
  const labelStyle = { display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 14 };

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
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(200,255,0,0.3) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,255,0,0.08); }
        .cta-btn { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .cta-btn:hover { transform: translateY(-2px); }

        @media (max-width: 768px) {
          .svc-header { padding: 16px 20px !important; }
          .svc-hero { padding: 80px 20px 48px !important; }
          .svc-section { padding: 24px 20px 80px !important; }
          .svc-grid-2 { grid-template-columns: 1fr !important; }
          .svc-grid-3 { grid-template-columns: 1fr !important; }
          .svc-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .svc-cta { padding: 36px 24px !important; }
          .svc-footer { padding: 24px 20px !important; flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
        }
      `}</style>

      {/* Atmosphere */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 55%)`, filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(77,159,255,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header className="svc-header" style={{ position: "sticky", top: 0, zIndex: 100, padding: "20px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,10,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.82rem", color: "#c8ff00", letterSpacing: -0.5 }}>
          NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span>
        </Link>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", padding: "8px 18px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.3s" }}>
          <span style={{ fontSize: "0.9rem" }}>&larr;</span> Voltar ao início
        </Link>
      </header>

      {/* Hero */}
      <section className="svc-hero" style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "120px 40px 72px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: `${ACCENT}14`, border: `1px solid ${ACCENT}33`, borderRadius: 100, marginBottom: 28 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, color: ACCENT, letterSpacing: 2.5 }}>S.01 · SERVIÇO</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.4rem, 5.5vw, 4rem)", fontWeight: 800, letterSpacing: -2, lineHeight: 1.04, marginBottom: 24, maxWidth: 820 }}>
          Sistemas{" "}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>sob medida</span>
        </h1>
        <p style={{ fontSize: "1.12rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 640, marginBottom: 40 }}>
          Aplicações web e mobile construídas sob medida para o fluxo real da sua empresa — com arquitetura escalável, código proprietário e manutenção contínua pela nossa equipe.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a className="cta-btn" href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20desenvolvimento%20de%20sistema%20sob%20medida." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.9rem" }}>
            Solicitar orçamento <span style={{ fontSize: "1rem" }}>↗</span>
          </a>
          <Link className="cta-btn" to="/#produtos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 100, fontWeight: 600, fontSize: "0.9rem", color: "rgba(255,255,255,0.85)" }}>
            Ver projetos entregues
          </Link>
        </div>
      </section>

      {/* Main content */}
      <main className="svc-section" style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "40px 40px 140px" }}>
        {/* Features */}
        <section style={sectionStyle}>
          <span style={labelStyle}>O que entregamos</span>
          <h2 style={h2Style}>Engenharia de software aplicada ao seu negócio</h2>
          <p style={{ ...pStyle, marginBottom: 36, maxWidth: 680 }}>
            Cada sistema nasce do fluxo real da sua empresa. Entregamos software que cabe no processo — e não processos que precisam se ajustar a um software de prateleira.
          </p>
          <div className="svc-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28 }}>
                <div style={{ fontSize: "1.7rem", marginBottom: 18 }}>{f.icon}</div>
                <h3 style={{ fontSize: "1.02rem", fontWeight: 700, marginBottom: 10, letterSpacing: -0.2 }}>{f.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section style={sectionStyle}>
          <span style={labelStyle}>Casos de uso</span>
          <h2 style={h2Style}>Exemplos de sistemas que construímos</h2>
          <div className="svc-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            {USE_CASES.map((uc) => (
              <div key={uc} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 22px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.55 }}>{uc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section style={sectionStyle}>
          <span style={labelStyle}>Stack técnico</span>
          <h2 style={h2Style}>Tecnologias modernas, aplicadas com critério</h2>
          <div className="svc-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 8 }}>
            {STACK.map((s) => (
              <div key={s.area} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, color: ACCENT, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 }}>{s.area}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.techs.map((t) => (
                    <span key={t} style={{ padding: "5px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.72)" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section style={sectionStyle}>
          <span style={labelStyle}>Como funciona</span>
          <h2 style={h2Style}>Do diagnóstico ao deploy em produção</h2>
          <div className="svc-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 8 }}>
            {PROCESS.map((p) => (
              <div key={p.num} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 26 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 700, color: ACCENT, letterSpacing: 2.5, marginBottom: 14 }}>{p.num}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 10, letterSpacing: -0.2 }}>{p.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="svc-cta" style={{ marginTop: 72, padding: 56, background: `linear-gradient(135deg, ${ACCENT}14 0%, rgba(77,159,255,0.05) 100%)`, border: `1px solid ${ACCENT}33`, borderRadius: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.7rem, 2.8vw, 2.1rem)", fontWeight: 800, letterSpacing: -0.8, marginBottom: 14 }}>
            Precisa de um sistema <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>sob medida</span>?
          </h2>
          <p style={{ fontSize: "0.98rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 580, margin: "0 auto 28px" }}>
            Conversamos sobre o fluxo da sua empresa, avaliamos a viabilidade técnica e apresentamos um escopo com prazo e valor em até 48h.
          </p>
          <a className="cta-btn" href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20desenvolvimento%20de%20sistema%20sob%20medida." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem" }}>
            Falar com especialista <span style={{ fontSize: "1rem" }}>↗</span>
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 60px", position: "relative", zIndex: 1 }}>
        <div className="svc-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1120, margin: "0 auto" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>&copy; 2026 Noratech &mdash; Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Privacidade</Link>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
