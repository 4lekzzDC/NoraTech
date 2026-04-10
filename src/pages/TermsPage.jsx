import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const sectionStyle = { marginBottom: 40 };
  const h2Style = { fontSize: "1.3rem", fontWeight: 700, color: "#eeede9", marginBottom: 16, letterSpacing: -0.3 };
  const h3Style = { fontSize: "1.05rem", fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 10 };
  const pStyle = { fontSize: "0.92rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.8, marginBottom: 12 };
  const listStyle = { fontSize: "0.92rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.8, paddingLeft: 24, marginBottom: 12 };

  return (
    <div style={{ background: "#08080a", color: "#eeede9", fontFamily: "'Manrope', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        a { text-decoration: none; color: inherit; }
      `}</style>

      {/* Atmosphere */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 800, height: 800, top: "-15%", right: "-10%", background: "radial-gradient(circle, rgba(200,255,0,0.035) 0%, transparent 55%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(77,159,255,0.025) 0%, transparent 55%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, padding: "20px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,10,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.82rem", color: "#c8ff00", letterSpacing: -0.5 }}>
          NEXUS<span style={{ color: "rgba(255,255,255,0.25)" }}>.ai</span>
        </Link>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.3s" }}>
          <span style={{ fontSize: "0.9rem" }}>&larr;</span> Voltar ao Inicio
        </Link>
      </header>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: 780, margin: "0 auto", padding: "80px 32px 120px" }}>
        <div style={{ marginBottom: 56 }}>
          <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: "#c8ff00", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>Legal</span>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16 }}>
            Termos de{" "}
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#c8ff00" }}>Uso</span>
          </h1>
          <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
            Ultima atualizacao: Abril de 2026
          </p>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 40 }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>1. Aceitacao dos Termos</h2>
            <p style={pStyle}>
              Ao acessar e utilizar os servicos oferecidos pela 4lekzz ("nos", "nosso" ou "empresa"), incluindo Finzo App, WhatsApp Bot, Autonomy e Sites para Empresas, voce concorda integralmente com estes Termos de Uso. Caso nao concorde com alguma disposicao, recomendamos que nao utilize nossos servicos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>2. Descricao dos Servicos</h2>
            <p style={pStyle}>A 4lekzz oferece os seguintes produtos e servicos:</p>
            <ul style={listStyle}>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Finzo App:</strong> plataforma de gestao financeira com integracao via Open Finance</li>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>WhatsApp Bot:</strong> sistema de atendimento automatizado via WhatsApp Business API</li>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Autonomy:</strong> plataforma de automacao empresarial com modulos integrados</li>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Sites para Empresas:</strong> criacao de sites profissionais com design personalizado</li>
            </ul>
            <p style={pStyle}>
              Os servicos podem ser modificados, atualizados ou descontinuados a qualquer momento, mediante aviso previo quando possivel.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>3. Cadastro e Conta</h2>
            <h3 style={h3Style}>3.1 Requisitos</h3>
            <p style={pStyle}>
              Para utilizar determinados servicos, pode ser necessario criar uma conta. Voce deve fornecer informacoes verdadeiras, completas e atualizadas. E sua responsabilidade manter a confidencialidade de suas credenciais de acesso.
            </p>
            <h3 style={h3Style}>3.2 Responsabilidade</h3>
            <p style={pStyle}>
              Voce e responsavel por todas as atividades realizadas em sua conta. Caso identifique uso nao autorizado, notifique-nos imediatamente pelo e-mail{" "}
              <a href="mailto:contato@4lekzz.com" style={{ color: "#c8ff00", borderBottom: "1px solid rgba(200,255,0,0.3)" }}>contato@4lekzz.com</a>.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>4. Uso Adequado</h2>
            <p style={pStyle}>Ao utilizar nossos servicos, voce se compromete a nao:</p>
            <ul style={listStyle}>
              <li>Violar leis ou regulamentacoes aplicaveis</li>
              <li>Utilizar os servicos para fins ilicitos ou nao autorizados</li>
              <li>Tentar acessar sistemas ou dados sem autorizacao</li>
              <li>Transmitir virus, malware ou conteudo malicioso</li>
              <li>Interferir no funcionamento dos servicos ou da infraestrutura</li>
              <li>Reproduzir, distribuir ou modificar nossos produtos sem autorizacao</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>5. Propriedade Intelectual</h2>
            <p style={pStyle}>
              Todo o conteudo, design, codigo-fonte, marcas, logos e materiais presentes em nossos produtos e servicos sao de propriedade da 4lekzz ou de seus licenciadores, protegidos pelas leis de propriedade intelectual.
            </p>
            <p style={pStyle}>
              E concedida a voce uma licenca limitada, nao exclusiva e revogavel para usar nossos servicos conforme estes Termos. Essa licenca nao transfere nenhum direito de propriedade.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>6. Pagamentos e Cancelamento</h2>
            <h3 style={h3Style}>6.1 Planos e cobrancas</h3>
            <p style={pStyle}>
              Alguns servicos podem ser oferecidos mediante pagamento. Os valores, formas de pagamento e ciclos de cobranca serao informados antes da contratacao. Ao contratar, voce autoriza a cobranca recorrente conforme o plano escolhido.
            </p>
            <h3 style={h3Style}>6.2 Cancelamento</h3>
            <p style={pStyle}>
              Voce pode cancelar sua assinatura a qualquer momento. O cancelamento sera efetivado ao final do periodo de cobranca vigente. Nao realizamos reembolsos proporcionais, salvo disposicao legal em contrario.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>7. Limitacao de Responsabilidade</h2>
            <p style={pStyle}>
              Nossos servicos sao fornecidos "como estao". Na extensao maxima permitida por lei, a 4lekzz nao sera responsavel por danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou impossibilidade de uso dos servicos.
            </p>
            <p style={pStyle}>
              Nao nos responsabilizamos por interrupcoes temporarias causadas por manutencao, atualizacoes ou fatores fora do nosso controle.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>8. Privacidade</h2>
            <p style={pStyle}>
              O tratamento de seus dados pessoais e regido por nossa{" "}
              <Link to="/privacidade" style={{ color: "#c8ff00", borderBottom: "1px solid rgba(200,255,0,0.3)" }}>Politica de Privacidade</Link>, que faz parte integrante destes Termos de Uso.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>9. Alteracoes nos Termos</h2>
            <p style={pStyle}>
              Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alteracoes significativas serao comunicadas por e-mail ou notificacao nos servicos. O uso continuado apos as alteracoes constitui aceitacao dos novos termos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>10. Legislacao Aplicavel</h2>
            <p style={pStyle}>
              Estes Termos sao regidos pelas leis da Republica Federativa do Brasil. Qualquer disputa sera submetida ao foro da comarca de Sao Paulo, Estado de Sao Paulo, com exclusao de qualquer outro.
            </p>
          </section>

          <section style={{ marginBottom: 0 }}>
            <h2 style={h2Style}>11. Contato</h2>
            <p style={pStyle}>
              Em caso de duvidas sobre estes Termos de Uso, entre em contato:
            </p>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginTop: 8 }}>
              <p style={{ ...pStyle, marginBottom: 4 }}><strong style={{ color: "rgba(255,255,255,0.65)" }}>4lekzz</strong></p>
              <p style={{ ...pStyle, marginBottom: 4 }}>E-mail: <a href="mailto:contato@4lekzz.com" style={{ color: "#c8ff00" }}>contato@4lekzz.com</a></p>
              <p style={{ ...pStyle, marginBottom: 0 }}>WhatsApp: <a href="https://wa.me/5511932227752" target="_blank" rel="noopener noreferrer" style={{ color: "#c8ff00" }}>(11) 93222-7752</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 780, margin: "0 auto" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>&copy; 2026 4lekzz &mdash; Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacidade" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Privacidade</Link>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(200,255,0,0.2)" }}>Termos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
