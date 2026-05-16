import { Link } from 'react-router-dom';
import { moduleRoute } from '../constants';

// Card de um módulo do hub Soluções Contábeis.
// Reaproveita o estilo do SystemCard usado em /area-do-cliente para manter
// a identidade visual da NoraTech.

const BASE_CARD_STYLE = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: '20px 22px',
  transition: 'all 0.2s',
  display: 'block',
  height: '100%',
};

export default function SolucaoCard({ module }) {
  const available = module.status === 'available';
  const statusColor = available ? '#00d48a' : '#a78bfa';
  const statusLabel = available ? 'Disponível' : 'Em migração';

  const inner = (
    <>
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
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 14, minHeight: 38 }}>
        {module.description}
      </p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: available ? '#7C3AED' : 'rgba(255,255,255,0.35)' }}>
        {available ? 'Abrir sistema ↗' : 'Acessar painel ↗'}
      </p>
    </>
  );

  return (
    <Link
      to={moduleRoute(module.slug)}
      className="solucao-card"
      style={{ ...BASE_CARD_STYLE, textDecoration: 'none', color: 'inherit' }}
    >
      {inner}
    </Link>
  );
}
