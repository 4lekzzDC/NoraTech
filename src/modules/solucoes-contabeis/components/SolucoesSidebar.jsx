import { useTheme } from '../../../contexts/ThemeContext';
import { HUB_SECTIONS } from '../constants';
import { getPalette } from '../theme';

// Sidebar do hub Soluções Contábeis (navegação interna por anchor scroll).

export default function SolucoesSidebar({ activeSection, onSectionClick }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  return (
    <aside
      style={{
        width: 220, flexShrink: 0,
        borderRight: `1px solid ${P.border}`,
        padding: '24px 14px',
        position: 'sticky', top: 72, alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 72px)', overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.4, color: P.muted2, textTransform: 'uppercase', padding: '4px 10px 12px' }}>
        Navegar
      </div>
      {HUB_SECTIONS.map((section) => {
        const active = section.id === activeSection;
        return (
          <a
            key={section.id}
            href={`#section-${section.id}`}
            onClick={(e) => {
              if (onSectionClick) {
                e.preventDefault();
                onSectionClick(section.id);
              }
            }}
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: '0.86rem',
              fontWeight: active ? 700 : 500,
              color: active ? P.primaryText : P.muted,
              background: active ? P.primarySoft : 'transparent',
              textDecoration: 'none',
              marginBottom: 2,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {section.title}
          </a>
        );
      })}
    </aside>
  );
}
