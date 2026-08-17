// Avatar do usuário, compartilhado pelas telas da suite Soluções Contábeis.
// Usa a foto de perfil quando existe; senão cai nas iniciais do nome sobre
// o gradiente roxo da NoraTech.

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function UserAvatar({ user, size = 54 }) {
  if (user?.photoUrl) {
    return (
      <img
        src={user.photoUrl} alt={user.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(124,58,237,0.25)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,rgba(124,58,237,0.22) 0%,rgba(124,58,237,0.08) 100%)',
      border: '2px solid rgba(124,58,237,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.32), fontWeight: 700, color: '#7C3AED',
    }}>{initials(user?.name)}</div>
  );
}
