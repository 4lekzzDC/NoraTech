// Componentes de formulário compartilhados entre as telas de admin que
// editam o catálogo de sistemas/módulos — extraído de AdminSystemsPage.jsx
// para não duplicar quando a tela de detalhe do sistema precisou dos mesmos
// campos (logo, slug, ícone). Funções puras (slugify, validateLogoFile)
// moraram em adminFormUtils.js — misturar os dois aqui quebra o
// fast-refresh do Vite.

export function SystemLogo({ system, size = 38 }) {
  if (system.logo_url) {
    return (
      <img
        src={system.logo_url}
        alt=""
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45,
    }}>
      {system.icon || '🧩'}
    </div>
  );
}

export function Field({ label, hint, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{hint}</span>}
    </label>
  );
}
