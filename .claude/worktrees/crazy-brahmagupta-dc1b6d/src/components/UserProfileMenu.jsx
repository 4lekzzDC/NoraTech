import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';
import { fetchMyCompany } from '../lib/companies';

const COMPANY_ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };
const PRESENCE = {
  online: { label: 'Online', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', bd: 'rgba(34,197,94,0.26)' },
  busy: { label: 'Ocupado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.28)' },
  away: { label: 'Ausente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', bd: 'rgba(245,158,11,0.3)' },
  invisible: { label: 'Invisivel', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', bd: 'rgba(156,163,175,0.28)' },
};

function isActiveStatus(user) {
  if (!user?.statusMessage || !user?.statusExpiresAt) return false;
  const expires = new Date(user.statusExpiresAt);
  return !Number.isNaN(expires.getTime()) && expires > new Date();
}

function validateProfileImage(file, maxMb) {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!file) return 'Selecione uma imagem.';
  if (!allowed.includes(file.type)) return 'Use uma imagem PNG, JPG, JPEG ou WebP.';
  if (file.size > maxMb * 1024 * 1024) return `Imagem acima de ${maxMb}MB.`;
  return null;
}

function VerifiedBadge() {
  return (
    <span className="nt-verified-badge" aria-label="E-mail verificado" tabIndex={0}>
      <span className="nt-verified-icon">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </span>
  );
}

function UserProfileModal({ user, companyInfo, initials, onClose, onUserUpdate }) {
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const statusEditorRef = useRef(null);
  const presenceMenuRef = useRef(null);
  const [saving, setSaving] = useState('');
  const [statusText, setStatusText] = useState(isActiveStatus(user) ? user.statusMessage : '');
  const [statusDraft, setStatusDraft] = useState(isActiveStatus(user) ? user.statusMessage : '');
  const [statusEditing, setStatusEditing] = useState(false);
  const [presence, setPresence] = useState('online');
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [message, setMessage] = useState(null);

  const companyName = companyInfo?.company?.name || user?.company || 'Sem empresa vinculada';
  const companyRole = companyInfo?.membership?.role || null;
  const roleLabel = COMPANY_ROLE_LABEL[companyRole] || 'Membro';
  const activeStatus = isActiveStatus(user) ? user.statusMessage : null;
  const presenceConfig = PRESENCE[presence] || PRESENCE.online;
  const bannerStyle = user?.bannerUrl
    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34)), url(${user.bannerUrl})` }
    : undefined;

  const uploadImage = async (file, kind) => {
    const maxMb = kind === 'avatar' ? 2 : 5;
    const validationError = validateProfileImage(file, maxMb);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    try {
      setSaving(kind);
      setMessage(null);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      const column = kind === 'avatar' ? 'photo_url' : 'banner_url';
      const { error: updateError } = await supabase.from('profiles').update({ [column]: publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (updateError) throw updateError;

      onUserUpdate(kind === 'avatar' ? { photoUrl: publicUrl } : { bannerUrl: publicUrl });
      setMessage({ type: 'success', text: kind === 'avatar' ? 'Foto atualizada.' : 'Banner atualizado.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao enviar imagem.' });
    } finally {
      setSaving('');
    }
  };

  const saveStatus = async (e) => {
    e.preventDefault();
    const trimmed = statusDraft.trim();
    if (trimmed.length > 80) {
      setMessage({ type: 'error', text: 'Status deve ter no maximo 80 caracteres.' });
      return;
    }

    try {
      setSaving('status');
      setMessage(null);
      const payload = trimmed
        ? { status_message: trimmed, status_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }
        : { status_message: null, status_expires_at: null, updated_at: new Date().toISOString() };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw error;

      onUserUpdate({ statusMessage: payload.status_message, statusExpiresAt: payload.status_expires_at });
      setStatusText(trimmed);
      setStatusEditing(false);
      setMessage({ type: 'success', text: trimmed ? 'Status salvo por 24h.' : 'Status removido.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar status.' });
    } finally {
      setSaving('');
    }
  };

  useEffect(() => {
    if (!statusEditing && !presenceOpen) return undefined;

    const handler = (e) => {
      if (statusEditing && statusEditorRef.current && !statusEditorRef.current.contains(e.target)) {
        setStatusDraft(statusText);
        setStatusEditing(false);
      }
      if (presenceOpen && presenceMenuRef.current && !presenceMenuRef.current.contains(e.target)) {
        setPresenceOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presenceOpen, statusEditing, statusText]);

  return createPortal(
    <div
      className="nt-profile-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="nt-profile-modal" role="dialog" aria-modal="true" aria-label="Meu perfil">
        <button type="button" className="nt-profile-close" onClick={onClose} aria-label="Fechar perfil">×</button>

        <div className="nt-profile-banner profile-banner-edit" style={bannerStyle}>
          <button type="button" className="nt-profile-banner-button" onClick={() => bannerInputRef.current?.click()} disabled={saving === 'banner'}>
            <span className="profile-banner-overlay nt-profile-banner-overlay">
              <span className="nt-profile-banner-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {saving === 'banner' ? 'Enviando...' : 'Alterar banner'}
              </span>
            </span>
          </button>
          <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'banner')} />
        </div>

        <div className="nt-profile-body">
          <div className="nt-profile-topline">
            <button className="nt-profile-avatar-edit profile-avatar-edit" type="button" onClick={() => avatarInputRef.current?.click()} disabled={saving === 'avatar'} title="Alterar foto">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" className="nt-profile-avatar-img" />
              ) : (
                <div className="nt-profile-avatar-fallback nt-profile-avatar-fallback-lg">{initials}</div>
              )}
              <span className="profile-avatar-overlay nt-profile-avatar-overlay">{saving === 'avatar' ? '...' : 'Editar'}</span>
              <span className="nt-profile-presence-ring" title={presenceConfig.label} style={{ background: presenceConfig.color, boxShadow: `0 0 14px ${presenceConfig.color}88` }} />
            </button>

            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'avatar')} />

            <div className="nt-profile-status-wrap">
              <div className="nt-profile-status-row">
                <div ref={presenceMenuRef} className="nt-profile-presence-menu">
                  <button
                    type="button"
                    className="nt-profile-presence-button"
                    onClick={() => setPresenceOpen((v) => !v)}
                    style={{ background: presenceConfig.bg, borderColor: presenceConfig.bd, color: presenceConfig.color }}
                  >
                    <span style={{ background: presenceConfig.color }} />
                    {presenceConfig.label}
                  </button>

                  {presenceOpen && (
                    <div className="nt-profile-popover nt-profile-presence-list">
                      {Object.entries(PRESENCE).map(([key, item]) => (
                        <button
                          key={key}
                          type="button"
                          className={`nt-profile-presence-option${key === presence ? ' active' : ''}`}
                          onClick={() => {
                            setPresence(key);
                            setPresenceOpen(false);
                          }}
                        >
                          <span style={{ background: item.color }} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={statusEditorRef} className="nt-profile-status-editor">
                  <span className="nt-profile-muted nt-profile-status-text">{activeStatus || 'Status 24h nao configurado'}</span>
                  <button
                    type="button"
                    className="nt-profile-icon-button"
                    aria-label="Editar status 24h"
                    onClick={() => {
                      setStatusDraft(activeStatus || '');
                      setStatusEditing((v) => !v);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>

                  {statusEditing && (
                    <form className="nt-profile-popover nt-profile-status-popover" onSubmit={saveStatus}>
                      <input
                        autoFocus
                        className="nt-profile-input"
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        maxLength={80}
                        placeholder="Ex.: Em reuniao, Focado, Ausente"
                      />
                      <div className="nt-profile-actions">
                        <button
                          type="button"
                          className="nt-profile-ghost-btn"
                          onClick={() => {
                            setStatusDraft(statusText);
                            setStatusEditing(false);
                          }}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="nt-profile-save-btn" disabled={saving === 'status'}>
                          {saving === 'status' ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="nt-profile-content">
            <div>
              <div className="nt-profile-name-row">
                <h2>{user?.name || 'Usuario'}</h2>
                <span className="nt-profile-company-name">{companyName}</span>
              </div>
              <div className="nt-profile-muted nt-profile-email">{user?.email}</div>
              {user?.emailVerified && (
                <div className="nt-profile-inline-badges">
                  <VerifiedBadge />
                </div>
              )}
            </div>

            {message && (
              <div className={`nt-profile-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="nt-profile-cards">
              <div className="nt-profile-card">
                <div className="nt-profile-section-label">Empresa</div>
                <div className="nt-profile-card-value">{companyName}</div>
              </div>
              <div className="nt-profile-card">
                <div className="nt-profile-section-label">Cargo</div>
                <div className="nt-profile-card-value">{companyRole ? roleLabel : 'Nao definido'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default function UserProfileMenu() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);
  const initials = useMemo(() => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'), [user]);

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

      {profileOpen && createPortal((() => {
        const rect = avatarRef.current?.getBoundingClientRect();
        const top = rect ? rect.bottom + 8 : 80;
        const right = rect ? window.innerWidth - rect.right : 32;

        return (
          <div ref={profileMenuRef} className="nt-user-menu" style={{ top, right }}>
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
        );
      })(), document.body)}

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
