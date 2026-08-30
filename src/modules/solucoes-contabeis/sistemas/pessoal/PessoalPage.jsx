// Categoria "Pessoal" do hub. Ferramentas vêm de `hub_module_categorias`/
// `hub_module_ferramentas` (editáveis em Admin/Sistemas/NoraHub/Estrutura)
// — o catálogo hardcoded abaixo só entra se o banco não tiver nada
// cadastrado ainda (mesmo padrão de fallback que FiscalPage.jsx usa).

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SolucoesHeader from '../../components/SolucoesHeader';
import { carregarCategoriaComFerramentas } from '../../../../lib/hubModuleCatalog';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER } from '../../theme';
import { SOLUCOES_CONTABEIS_ROUTE, SOLUCOES_CONTABEIS_SLUG, moduleRoute } from '../../constants';

function IUserCheck({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

const CATEGORIA_PADRAO = {
  categoria: { name: 'Pessoal', description: 'Gestão de pessoas e processos de RH.', icon: '' },
  ferramentas: [
    {
      slug: 'controle-funcionarios', name: 'Controle dos funcionários', icon: '', color: '#7C3AED', status: 'soon',
      description: 'Gerencie admissões, demissões, férias e obrigações trabalhistas dos funcionários.',
    },
  ],
};

function PersonCard({ item, P, isDark, onNavigate }) {
  const [hov, setHov] = useState(false);
  const soon = item.status === 'soon';
  const canHov = hov && !soon;
  return (
    <button
      onClick={soon ? undefined : onNavigate}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', position: 'relative',
        background: canHov ? (isDark ? 'rgba(255,255,255,0.03)' : '#fafafd') : P.surface,
        border: `1px solid ${canHov ? item.color + '55' : P.border}`,
        borderRadius: 14, padding: '22px 20px 18px',
        cursor: soon ? 'default' : 'pointer', textAlign: 'left', fontFamily: FONT_INTER,
        color: P.text, boxShadow: P.shadow, transition: 'all 0.18s ease',
        opacity: soon ? 0.72 : 1,
      }}
    >
      {soon && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          padding: '3px 8px', borderRadius: 20,
          background: isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.1)',
          color: '#7C3AED', border: '1px solid rgba(124,58,237,0.25)',
        }}>Em breve</div>
      )}
      <div style={{
        width: 54, height: 54, borderRadius: 14, marginBottom: 16,
        background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', boxShadow: `0 4px 14px ${item.color}42`, fontSize: 24,
      }}>
        {item.icon || <IUserCheck size={24} />}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8, letterSpacing: -0.2, lineHeight: 1.3 }}>
        {item.name}
      </div>
      <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.6 }}>
        {item.description}
      </div>
    </button>
  );
}

export default function PessoalPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);
  const isDark = theme === 'dark';

  const [dados, setDados] = useState(null);
  useEffect(() => {
    let ativo = true;
    carregarCategoriaComFerramentas(SOLUCOES_CONTABEIS_SLUG, 'pessoal')
      .then((r) => { if (ativo) setDados(r?.ferramentas?.length ? r : CATEGORIA_PADRAO); })
      .catch(() => { if (ativo) setDados(CATEGORIA_PADRAO); });
    return () => { ativo = false; };
  }, []);
  const { categoria, ferramentas } = dados || CATEGORIA_PADRAO;

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; }
        .pessoal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 860px) { .pessoal-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { .pessoal-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <SolucoesHeader />

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Link to={SOLUCOES_CONTABEIS_ROUTE} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: P.primaryText, marginBottom: 20 }}>
          ← Voltar para a suite
        </Link>

        {/* Category banner */}
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
            fontSize: 26,
          }}>
            {categoria.icon || <IUserCheck size={26} />}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: P.text, marginBottom: 6, lineHeight: 1.1 }}>
              {categoria.name}
            </div>
            <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.55, maxWidth: 460 }}>
              {categoria.description}
            </div>
          </div>
        </div>

        <div className="pessoal-grid">
          {ferramentas.map((item) => (
            <PersonCard key={item.slug} item={item} P={P} isDark={isDark} onNavigate={() => navigate(moduleRoute(item.slug))} />
          ))}
        </div>
      </main>
    </div>
  );
}
