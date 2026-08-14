import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyCompany } from '../lib/companies';
import UserProfileModal from './UserProfileModal';

export default function UserProfileMenu() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 80, right: 32 });
  const initials = useMemo(() => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'), [user]);

  // A posição do menu vem do retângulo do avatar. Isso é medido em efeito, e
  // não durante o render: ler ref.current no render devolve a medida do frame
  // anterior (ou null no primeiro) e não reage a scroll/resize — o menu ficava
  // ancorado no lugar errado depois que a página rolava.
  useEffect(() => {
    if (!profileOpen) return undefined;

    const measure = () => {
      const rect = avatarRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [profileOpen]);

  useEffect(() => {
    let active = true;
    fetchMyCompany()
      .then((info) => {
        if (active) setCompanyInfo(info);
      })
      .catch(() => {
        if (active) setCompanyInfo(null);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target) && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <button ref={avatarRef} type="button" className="nt-profile-avatar-trigger" onClick={() => setProfileOpen((o) => !o)} title={user?.name || 'Usuario'} aria-label="Menu do usuario">
        {user?.photoUrl ? (
          <img src={user.photoUrl} alt="" className="nt-profile-avatar-trigger-img" />
        ) : (
          <div className={`nt-profile-avatar-fallback nt-profile-avatar-trigger-fallback${profileOpen ? ' active' : ''}`}>{initials}</div>
        )}
      </button>

      {profileOpen && createPortal(
        (
          <div ref={profileMenuRef} className="nt-user-menu" style={{ top: menuPos.top, right: menuPos.right }}>
            <div className="nt-user-menu-head">
              <div className="nt-user-menu-user">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="" className="nt-user-menu-avatar" />
                ) : (
                  <div className="nt-profile-avatar-fallback nt-user-menu-avatar-fallback">{initials}</div>
                )}
                <div className="nt-user-menu-copy">
                  <div className="nt-user-menu-name">{user?.name || 'Usuario'}</div>
                  <div className="nt-user-menu-email">{user?.email}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="nt-user-menu-item"
              onClick={() => {
                setProfileOpen(false);
                setProfileModalOpen(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Meu perfil
            </button>

            <button
              type="button"
              className="nt-user-menu-item nt-user-menu-logout"
              onClick={() => {
                setProfileOpen(false);
                handleLogout();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair
            </button>
          </div>
        ), document.body)}

      {profileModalOpen && (
        <UserProfileModal
          user={user}
          companyInfo={companyInfo}
          initials={initials}
          onClose={() => setProfileModalOpen(false)}
          onUserUpdate={updateUser}
        />
      )}
    </>
  );
}
