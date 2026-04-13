import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function DashboardsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const ACCENT = "#ff6b9d";

  const sectionStyle = { marginBottom: 56 };
  const h2Style = { fontSize: "1.5rem", fontWeight: 700, color: "#eeede9", marginBottom: 18, letterSpacing: -0.4 };
  const pStyle = { fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 14 };

  const FEATURES = [
    { icon: "📊", title: "KPIs em tempo real", desc: "Indicadores atualizados a cada evento — vendas, estoque, atendimentos e caixa vivos, sem planilha intermediária." },
    { icon: "🎯", title: "Painéis por papel", desc: "Visões separadas para diretoria, operação e times comerciais — cada um vê só o que precisa decidir." },
    { icon: "📈", title: "Análise histórica", desc: "Tendências, sazonalidade e comparativos mês-a-mês com drill-down até o registro que originou o número." },
    { icon: "🔔", title: "Alertas automáticos", desc: "Avisos por WhatsApp ou e-mail quando uma meta é batida, um indicador cai ou uma anomalia é detectada." },
    { icon: "📤", title: "Relatórios agendados", desc: "PDF e planilha disparados automaticamente no dia e hora certos — sem alguém precisar lembrar de gerar." },
    { icon: "🔍", title: "Dados unificados", desc: "ERP, CRM, WhatsApp, gateway de pagamento e planilhas consolidados na mesma fonte de verdade." },
  ];

  const METRICS = [
    { metric: "–80%", label: "Tempo gasto", desc: "em consolidar planilhas toda semana" },
    { metric: "1 tela", label: "Fonte única", desc: "no lugar de 5 sistemas abertos ao mesmo tempo" },
    { metric: "< 1min", label: "Atualização", desc: "dados vivos — não relatório de ontem" },
    { metric: "24/7", label: "Disponível", desc: "no celular, tablet ou TV de parede" },
  ];

  const USE_CASES = [
    "Dashboard comercial com pipeline, conversão e ticket médio por vendedor",
    "Painel financeiro de fluxo de caixa, DRE e contas a pagar/receber",
    "KPIs de atendimento — tempo de resposta, NPS e volume por canal",
    "Gestão de estoque com curva ABC, giro e alertas de ruptura",
    "Monitor operacional com SLA, backlog e produtividade por equipe",
    "Visão de diretoria — consolidado de todas as áreas em 1 tela executiva",
  ];

  const STACK = [
    { area: "Visualização", techs: ["Metabase", "Grafana", "Power BI", "Custom UI"] },
    { area: "Dados", techs: ["PostgreSQL", "BigQuery", "dbt", "ETL customizado"] },
    { area: "Integração", techs: ["APIs", "Webhooks", "Google Sheets", "CSV/Excel"] },
    { area: "Entrega", techs: ["Web", "Mobile", "TV dashboard", "Export PDF"] },
  ];

  const PROCESS = [
    { num: "01", title: "Quais decisões?", desc: "Antes de pensar em gráfico, definimos quais decisões o painel precisa sustentar e quem vai usá-lo." },
    { num: "02", title: "Modelagem", desc: "Unificamos as fontes, limpamos os dados e construímos o modelo semântico dos indicadores." },
    { num: "03", title: "Design do painel", desc: "Layouts por papel, hierarquia visual clara e drill-down guiado — painel que se lê em 10 segundos." },
    { num: "04", title: "Evolução contínua", desc: "Novos KPIs conforme o negócio muda, manutenção das fontes e ajustes de performance." },
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
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(255,107,157,0.28) !important; }

        @media (max-width: 768px) {
          .svc-header { padding: 16px 20px !important; }
          .svc-hero { padding: 60px 20px 40px !important; }
          .svc-section { padding: 0 20px !important; }
          .svc-grid-2 { grid-template-columns: 1fr !important; }
          .svc-grid-3 { grid-template-columns: 1fr !important; }
          .svc-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .svc-footer { padding: 24px 20px !important; flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
        }
      `}</style>

      {/* Atmosphere */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 55%)`, filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(200,255,0,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header className="svc-header" style={{ position: "sticky", top: 0, zIndex: 100, padding: "20px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,10,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.82rem", color: "#c8ff00", letterSpacing: -0.5 }}>
          NORA<span style={{ color: "rgba(255,255,255,0.25)" }}>.tech</span>
        </Link>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.3s" }}>
          <span style={{ fontSize: "0.9rem" }}>&larr;</span> Voltar ao início
        </Link>
      </header>

      {/* Hero */}
      <section className="svc-hero" style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "96px 32px 56px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: `${ACCENT}14`, border: `1px solid ${ACCENT}33`, borderRadius: 100, marginBottom: 24 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>S.03 · SERVIÇO</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)", fontWeight: 800, letterSpacing: -1.8, lineHeight: 1.05, marginBottom: 20 }}>
          Dashboards &{" "}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>BI</span>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, maxWidth: 640, marginBottom: 36 }}>
          Painéis em tempo real que consolidam dados de vendas, finanças e operação em KPIs claros — para decisões rápidas, baseadas em fato e não em planilha desatualizada.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20dashboards%20e%20BI." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", background: "#c8ff00", color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.9rem" }}>
            Solicitar demonstração <span style={{ fontSize: "1rem" }}>↗</span>
          </a>
          <Link to="/#servicos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, fontWeight: 600, fontSize: "0.9rem" }}>
            Ver outros serviços
          </Link>
        </div>
      </section>

      {/* Main */}
      <main className="svc-section" style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "32px 32px 120px" }}>
        {/* Metrics strip */}
        <section style={sectionStyle}>
          <div className="svc-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {METRICS.map((b) => (
              <div key={b.label} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 22 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.6rem", fontWeight: 800, color: ACCENT, letterSpacing: -1, marginBottom: 6 }}>{b.metric}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>O que entregamos</span>
          <h2 style={h2Style}>Decisão baseada em dado — não em achismo</h2>
          <p style={{ ...pStyle, marginBottom: 32, maxWidth: 680 }}>
            Dashboard que serve pra decidir, não pra decorar parede. Começamos pelas decisões que o painel precisa sustentar e modelamos os dados em torno disso.
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
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Painéis que entregamos</span>
          <h2 style={h2Style}>Exemplos de dashboards em produção</h2>
          <div className="svc-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            {USE_CASES.map((uc) => (
              <div key={uc} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>{uc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section style={sectionStyle}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Stack & ferramentas</span>
          <h2 style={h2Style}>Do banco ao gráfico, sem caixa-preta</h2>
          <div className="svc-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 8 }}>
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
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: ACCENT, marginBottom: 12 }}>Metodologia</span>
          <h2 style={h2Style}>Do dado bruto à decisão, em 4 etapas</h2>
          <div className="svc-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 8 }}>
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
        <section style={{ marginTop: 64, padding: 40, background: `linear-gradient(135deg, ${ACCENT}14 0%, rgba(200,255,0,0.04) 100%)`, border: `1px solid ${ACCENT}33`, borderRadius: 20, textAlign: "center" }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: -0.6, marginBottom: 10 }}>
            Quer trocar as{" "}
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>planilhas</span>{" "}
            por um painel vivo?
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 580, margin: "0 auto 24px" }}>
            Mostramos um protótipo de painel com os dados da sua empresa em até 7 dias — sem compromisso, sem letra miúda.
          </p>
          <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20ver%20um%20prot%C3%B3tipo%20de%20dashboard." target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "#c8ff00", color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.92rem" }}>
            Pedir protótipo <span style={{ fontSize: "1rem" }}>↗</span>
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
