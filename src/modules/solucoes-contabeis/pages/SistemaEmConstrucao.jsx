import { Link, useParams } from 'react-router-dom';
import SolucoesHeader from '../components/SolucoesHeader';
import { SOLUCOES_CONTABEIS_ROUTE, getHubModule } from '../constants';

// Placeholder universal para os módulos do Autonomy que ainda não foram
// reescritos para a stack da NoraTech. Recebe o slug pela URL e procura
// o módulo correspondente no catálogo (HUB_MODULES) para renderizar o
// nome, ícone e descrição corretos.

export default function SistemaEmConstrucao({ slug: slugFromProps }) {
  const params = useParams();
  const slug = slugFromProps || params.slug;
  const module = slug ? getHubModule(slug) : null;
  const name = module?.name || 'Módulo';
  const icon = module?.icon || '🧩';
  const description = module?.description || 'Este módulo ainda está em processo de migração.';

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        .em-migracao-btn:hover { background: rgba(124,58,237,0.18) !important; border-color: rgba(124,58,237,0.45) !important; }
      `}</style>
      <SolucoesHeader />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '120px 32px 80px', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 18 }}>{icon}</div>
        <span style={{
          display: 'inline-block',
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5,
          color: '#c4b3ff',
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(124,58,237,0.14)',
          border: '1px solid rgba(124,58,237,0.3)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          Em migração
        </span>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: -0.6, marginBottom: 14 }}>
          {name}
        </h1>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.55 }}>
          {description}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
          Estamos migrando este módulo do Autonomy para a infraestrutura da NoraTech.
          Em breve ele estará disponível dentro da suite Soluções Contábeis.
        </p>
        <Link
          to={SOLUCOES_CONTABEIS_ROUTE}
          className="em-migracao-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 10,
            border: '1px solid rgba(124,58,237,0.3)',
            background: 'rgba(124,58,237,0.08)',
            color: '#ddd6fe',
            fontSize: '0.88rem', fontWeight: 700,
            transition: 'background 0.18s, border-color 0.18s',
          }}
        >
          ← Voltar para a suite
        </Link>
      </main>
    </div>
  );
}
