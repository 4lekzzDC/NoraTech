// Categoria "Fiscal" do hub — grade de módulos fiscais, no mesmo padrão leve
// de PessoalPage (banner + grid). Ainda não precisa do dashboard pesado do
// Contábil (abas, estatísticas, gráfico): com um módulo só, uma grade simples
// já entrega a navegação, e cresce para o padrão de abas quando a segunda
// ferramenta fiscal chegar.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SolucoesHeader from '../../components/SolucoesHeader';
import { useIsAdmin } from '../../../../lib/admin';
import { hasActiveSubscription, isModuleEnabled } from '../../../../lib/subscriptions';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER } from '../../theme';
import {
  SOLUCOES_CONTABEIS_ROUTE, SOLUCOES_CONTABEIS_SLUG, SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  moduleRoute,
} from '../../constants';

function IReceipt({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function IChevronRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Catálogo dos módulos fiscais. Um item hoje; a forma já é a de uma lista,
// para que o segundo módulo (ICMS-ST, apuração do Simples, o que vier) seja
// só mais uma linha aqui — não uma página nova.
const ITEMS = [
  {
    name: 'Calculadora de DIFAL', slug: 'calculadora-difal', accent: '#7C3AED', CardIcon: IReceipt,
    desc: 'Diferencial de alíquota do Simples Nacional, produto a produto, a partir do XML da NF-e.',
  },
];

function FiscalCard({ item, P, isDark, onNavigate, blocked }) {
  const [hov, setHov] = useState(false);
  const canHov = hov && !blocked;
  return (
    <button
      onClick={blocked ? undefined : onNavigate}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={blocked ? 'Não incluído no plano contratado — fale com o suporte para liberar.' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', position: 'relative',
        background: canHov ? (isDark ? 'rgba(255,255,255,0.03)' : '#fafafd') : P.surface,
        border: `1px solid ${canHov ? item.accent + '55' : P.border}`,
        borderRadius: 14, padding: '22px 20px 18px',
        cursor: blocked ? 'default' : 'pointer', textAlign: 'left', fontFamily: FONT_INTER,
        color: P.text, boxShadow: canHov ? `0 4px 20px ${item.accent}18` : P.shadow,
        transition: 'all 0.18s ease', transform: canHov ? 'translateY(-2px)' : 'translateY(0)',
        opacity: blocked ? 0.72 : 1,
      }}
    >
      {blocked && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          padding: '3px 8px', borderRadius: 20,
          background: isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.12)',
          color: '#d97706', border: '1px solid rgba(245,158,11,0.3)',
        }}>🔒 Fora do plano</div>
      )}
      <div style={{
        width: 54, height: 54, borderRadius: 14, marginBottom: 16,
        background: item.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', boxShadow: `0 4px 14px ${item.accent}42`,
      }}>
        <item.CardIcon size={24} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8, letterSpacing: -0.2, lineHeight: 1.3 }}>
        {item.name}
      </div>
      <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.6, flex: 1, marginBottom: 18 }}>
        {item.desc}
      </div>
      {!blocked && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: canHov ? item.accent : (isDark ? P.surface2 : '#f5f4fb'),
            border: `1px solid ${canHov ? item.accent : P.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: canHov ? '#fff' : item.accent, transition: 'all 0.18s',
          }}>
            <IChevronRight size={14} />
          </div>
        </div>
      )}
    </button>
  );
}

export default function FiscalPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);
  const isDark = theme === 'dark';
  const { isAdmin } = useIsAdmin();

  // Mesmo gate que o Contábil usa: enquanto não resolve, nada aparece
  // bloqueado — só depois de saber de fato que o módulo está fora do plano.
  // Admin não sofre a restrição: quem configura o acesso não pode ficar
  // bloqueado da própria tela de configuração.
  const [modAccess, setModAccess] = useState({ loaded: false, enabledModules: null });
  useEffect(() => {
    let ativo = true;
    hasActiveSubscription(SOLUCOES_CONTABEIS_SLUG, { legacySlugs: SOLUCOES_CONTABEIS_LEGACY_SLUGS })
      .then(({ enabledModules }) => { if (ativo) setModAccess({ loaded: true, enabledModules }); })
      .catch(() => { if (ativo) setModAccess({ loaded: true, enabledModules: null }); });
    return () => { ativo = false; };
  }, []);
  const isBlocked = (slug) => {
    if (!slug || isAdmin || !modAccess.loaded) return false;
    return !isModuleEnabled(modAccess.enabledModules, slug);
  };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; }
        .fiscal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 860px) { .fiscal-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { .fiscal-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <SolucoesHeader />

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Link to={SOLUCOES_CONTABEIS_ROUTE} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: P.primaryText, marginBottom: 20 }}>
          ← Voltar para a suite
        </Link>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          padding: '26px 30px', borderRadius: 16, marginBottom: 24,
          background: isDark
            ? 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(99,102,241,0.06))'
            : 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.04) 100%)',
          border: `1px solid ${P.primaryBorder}`,
          boxShadow: P.shadow,
        }}>
          <div style={{
            width: 62, height: 62, borderRadius: 16, flexShrink: 0,
            background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.primaryText,
          }}>
            <IReceipt size={26} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: P.text, marginBottom: 6, lineHeight: 1.1 }}>
              Fiscal
            </div>
            <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.55, maxWidth: 460 }}>
              Apuração de tributos e obrigações fiscais.
            </div>
          </div>
        </div>

        <div className="fiscal-grid">
          {ITEMS.map((item) => (
            <FiscalCard
              key={item.slug}
              item={item}
              P={P}
              isDark={isDark}
              blocked={isBlocked(item.slug)}
              onNavigate={() => navigate(moduleRoute(item.slug))}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
