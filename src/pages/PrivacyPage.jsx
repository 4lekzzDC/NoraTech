import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function PrivacyPage() {
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
          NORA<span style={{ color: "rgba(255,255,255,0.25)" }}>.tech</span>
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
            Politica de{" "}
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, color: "#c8ff00" }}>Privacidade</span>
          </h1>
          <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
            Ultima atualizacao: Abril de 2026
          </p>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 40 }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>1. Introducao</h2>
            <p style={pStyle}>
              A Noratech ("nos", "nosso" ou "empresa") valoriza a privacidade dos usuarios de nossos produtos e servicos. Esta Politica de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informacoes pessoais ao utilizar nossos produtos, incluindo Finzo App, WhatsApp Bot e Sites para Empresas.
            </p>
            <p style={pStyle}>
              Ao acessar ou utilizar nossos servicos, voce concorda com as praticas descritas nesta politica. Recomendamos a leitura atenta deste documento.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>2. Dados que Coletamos</h2>

            <h3 style={h3Style}>2.1 Dados fornecidos por voce</h3>
            <ul style={listStyle}>
              <li>Nome, e-mail e telefone ao preencher formularios de contato</li>
              <li>Informacoes de empresa ao solicitar orcamentos</li>
              <li>Dados financeiros ao utilizar o Finzo App (via Open Finance)</li>
              <li>Mensagens enviadas ao WhatsApp Bot</li>
            </ul>

            <h3 style={h3Style}>2.2 Dados coletados automaticamente</h3>
            <ul style={listStyle}>
              <li>Endereco IP e dados de geolocalizacao aproximada</li>
              <li>Tipo de navegador, sistema operacional e dispositivo</li>
              <li>Paginas visitadas, tempo de permanencia e interacoes no site</li>
              <li>Cookies e tecnologias semelhantes de rastreamento</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>3. Como Utilizamos seus Dados</h2>
            <p style={pStyle}>Utilizamos suas informacoes para as seguintes finalidades:</p>
            <ul style={listStyle}>
              <li>Prestar e aprimorar nossos servicos e produtos</li>
              <li>Personalizar a experiencia do usuario</li>
              <li>Enviar comunicacoes relevantes sobre atualizacoes e ofertas</li>
              <li>Processar solicitacoes de contato e agendamentos</li>
              <li>Cumprir obrigacoes legais e regulatorias</li>
              <li>Garantir a seguranca e prevenir fraudes</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>4. Compartilhamento de Dados</h2>
            <p style={pStyle}>
              Nao vendemos suas informacoes pessoais. Podemos compartilhar seus dados com:
            </p>
            <ul style={listStyle}>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Provedores de servico:</strong> empresas que nos auxiliam na operacao dos produtos (hospedagem, processamento de pagamentos, analise de dados)</li>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Parceiros de Open Finance:</strong> instituicoes financeiras autorizadas pelo Banco Central, no contexto do Finzo App</li>
              <li><strong style={{ color: "rgba(255,255,255,0.65)" }}>Autoridades legais:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>5. Seguranca dos Dados</h2>
            <p style={pStyle}>
              Adotamos medidas tecnicas e organizacionais para proteger suas informacoes, incluindo criptografia de ponta a ponta, controle de acesso restrito e monitoramento continuo. Nenhum sistema e 100% seguro, mas nos comprometemos a manter os mais altos padroes de protecao.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>6. Seus Direitos</h2>
            <p style={pStyle}>De acordo com a Lei Geral de Protecao de Dados (LGPD), voce tem direito a:</p>
            <ul style={listStyle}>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusao de dados desnecessarios</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados</li>
              <li>Obter informacoes sobre o compartilhamento de seus dados</li>
            </ul>
            <p style={pStyle}>
              Para exercer seus direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:contato@noratech.com.br" style={{ color: "#c8ff00", borderBottom: "1px solid rgba(200,255,0,0.3)" }}>contato@noratech.com.br</a>.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>7. Cookies</h2>
            <p style={pStyle}>
              Utilizamos cookies para melhorar a experiencia de navegacao, analisar trafego e personalizar conteudo. Voce pode gerenciar suas preferencias de cookies nas configuracoes do navegador. A desativacao de cookies pode afetar a funcionalidade de alguns servicos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>8. Retencao de Dados</h2>
            <p style={pStyle}>
              Seus dados pessoais sao retidos pelo tempo necessario para cumprir as finalidades descritas nesta politica, ou conforme exigido por lei. Quando nao forem mais necessarios, os dados serao excluidos ou anonimizados de forma segura.
            </p>
          </section>

          <section style={{ marginBottom: 0 }}>
            <h2 style={h2Style}>9. Contato</h2>
            <p style={pStyle}>
              Em caso de duvidas sobre esta Politica de Privacidade ou sobre o tratamento de seus dados, entre em contato:
            </p>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginTop: 8 }}>
              <p style={{ ...pStyle, marginBottom: 4 }}><strong style={{ color: "rgba(255,255,255,0.65)" }}>Noratech</strong></p>
              <p style={{ ...pStyle, marginBottom: 4 }}>E-mail: <a href="mailto:contato@noratech.com.br" style={{ color: "#c8ff00" }}>contato@noratech.com.br</a></p>
              <p style={{ ...pStyle, marginBottom: 0 }}>WhatsApp: <a href="https://wa.me/5511932227752" target="_blank" rel="noopener noreferrer" style={{ color: "#c8ff00" }}>(11) 93222-7752</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 780, margin: "0 auto" }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)" }}>&copy; 2026 Noratech &mdash; Todos os direitos reservados</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(200,255,0,0.2)" }}>Privacidade</span>
            <Link to="/termos" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
