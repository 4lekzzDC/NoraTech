import { Link } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { moduleRoute } from '../constants';
import { getPalette, FONT_MONO } from '../theme';

// Card de um módulo do hub Soluções Contábeis.

export default function SolucaoCard({ module }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const available = module.status === 'available';
  const statusColor = available ? P.green : P.primary;
  const statusLabel = available ? 'Disponível' : 'Em migração';

  return (
    <Link
      to={moduleRoute(module.slug)}
      className="solucao-card"
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 14,
        padding: '20px 22px',
        transition: 'all 0.2s',
        display: 'block',
        height: '100%',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: P.shadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{module.icon}</span> {module.name}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.66rem', fontWeight: 700, color: statusColor,
          textTransform: 'uppercase', letterSpacing: 1,
          flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </span>
      </div>
      <p style={{ fontSize: '0.85rem', color: P.muted, marginBottom: 14, minHeight: 38 }}>
        {module.description}
      </p>
      <p style={{ fontFamily: FONT_MONO, fontSize: '0.78rem', color: available ? P.primary : P.muted2 }}>
        {available ? 'Abrir sistema ↗' : 'Acessar painel ↗'}
      </p>
    </Link>
  );
}
