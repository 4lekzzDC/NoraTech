import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ClienteAreaPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const ACCENT = "#c8ff00";

  // Mock client data — seria substituído por dados reais via API/auth
  const client = {
    name: "João Silva",
    company: "Acme Indústria Ltda",
    email: "joao.silva@acme.com.br",
    memberSince: "Mar/2024",
    avatar: "JS",
  };

  const SUMMARY = [
    { label: "Sistemas ativos", value: "3", hint: "todos operando" },
    { label: "Faturas em dia", value: "12", hint: "sem pendências" },
    { label: "Próxima cobrança", value: "25 abr", hint: "R$ 1.480,00" },
    { label: "SLA do mês", value: "99.98%", hint: "acima do contrato" },
  ];

  const SYSTEMS = [
    {
      name: "Finzo — Gestão Financeira",
      tag: "SaaS · Multi-conta",
      status: "Ativo",
      statusColor: "#00d48a",
      plan: "Plano Business",
      lastAccess: "hoje, 09:14",
      url: "#",
      icon: "💰",
    },
    {
      name: "WhatsApp Bot — Atendimento",
      tag: "Automação · 24/7",
      status: "Ativo",
      statusColor: "#00d48a",
      plan: "Plano Pro · 2 números",
      lastAccess: "hoje, 14:02",
      url: "https://whatsapp-mu.vercel.app",
      icon: "💬",
    },
    {
      name: "Site Institucional",
      tag: "Hospedagem · CDN",
      status: "Ativo",
      statusColor: "#00d48a",
      plan: "Plano Standard",
      lastAccess: "ontem, 18:40",
      url: "https://criadordesites-rose.vercel.app",
      icon: "🌐",
    },
  ];

  const INVOICES = [
    { id: "NT-2026-0412", date: "25/03/2026", amount: "R$ 1.480,00", status: "Paga", ref: "Mensalidade Abr/26" },
    { id: "NT-2026-0311", date: "25/02/2026", amount: "R$ 1.480,00", status: "Paga", ref: "Mensalidade Mar/26" },
    { id: "NT-2026-0210", date: "25/01/2026", amount: "R$ 1.480,00", status: "Paga", ref: "Mensalidade Fev/26" },
    { id: "NT-2026-0109", date: "25/12/2025", amount: "R$ 1.480,00", status: "Paga", ref: "Mensalidade Jan/26" },
    { id: "NT-2025-1208", date: "25/11/2025", amount: "R$ 1.480,00", status: "Paga", ref: "Mensalidade Dez/25" },
  ];

  const DOCUMENTS = [
    { name: "Contrato de Prestação de Serviço", type: "PDF · Assinado", date: "12/03/2024", size: "284 KB" },
    { name: "Termo de Licenciamento — Finzo", type: "PDF · Assinado", date: "12/03/2024", size: "156 KB" },
    { name: "Termo de Uso — WhatsApp Bot", type: "PDF · Assinado", date: "04/07/2024", size: "142 KB" },
    { name: "Política de Privacidade (LGPD)", type: "PDF", date: "01/01/2026", size: "198 KB" },
    { name: "SLA & Nível de Serviço", type: "PDF", date: "01/01/2026", size: "112 KB" },
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

        .sys-card { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
        .sys-card:hover { transform: translateY(-3px); border-color: rgba(200,255,0,0.28) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,255,0,0.08); }
        .access-btn { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
        .access-btn:hover { transform: translateY(-1px); background: #d4ff33 !important; }
        .ghost-btn { transition: all 0.25s; }
        .ghost-btn:hover { border-color: rgba(255,255,255,0.28) !important; color: rgba(255,255,255,0.95) !important; }
        .invoice-row { transition: background 0.2s; }
        .invoice-row:hover { background: rgba(255,255,255,0.025) !important; }
        .doc-item { transition: all 0.25s; }
        .doc-item:hover { border-color: rgba(200,255,0,0.22) !important; background: rgba(255,255,255,0.025) !important; }
        .logout-btn { transition: all 0.25s; }
        .logout-btn:hover { background: rgba(255,80,80,0.08) !important; border-color: rgba(255,80,80,0.28) !important; color: #ff7a7a !important; }

        .status-dot { animation: pulseDot 2s ease-in-out infinite; }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        @media (max-width: 900px) {
          .ca-nav { padding: 14px 20px !important; flex-wrap: wrap !important; gap: 12px !important; }
          .ca-nav-user { width: 100%; justify-content: space-between !important; }
          .ca-container { padding: 32px 20px 80px !important; }
          .ca-welcome { font-size: clamp(1.5rem, 6vw, 2rem) !important; }
          .ca-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .ca-sys-card { grid-template-columns: 1fr !important; gap: 16px !important; }
          .ca-sys-right { justify-self: flex-start !important; width: 100%; }
          .ca-access-btn { width: 100%; justify-content: center !important; }
          .ca-inv-head, .ca-inv-row { grid-template-columns: 1fr 1fr auto !important; }
          .ca-inv-ref, .ca-inv-id { display: none !important; }
          .ca-support { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Atmosphere */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 900, height: 900, top: "-20%", right: "-15%", background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 55%)`, filter: "blur(50px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "5%", left: "-10%", background: "radial-gradient(circle, rgba(0,212,138,0.03) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Top nav */}
      <header className="ca-nav" style={{
        position: "sticky", top: 0, zIndex: 100, padding: "18px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(8,8,10,0.88)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.82rem", color: ACCENT, letterSpacing: -0.5 }}>
            NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span>
          </Link>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 2.5, textTransform: "uppercase" }}>
            Área do Cliente
          </span>
        </div>

        <div className="ca-nav-user" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px 7px 7px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 100 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT} 0%, #00d48a 100%)`, color: "#08080a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, letterSpacing: -0.5 }}>{client.avatar}</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{client.name}</div>
              <div style={{ fontSize: "0.64rem", color: "rgba(255,255,255,0.4)" }}>{client.company}</div>
            </div>
          </div>
          <Link to="/" className="logout-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", padding: "9px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>
            Sair <span style={{ fontSize: "0.85rem" }}>↗</span>
          </Link>
        </div>
      </header>

      {/* Main container */}
      <main className="ca-container" style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "56px 40px 120px" }}>

        {/* Welcome */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "rgba(0,212,138,0.1)", border: "1px solid rgba(0,212,138,0.25)", borderRadius: 100, marginBottom: 18 }}>
            <span className="status-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d48a", boxShadow: "0 0 8px #00d48a" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", fontWeight: 700, color: "#00d48a", letterSpacing: 2 }}>OPERAÇÃO ONLINE</span>
          </div>
          <h1 className="ca-welcome" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, letterSpacing: -1.2, lineHeight: 1.1, marginBottom: 10 }}>
            Olá, <span style={{ color: ACCENT }}>{client.name.split(" ")[0]}</span>{" "}
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>—</span>{" "}
            sua operação em números
          </h1>
          <p style={{ fontSize: "0.98rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 620 }}>
            Painel central com seus sistemas, faturas, contratos e acesso ao suporte. Cliente desde {client.memberSince}.
          </p>
        </section>

        {/* Summary cards */}
        <section style={{ marginBottom: 64 }}>
          <div className="ca-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {SUMMARY.map((s) => (
              <div key={s.label} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{s.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.9rem", fontWeight: 800, color: ACCENT, letterSpacing: -1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Sistemas contratados */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
            <div>
              <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 10 }}>Sistemas contratados</span>
              <h2 style={{ fontSize: "clamp(1.45rem, 2.2vw, 1.75rem)", fontWeight: 700, color: "#eeede9", letterSpacing: -0.5 }}>Seus sistemas ativos</h2>
            </div>
            <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20gostaria%20de%20contratar%20um%20novo%20sistema." target="_blank" rel="noopener noreferrer" className="ghost-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", padding: "9px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>
              + Contratar novo
            </a>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SYSTEMS.map((s) => (
              <div key={s.name} className="sys-card ca-sys-card" style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 24,
                background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "22px 26px"
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${ACCENT}0d`, border: `1px solid ${ACCENT}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                  {s.icon}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "rgba(255,255,255,0.95)", letterSpacing: -0.2 }}>{s.name}</h3>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: `${s.statusColor}14`, border: `1px solid ${s.statusColor}33`, borderRadius: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 700, color: s.statusColor, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      <span className="status-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: s.statusColor }} />
                      {s.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>{s.tag}</span>
                    <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>·</span>
                    <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.55)" }}>{s.plan}</span>
                    <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>·</span>
                    <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>último acesso {s.lastAccess}</span>
                  </div>
                </div>

                <div className="ca-sys-right" style={{ justifySelf: "flex-end" }}>
                  <a href={s.url} target={s.url.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" className="access-btn ca-access-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.84rem" }}>
                    Acessar sistema <span style={{ fontSize: "1rem" }}>↗</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Faturas */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
            <div>
              <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 10 }}>Financeiro</span>
              <h2 style={{ fontSize: "clamp(1.45rem, 2.2vw, 1.75rem)", fontWeight: 700, color: "#eeede9", letterSpacing: -0.5 }}>Histórico de faturas</h2>
            </div>
            <a href="#" className="ghost-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", padding: "9px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>
              Exportar extrato
            </a>
          </div>

          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden" }}>
            {/* Header */}
            <div className="ca-inv-head" style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 0.9fr 1.2fr 0.9fr auto", gap: 16,
              padding: "14px 24px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase"
            }}>
              <span className="ca-inv-id">Fatura</span>
              <span>Emissão</span>
              <span>Valor</span>
              <span className="ca-inv-ref">Referência</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Ação</span>
            </div>
            {/* Rows */}
            {INVOICES.map((inv, i) => (
              <div key={inv.id} className="invoice-row ca-inv-row" style={{
                display: "grid", gridTemplateColumns: "1.2fr 1fr 0.9fr 1.2fr 0.9fr auto", gap: 16, alignItems: "center",
                padding: "18px 24px", borderBottom: i < INVOICES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
              }}>
                <span className="ca-inv-id" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{inv.id}</span>
                <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.65)" }}>{inv.date}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.86rem", color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>{inv.amount}</span>
                <span className="ca-inv-ref" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{inv.ref}</span>
                <span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(0,212,138,0.1)", border: "1px solid rgba(0,212,138,0.28)", borderRadius: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 700, color: "#00d48a", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00d48a" }} />
                    {inv.status}
                  </span>
                </span>
                <a href="#" style={{ justifySelf: "end", fontSize: "0.76rem", fontWeight: 600, color: ACCENT, padding: "7px 12px", borderRadius: 100, border: `1px solid ${ACCENT}33`, background: `${ACCENT}0a`, transition: "all 0.25s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}18`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = `${ACCENT}0a`; }}
                >
                  Baixar ↓
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Documentos & Licenças */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ marginBottom: 22 }}>
            <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 10 }}>Contratos & licenças</span>
            <h2 style={{ fontSize: "clamp(1.45rem, 2.2vw, 1.75rem)", fontWeight: 700, color: "#eeede9", letterSpacing: -0.5 }}>Documentos assinados</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {DOCUMENTS.map((d) => (
              <div key={d.name} className="doc-item" style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px"
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="15" y2="17"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "rgba(255,255,255,0.92)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.64rem", color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
                    {d.type} · {d.date} · {d.size}
                  </div>
                </div>
                <a href="#" style={{ flexShrink: 0, fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", padding: "7px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.25s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ACCENT}44`; e.currentTarget.style.color = ACCENT; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                >
                  ↓
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Suporte */}
        <section>
          <div style={{ marginBottom: 22 }}>
            <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 10 }}>Suporte</span>
            <h2 style={{ fontSize: "clamp(1.45rem, 2.2vw, 1.75rem)", fontWeight: 700, color: "#eeede9", letterSpacing: -0.5 }}>Precisa de ajuda?</h2>
          </div>

          <div className="ca-support" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            {/* Support card */}
            <div style={{
              position: "relative", overflow: "hidden",
              background: `linear-gradient(135deg, ${ACCENT}10 0%, rgba(0,212,138,0.05) 100%)`,
              border: `1px solid ${ACCENT}26`, borderRadius: 22, padding: 32
            }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 60%)`, filter: "blur(30px)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
                  Fale direto com um{" "}
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>engenheiro</span>
                </h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 22, maxWidth: 480 }}>
                  Sem URA, sem robô, sem nível 1. Seu chamado vai direto para quem pode resolver. SLA de 4h úteis em dias comerciais.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <a href="https://wa.me/5511932227752?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20meu%20sistema." target="_blank" rel="noopener noreferrer" className="access-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.84rem" }}>
                    Abrir chamado <span style={{ fontSize: "1rem" }}>↗</span>
                  </a>
                  <a href="mailto:suporte@noratech.com.br" className="ghost-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 100, fontWeight: 600, fontSize: "0.84rem", color: "rgba(255,255,255,0.85)" }}>
                    suporte@noratech.com.br
                  </a>
                </div>
              </div>
            </div>

            {/* Quick info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Horário de atendimento</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>Segunda a sexta · 08h–19h</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>Plantão 24/7 para incidentes críticos</div>
              </div>
              <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Gestor de conta</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>Bruno Nora</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>bruno@noratech.com.br</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "28px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, margin: "0 auto", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>&copy; 2026 Noratech &mdash; Área do Cliente · v1.0</span>
          <div style={{ display: "flex", gap: 18 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Privacidade</Link>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Termos</Link>
            <a href="https://wa.me/5511932227752" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
