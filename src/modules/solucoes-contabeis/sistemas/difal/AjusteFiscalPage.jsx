// Ajuste de alíquotas de NCM do próprio escritório.
//
// Sobrepõe a base global (mantida pelo admin da plataforma) só para este
// escritório, prefixo a prefixo — para quando um cliente tem um regime
// diferenciado que a regra geral do estado não cobre. A rota já é protegida
// por `OrgManagerRoute` (owner/admin da equipe); a RLS do banco protege de
// novo, então mesmo um link direto não passa de quem não tem o cargo.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER } from '../../theme';
import { getCurrentTenantCompanyId } from '../../../../lib/subscriptions';
import { SOLUCOES_CONTABEIS_ROUTE } from '../../constants';
import GerenciadorRegrasNcm from './GerenciadorRegrasNcm';

export default function AjusteFiscalPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [companyId, setCompanyId] = useState(undefined);

  useEffect(() => {
    getCurrentTenantCompanyId().then((id) => setCompanyId(id || null)).catch(() => setCompanyId(null));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
      `}</style>

      <SolucoesHeader />

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Link to={`${SOLUCOES_CONTABEIS_ROUTE}/calculadora-difal`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: P.primaryText, marginBottom: 20 }}>
          ← Voltar para a Calculadora de DIFAL
        </Link>

        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
          Ajuste fiscal do escritório
        </h1>
        <p style={{ fontSize: '0.85rem', color: P.muted, lineHeight: 1.6, marginBottom: 24, maxWidth: 640 }}>
          As alíquotas por NCM vêm de uma base compartilhada da plataforma. Use esta tela só
          quando um cliente tem um regime diferenciado que a regra geral do estado não cobre —
          o que for cadastrado aqui sobrepõe a base global, prefixo a prefixo, só para este
          escritório.
        </p>

        {companyId === undefined ? (
          <div style={{ color: P.muted, fontSize: 13 }}>Carregando…</div>
        ) : !companyId ? (
          <div style={{ color: P.muted, fontSize: 13 }}>
            Sem equipe ativa — entre em uma organização para ajustar regras fiscais.
          </div>
        ) : (
          <GerenciadorRegrasNcm
            escopo="tenant"
            tenantCompanyId={companyId}
            titulo="Ajuste deste escritório"
            descricao="Um NCM cadastrado aqui substitui a regra global inteira para aquele prefixo — todas as vigências dela, não só a mais recente. Deixe em branco o que não precisa mudar."
          />
        )}
      </main>
    </div>
  );
}
