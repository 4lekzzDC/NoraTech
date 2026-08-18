import { Link, NavLink } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import UserProfileMenu from '../../../components/UserProfileMenu';
import { useTheme } from '../../../contexts/ThemeContext';
import { NAV_ITEMS, NORADOCS_NAME, NORADOCS_ROUTE, noradocsRoute } from '../constants';
import { getPalette, FONT_INTER, FONT_MONO } from '../theme';

// Moldura das quatro telas do NoraDocs: header sempre dark (mesma linguagem do
// hub Soluções Contábeis) e sidebar de navegação por rota.
//
// A navegação é por rota, e não por scroll de âncora como no hub: aqui cada
// item é uma tela de trabalho independente, não uma seção de um catálogo.

const CENTRAL_DE_CONTROLE_ROUTE = '/area-do-cliente';

export default function NoraDocsLayout({ title, subtitle, actions, children }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <style>{`
        .nd-header {
          position: sticky; top: 0; z-index: 100;
          background: #08080A;
          border-bottom: 1px solid rgba(139,61,255,0.25);
          box-shadow: 0 8px 30px rgba(0,0,0,0.28);
        }
        .nd-header-inner {
          max-width: 1240px; margin: 0 auto; padding: 0 32px; height: 60px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .nd-back {
          color: rgba(255,255,255,0.55); text-decoration: none; font-size: 0.8rem;
          display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s;
        }
        .nd-back:hover { color: #C4B5FD; }
        .nd-brand { color: #EEEDE9; font-weight: 800; letter-spacing: -0.02em; font-size: 0.98rem; }
        .nd-brand span { color: #8B3DFF; }
        .nd-nav-link {
          display: block; padding: 9px 12px; border-radius: 10px;
          font-size: 0.86rem; text-decoration: none; margin-bottom: 2px;
          transition: background 0.15s, color 0.15s;
        }
        @media (max-width: 860px) {
          .nd-header-inner { padding: 0 18px; }
          .nd-shell { flex-direction: column; }
          .nd-sidebar { width: 100% !important; position: static !important;
            border-right: none !important; max-height: none !important; }
          .nd-nav { display: flex; gap: 6px; overflow-x: auto; }
        }
      `}</style>

      <header className="nd-header">
        <div className="nd-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <Link to={NORADOCS_ROUTE} className="nd-brand" style={{ textDecoration: 'none' }}>
              Nora<span>Docs</span>
            </Link>
            <span style={{ width: 1, height: 22, background: 'rgba(139,61,255,0.25)' }} />
            <Link to={CENTRAL_DE_CONTROLE_ROUTE} className="nd-back">
              ← Central de Controle
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <div className="nd-shell" style={{ display: 'flex', maxWidth: 1240, margin: '0 auto', gap: 0 }}>
        <aside
          className="nd-sidebar"
          style={{
            width: 214, flexShrink: 0,
            borderRight: `1px solid ${P.border}`,
            padding: '22px 14px',
            position: 'sticky', top: 60, alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
          }}
        >
          <div style={{
            fontFamily: FONT_MONO, fontSize: '0.6rem', fontWeight: 500, letterSpacing: 1.4,
            color: P.muted2, textTransform: 'uppercase', padding: '4px 12px 12px',
          }}>
            {NORADOCS_NAME}
          </div>
          <nav className="nd-nav">
            {NAV_ITEMS.map((item) => {
              const to = noradocsRoute(item.path);
              // `end` só na raiz: sem isso a Caixa de Entrada ficaria ativa em
              // todas as sub-rotas, já que todas começam com /noradocs.
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={item.path === ''}
                  className="nd-nav-link"
                  style={({ isActive }) => ({
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? P.primaryText : P.muted,
                    background: isActive ? P.primarySoft : 'transparent',
                    whiteSpace: 'nowrap',
                  })}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 72px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', marginBottom: 24,
          }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: '1.42rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ margin: '6px 0 0', color: P.muted, fontSize: '0.88rem', maxWidth: '62ch' }}>
                  {subtitle}
                </p>
              )}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
