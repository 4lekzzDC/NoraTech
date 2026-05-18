import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import UserProfileMenu from '../../../components/UserProfileMenu';
import { SOLUCOES_CONTABEIS_NAME, SOLUCOES_CONTABEIS_ROUTE, getHubModule } from '../constants';

// Header sempre dark — não reage ao tema da página.
// Roxo (#8B3DFF) apenas como detalhe: separadores, hover, bordas.

const CENTRAL_DE_CONTROLE_ROUTE = '/area-do-cliente';

const TOOL_PARENTS = {
  'codificador':              { slug: 'contabil', name: 'Contábil' },
  'conciliador-extratos':     { slug: 'contabil', name: 'Contábil' },
  'transformador-extrato':    { slug: 'contabil', name: 'Contábil' },
  'conciliador-fornecedores': { slug: 'contabil', name: 'Contábil' },
  'analise-demonstracoes':    { slug: 'contabil', name: 'Contábil' },
  'acompanhamento-contabil':  { slug: 'contabil', name: 'Contábil' },
  'prazos':                   { slug: 'contabil', name: 'Contábil' },
  'gestao-clientes':          { slug: 'gestao',   name: 'Gestão' },
};

export default function SolucoesHeader() {
  const { pathname } = useLocation();

  const subSlug = pathname.replace(SOLUCOES_CONTABEIS_ROUTE, '').replace(/^\//, '');
  const subModule = subSlug ? getHubModule(subSlug) : null;
  const isInside = Boolean(subModule);
  const parent = subModule ? TOOL_PARENTS[subModule.slug] : null;

  const backHref  = isInside
    ? (parent ? `${SOLUCOES_CONTABEIS_ROUTE}/${parent.slug}` : SOLUCOES_CONTABEIS_ROUTE)
    : CENTRAL_DE_CONTROLE_ROUTE;
  const backLabel = isInside
    ? (parent ? `Voltar para ${parent.name}` : 'Voltar para a suite')
    : 'Voltar à Central de Controle';

  const crumbs = [
    { label: 'Noratech',              href: CENTRAL_DE_CONTROLE_ROUTE, mono: true },
    { label: SOLUCOES_CONTABEIS_NAME, href: SOLUCOES_CONTABEIS_ROUTE },
  ];
  if (isInside && parent) {
    crumbs.push({ label: parent.name, href: `${SOLUCOES_CONTABEIS_ROUTE}/${parent.slug}` });
  }
  if (isInside) {
    crumbs.push({ label: subModule.name, href: null });
  }

  return (
    <>
      <style>{`
        .sc-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #08080A;
          border-bottom: 1px solid rgba(139,61,255,0.25);
          box-shadow: 0 8px 30px rgba(0,0,0,0.28);
        }
        .sc-header-inner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 32px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .sc-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .sc-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          color: #fff;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.17s, border-color 0.17s;
        }
        .sc-back:hover {
          background: rgba(139,61,255,0.14);
          border-color: #8B3DFF;
        }
        .sc-back svg { display: block; }
        .sc-nav {
          display: flex;
          align-items: center;
          gap: 0;
          min-width: 0;
        }
        .sc-crumb-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0;
          min-width: 0;
        }
        .sc-sep {
          display: inline-flex;
          align-items: center;
          padding: 0 5px;
          font-size: 13px;
          line-height: 1;
          color: rgba(139,61,255,0.75);
          user-select: none;
          flex-shrink: 0;
        }
        .sc-crumb {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 7px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
          color: rgba(255,255,255,0.68);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
        }
        .sc-crumb-link:hover {
          color: #fff;
          background: rgba(139,61,255,0.14);
        }
        .sc-crumb-current {
          color: #fff;
          font-weight: 600;
          max-width: 360px;
        }
        .sc-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.2px; }
        @media (max-width: 640px) {
          .sc-header-inner { padding: 0 14px !important; }
          .sc-crumb-wrap:not(:last-child) { display: none !important; }
        }
        .sc-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        /* ThemeToggle override — forçar estilo dark dentro do header */
        .sc-toggle-slot button.theme-toggle,
        .sc-toggle-slot [class*="theme-toggle"] {
          width: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
          color: #fff !important;
          transition: background 0.17s, border-color 0.17s !important;
        }
        .sc-toggle-slot button.theme-toggle:hover,
        .sc-toggle-slot [class*="theme-toggle"]:hover {
          background: rgba(139,61,255,0.14) !important;
          border-color: #8B3DFF !important;
        }
      `}</style>

      <header className="sc-header">
        <div className="sc-header-inner">
          {/* Esquerda: botão voltar + breadcrumb */}
          <div className="sc-left">
            <Link to={backHref} title={backLabel} aria-label={backLabel} className="sc-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>

            <nav aria-label="Breadcrumb" className="sc-nav">
              {crumbs.map((c, i) => {
                const isLast = i === crumbs.length - 1;
                const cls = [
                  'sc-crumb',
                  c.mono ? 'sc-mono' : '',
                  isLast ? 'sc-crumb-current' : (c.href ? 'sc-crumb-link' : ''),
                ].filter(Boolean).join(' ');

                return (
                  <span key={i} className="sc-crumb-wrap">
                    {i > 0 && <span className="sc-sep">/</span>}
                    {c.href && !isLast ? (
                      <Link to={c.href} className={cls} title={c.label}>{c.label}</Link>
                    ) : (
                      <span className={cls} title={c.label}>{c.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          {/* Direita: toggle + perfil */}
          <div className="sc-right">
            <span className="sc-toggle-slot" style={{ display: 'inline-flex' }}>
              <ThemeToggle />
            </span>
            <UserProfileMenu />
          </div>
        </div>
      </header>
    </>
  );
}
