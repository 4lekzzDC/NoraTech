import { HUB_SECTIONS } from '../constants';

// Sidebar do hub Soluções Contábeis.
// Funciona como navegação interna (anchor scroll) para as seções do hub.
// Não substitui o layout global da NoraTech — fica encaixada dentro do
// shell da suite.

export default function SolucoesSidebar({ activeSection, onSectionClick }) {
  return (
    <aside
      style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 14px',
        position: 'sticky', top: 72, alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 72px)', overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.4, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '4px 10px 12px' }}>
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
              color: active ? '#c4b3ff' : 'rgba(255,255,255,0.7)',
              background: active ? 'rgba(124,58,237,0.14)' : 'transparent',
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
