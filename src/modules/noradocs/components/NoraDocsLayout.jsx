import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import UserProfileMenu from '../../../components/UserProfileMenu';
import { useTheme } from '../../../contexts/ThemeContext';
import { NAV_ITEMS, NORADOCS_NAME, NORADOCS_ROUTE, noradocsRoute } from '../constants';
import { getPalette, FONT_INTER, FONT_MONO } from '../theme';

// Moldura das quatro telas do NoraDocs: barra de ícones à esquerda (altura
// cheia), cabeçalho só sobre o conteúdo, sidebar de navegação por rota.
//
// A navegação é por rota, e não por scroll de âncora como no hub: aqui cada
// item é uma tela de trabalho independente, não uma seção de um catálogo.

const AREA_DO_CLIENTE_ROUTE = '/area-do-cliente';
const RAIL_EXPANDED_KEY = 'noradocs:rail-expanded';

// Ícones da barra — desenhados à mão no mesmo traço (stroke 2, cantos
// arredondados) do resto do NoraDocs, sem depender de lib de ícones.
const ICONES = {
  '': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  historico: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H6a2 2 0 0 0-2 2v13a1 1 0 0 0 1 1h4" />
      <path d="M9 4h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H9" />
      <path d="M9 4v17" />
      <line x1="13" y1="8.5" x2="17" y2="8.5" />
      <line x1="13" y1="12.5" x2="17" y2="12.5" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  configuracoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const ICONE_VOLTAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
);

function carregarExpandido() {
  try {
    return window.localStorage.getItem(RAIL_EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function NoraDocsLayout({ title, subtitle, actions, children }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [expandido, setExpandido] = useState(carregarExpandido);

  function alternarExpandido() {
    setExpandido((atual) => {
      const novo = !atual;
      try {
        window.localStorage.setItem(RAIL_EXPANDED_KEY, novo ? '1' : '0');
      } catch {
        // localStorage indisponível (modo privado etc.) — a preferência só
        // não sobrevive ao recarregamento, sem quebrar o botão.
      }
      return novo;
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER, display: 'flex' }}>
      <style>{`
        .nd-rail {
          position: sticky; top: 0; align-self: flex-start; height: 100vh;
          flex-shrink: 0; width: 60px; background: #08080A;
          border-right: 1px solid rgba(139,61,255,0.18);
          display: flex; flex-direction: column; align-items: center; padding: 16px 0;
          transition: width 0.18s cubic-bezier(0.2,0,0,1);
          z-index: 20;
        }
        .nd-rail.expandido { width: 208px; align-items: stretch; padding: 16px 12px; }
        .nd-rail-logo {
          width: 30px; height: 30px; border-radius: 9px; background: #8B3DFF;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;
          margin: 0 0 14px;
        }
        .nd-rail.expandido .nd-rail-logo { align-self: center; }
        .nd-rail-toggle {
          position: absolute; top: 50%; right: -11px; transform: translateY(-50%);
          width: 22px; height: 22px; border-radius: 50%; z-index: 21;
          border: 1px solid ${P.border2}; background: ${P.surfaceSolid};
          color: ${P.muted}; display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        }
        .nd-rail-toggle:hover { color: ${P.text}; border-color: ${P.primaryBorder}; }
        .nd-rail-toggle svg { width: 11px; height: 11px; transition: transform 0.18s cubic-bezier(0.2,0,0,1); }
        .nd-rail.expandido .nd-rail-toggle svg { transform: rotate(180deg); }
        .nd-rail-item {
          position: relative; width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          color: rgba(255,255,255,0.5); text-decoration: none; margin-bottom: 3px;
          transition: background 0.15s, color 0.15s;
        }
        .nd-rail.expandido .nd-rail-item {
          width: auto; height: 36px; justify-content: flex-start; gap: 10px; padding: 0 9px;
        }
        .nd-rail-item svg { width: 18px; height: 18px; flex-shrink: 0; }
        .nd-rail-item:hover { color: rgba(255,255,255,0.85); }
        .nd-rail-item.ativo { background: rgba(139,61,255,0.16); color: #C4B5FD; }
        .nd-rail-label { display: none; font-size: 0.83rem; font-weight: 600; white-space: nowrap; }
        .nd-rail.expandido .nd-rail-label { display: inline; }
        .nd-rail-tip {
          position: absolute; left: 48px; top: 50%; transform: translateY(-50%);
          background: ${P.surfaceSolid}; border: 1px solid ${P.border2}; color: ${P.text};
          font-size: 0.72rem; font-weight: 600; padding: 5px 9px; border-radius: 7px;
          white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.12s;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        }
        .nd-rail-item:hover .nd-rail-tip { opacity: 1; }
        .nd-rail.expandido .nd-rail-tip { display: none; }
        .nd-rail-spacer { flex: 1; }

        .nd-header {
          position: sticky; top: 0; z-index: 10;
          background: #08080A;
          border-bottom: 1px solid rgba(139,61,255,0.25);
          box-shadow: 0 8px 30px rgba(0,0,0,0.28);
        }
        .nd-header-inner {
          padding: 0 28px; height: 60px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .nd-brand { color: #EEEDE9; font-weight: 800; letter-spacing: -0.02em; font-size: 0.98rem; text-decoration: none; }
        .nd-brand span { color: #8B3DFF; }
        @media (max-width: 860px) {
          .nd-header-inner { padding: 0 16px; }
          .nd-rail.expandido { width: 60px; align-items: center; padding: 16px 0; }
          .nd-rail.expandido .nd-rail-item { width: 38px; height: 38px; justify-content: center; gap: 0; padding: 0; }
          .nd-rail.expandido .nd-rail-label { display: none; }
          .nd-rail.expandido .nd-rail-tip { display: block; }
          .nd-rail-toggle { display: none; }
        }
        @media (max-width: 640px) {
          .nd-main { padding: 22px 16px 60px !important; }
          .nd-rail { width: 50px; }
        }
      `}</style>

      <nav className={`nd-rail${expandido ? ' expandido' : ''}`} aria-label="Navegação do NoraDocs">
        <Link to={NORADOCS_ROUTE} className="nd-rail-logo" title={NORADOCS_NAME}>N</Link>

        <button
          type="button"
          className="nd-rail-toggle"
          onClick={alternarExpandido}
          aria-label={expandido ? 'Recolher barra de navegação' : 'Expandir barra de navegação'}
          title={expandido ? 'Recolher' : 'Expandir'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {NAV_ITEMS.map((item) => {
          const to = noradocsRoute(item.path);
          return (
            <NavLink
              key={to}
              to={to}
              end={item.path === ''}
              className={({ isActive }) => `nd-rail-item${isActive ? ' ativo' : ''}`}
              title={item.hint}
            >
              {ICONES[item.path]}
              <span className="nd-rail-label">{item.label}</span>
              <span className="nd-rail-tip">{item.label}</span>
            </NavLink>
          );
        })}

        <div className="nd-rail-spacer" />

        <Link to={AREA_DO_CLIENTE_ROUTE} className="nd-rail-item" title="Voltar para a Área do Cliente">
          {ICONE_VOLTAR}
          <span className="nd-rail-label">Área do Cliente</span>
          <span className="nd-rail-tip">Área do Cliente</span>
        </Link>
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="nd-header">
          <div className="nd-header-inner">
            <Link to={NORADOCS_ROUTE} className="nd-brand">
              Nora<span>Docs</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </div>
        </header>

        <main className="nd-main" style={{ flex: 1, minWidth: 0, padding: '28px 32px 72px' }}>
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
