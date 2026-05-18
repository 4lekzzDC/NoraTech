import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import CockpitCompany from '../components/CockpitCompany';
import UserProfileMenu from '../components/UserProfileMenu';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';
import { fetchMyCompany, fetchCompanyMembers, leaveCompany } from '../lib/companies';
import { getSystem, SYSTEMS } from '../lib/systems';
import { getPalette, FONT_INTER, FONT_MONO } from '../modules/solucoes-contabeis/theme';

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const COMPANY_ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };
const ROLE_BADGE = {
  owner:  { label: 'DONO',  bg: 'rgba(124,58,237,0.14)', bd: 'rgba(124,58,237,0.3)',  color: '#7C3AED' },
  admin:  { label: 'ADMIN', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.28)', color: '#d97706' },
  member: { label: 'MEMBRO',bg: 'transparent',           bd: 'var(--p-border)',        color: 'var(--p-muted)' },
};
const PRESENCE = {
  online:    { label: 'Online',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   bd: 'rgba(34,197,94,0.26)'   },
  busy:      { label: 'Ocupado',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.28)'   },
  away:      { label: 'Ausente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.3)'   },
  invisible: { label: 'Invisível', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', bd: 'rgba(156,163,175,0.28)' },
};

function formatMemberSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

function formatRelativeDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - target) / 86400000);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff === 0) return `Hoje, ${hhmm}`;
  if (diff === 1) return `Ontem, ${hhmm}`;
  return `${String(d.getDate()).padStart(2, '0')}/${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}, ${hhmm}`;
}

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
  const [tip, setTip] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
      onFocus={() => setTip(true)}
      onBlur={() => setTip(false)}
      tabIndex={0}
      role="img"
      aria-label="E-mail verificado"
    >
      <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6, #22c55e)', boxShadow: '0 0 14px rgba(139,92,246,0.38)', cursor: 'default' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {tip && (
        <span style={{ position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', padding: '5px 10px', borderRadius: 8, background: '#18181b', border: '1px solid rgba(255,255,255,0.14)', color: '#e4e4e7', fontSize: '0.72rem', fontWeight: 700, pointerEvents: 'none', zIndex: 20, boxShadow: '0 6px 18px rgba(0,0,0,0.4)' }}>
          E-mail verificado
        </span>
      )}
    </span>
  );
}

// ─── UserProfileModal ─────────────────────────────────────────────────────────

