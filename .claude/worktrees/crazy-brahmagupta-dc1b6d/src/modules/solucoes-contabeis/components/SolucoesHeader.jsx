import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import { SOLUCOES_CONTABEIS_NAME, SOLUCOES_CONTABEIS_ROUTE, getHubModule } from '../constants';

// Header da suite. Renderiza dentro do shell global da NoraTech (NÃO
// substitui html/body) e segue a identidade visual já estabelecida em
// /area-do-cliente e na página antiga de Acompanhamento Contábil.

export default function SolucoesHeader({ subtitle }) {
  const { pathname } = useLocation();
  const subSlug = pathname.replace(SOLUCOES_CONTABEIS_ROUTE, '').replace(/^\//, '');
  const subModule = subSlug ? getHubModule(subSlug) : null;
  const title = subModule ? subModule.name : SOLUCOES_CONTABEIS_NAME;
  const breadcrumb = subModule ? SOLUCOES_CONTABEIS_NAME : null;

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <Link
            to="/area-do-cliente"
            title="Voltar à área do cliente"
            aria-label="Voltar à área do cliente"
            style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.2s', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <Link
            to={SOLUCOES_CONTABEIS_ROUTE}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5,
              flexShrink: 0, textDecoration: 'none',
            }}
          >
            Noratech / Soluções Contábeis
          </Link>
          {breadcrumb && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>/</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {subtitle && (
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
              {subtitle}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
