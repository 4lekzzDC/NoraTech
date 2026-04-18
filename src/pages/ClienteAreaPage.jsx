import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

export default function ClienteAreaPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const ACCENT = "#c8ff00";

  // Auth state
  const [view, setView] = useState("login"); // "login" | "signup" | "recover" | "recover-sent"
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [signupPass2, setSignupPass2] = useState("");
  const [signupError, setSignupError] = useState("");

  // Recover form
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverError, setRecoverError] = useState("");

  // Cockpit state (declared up front to keep hook order stable)
  const [activeTab, setActiveTab] = useState("cockpit");
  const sectionRefs = useRef({});
  const isClickScrolling = useRef(false);
  const clickTimeout = useRef(null);

  // Persistence helpers
  const getUsers = () => {
    try { return JSON.parse(localStorage.getItem("noratech_users") || "[]"); } catch { return []; }
  };
  const saveUsers = (u) => { try { localStorage.setItem("noratech_users", JSON.stringify(u)); } catch {} };

  // Seed demo account if storage is empty
  useEffect(() => {
    const users = getUsers();
    if (users.length === 0) {
      saveUsers([{ name: "Demo Noratech", company: "Noratech Demo", email: "demo@noratech.com.br", password: "demo123", memberSince: "Jan/25" }]);
    }
  }, []);

  const makeAvatar = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] || "";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase() || "??";
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail || !loginPass) { setLoginError("Preencha todos os campos."); return; }
    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === loginEmail.toLowerCase() && u.password === loginPass);
    if (!user) { setLoginError("E-mail ou senha incorretos."); return; }
    setCurrentUser(user);
    setIsLoggedIn(true);
    window.scrollTo(0, 0);
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setSignupError("");
    if (!signupName || !signupEmail || !signupPass) { setSignupError("Preencha nome, e-mail e senha."); return; }
    if (signupPass.length < 6) { setSignupError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (signupPass !== signupPass2) { setSignupError("As senhas não conferem."); return; }
    const users = getUsers();
    if (users.some((u) => u.email.toLowerCase() === signupEmail.toLowerCase())) {
      setSignupError("Este e-mail já está cadastrado."); return;
    }
    const now = new Date();
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const newUser = {
      name: signupName.trim(),
      company: signupCompany.trim() || "—",
      email: signupEmail.trim(),
      password: signupPass,
      memberSince: `${meses[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`,
    };
    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser);
    setIsLoggedIn(true);
    window.scrollTo(0, 0);
  };

  const handleRecover = (e) => {
    e.preventDefault();
    setRecoverError("");
    if (!recoverEmail) { setRecoverError("Informe seu e-mail."); return; }
    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === recoverEmail.toLowerCase());
    if (!user) { setRecoverError("Nenhuma conta encontrada com esse e-mail."); return; }
    // Simulate recovery: generate a temp password
    const tempPass = Math.random().toString(36).slice(-8);
    const updated = users.map((u) => u.email.toLowerCase() === recoverEmail.toLowerCase() ? { ...u, password: tempPass } : u);
    saveUsers(updated);
    setView("recover-sent");
    // Store temp pass to show on the confirmation screen
    sessionStorage.setItem("noratech_temp_pass", tempPass);
  };

  const switchTo = (v) => {
    setLoginError(""); setSignupError(""); setRecoverError("");
    setView(v);
  };

  const TABS = [
    { id: "cockpit", label: "Cockpit", num: "01" },
    { id: "operacao", label: "Operação", num: "02" },
    { id: "financeiro", label: "Financeiro", num: "03" },
    { id: "oportunidades", label: "Oportunidades", num: "04" },
    { id: "comando", label: "Comando", num: "05" },
  ];

  useEffect(() => {
    if (!isLoggedIn) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveTab(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: [0, 0.15, 0.3, 0.6] }
    );
    TABS.forEach((t) => { const el = sectionRefs.current[t.id]; if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [isLoggedIn]);

  // ── LOGIN SCREEN ──
  if (!isLoggedIn) {
    return (
      <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Manrope', sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
          *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
          body{-webkit-font-smoothing:antialiased}
          a{text-decoration:none;color:inherit}
          .login-input{width:100%;padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#eeede9;font-family:'Manrope',sans-serif;font-size:0.9rem;outline:none;transition:border-color 0.3s}
          .login-input:focus{border-color:rgba(200,255,0,0.4)}
          .login-input::placeholder{color:rgba(255,255,255,0.28)}
          .login-btn{width:100%;padding:14px;background:#c8ff00;color:#08080a;border:none;border-radius:12px;font-family:'Manrope',sans-serif;font-size:0.92rem;font-weight:700;cursor:pointer;transition:all 0.25s cubic-bezier(0.16,1,0.3,1)}
          .login-btn:hover{background:#d4ff33;transform:translateY(-1px)}
          .login-link{transition:color 0.2s}
          .login-link:hover{color:rgba(255,255,255,0.85)!important}
          @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        `}</style>

        {/* Atmosphere */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 700, height: 700, top: "20%", left: "50%", transform: "translateX(-50%)", background: `radial-gradient(circle, ${ACCENT}0c 0%, transparent 55%)`, filter: "blur(60px)" }} />
          <div style={{ position: "absolute", width: 400, height: 400, bottom: "10%", right: "15%", background: "radial-gradient(circle, rgba(0,212,138,0.04) 0%, transparent 55%)", filter: "blur(40px)" }} />
        </div>

        {/* Login card */}
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "0 24px", animation: "fadeIn 0.6s ease-out both" }}>
          {/* Back link */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
            <span style={{ fontSize: "0.9rem" }}>&larr;</span> Voltar ao site
          </Link>

          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 32px", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "1.1rem", color: ACCENT, letterSpacing: -0.5, marginBottom: 8 }}>
                NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.64rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 3, textTransform: "uppercase" }}>
                {view === "login" && "Central de Controle"}
                {view === "signup" && "Criar sua conta"}
                {view === "recover" && "Recuperar acesso"}
                {view === "recover-sent" && "Senha redefinida"}
              </div>
            </div>

            {/* ── LOGIN VIEW ── */}
            {view === "login" && (
              <>
                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>E-mail</label>
                    <input type="email" className="login-input" placeholder="seu@email.com.br" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Senha</label>
                    <input type="password" className="login-input" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                  </div>
                  {loginError && (
                    <div style={{ padding: "10px 14px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, fontSize: "0.8rem", color: "#ff7a7a" }}>{loginError}</div>
                  )}
                  <button type="submit" className="login-btn" style={{ marginTop: 6 }}>Entrar</button>
                </form>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button type="button" onClick={() => switchTo("recover")} className="login-link" style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Esqueci a senha</button>
                  <button type="button" onClick={() => switchTo("signup")} className="login-link" style={{ fontSize: "0.76rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}>Criar conta</button>
                </div>
              </>
            )}

            {/* ── SIGNUP VIEW ── */}
            {view === "signup" && (
              <>
                <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Nome completo</label>
                    <input type="text" className="login-input" placeholder="João Silva" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Empresa <span style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.6rem", opacity: 0.6 }}>(opcional)</span></label>
                    <input type="text" className="login-input" placeholder="Acme Indústria Ltda" value={signupCompany} onChange={(e) => setSignupCompany(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>E-mail</label>
                    <input type="email" className="login-input" placeholder="seu@email.com.br" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Senha <span style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.6rem", opacity: 0.6 }}>(mín. 6 caracteres)</span></label>
                    <input type="password" className="login-input" placeholder="••••••••" value={signupPass} onChange={(e) => setSignupPass(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Confirmar senha</label>
                    <input type="password" className="login-input" placeholder="••••••••" value={signupPass2} onChange={(e) => setSignupPass2(e.target.value)} />
                  </div>
                  {signupError && (
                    <div style={{ padding: "10px 14px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, fontSize: "0.8rem", color: "#ff7a7a" }}>{signupError}</div>
                  )}
                  <button type="submit" className="login-btn" style={{ marginTop: 6 }}>Criar conta</button>
                </form>
                <div style={{ textAlign: "center", marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.4)" }}>Já tem conta? </span>
                  <button type="button" onClick={() => switchTo("login")} className="login-link" style={{ fontSize: "0.76rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}>Entrar</button>
                </div>
              </>
            )}

            {/* ── RECOVER VIEW ── */}
            {view === "recover" && (
              <>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 18, textAlign: "center" }}>
                  Informe o e-mail da sua conta e enviaremos uma nova senha provisória.
                </p>
                <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>E-mail cadastrado</label>
                    <input type="email" className="login-input" placeholder="seu@email.com.br" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} />
                  </div>
                  {recoverError && (
                    <div style={{ padding: "10px 14px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, fontSize: "0.8rem", color: "#ff7a7a" }}>{recoverError}</div>
                  )}
                  <button type="submit" className="login-btn" style={{ marginTop: 6 }}>Enviar nova senha</button>
                </form>
                <div style={{ textAlign: "center", marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button type="button" onClick={() => switchTo("login")} className="login-link" style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.55)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>← Voltar ao login</button>
                </div>
              </>
            )}

            {/* ── RECOVER SENT VIEW ── */}
            {view === "recover-sent" && (
              <>
                <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,212,138,0.12)", border: "1px solid rgba(0,212,138,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18, fontSize: "1.6rem", color: "#00d48a" }}>✓</div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 10 }}>Sua senha foi redefinida</h3>
                  <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 18 }}>
                    Geramos uma senha provisória para o e-mail informado. Use-a para entrar e depois altere no seu perfil.
                  </p>
                  <div style={{ padding: "14px 18px", background: "rgba(200,255,0,0.08)", border: `1px dashed ${ACCENT}55`, borderRadius: 12, marginBottom: 20 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Senha provisória</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.15rem", fontWeight: 600, color: ACCENT, letterSpacing: 2 }}>
                      {typeof window !== "undefined" ? sessionStorage.getItem("noratech_temp_pass") || "--------" : "--------"}
                    </div>
                  </div>
                  <button type="button" onClick={() => switchTo("login")} className="login-btn">Ir para o login</button>
                </div>
              </>
            )}
          </div>

          {/* Bottom text */}
          <p style={{ textAlign: "center", fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", marginTop: 24 }}>
            &copy; 2026 Noratech &mdash; Todos os direitos reservados
          </p>
        </div>
      </div>
    );
  }

  // ── COCKPIT (post-login) ──

  const handleTabClick = (id) => {
    setActiveTab(id);
    isClickScrolling.current = true;
    const el = sectionRefs.current[id];
    if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo({ top: y, behavior: "smooth" }); }
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => { isClickScrolling.current = false; }, 900);
  };

  const client = currentUser
    ? { name: currentUser.name, company: currentUser.company, avatar: makeAvatar(currentUser.name), memberSince: currentUser.memberSince }
    : { name: "João Silva", company: "Acme Indústria Ltda", avatar: "JS", memberSince: "Mar/2024" };

  const healthScore = 98;
  const SIGNALS = [
    { label: "Funcionando", count: 3, color: "#00d48a", icon: "✓", items: ["Finzo online — 99.98% uptime", "WhatsApp Bot ativo — 892 conversas", "Site publicado — 3.2k visitas"] },
    { label: "Atenção", count: 1, color: "#ffb347", icon: "!", items: ["Certificado SSL vence em 12 dias"] },
    { label: "Expansão", count: 2, color: ACCENT, icon: "↗", items: ["Upgrade Bot → multicanal disponível", "Dashboard financeiro recomendado"] },
  ];

  const ACTIVITY = [
    { time: "agora", event: "WhatsApp Bot respondeu 3 clientes simultâneos", type: "success" },
    { time: "2min", event: "Finzo sincronizou 12 transações bancárias", type: "success" },
    { time: "15min", event: "Site recebeu 47 visitas orgânicas", type: "info" },
    { time: "1h", event: "Certificado SSL — renovação em 12 dias", type: "warning" },
    { time: "3h", event: "Backup automático concluído com sucesso", type: "success" },
  ];

  const SYSTEMS = [
    { name: "Finzo", desc: "Gestão Financeira", status: "online", plan: "Business", metric: "1.247", metricLabel: "transações/mês", uptime: [1,1,1,1,1,1,1,1,1,1,1,1,1,0.8,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], spark: "0,32 20,28 40,15 60,20 80,10 100,8 120,5", url: "#", icon: "💰" },
    { name: "WhatsApp Bot", desc: "Atendimento 24/7", status: "online", plan: "Pro · 2 números", metric: "892", metricLabel: "conversas/mês", uptime: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], spark: "0,30 20,25 40,22 60,18 80,20 100,12 120,8", url: "https://whatsapp-mu.vercel.app", icon: "💬" },
    { name: "Site Institucional", desc: "Hospedagem CDN", status: "online", plan: "Standard", metric: "3.2k", metricLabel: "visitas/mês", uptime: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], spark: "0,28 20,30 40,25 60,20 80,22 100,15 120,12", url: "https://criadordesites-rose.vercel.app", icon: "🌐" },
  ];

  const FINANCES = {
    monthly: "R$ 1.480", annual: "R$ 17.760", paid: 12, total: 12,
    nextBill: { date: "25 abr", amount: "R$ 1.480,00", days: 8 },
    history: [
      { month: "Nov", status: "paid" }, { month: "Dez", status: "paid" },
      { month: "Jan", status: "paid" }, { month: "Fev", status: "paid" },
      { month: "Mar", status: "paid" }, { month: "Abr", status: "next" },
    ],
  };

  const OPPORTUNITIES = [
    { title: "Multicanal no Bot", desc: "Expanda o atendimento para Instagram DM e Telegram com a mesma base de conhecimento e fluxos já treinados.", impact: "Alto", tag: "Upgrade", color: "#00d48a" },
    { title: "Dashboard Financeiro", desc: "Painel executivo com KPIs de caixa, inadimplência e projeção — conectado direto ao Finzo.", impact: "Estratégico", tag: "Novo", color: ACCENT },
    { title: "Integração ERP", desc: "Conecte Bling ou Omie ao fluxo atual e elimine lançamento manual entre financeiro e estoque.", impact: "Médio", tag: "Integração", color: "#4d9fff" },
  ];

  const typeColors = { success: "#00d48a", warning: "#ffb347", info: "#4d9fff" };
  const R = 85;
  const C = 2 * Math.PI * R;
  const healthOffset = C - (healthScore / 100) * C;

  return (
    <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Manrope', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth} body{-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        a{text-decoration:none;color:inherit}
        .ck-card{transition:all 0.4s cubic-bezier(0.16,1,0.3,1)}
        .ck-card:hover{transform:translateY(-3px);border-color:rgba(200,255,0,0.25)!important;box-shadow:0 20px 60px rgba(0,0,0,0.4),inset 0 1px 0 rgba(200,255,0,0.08)}
        .ck-btn{transition:all 0.25s cubic-bezier(0.16,1,0.3,1)}
        .ck-btn:hover{transform:translateY(-1px);background:#d4ff33!important}
        .ck-ghost{transition:all 0.25s}
        .ck-ghost:hover{border-color:rgba(255,255,255,0.28)!important;color:rgba(255,255,255,0.95)!important}
        .ck-logout{transition:all 0.25s}
        .ck-logout:hover{background:rgba(255,80,80,0.08)!important;border-color:rgba(255,80,80,0.28)!important;color:#ff7a7a!important}
        .ca-tab:hover{color:rgba(255,255,255,0.85)!important}
        .ca-tabs-inner::-webkit-scrollbar{display:none}
        .ck-pulse{animation:pulseDot 2s ease-in-out infinite}
        @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes gaugeIn{from{stroke-dashoffset:${C}}to{stroke-dashoffset:${healthOffset}}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .ck-signal-item{animation:fadeUp 0.5s ease-out both}
        .ck-opp{transition:all 0.4s cubic-bezier(0.16,1,0.3,1)}
        .ck-opp:hover{transform:translateY(-4px);border-color:rgba(200,255,0,0.22)!important;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
        @media(max-width:900px){
          .ca-nav{padding:14px 20px!important;flex-wrap:wrap!important;gap:12px!important}
          .ca-nav-user{width:100%;justify-content:space-between!important}
          .ca-tabs-inner{padding:0 16px!important}
          .ca-tab{padding:14px 10px!important}
          .ck-main{padding:32px 20px 80px!important}
          .ck-cockpit-grid{grid-template-columns:1fr!important}
          .ck-gauge-wrap{justify-content:center}
          .ck-signals{grid-template-columns:1fr!important}
          .ck-sys-grid{grid-template-columns:1fr!important}
          .ck-fin-grid{grid-template-columns:1fr!important}
          .ck-opp-grid{grid-template-columns:1fr!important}
          .ck-cmd-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 900, height: 900, top: "-20%", right: "-15%", background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 55%)`, filter: "blur(50px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "5%", left: "-10%", background: "radial-gradient(circle, rgba(0,212,138,0.03) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header className="ca-nav" style={{ position: "sticky", top: 0, zIndex: 100, padding: "18px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,10,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.82rem", color: ACCENT, letterSpacing: -0.5 }}>
            NORA<span style={{ color: "rgba(255,255,255,0.3)" }}>TECH</span>
          </Link>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 2.5, textTransform: "uppercase" }}>Central de Controle</span>
        </div>
        <div className="ca-nav-user" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px 7px 7px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 100 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT} 0%, #00d48a 100%)`, color: "#08080a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800 }}>{client.avatar}</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{client.name}</div>
              <div style={{ fontSize: "0.64rem", color: "rgba(255,255,255,0.4)" }}>{client.company}</div>
            </div>
          </div>
          <Link to="/" className="ck-logout" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", padding: "9px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>Sair ↗</Link>
        </div>
      </header>

      {/* Tab bar */}
      <nav style={{ position: "sticky", top: 65, zIndex: 99, background: "rgba(8,8,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="ca-tabs-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => handleTabClick(t.id)} className="ca-tab" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer", color: active ? "#eeede9" : "rgba(255,255,255,0.42)", transition: "color 0.3s", fontFamily: "'Manrope', sans-serif", whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 600, letterSpacing: 1.5, color: active ? ACCENT : "rgba(255,255,255,0.3)", transition: "color 0.3s" }}>{t.num}</span>
                <span style={{ fontSize: "0.83rem", fontWeight: active ? 700 : 500, letterSpacing: -0.2 }}>{t.label}</span>
                <span style={{ position: "absolute", left: 14, right: 14, bottom: 0, height: 2, background: active ? ACCENT : "transparent", boxShadow: active ? `0 0 12px ${ACCENT}88` : "none", borderRadius: 2, transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)" }} />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main */}
      <main className="ck-main" style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "48px 40px 120px" }}>

        {/* ═══ COCKPIT ═══ */}
        <section id="cockpit" ref={(el) => (sectionRefs.current["cockpit"] = el)} style={{ marginBottom: 80, scrollMarginTop: 130 }}>
          <div className="ck-cockpit-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 48, alignItems: "flex-start", marginBottom: 40 }}>
            {/* Health gauge */}
            <div className="ck-gauge-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ filter: `drop-shadow(0 0 20px ${ACCENT}33)` }}>
                <circle cx="100" cy="100" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="12" fill="none" />
                <circle cx="100" cy="100" r={R} stroke={ACCENT} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={healthOffset} transform="rotate(-90 100 100)" style={{ animation: "gaugeIn 1.5s cubic-bezier(0.16,1,0.3,1) both" }} />
                <text x="100" y="88" textAnchor="middle" fill={ACCENT} fontFamily="'JetBrains Mono', monospace" fontSize="42" fontWeight="800">{healthScore}</text>
                <text x="100" y="118" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="'Manrope', sans-serif" fontSize="12" fontWeight="600">SAÚDE DA OPERAÇÃO</text>
              </svg>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
                <span className="ck-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d48a", boxShadow: "0 0 10px #00d48a" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.66rem", fontWeight: 700, color: "#00d48a", letterSpacing: 2 }}>TUDO OPERANDO</span>
              </div>
            </div>

            {/* Welcome + signals */}
            <div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "rgba(0,212,138,0.08)", border: "1px solid rgba(0,212,138,0.22)", borderRadius: 100, marginBottom: 14 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", fontWeight: 700, color: "#00d48a", letterSpacing: 2 }}>CLIENTE DESDE {client.memberSince.toUpperCase()}</span>
                </div>
                <h1 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 800, letterSpacing: -1, lineHeight: 1.15, marginBottom: 6 }}>
                  Olá, <span style={{ color: ACCENT }}>{client.name.split(" ")[0]}</span>
                </h1>
                <p style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>Visão em tempo real da sua operação na Noratech.</p>
              </div>

              {/* 3 signal cards */}
              <div className="ck-signals" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {SIGNALS.map((s) => (
                  <div key={s.label} style={{ background: "#111114", border: `1px solid ${s.color}22`, borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: `radial-gradient(circle, ${s.color}18 0%, transparent 60%)`, pointerEvents: "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: `${s.color}18`, border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", fontWeight: 800, color: s.color }}>{s.icon}</div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.64rem", fontWeight: 700, color: s.color, letterSpacing: 2, textTransform: "uppercase" }}>{s.label}</span>
                      <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.count}</span>
                    </div>
                    {s.items.map((item, i) => (
                      <div key={i} className="ck-signal-item" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", animationDelay: `${i * 0.1}s` }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span className="ck-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d48a" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.64rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textTransform: "uppercase" }}>Atividade ao vivo</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", borderBottom: i < ACTIVITY.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: typeColors[a.type], flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", minWidth: 44 }}>{a.time}</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>{a.event}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ OPERAÇÃO ═══ */}
        <section id="operacao" ref={(el) => (sectionRefs.current["operacao"] = el)} style={{ marginBottom: 80, scrollMarginTop: 130 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
            <div>
              <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 8 }}>Operação</span>
              <h2 style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.7rem)", fontWeight: 700, letterSpacing: -0.5 }}>Seus sistemas em tempo real</h2>
            </div>
            <a href="https://wa.me/5511932227752?text=Quero%20contratar%20um%20novo%20sistema." target="_blank" rel="noopener noreferrer" className="ck-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", padding: "9px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>+ Novo sistema</a>
          </div>

          <div className="ck-sys-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {SYSTEMS.map((s) => (
              <div key={s.name} className="ck-card" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Top: icon + name + status */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ACCENT}0d`, border: `1px solid ${ACCENT}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>{s.icon}</div>
                    <div>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: -0.2 }}>{s.name}</h3>
                      <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{s.desc}</span>
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "rgba(0,212,138,0.1)", border: "1px solid rgba(0,212,138,0.28)", borderRadius: 100 }}>
                    <span className="ck-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#00d48a" }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", fontWeight: 700, color: "#00d48a", letterSpacing: 1.5, textTransform: "uppercase" }}>{s.status}</span>
                  </span>
                </div>

                {/* Metric + sparkline */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.6rem", fontWeight: 800, color: ACCENT, letterSpacing: -1 }}>{s.metric}</div>
                    <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{s.metricLabel}</div>
                  </div>
                  <svg width="100" height="36" viewBox="0 0 120 36" style={{ overflow: "visible" }}>
                    <defs><linearGradient id={`sg-${s.name}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity="0.2"/><stop offset="100%" stopColor={ACCENT} stopOpacity="0"/></linearGradient></defs>
                    <polygon points={`${s.spark} 120,36 0,36`} fill={`url(#sg-${s.name})`} />
                    <polyline points={s.spark} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* 30-day uptime bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, textTransform: "uppercase" }}>Uptime 30d</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "#00d48a", fontWeight: 700 }}>99.{s.uptime.filter(u => u === 1).length >= 29 ? "98" : "7"}%</span>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {s.uptime.map((u, i) => (
                      <div key={i} style={{ flex: 1, height: 18, borderRadius: 2, background: u === 1 ? "#00d48a" : u >= 0.5 ? "#ffb347" : "rgba(255,80,80,0.5)", opacity: 0.7 + u * 0.3 }} />
                    ))}
                  </div>
                </div>

                {/* Plan + access */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{s.plan}</span>
                  <a href={s.url} target={s.url.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" className="ck-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.76rem" }}>Abrir ↗</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FINANCEIRO — stub ═══ */}
        <section id="financeiro" ref={(el) => (sectionRefs.current["financeiro"] = el)} style={{ marginBottom: 80, scrollMarginTop: 130 }}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 8 }}>Financeiro</span>
          <h2 style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.7rem)", fontWeight: 700, letterSpacing: -0.5, marginBottom: 24 }}>Pulso financeiro da operação</h2>

          <div className="ck-fin-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            {/* Investimento mensal */}
            <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 26, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 60%)`, pointerEvents: "none" }} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Investimento mensal</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "2.2rem", fontWeight: 800, color: ACCENT, letterSpacing: -1.5, marginBottom: 4 }}>{FINANCES.monthly}</div>
              <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>ciclo anual: {FINANCES.annual}</div>
            </div>

            {/* Próxima cobrança */}
            <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 26 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Próxima cobrança</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "2.2rem", fontWeight: 800, color: "#eeede9", letterSpacing: -1.5, marginBottom: 4 }}>{FINANCES.nextBill.days}<span style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginLeft: 6 }}>dias</span></div>
              <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>{FINANCES.nextBill.date} · {FINANCES.nextBill.amount}</div>
            </div>

            {/* Adimplência */}
            <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 26, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <svg width="90" height="90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="40" stroke="#00d48a" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(FINANCES.paid / FINANCES.total) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`} transform="rotate(-90 50 50)" />
                <text x="50" y="46" textAnchor="middle" fill="#00d48a" fontFamily="'JetBrains Mono', monospace" fontSize="18" fontWeight="800">{FINANCES.paid}/{FINANCES.total}</text>
                <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontFamily="'Manrope', sans-serif" fontSize="8" fontWeight="600">EM DIA</text>
              </svg>
            </div>
          </div>

          {/* Payment timeline */}
          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 22px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Linha do tempo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {FINANCES.history.map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: h.status === "paid" ? "rgba(0,212,138,0.15)" : `${ACCENT}22`, border: `1px solid ${h.status === "paid" ? "rgba(0,212,138,0.3)" : ACCENT + "44"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {h.status === "paid" ? (
                      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7l3 3 5-5" stroke="#00d48a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", fontWeight: 700, color: ACCENT }}>→</span>
                    )}
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: h.status === "next" ? ACCENT : "rgba(255,255,255,0.4)", fontWeight: h.status === "next" ? 700 : 500 }}>{h.month}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ OPORTUNIDADES — stub ═══ */}
        <section id="oportunidades" ref={(el) => (sectionRefs.current["oportunidades"] = el)} style={{ marginBottom: 80, scrollMarginTop: 130 }}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 8 }}>Oportunidades</span>
          <h2 style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.7rem)", fontWeight: 700, letterSpacing: -0.5, marginBottom: 24 }}>Próximos passos para sua operação</h2>

          <div className="ck-opp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {OPPORTUNITIES.map((o) => (
              <div key={o.title} className="ck-opp" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 26, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: `radial-gradient(circle, ${o.color}14 0%, transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ padding: "4px 10px", background: `${o.color}14`, border: `1px solid ${o.color}33`, borderRadius: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 700, color: o.color, letterSpacing: 1.5, textTransform: "uppercase" }}>{o.tag}</span>
                  <span style={{ marginLeft: "auto", padding: "4px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>IMPACTO {o.impact.toUpperCase()}</span>
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: -0.3, marginBottom: 8 }}>{o.title}</h3>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, flex: 1, marginBottom: 18 }}>{o.desc}</p>
                <a href="https://wa.me/5511932227752?text=Tenho%20interesse%20na%20oportunidade%20de%20expans%C3%A3o" target="_blank" rel="noopener noreferrer" className="ck-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", border: `1px solid ${o.color}33`, borderRadius: 100, fontWeight: 600, fontSize: "0.78rem", color: o.color, alignSelf: "flex-start" }}>
                  Quero saber mais ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ COMANDO — stub ═══ */}
        <section id="comando" ref={(el) => (sectionRefs.current["comando"] = el)} style={{ scrollMarginTop: 130 }}>
          <span style={{ display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: ACCENT, marginBottom: 8 }}>Comando</span>
          <h2 style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.7rem)", fontWeight: 700, letterSpacing: -0.5, marginBottom: 24 }}>Central de comando</h2>

          <div className="ck-cmd-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            {/* Primary action */}
            <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${ACCENT}10 0%, rgba(0,212,138,0.05) 100%)`, border: `1px solid ${ACCENT}26`, borderRadius: 22, padding: 32 }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 60%)`, filter: "blur(30px)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
                  Fale direto com um <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>engenheiro</span>
                </h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 22, maxWidth: 480 }}>
                  Sem URA, sem robô, sem nível 1. Seu chamado vai direto para quem resolve. SLA de 4h úteis.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <a href="https://wa.me/5511932227752?text=Preciso%20de%20suporte%20no%20meu%20sistema." target="_blank" rel="noopener noreferrer" className="ck-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: ACCENT, color: "#08080a", borderRadius: 100, fontWeight: 700, fontSize: "0.84rem" }}>Abrir chamado ↗</a>
                  <a href="mailto:suporte@noratech.com.br" className="ck-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 100, fontWeight: 600, fontSize: "0.84rem", color: "rgba(255,255,255,0.85)" }}>suporte@noratech.com.br</a>
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>SLA contratado</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.5rem", fontWeight: 800, color: "#00d48a" }}>4h</span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>tempo de resposta útil</span>
                </div>
              </div>
              <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Gestor de conta</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>Bruno Nora</div>
                <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>bruno@noratech.com.br</div>
              </div>
              <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Atendimento</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>Seg–Sex · 08h–19h</div>
                <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)" }}>Plantão 24/7 para incidentes críticos</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "28px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, margin: "0 auto", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>&copy; 2026 Noratech &mdash; Central de Controle · v2.0</span>
          <div style={{ display: "flex", gap: 18 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Privacidade</Link>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