function UserProfileModal({ user, companyInfo, initials, onClose, onUserUpdate, theme }) {
  const isDark = theme !== 'light';
  const C = {
    panelBg:     isDark ? '#111116'                     : '#ffffff',
    panelBorder: isDark ? 'rgba(255,255,255,0.12)'      : 'rgba(0,0,0,0.10)',
    text:        isDark ? '#eeede9'                     : '#111116',
    muted:       isDark ? 'rgba(255,255,255,0.42)'      : 'rgba(0,0,0,0.45)',
    closeBg:     isDark ? 'rgba(0,0,0,0.34)'            : 'rgba(0,0,0,0.06)',
    closeBd:     isDark ? 'rgba(255,255,255,0.12)'      : 'rgba(0,0,0,0.12)',
    closeColor:  isDark ? 'rgba(255,255,255,0.78)'      : 'rgba(0,0,0,0.55)',
    bannerBd:    isDark ? 'rgba(255,255,255,0.08)'      : 'rgba(0,0,0,0.08)',
    avatarBg:    isDark ? '#111116'                     : '#ffffff',
    avatarShad:  isDark ? '0 0 0 1px rgba(255,255,255,0.08)' : '0 0 0 1px rgba(0,0,0,0.10)',
    popupBg:     isDark ? '#18181f'                     : '#ffffff',
    popupBd:     isDark ? 'rgba(255,255,255,0.12)'      : 'rgba(0,0,0,0.12)',
    popupShadow: isDark ? '0 16px 40px rgba(0,0,0,0.55)' : '0 16px 40px rgba(0,0,0,0.12)',
    statusColor: isDark ? 'rgba(255,255,255,0.42)'      : 'rgba(0,0,0,0.44)',
    editBtnBd:   isDark ? 'rgba(255,255,255,0.1)'       : 'rgba(0,0,0,0.12)',
    editBtnBg:   isDark ? 'rgba(255,255,255,0.04)'      : 'rgba(0,0,0,0.04)',
    editBtnCol:  isDark ? 'rgba(255,255,255,0.55)'      : 'rgba(0,0,0,0.44)',
    inputBd:     isDark ? 'rgba(255,255,255,0.1)'       : 'rgba(0,0,0,0.12)',
    inputBg:     isDark ? 'rgba(0,0,0,0.26)'            : 'rgba(0,0,0,0.04)',
    inputColor:  isDark ? '#eeede9'                     : '#111116',
    cancelBd:    isDark ? 'rgba(255,255,255,0.1)'       : 'rgba(0,0,0,0.12)',
    cancelCol:   isDark ? 'rgba(255,255,255,0.62)'      : 'rgba(0,0,0,0.55)',
    sectionBg:   isDark ? 'rgba(255,255,255,0.035)'     : 'rgba(0,0,0,0.03)',
    sectionBd:   isDark ? 'rgba(255,255,255,0.08)'      : 'rgba(0,0,0,0.08)',
    badgeBg:     isDark ? 'rgba(255,255,255,0.38)'      : 'rgba(0,0,0,0.35)',
    gridBg:      isDark ? 'rgba(0,0,0,0.18)'            : 'rgba(0,0,0,0.03)',
    gridBd:      isDark ? 'rgba(255,255,255,0.06)'      : 'rgba(0,0,0,0.07)',
    gridLabel:   isDark ? 'rgba(255,255,255,0.36)'      : 'rgba(0,0,0,0.38)',
    pressBtnCol: isDark ? 'rgba(255,255,255,0.82)'      : 'rgba(0,0,0,0.75)',
    pressBtnSelBg: isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(0,0,0,0.06)',
    avatarInitBg: isDark ? 'rgba(124,58,237,0.18)'     : 'rgba(124,58,237,0.10)',
    presenceBord: isDark ? '#111116'                    : '#ffffff',
  };
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
    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34)), url(${user.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : isDark
      ? { background: 'radial-gradient(circle at 18% 20%, rgba(196,181,253,0.28) 0%, transparent 34%), linear-gradient(135deg, #15151c 0%, #2b145d 48%, #08080a 100%)' }
      : { background: 'radial-gradient(circle at 18% 20%, rgba(139,92,246,0.18) 0%, transparent 34%), linear-gradient(135deg, #e9e4ff 0%, #c4b5fd 48%, #ddd6fe 100%)' };

  const uploadImage = async (file, kind) => {
    const maxMb = kind === 'avatar' ? 2 : 5;
    const validationError = validateProfileImage(file, maxMb);
    if (validationError) { setMessage({ type: 'error', text: validationError }); return; }
    try {
      setSaving(kind); setMessage(null);
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
    } finally { setSaving(''); }
  };

  const saveStatus = async (e) => {
    e.preventDefault();
    const trimmed = statusDraft.trim();
    if (trimmed.length > 80) { setMessage({ type: 'error', text: 'Status deve ter no máximo 80 caracteres.' }); return; }
    try {
      setSaving('status'); setMessage(null);
      const payload = trimmed
        ? { status_message: trimmed, status_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }
        : { status_message: null, status_expires_at: null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw error;
      onUserUpdate({ statusMessage: payload.status_message, statusExpiresAt: payload.status_expires_at });
      setStatusText(trimmed); setStatusEditing(false);
      setMessage({ type: 'success', text: trimmed ? 'Status salvo por 24h.' : 'Status removido.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar status.' });
    } finally { setSaving(''); }
  };

  useEffect(() => {
    if (!statusEditing && !presenceOpen) return undefined;
    const handler = (e) => {
      if (statusEditing && statusEditorRef.current && !statusEditorRef.current.contains(e.target)) { setStatusDraft(statusText); setStatusEditing(false); }
      if (presenceOpen && presenceMenuRef.current && !presenceMenuRef.current.contains(e.target)) setPresenceOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presenceOpen, statusEditing, statusText]);

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label="Meu perfil"
        style={{ width: 'min(640px, 100%)', background: C.panelBg, border: `1px solid ${C.panelBorder}`, borderRadius: 20, boxShadow: '0 28px 90px rgba(0,0,0,0.78)', overflow: 'hidden', color: C.text, position: 'relative', fontFamily: "'Inter', sans-serif" }}>
        <style>{`
          .profile-avatar-edit .profile-avatar-overlay, .profile-banner-edit .profile-banner-overlay { opacity: 0; transition: opacity 0.18s ease; }
          .profile-avatar-edit:hover .profile-avatar-overlay, .profile-avatar-edit:focus-visible .profile-avatar-overlay,
          .profile-banner-edit:hover .profile-banner-overlay, .profile-banner-edit:focus-visible .profile-banner-overlay { opacity: 1; }
        `}</style>
        <button type="button" onClick={onClose} aria-label="Fechar perfil"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.closeBd}`, background: C.closeBg, color: C.closeColor, cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>

        <div className="profile-banner-edit" style={{ height: 156, borderBottom: `1px solid ${C.bannerBd}`, position: 'relative', overflow: 'hidden', cursor: 'pointer', ...bannerStyle }}>
          <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={saving === 'banner'}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', color: '#fff', cursor: saving === 'banner' ? 'wait' : 'pointer', zIndex: 1 }}>
            <span className="profile-banner-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.34)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.42)', fontSize: '0.74rem', fontWeight: 800, backdropFilter: 'blur(10px)', color: '#fff' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                {saving === 'banner' ? 'Enviando...' : 'Alterar banner'}
              </span>
            </span>
          </button>
          <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'banner')} />
        </div>

        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: -46, flexWrap: 'wrap' }}>
            <button className="profile-avatar-edit" type="button" onClick={() => avatarInputRef.current?.click()} disabled={saving === 'avatar'} title="Alterar foto"
              style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', padding: 6, background: C.avatarBg, boxShadow: C.avatarShad, border: 'none', cursor: saving === 'avatar' ? 'wait' : 'pointer' }}>
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.avatarInitBg, color: '#a78bfa', fontSize: '1.6rem', fontWeight: 900 }}>{initials}</div>}
              <span className="profile-avatar-overlay" style={{ position: 'absolute', inset: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.48)', color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}>
                {saving === 'avatar' ? '...' : 'Editar'}
              </span>
              <span title={presenceConfig.label} style={{ position: 'absolute', right: 8, bottom: 10, width: 22, height: 22, borderRadius: '50%', background: presenceConfig.color, border: `5px solid ${C.presenceBord}`, boxShadow: `0 0 14px ${presenceConfig.color}88` }} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'avatar')} />

            <div style={{ minWidth: 0, flex: 1, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div ref={presenceMenuRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setPresenceOpen((v) => !v)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: presenceConfig.bg, border: `1px solid ${presenceConfig.bd}`, color: presenceConfig.color, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: presenceConfig.color }} />{presenceConfig.label}
                  </button>
                  {presenceOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 5, minWidth: 150, padding: 6, borderRadius: 12, background: C.popupBg, border: `1px solid ${C.popupBd}`, boxShadow: C.popupShadow }}>
                      {Object.entries(PRESENCE).map(([key, item]) => (
                        <button key={key} type="button" onClick={() => { setPresence(key); setPresenceOpen(false); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 9, border: 'none', background: key === presence ? C.pressBtnSelBg : 'transparent', color: C.pressBtnCol, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', textAlign: 'left' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />{item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={statusEditorRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ color: C.statusColor, fontSize: '0.76rem' }}>{activeStatus || 'Status 24h não configurado'}</span>
                  <button type="button" aria-label="Editar status 24h" onClick={() => { setStatusDraft(activeStatus || ''); setStatusEditing((v) => !v); }}
                    style={{ width: 24, height: 24, borderRadius: '50%', border: `1px solid ${C.editBtnBd}`, background: C.editBtnBg, color: C.editBtnCol, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                  {statusEditing && (
                    <form onSubmit={saveStatus} style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 6, width: 300, maxWidth: 'calc(100vw - 56px)', padding: 12, borderRadius: 14, background: C.popupBg, border: `1px solid ${C.popupBd}`, boxShadow: C.popupShadow }}>
                      <input autoFocus value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} maxLength={80} placeholder="Ex.: Em reunião, Focado, Ausente"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.inputBd}`, background: C.inputBg, color: C.inputColor, outline: 'none', fontFamily: 'inherit', marginBottom: 10 }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" onClick={() => { setStatusDraft(statusText); setStatusEditing(false); }}
                          style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.cancelBd}`, background: 'transparent', color: C.cancelCol, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                        <button type="submit" disabled={saving === 'status'}
                          style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.34)', background: 'rgba(124,58,237,0.16)', color: '#ddd6fe', fontWeight: 800, cursor: saving === 'status' ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                          {saving === 'status' ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.55rem', fontWeight: 850, letterSpacing: -0.6, lineHeight: 1.1, color: C.text }}>{user?.name || 'Usuário'}</h2>
                <span style={{ color: '#a78bfa', fontSize: '0.88rem', fontWeight: 700 }}>{companyName}</span>
              </div>
              <div style={{ marginTop: 6, color: C.muted, fontSize: '0.9rem' }}>{user?.email}</div>
            </div>

            <div style={{ background: C.sectionBg, border: `1px solid ${C.sectionBd}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: C.muted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Badges</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {user?.emailVerified ? <VerifiedBadge /> : <span style={{ color: C.muted, fontSize: '0.82rem' }}>Nenhuma badge disponível.</span>}
              </div>
            </div>

            {message && (
              <div style={{ padding: '11px 13px', borderRadius: 12, background: message.type === 'error' ? 'rgba(255,80,80,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${message.type === 'error' ? 'rgba(255,80,80,0.24)' : 'rgba(34,197,94,0.24)'}`, color: message.type === 'error' ? '#ff9ab4' : '#86efac', fontSize: '0.82rem', fontWeight: 700 }}>
                {message.text}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 14, background: C.gridBg, border: `1px solid ${C.gridBd}`, color: C.text }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: C.gridLabel, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Empresa</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{companyName}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 14, background: C.gridBg, border: `1px solid ${C.gridBd}`, color: C.text }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: C.gridLabel, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Cargo</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{companyRole ? roleLabel : 'Não definido'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

// ─── System cards ─────────────────────────────────────────────────────────────

function SystemCard({ s }) {
  const isTrial = s.subscription?.status === 'trialing';
  const statusColor = isTrial ? '#60a5fa' : '#22c55e';
  const statusLabel = isTrial ? 'Trial' : 'Ativa';

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
            {s.icon}
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--p-text)', lineHeight: 1.2 }}>{s.name}</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.8, padding: '3px 8px', background: `${statusColor}18`, border: `1px solid ${statusColor}35`, borderRadius: 999, flexShrink: 0 }}>
          + {statusLabel}
        </span>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--p-muted)', lineHeight: 1.5 }}>{s.description}</p>
      <span style={{ fontFamily: FONT_MONO, fontSize: '0.75rem', color: 'var(--p-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {s.url ? 'Abrir sistema ↗' : s.subscription?.plan || ''}
      </span>
    </div>
  );

  const cardStyle = { background: 'var(--p-surface2)', border: '1px solid var(--p-border)', boxShadow: 'var(--p-shadow)', borderRadius: 14, padding: '18px 20px', transition: 'all 0.2s', cursor: 'pointer', display: 'block' };
  if (!s.url) return <div className="system-card" style={cardStyle}>{inner}</div>;
  if (s.internal) return <Link to={s.url} className="system-card" style={cardStyle}>{inner}</Link>;
  return <a href={s.url} target="_blank" rel="noopener noreferrer" className="system-card" style={cardStyle}>{inner}</a>;
}

function SystemsGrid({ systems, isAdmin }) {
  const adminInternals = isAdmin
    ? SYSTEMS.filter((s) => s.internal && !systems.some((sub) => sub.slug === s.slug)).map((s) => ({ ...s, subscription: { status: 'active' } }))
    : [];
  const all = [...systems, ...adminInternals];

  if (all.length === 0) {
    return (
      <div style={{ background: 'var(--p-surface2)', border: '1px dashed var(--p-border2)', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Nenhum sistema contratado</div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, marginBottom: 8, color: 'var(--p-text)' }}>Ainda sem sistemas ativos</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--p-muted)', maxWidth: 400, margin: '0 auto 18px' }}>Explore nossos serviços ou fale com a Noratech para começar.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/servicos/sistemas-sob-medida" style={{ padding: '8px 16px', border: '1px solid var(--p-border2)', borderRadius: 10, color: 'var(--p-text)', fontSize: '0.82rem', fontWeight: 600 }}>Ver serviços</Link>
          <Link to="/#contato" style={{ padding: '8px 16px', background: 'var(--p-primary)', borderRadius: 10, color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>Falar com a Noratech</Link>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      {all.map((s) => <SystemCard key={s.slug} s={s} />)}
    </div>
  );
}

function StatusGauge({ count = 0, primaryColor = '#7C3AED' }) {
  const size = 96;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = count > 0 ? Math.min(0.85, 0.45 + count * 0.12) : 0;
  const dashOffset = circumference - fill * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--p-border2)" strokeWidth={stroke} />
        {count > 0 && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={primaryColor} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: count > 0 ? primaryColor : 'var(--p-muted2)', letterSpacing: -1, lineHeight: 1 }}>
          {count > 0 ? count : '—'}
        </div>
        <div style={{ fontSize: '0.48rem', fontWeight: 700, letterSpacing: 1.4, color: 'var(--p-muted)', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4 }}>
          SISTEMAS<br />ativos
        </div>
      </div>
    </div>
  );
}

// ─── OrgModal ────────────────────────────────────────────────────────────────

function OrgModal({ hasCompany, companyName, user, onClose, P }) {
  const isDark = P.bg === '#08080a';
  // Solid panel colours — never transparent so the modal is fully opaque
  const panelBg     = isDark ? '#18181b' : '#ffffff';
  const panelBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,17,21,0.12)';
  const panelShadow = isDark ? '0 32px 100px rgba(0,0,0,0.72)' : '0 24px 60px rgba(0,0,0,0.13)';
  const headBg      = isDark ? '#18181b' : '#ffffff';
  const closeBg     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,17,21,0.05)';
  const closeBd     = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,17,21,0.12)';
  const closeColor  = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,17,21,0.6)';
  const iconBg      = isDark ? 'rgba(124,58,237,0.16)' : 'rgba(124,58,237,0.08)';
  const iconBd      = isDark ? 'rgba(124,58,237,0.3)'  : 'rgba(124,58,237,0.2)';
  const divColor    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,17,21,0.08)';

  // CSS vars injected on the panel so CockpitCompany children resolve them correctly
  const cssVars = {
    '--p-bg': P.bg, '--p-surface': panelBg, '--p-surface2': isDark ? '#222228' : '#f6f7fa',
    '--p-surface-solid': panelBg,
    '--p-text': P.text, '--p-muted': P.muted, '--p-muted2': P.muted2,
    '--p-border': panelBorder, '--p-border2': isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,17,21,0.18)',
    '--p-primary': P.primary, '--p-primary-soft': P.primarySoft, '--p-primary-border': P.primaryBorder,
    '--p-input-bg': isDark ? 'rgba(255,255,255,0.05)' : '#f6f7fa',
    '--p-shadow': panelShadow, '--p-row-hover': isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,17,21,0.04)',
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={hasCompany ? 'Gerenciar organização' : 'Criar organização'}
        className="org-modal-section"
        style={{ ...cssVars, width: 'min(600px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 20, boxShadow: panelShadow, color: P.text, fontFamily: FONT_INTER, position: 'relative' }}
      >
        {/* sticky header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 18px', borderBottom: `1px solid ${divColor}`, position: 'sticky', top: 0, background: headBg, zIndex: 2, borderRadius: '20px 20px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, border: `1px solid ${iconBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.5, color: P.primary, textTransform: 'uppercase' }}>Organização</div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, marginTop: 1, color: P.text }}>
                {hasCompany ? (companyName || 'Gerenciar organização') : 'Criar organização'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${closeBd}`, background: closeBg, color: closeColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}
          >×</button>
        </div>

        <div style={{ paddingBottom: 4 }}>
          <CockpitCompany user={user} />
        </div>
      </section>
    </div>,
    document.body
  );
}

// ─── LeaveTeamModal ──────────────────────────────────────────────────────────

function LeaveTeamModal({ companyName, onClose, onConfirm, confirming, error, P }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !confirming) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, confirming]);

  const isDark = P.bg === '#08080a';
  const panelBg     = isDark ? '#18181b' : '#ffffff';
  const panelBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,17,21,0.12)';
  const panelShadow = isDark ? '0 32px 100px rgba(0,0,0,0.72)' : '0 24px 60px rgba(0,0,0,0.13)';
  const btnCancelBd = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(15,17,21,0.13)';

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !confirming) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sair da equipe"
        style={{ width: 'min(440px, 100%)', background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 20, boxShadow: panelShadow, color: P.text, fontFamily: FONT_INTER, padding: '28px 28px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: P.text, marginBottom: 2, letterSpacing: -0.2 }}>Sair da equipe?</h2>
            {companyName && <div style={{ fontSize: '0.82rem', color: P.muted }}>{companyName}</div>}
          </div>
        </div>

        <p style={{ fontSize: '0.88rem', color: P.muted, lineHeight: 1.65, marginBottom: 20 }}>
          Você perderá acesso aos sistemas e informações desta organização. Esta ação não pode ser desfeita.
        </p>

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            style={{ padding: '10px 18px', borderRadius: 10, background: 'transparent', border: `1px solid ${btnCancelBd}`, color: P.muted, fontWeight: 600, cursor: confirming ? 'default' : 'pointer', fontSize: '0.88rem', fontFamily: FONT_INTER, opacity: confirming ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            style={{ padding: '10px 18px', borderRadius: 10, background: confirming ? 'rgba(220,38,38,0.55)' : '#dc2626', border: 'none', color: '#fff', fontWeight: 700, cursor: confirming ? 'wait' : 'pointer', fontSize: '0.88rem', fontFamily: FONT_INTER, transition: 'background 0.15s' }}
          >
            {confirming ? 'Saindo...' : 'Confirmar saída'}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

// ─── SupportModal ─────────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = '5511999999999'; // substituir pelo número real

function SupportModal({ onClose, P }) {
  const isDark = P.bg === '#08080a';
  const C = {
    panelBg:    isDark ? '#18181b' : '#ffffff',
    panelBd:    isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    text:       isDark ? '#eeede9' : '#111116',
    muted:      isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.48)',
    cardBg:     isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    cardBd:     isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    cardHover:  isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    closeBg:    isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    closeBd:    isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    closeColor: isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.55)',
  };

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: '', description: '' });
  const [ticketSent, setTicketSent] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = [
    {
      key: 'chat',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      label: 'Chat no sistema',
      desc: 'Converse com nosso atendimento por IA dentro da plataforma.',
      badge: 'Em breve',
      action: null,
      color: '#6366f1',
      colorSoft: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.09)',
      colorBd: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)',
    },
    {
      key: 'ticket',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      label: 'Abrir ticket',
      desc: 'Registre uma solicitação para acompanhamento pelo suporte.',
      badge: null,
      action: () => setTicketOpen(true),
      color: '#7C3AED',
      colorSoft: isDark ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.09)',
      colorBd: isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)',
    },
    {
      key: 'whatsapp',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
      label: 'WhatsApp',
      desc: 'Fale rapidamente com a equipe pelo WhatsApp.',
      badge: null,
      action: () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Preciso de suporte Noratech.')}`, '_blank'),
      color: '#22c55e',
      colorSoft: isDark ? 'rgba(34,197,94,0.13)' : 'rgba(34,197,94,0.09)',
      colorBd: isDark ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.2)',
    },
    {
      key: 'email',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      label: 'E-mail',
      desc: 'Envie sua solicitação por e-mail para nossa equipe.',
      badge: null,
      action: () => window.open('mailto:contato@noratech.com.br?subject=Suporte%20Noratech', '_blank'),
      color: '#f59e0b',
      colorSoft: isDark ? 'rgba(245,158,11,0.13)' : 'rgba(245,158,11,0.09)',
      colorBd: isDark ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.2)',
    },
  ];

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label="Falar com suporte"
        style={{ width: 'min(520px, 100%)', background: C.panelBg, border: `1px solid ${C.panelBd}`, borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.55)', overflow: 'hidden', color: C.text, fontFamily: FONT_INTER, position: 'relative' }}>

        <button type="button" onClick={onClose} aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.closeBd}`, background: C.closeBg, color: C.closeColor, cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

        {!ticketOpen ? (
          <div style={{ padding: '28px 24px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.3, marginBottom: 5, color: C.text }}>Falar com suporte</h2>
              <p style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.5 }}>Escolha como deseja entrar em contato com a equipe da Noratech.</p>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {options.map((opt) => (
                <button key={opt.key} type="button"
                  onClick={opt.action || undefined}
                  disabled={!opt.action}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '14px 16px', borderRadius: 14, background: C.cardBg, border: `1px solid ${C.cardBd}`, color: C.text, cursor: opt.action ? 'pointer' : 'default', textAlign: 'left', fontFamily: FONT_INTER, transition: 'background 0.14s', opacity: opt.action ? 1 : 0.6 }}
                  onMouseEnter={(e) => { if (opt.action) e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.cardBg; }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: opt.colorSoft, border: `1px solid ${opt.colorBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: opt.color, flexShrink: 0 }}>
                    {opt.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{opt.label}</span>
                      {opt.badge && (
                        <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: 0.6, padding: '2px 7px', borderRadius: 5, background: opt.colorSoft, border: `1px solid ${opt.colorBd}`, color: opt.color }}>{opt.badge}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.77rem', color: C.muted, lineHeight: 1.4 }}>{opt.desc}</div>
                  </div>
                  {opt.action && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '28px 24px 24px' }}>
            <button type="button" onClick={() => { setTicketOpen(false); setTicketSent(false); setTicketForm({ subject: '', category: '', description: '' }); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: FONT_INTER, padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Voltar
            </button>

            {ticketSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 8, color: C.text }}>Ticket em preparação</h3>
                <p style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.5 }}>Esta função estará disponível em breve. Em seguida, sua solicitação será enviada automaticamente para a equipe de suporte.</p>
                <button type="button" onClick={onClose}
                  style={{ marginTop: 20, padding: '9px 22px', borderRadius: 10, background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontFamily: FONT_INTER, fontSize: '0.85rem' }}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 4, color: C.text }}>Abrir ticket</h2>
                <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 20, lineHeight: 1.4 }}>Registre sua solicitação para acompanhamento pelo suporte.</p>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Assunto</label>
                    <input value={ticketForm.subject} onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Ex.: Erro ao acessar sistema"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBd}`, background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', color: C.text, outline: 'none', fontFamily: FONT_INTER, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Categoria</label>
                    <select value={ticketForm.category} onChange={(e) => setTicketForm((f) => ({ ...f, category: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBd}`, background: isDark ? '#18181b' : '#ffffff', color: C.text, outline: 'none', fontFamily: FONT_INTER, fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="">Selecione uma categoria</option>
                      <option value="acesso">Acesso / Login</option>
                      <option value="sistema">Problema no sistema</option>
                      <option value="financeiro">Financeiro / Assinatura</option>
                      <option value="duvida">Dúvida geral</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Descrição</label>
                    <textarea value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Descreva com detalhes o que aconteceu..."
                      rows={4}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBd}`, background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', color: C.text, outline: 'none', fontFamily: FONT_INTER, fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', minHeight: 90 }} />
                  </div>
                  <button type="button"
                    onClick={() => setTicketSent(true)}
                    style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontWeight: 800, cursor: 'pointer', fontFamily: FONT_INTER, fontSize: '0.88rem', textAlign: 'center' }}>
                    Abrir ticket
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AreaDoClientePage() {
  const { user, logout, updateUser } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);

  const firstName = useMemo(() => (user?.name || '').split(' ')[0] || 'você', [user]);
  const initials = useMemo(
    () => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
    [user]
  );
  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user]);

  const [systems, setSystems] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveConfirming, setLeaveConfirming] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const my = await fetchMyCompany();
        if (active) setCompanyInfo(my);
        const companyId = my?.company?.id;
        const list = [];
        if (companyId) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('id, system_slug, plan, status, current_period_end, created_at')
            .eq('company_id', companyId)
            .in('status', ['active', 'trialing']);
          if (active && !error) {
            const seen = new Set();
            (data || []).forEach((s) => {
              const sys = getSystem(s.system_slug);
              if (!sys || seen.has(sys.slug)) return;
              seen.add(sys.slug);
              list.push({ ...sys, subscription: s });
            });
          }
          try {
            const membersData = await fetchCompanyMembers(companyId);
            if (active) setMembers(membersData || []);
          } catch { /* keep empty */ }
        }
        if (active) setSystems(list);
      } catch {
        if (active) { setCompanyInfo(null); setSystems([]); }
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const handleLogout = async () => { await logout(); navigate('/'); };

  // Guard: apenas owner/admin pode abrir o modal de gestão
  const handleOpenOrgModal = () => {
    if (hasCompany && !isOrgManager) {
      console.warn('[Cockpit] Acesso negado: apenas owner/admin pode gerenciar organização');
      return;
    }
    setOrgModalOpen(true);
  };

  const handleLeaveTeam = async () => {
    if (!companyInfo?.company?.id) return;
    setLeaveConfirming(true);
    setLeaveError(null);
    try {
      await leaveCompany(companyInfo.company.id);
      setLeaveModalOpen(false);
      setCompanyInfo(null);
      setMembers([]);
    } catch (err) {
      setLeaveError(err.message || 'Não foi possível sair da equipe. Tente novamente.');
    } finally {
      setLeaveConfirming(false);
    }
  };

  const companyName = companyInfo?.company?.name || user?.company || null;
  const companyRole = companyInfo?.membership?.role || null;
  const roleLabel = COMPANY_ROLE_LABEL[companyRole] || 'Membro';
  // companies.js retorna o campo como `code` (não `join_code`)
  const joinCode = companyInfo?.company?.code || null;
  const hasCompany = Boolean(companyInfo?.company?.id);
  // isOrgManager: owner ou admin da organização — pode gerenciar equipe/convites
  const isOrgManager = companyRole === 'owner' || companyRole === 'admin';

  const approvedMembers = useMemo(() => members.filter((m) => m.status !== 'pending'), [members]);
  const pendingCount = useMemo(() => members.filter((m) => m.status === 'pending').length, [members]);

  const activity = useMemo(() => {
    const events = [];
    members.forEach((m) => {
      if (m.created_at) events.push({ id: 'mbr_' + m.id, label: m.profile?.name || 'Membro', sublabel: 'entrou na organização', date: m.created_at, type: 'member' });
    });
    systems.forEach((s) => {
      if (s.subscription?.created_at) events.push({ id: 'sys_' + s.slug, label: s.name, sublabel: 'sistema ativado', date: s.subscription.created_at, type: 'system' });
    });
    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }, [members, systems]);

  const handleCopyCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode)
      .then(() => { setJoinCodeCopied(true); setTimeout(() => setJoinCodeCopied(false), 2000); })
      .catch(() => {});
  };

  const cssVars = {
    '--p-bg': P.bg, '--p-surface': P.surface, '--p-surface2': P.surface2, '--p-surface-solid': P.surfaceSolid,
    '--p-text': P.text, '--p-muted': P.muted, '--p-muted2': P.muted2,
    '--p-border': P.border, '--p-border2': P.border2,
    '--p-primary': P.primary, '--p-primary-soft': P.primarySoft, '--p-primary-border': P.primaryBorder,
    '--p-input-bg': P.inputBg, '--p-shadow': P.shadow, '--p-row-hover': P.rowHover,
  };

  const CARD = { background: 'var(--p-surface)', border: '1px solid var(--p-border)', boxShadow: 'var(--p-shadow)', borderRadius: 16, padding: '20px 24px' };
  const EYEBROW = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.5, color: 'var(--p-primary)', textTransform: 'uppercase' };
  const CARD_H = { fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.4, marginTop: 2, color: 'var(--p-text)' };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER, ...cssVars }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }

        /* Dark header — uses class so index.css [style*="rgb(8,8,10)"] override doesn't apply */
        .adc-header { position:sticky;top:0;z-index:100;background:#08080A;border-bottom:1px solid rgba(139,61,255,0.25);box-shadow:0 8px 30px rgba(0,0,0,0.28); }
        .adc-back { display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;transition:background 0.17s,border-color 0.17s; }
        .adc-back:hover { background:rgba(139,61,255,0.14);border-color:#8B3DFF; }
        .adc-crumb { display:inline-flex;align-items:center;height:26px;padding:0 7px;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;color:rgba(255,255,255,0.68);text-decoration:none;transition:color 0.15s,background 0.15s; }
        .adc-crumb-link:hover { color:#fff;background:rgba(139,61,255,0.14); }
        .adc-crumb-current { color:#fff;font-weight:600; }
        .adc-crumb-sep { display:inline-flex;align-items:center;padding:0 5px;font-size:13px;color:rgba(139,61,255,0.75);user-select:none; }
        .adc-toggle-slot button.theme-toggle,.adc-toggle-slot [class*="theme-toggle"] { width:34px!important;height:34px!important;border-radius:10px!important;background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.14)!important;color:#fff!important;transition:background 0.17s,border-color 0.17s!important; }
        .adc-toggle-slot button.theme-toggle:hover,.adc-toggle-slot [class*="theme-toggle"]:hover { background:rgba(139,61,255,0.14)!important;border-color:#8B3DFF!important; }
        .adc-admin-btn { display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid rgba(124,58,237,0.4);background:rgba(124,58,237,0.1);color:#a78bfa;font-size:0.75rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;transition:background 0.15s,border-color 0.15s; }
        .adc-admin-btn:hover { background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.6); }

        /* Content */
        .system-card:hover { border-color:var(--p-primary-border)!important;background:var(--p-primary-soft)!important; }
        .adc-member-row { border-radius:10px;transition:background 0.13s; }
        .adc-member-row:hover { background:var(--p-row-hover); }
        .adc-qa-row { display:flex;align-items:center;gap:12px;width:100%;padding:9px 8px;border-radius:12px;background:transparent;border:none;cursor:pointer;font-family:inherit;text-align:left;transition:background 0.13s; }
        .adc-qa-row:hover { background:var(--p-primary-soft); }
        .adc-qa-row:disabled { opacity:0.45;cursor:default; }
        .adc-expand-btn { display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 12px;border-radius:10px;background:transparent;border:1px solid var(--p-border);color:var(--p-muted);font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.15s; }
        .adc-expand-btn:hover { background:var(--p-primary-soft);border-color:var(--p-primary-border);color:var(--p-primary); }
        @keyframes pulse { 0%,100% { opacity:0.9; } 50% { opacity:0.4; } }
        .live-dot { animation:pulse 1.6s ease-in-out infinite; }
        .adc-header-inner { max-width:1240px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
        .org-modal-section::-webkit-scrollbar { width:6px; }
        .org-modal-section::-webkit-scrollbar-track { background:transparent; }
        .org-modal-section::-webkit-scrollbar-thumb { background:var(--p-border2);border-radius:3px; }
        @media (max-width:960px) { .adc-grid { grid-template-columns:1fr!important; } .adc-sidebar { order:-1; } }
        @media (max-width:640px) { .adc-header-inner { padding:0 14px!important; } .adc-crumb-link,.adc-crumb-sep { display:none!important; } .adc-admin-btn { display:none!important; } }
        @media (max-width:600px) { .adc-main { padding:16px 16px 64px!important; } }
      `}</style>

      {/* ── Header (always dark) ── */}
      <header className="adc-header">
        <div className="adc-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Link to="/" aria-label="Voltar ao site" className="adc-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
              <Link to="/" className="adc-crumb adc-crumb-link" style={{ fontFamily: FONT_MONO, letterSpacing: -0.2 }}>Noratech</Link>
              <span className="adc-crumb-sep">/</span>
              <Link to="/area-do-cliente" className="adc-crumb adc-crumb-link">Central de Controle</Link>
              <span className="adc-crumb-sep">/</span>
              <span className="adc-crumb adc-crumb-current">Cockpit</span>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isAdmin && (
              <Link to="/admin" className="adc-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Admin
              </Link>
            )}
            <span className="adc-toggle-slot" style={{ display: 'inline-flex' }}><ThemeToggle /></span>
            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="adc-main" style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px 80px' }}>
        <div className="adc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

          {/* ════ Left column ════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Welcome card */}
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, marginBottom: 6 }}>
                  Olá, <span style={{ color: P.primary }}>{firstName}</span>
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--p-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                  {systems.length > 0
                    ? 'Sua central está ativa. Acompanhe o que importa e tome decisões com confiança.'
                    : 'Ainda sem sistemas ativos. Contrate um serviço e a operação aparece aqui.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: systems.length > 0 ? 'rgba(0,212,138,0.1)' : 'var(--p-surface2)', border: `1px solid ${systems.length > 0 ? 'rgba(0,212,138,0.25)' : 'var(--p-border)'}`, fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.8, color: systems.length > 0 ? '#00d48a' : 'var(--p-muted)', textTransform: 'uppercase' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: systems.length > 0 ? '#00d48a' : 'var(--p-muted2)', boxShadow: systems.length > 0 ? '0 0 8px rgba(0,212,138,0.55)' : 'none' }} className={systems.length > 0 ? 'live-dot' : ''} />
                    {systems.length > 0 ? 'Operação ativa' : 'Sem operação'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.8, color: 'var(--p-primary)', textTransform: 'uppercase' }}>
                    {systems.length} {systems.length === 1 ? 'sistema ativo' : 'sistemas ativos'}
                  </span>
                  {memberSince && (
                    <span style={{ fontFamily: FONT_MONO, fontSize: '0.66rem', fontWeight: 500, color: 'var(--p-muted2)', letterSpacing: 0.3 }}>
                      Membro desde {memberSince}
                    </span>
                  )}
                </div>
              </div>
              <StatusGauge count={systems.length} primaryColor={P.primary} />
            </div>

            {/* Systems card */}
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div>
                    <span style={EYEBROW}>Operação</span>
                    <h2 style={{ ...CARD_H, marginTop: 1 }}>Sistemas em operação</h2>
                  </div>
                </div>
                {systems.length > 0 && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: '0.7rem', color: 'var(--p-muted)' }}>
                    {systems.length} ativo{systems.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <SystemsGrid systems={systems} isAdmin={isAdmin} />
            </div>

            {/* Activity card */}
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <span style={EYEBROW}>Histórico</span>
                  <h2 style={{ ...CARD_H, marginTop: 1 }}>Atividade recente</h2>
                </div>
              </div>

              {activity.length === 0 ? (
                <p style={{ color: 'var(--p-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                  Nenhuma atividade registrada ainda.
                </p>
              ) : (
                <div>
                  {activity.map((ev, i) => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < activity.length - 1 ? '1px solid var(--p-border)' : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: ev.type === 'member' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)', border: ev.type === 'member' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {ev.type === 'member' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ev.type === 'member' ? '#6366f1' : '#10b981'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--p-text)' }}>{ev.label}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--p-muted)', marginLeft: 6 }}>{ev.sublabel}</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--p-muted2)', whiteSpace: 'nowrap', fontFamily: FONT_MONO }}>
                        {formatRelativeDate(ev.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ════ Right sidebar ════ */}
          <div className="adc-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Team card */}
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <span style={EYEBROW}>Equipe</span>
                  <h2 style={{ ...CARD_H, fontSize: '1rem', marginTop: 1 }}>Membros</h2>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: '0.75rem', fontWeight: 700, color: 'var(--p-muted)', padding: '2px 8px', background: 'var(--p-surface2)', border: '1px solid var(--p-border)', borderRadius: 20 }}>
                  {approvedMembers.length}
                </span>
              </div>

              {approvedMembers.length === 0 ? (
                <p style={{ color: 'var(--p-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '12px 0' }}>Nenhum membro ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 12 }}>
                  {approvedMembers.map((m) => {
                    const name = m.profile?.name || 'Membro';
                    const mi = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                    const badge = ROLE_BADGE[m.role] || ROLE_BADGE.member;
                    return (
                      <div key={m.id} className="adc-member-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px' }}>
                        {m.profile?.photo_url
                          ? <img src={m.profile.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: 'var(--p-primary)', flexShrink: 0 }}>{mi}</div>}
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: 0.6, padding: '2px 7px', borderRadius: 6, background: badge.bg, border: `1px solid ${badge.bd}`, color: badge.color, flexShrink: 0 }}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Código de ingresso — visível apenas para owner/admin */}
              {isOrgManager && joinCode && (
                <div style={{ marginBottom: 10, padding: '9px 10px', background: 'var(--p-surface2)', border: '1px solid var(--p-border)', borderRadius: 10 }}>
                  <div style={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: 1.2, color: 'var(--p-muted2)', textTransform: 'uppercase', marginBottom: 5 }}>Código de ingresso</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '0.88rem', fontWeight: 700, letterSpacing: 2.5, color: 'var(--p-text)' }}>
                      {joinCode.toUpperCase()}
                    </span>
                    <button type="button" onClick={handleCopyCode}
                      style={{ padding: '3px 9px', background: joinCodeCopied ? 'rgba(34,197,94,0.1)' : 'var(--p-primary-soft)', border: `1px solid ${joinCodeCopied ? 'rgba(34,197,94,0.3)' : 'var(--p-primary-border)'}`, borderRadius: 6, color: joinCodeCopied ? '#22c55e' : 'var(--p-primary)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      {joinCodeCopied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Botão de ação no card Equipe — condicional por cargo */}
              {isOrgManager ? (
                <button type="button" onClick={handleOpenOrgModal} className="adc-expand-btn" style={{ fontSize: '0.78rem' }}>
                  Gerenciar equipe →
                </button>
              ) : hasCompany ? (
                <button type="button" onClick={() => { setLeaveError(null); setLeaveModalOpen(true); }} className="adc-expand-btn"
                  style={{ fontSize: '0.78rem', borderColor: 'rgba(220,38,38,0.25)', color: 'rgba(220,38,38,0.75)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)'; e.currentTarget.style.color = 'rgba(220,38,38,0.75)'; }}>
                  Sair da equipe
                </button>
              ) : null}
            </div>

            {/* Quick actions card */}
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <span style={EYEBROW}>{isOrgManager || !hasCompany ? 'Ações rápidas' : 'Ajuda'}</span>
              <h2 style={{ ...CARD_H, fontSize: '1rem', marginBottom: 10 }}>{isOrgManager || !hasCompany ? 'Comandos' : 'Central de apoio'}</h2>

              {/* Ações condicionais por cargo na organização */}
              {(() => {
                const iconOrg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>;
                const iconFinanceiro = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
                const iconProfile = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>;
                const iconSupport = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
                const iconTraining = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>;

                // owner / admin: suporte + assinaturas + perfil
                // Gerenciar organização, Convidar membro e Copiar código ficam no card Equipe.
                if (isOrgManager) {
                  return [
                    { title: 'Falar com suporte', desc: 'Tire dúvidas com nossa equipe', action: () => setSupportModalOpen(true), icon: iconSupport },
                    { title: 'Treinamentos', desc: 'Aprenda a usar os sistemas', icon: iconTraining, disabled: true, badge: 'Em breve' },
                    { title: 'Gerenciar assinaturas', desc: 'Visualize e administre os sistemas contratados', action: () => navigate('/area-do-cliente/financeiro'), icon: iconFinanceiro },
                    { title: 'Editar perfil', desc: 'Avatar, banner e status da conta', action: () => setProfileModalOpen(true), icon: iconProfile },
                  ];
                }

                // membro comum com empresa: suporte e acesso a recursos
                if (hasCompany) {
                  return [
                    { title: 'Falar com suporte', desc: 'Tire dúvidas com nossa equipe', action: () => setSupportModalOpen(true), icon: iconSupport },
                    { title: 'Treinamentos', desc: 'Aprenda a usar os sistemas', icon: iconTraining, disabled: true, badge: 'Em breve' },
                    { title: 'Editar perfil', desc: 'Avatar, banner e status da conta', action: () => setProfileModalOpen(true), icon: iconProfile },
                  ];
                }

                // sem empresa: criar organização
                return [
                  { title: 'Criar organização', desc: 'Configure sua organização no sistema', action: handleOpenOrgModal, icon: iconOrg },
                  { title: 'Gerenciar assinaturas', desc: 'Visualize os sistemas contratados', action: () => navigate('/area-do-cliente/financeiro'), icon: iconFinanceiro },
                  { title: 'Editar perfil', desc: 'Avatar, banner e status da conta', action: () => setProfileModalOpen(true), icon: iconProfile },
                ];
              })().map(({ title, desc, action, icon, disabled, badge }) => (
                <button key={title} type="button" onClick={disabled ? undefined : action} disabled={disabled} className="adc-qa-row"
                  style={disabled ? { opacity: 0.55, cursor: 'default' } : undefined}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--p-text)' }}>{title}</span>
                      {badge && <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: 0.6, padding: '2px 6px', borderRadius: 5, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', color: 'var(--p-primary)' }}>{badge}</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--p-muted)' }}>{desc}</div>
                  </div>
                  {!disabled && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p-muted2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              ))}

              <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--p-border)' }}>
                <button type="button" onClick={handleLogout}
                  style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 9, color: 'rgba(220,38,38,0.75)', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.07)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)'; e.currentTarget.style.color = 'rgba(220,38,38,0.75)'; }}>
                  Encerrar sessão
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {profileModalOpen && (
        <UserProfileModal
          user={user}
          companyInfo={companyInfo}
          initials={initials}
          onClose={() => setProfileModalOpen(false)}
          onUserUpdate={updateUser}
          theme={theme}
        />
      )}

      {/* Modal de gestão — somente owner/admin chega aqui (guard em handleOpenOrgModal) */}
      {orgModalOpen && (
        <OrgModal
          hasCompany={hasCompany}
          companyName={companyName}
          user={user}
          onClose={() => setOrgModalOpen(false)}
          P={P}
        />
      )}

      {/* Modal de saída da equipe — apenas para membro comum */}
      {leaveModalOpen && (
        <LeaveTeamModal
          companyName={companyName}
          onClose={() => { if (!leaveConfirming) setLeaveModalOpen(false); }}
          onConfirm={handleLeaveTeam}
          confirming={leaveConfirming}
          error={leaveError}
          P={P}
        />
      )}

      {/* Modal de suporte — apenas para membro comum */}
      {supportModalOpen && (
        <SupportModal
          onClose={() => setSupportModalOpen(false)}
          P={P}
        />
      )}
    </div>
  );
}
