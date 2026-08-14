import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin, formatBRL } from '../lib/admin';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import CockpitCompany from '../components/CockpitCompany';
import UserProfileMenu from '../components/UserProfileMenu';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';
import { fetchMyCompany, fetchCompanyMembers, leaveCompany } from '../lib/companies';
import { fetchSystems, indexSystems } from '../lib/systems';
import { getPalette, FONT_INTER, FONT_MONO } from '../modules/solucoes-contabeis/theme';

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const COMPANY_ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };
const PRESENCE = {
  online:    { label: 'Online',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   bd: 'rgba(34,197,94,0.26)'   },
  busy:      { label: 'Ocupado',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.28)'   },
  away:      { label: 'Ausente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.3)'   },
  invisible: { label: 'Invisível', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', bd: 'rgba(156,163,175,0.28)' },
};

function formatShortDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
      <span style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.6, padding: '2px 7px', background: `${statusColor}18`, border: `1px solid ${statusColor}35`, borderRadius: 999 }}>
        {statusLabel}
      </span>
      {s.logo_url ? (
        <img src={s.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', background: 'var(--p-primary-soft)' }} />
      ) : (
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
          {s.icon}
        </div>
      )}
      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--p-text)', lineHeight: 1.25, marginTop: 10 }}>{s.name}</span>
    </div>
  );

  const cardStyle = { position: 'relative', background: 'var(--p-surface2)', border: '1px solid var(--p-border)', boxShadow: 'var(--p-shadow)', borderRadius: 14, padding: '20px 16px', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (!s.url) return <div className="system-card" style={cardStyle}>{inner}</div>;
  if (s.internal) return <Link to={s.url} className="system-card" style={cardStyle}>{inner}</Link>;
  return <a href={s.url} target="_blank" rel="noopener noreferrer" className="system-card" style={cardStyle}>{inner}</a>;
}

function AddSystemCard({ onClick }) {
  const cardStyle = { width: '100%', background: 'transparent', border: '1px dashed var(--p-border2)', borderRadius: 14, padding: '20px 16px', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4, fontFamily: 'inherit' };
  return (
    <button type="button" onClick={onClick} className="system-card" style={cardStyle}>
      <div style={{ width: 52, height: 52, borderRadius: 14, border: '1px dashed var(--p-border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-muted)', fontSize: '1.3rem', lineHeight: 1 }}>+</div>
      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--p-text)', marginTop: 10 }}>Adquirir sistema</span>
    </button>
  );
}

// Slot vazio só para manter a grade 2x2 (2 em cima, 2 embaixo) quando há
// menos sistemas do que espaços — não é clicável nem representa nada real.
function EmptySystemSlot() {
  return (
    <div aria-hidden="true" style={{ borderRadius: 14, border: '1px dashed var(--p-border)', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, border: '1px dashed var(--p-border)' }} />
    </div>
  );
}

function SystemsGrid({ systems, onAcquire }) {
  const tiles = [
    ...systems.map((s) => <SystemCard key={s.slug} s={s} />),
    <AddSystemCard key="add-system" onClick={onAcquire} />,
  ];
  const emptySlots = Math.max(0, 4 - tiles.length);

  return (
    <div>
      {systems.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--p-muted)', lineHeight: 1.6, marginBottom: 16 }}>
          Ainda sem sistemas ativos. Explore o catálogo e contrate o primeiro sistema da sua equipe.
        </p>
      )}
      {/* Grade fixa de 2 colunas — 2 em cima, 2 embaixo — para casar com a
          altura do card "Ações rápidas" ao lado. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {tiles}
        {Array.from({ length: emptySlots }, (_, i) => <EmptySystemSlot key={`empty-${i}`} />)}
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

// ─── AcquireSystemsModal ────────────────────────────────────────────────────────

function AcquireSystemsModal({ activeSlugs, onClose, P }) {
  const navigate = useNavigate();
  const isDark = P.bg === '#08080a';
  const C = {
    panelBg:    isDark ? '#18181b' : '#ffffff',
    panelBd:    isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    text:       isDark ? '#eeede9' : '#111116',
    muted:      isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.48)',
    cardBg:     isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    cardBd:     isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    closeBg:    isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    closeBd:    isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    closeColor: isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.55)',
  };

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await fetchSystems();
        if (active) setAvailable(all.filter((s) => !activeSlugs.has(s.slug)));
      } catch {
        if (active) setAvailable([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeSlugs]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openDetails = (sys) => {
    onClose();
    navigate(`/area-do-cliente/sistemas/${sys.slug}`);
  };

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label="Adquirir sistema"
        style={{ width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: C.panelBg, border: `1px solid ${C.panelBd}`, borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.55)', color: C.text, fontFamily: FONT_INTER, position: 'relative' }}>

        <button type="button" onClick={onClose} aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.closeBd}`, background: C.closeBg, color: C.closeColor, cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.3, marginBottom: 5, color: C.text }}>Adquirir sistema</h2>
            <p style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.5 }}>Veja os detalhes de cada sistema disponível e siga para a contratação.</p>
          </div>

          {loading ? (
            <p style={{ fontSize: '0.85rem', color: C.muted, textAlign: 'center', padding: '20px 0' }}>Carregando catálogo...</p>
          ) : available.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <p style={{ fontSize: '0.85rem', color: C.muted, lineHeight: 1.5 }}>Sua empresa já possui todos os sistemas disponíveis no catálogo.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {available.map((sys) => (
                <div key={sys.slug}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', borderRadius: 14, background: C.cardBg, border: `1px solid ${C.cardBd}` }}>
                  {sys.logo_url ? (
                    <img src={sys.logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: 'var(--p-primary-soft)' }} />
                  ) : (
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                      {sys.icon}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{sys.name}</div>
                    <div style={{ fontSize: '0.77rem', color: C.muted, lineHeight: 1.4 }}>{sys.description}</div>
                    {sys.default_amount > 0 && (
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--p-primary)', marginTop: 4 }}>{formatBRL(sys.default_amount)}/mês</div>
                    )}
                  </div>
                  <button type="button" onClick={() => openDetails(sys)}
                    style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontFamily: FONT_INTER, fontSize: '0.8rem' }}>
                    Detalhes
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
  const [catalog, setCatalog] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeNav, setActiveNav] = useState('inicio');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [acquireModalOpen, setAcquireModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveConfirming, setLeaveConfirming] = useState(false);
  const [leaveError, setLeaveError] = useState(null);

  const loadCockpitData = useCallback(async ({ active = { current: true } } = {}) => {
    try {
      const my = await fetchMyCompany();
      if (active.current) setCompanyInfo(my);

      // Catálogo completo: alimenta tanto o vínculo das assinaturas quanto o
      // card "Explore nossos sistemas" (que lista o que ainda não foi contratado).
      const allSystems = await fetchSystems();
      if (active.current) setCatalog(allSystems);

      const companyId = my?.company?.id;
      const list = [];
      if (companyId) {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id, system_slug, plan, status, current_period_end, created_at')
          .eq('company_id', companyId)
          .in('status', ['active', 'trialing']);
        if (active.current && !error) {
          const bySlug = indexSystems(allSystems);
          const seen = new Set();
          (data || []).forEach((s) => {
            const sys = bySlug[s.system_slug];
            if (!sys || seen.has(sys.slug)) return;
            seen.add(sys.slug);
            list.push({ ...sys, subscription: s });
          });
        }
        try {
          const membersData = await fetchCompanyMembers(companyId);
          if (active.current) setMembers(membersData || []);
        } catch { /* keep empty */ }
      }
      if (active.current) setSystems(list);
    } catch {
      if (active.current) { setCompanyInfo(null); setSystems([]); }
    }
  }, []);

  useEffect(() => {
    const active = { current: true };
    loadCockpitData({ active });
    return () => { active.current = false; };
  }, [user?.id, loadCockpitData]);

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
  const hasCompany = Boolean(companyInfo?.company?.id);
  // isOrgManager: owner ou admin da organização — pode gerenciar equipe/convites
  const isOrgManager = companyRole === 'owner' || companyRole === 'admin';

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

  // Sistemas do catálogo que a equipe ainda não contratou — alimentam o card
  // "Explore nossos sistemas".
  const exploreSystems = useMemo(() => {
    const owned = new Set(systems.map((s) => s.slug));
    return catalog.filter((s) => !owned.has(s.slug)).slice(0, 4);
  }, [catalog, systems]);

  // Resumo da conta: plano e próxima cobrança saem da assinatura mais próxima
  // de renovar; os contadores, do que já está carregado na tela.
  const accountSummary = useMemo(() => {
    const subs = systems.map((s) => s.subscription).filter(Boolean);
    const nextCharge = subs
      .map((s) => s.current_period_end)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || null;
    return {
      plan: subs.find((s) => s.plan)?.plan || null,
      trial: subs.some((s) => s.status === 'trialing'),
      systemsCount: systems.length,
      membersCount: members.length,
      nextCharge,
    };
  }, [systems, members]);

  const cssVars = {
    '--p-bg': P.bg, '--p-surface': P.surface, '--p-surface2': P.surface2, '--p-surface-solid': P.surfaceSolid,
    '--p-text': P.text, '--p-muted': P.muted, '--p-muted2': P.muted2,
    '--p-border': P.border, '--p-border2': P.border2,
    '--p-primary': P.primary, '--p-primary-soft': P.primarySoft, '--p-primary-border': P.primaryBorder,
    '--p-input-bg': P.inputBg, '--p-shadow': P.shadow, '--p-row-hover': P.rowHover,
  };

  const CARD = { background: 'var(--p-surface)', border: '1px solid var(--p-border)', boxShadow: 'var(--p-shadow)', borderRadius: 16 };
  const CARD_TITLE = { fontSize: '1.02rem', fontWeight: 800, letterSpacing: -0.3, color: 'var(--p-text)' };

  const svg = (children, size = 17) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
  const ICON = {
    home:    svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.8V21h13V9.8" /></>),
    grid:    svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>),
    bag:     svg(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>),
    card:    svg(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
    team:    svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
    support: svg(<><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>),
    user:    svg(<><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></>),
    gear:    svg(<><circle cx="12" cy="12" r="3" /><path d="M19.9 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>),
    clock:   svg(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
    chart:   svg(<><path d="M21.2 15.9A10 10 0 1 1 8.1 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>),
    bolt:    svg(<><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></>),
    bell:    svg(<><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
    chevron: svg(<polyline points="9 18 15 12 9 6" />, 14),
    arrow:   svg(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>, 14),
    logout:  svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>, 15),
    menu:    svg(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>),
  };

  // Ação do item "Equipe": respeita exatamente o mesmo guard de cargo de antes —
  // gestor (ou sem equipe) abre o modal de gestão; membro comum só pode sair.
  const handleTeamNav = () => {
    if (hasCompany && !isOrgManager) { setLeaveError(null); setLeaveModalOpen(true); return; }
    handleOpenOrgModal();
  };

  const goTo = (key, sectionId) => {
    setActiveNav(key);
    setMobileNavOpen(false);
    const el = sectionId ? document.getElementById(sectionId) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    { key: 'inicio',      label: 'Início',            icon: ICON.home,    onClick: () => goTo('inicio') },
    { key: 'sistemas',    label: 'Meus sistemas',     icon: ICON.grid,    onClick: () => goTo('sistemas', 'sec-sistemas') },
    { key: 'explorar',    label: 'Explorar sistemas', icon: ICON.bag,     onClick: () => { setActiveNav('explorar'); setMobileNavOpen(false); setAcquireModalOpen(true); } },
    { key: 'assinaturas', label: 'Financeiro',        icon: ICON.card,    onClick: () => navigate('/area-do-cliente/financeiro') },
    { key: 'equipe',      label: 'Equipe',            icon: ICON.team,    onClick: () => { setActiveNav('equipe'); setMobileNavOpen(false); handleTeamNav(); }, badge: pendingCount > 0 ? pendingCount : null },
    { key: 'suporte',     label: 'Suporte',           icon: ICON.support, onClick: () => { setActiveNav('suporte'); setMobileNavOpen(false); setSupportModalOpen(true); } },
    { key: 'perfil',      label: 'Meu perfil',        icon: ICON.user,    onClick: () => { setActiveNav('perfil'); setMobileNavOpen(false); setProfileModalOpen(true); } },
    { key: 'config',      label: 'Configurações',     icon: ICON.gear,    disabled: true, tag: 'Em breve' },
  ];

  const quickActions = [
    { title: 'Falar com suporte', desc: 'Tire dúvidas ou abra um atendimento', icon: ICON.support, onClick: () => setSupportModalOpen(true) },
    hasCompany && !isOrgManager
      ? { title: 'Sair da equipe', desc: `Deixar ${companyName || 'a organização'}`, icon: ICON.team, onClick: () => { setLeaveError(null); setLeaveModalOpen(true); } }
      : { title: hasCompany ? 'Gerenciar equipe' : 'Criar equipe', desc: hasCompany ? 'Convide e gerencie membros' : 'Configure sua organização', icon: ICON.team, onClick: handleOpenOrgModal },
    { title: 'Financeiro e pagamentos', desc: 'Planos e histórico de cobranças', icon: ICON.card, onClick: () => navigate('/area-do-cliente/financeiro') },
    { title: 'Meu perfil', desc: 'Avatar, banner e status da conta', icon: ICON.user, onClick: () => setProfileModalOpen(true) },
  ];

  return (
    <div className="adc-shell" data-nav={mobileNavOpen ? 'open' : 'closed'} style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER, ...cssVars }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }

        .adc-shell { display: flex; align-items: stretch; }

        /* ── Sidebar ── */
        .adc-side {
          width: 236px; flex-shrink: 0; position: sticky; top: 0; height: 100vh;
          background: var(--p-surface-solid); border-right: 1px solid var(--p-border);
          display: flex; flex-direction: column; z-index: 60;
        }
        .adc-brand { display:flex; align-items:center; gap:10px; padding:22px 20px 18px; }
        .adc-brand-mark { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,#8B5CF6,#6D28D9); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:1rem; flex-shrink:0; }
        .adc-brand-name { font-size:1.05rem; font-weight:800; letter-spacing:-0.4px; color:var(--p-text); }
        .adc-nav { flex:1; overflow-y:auto; padding:4px 12px; display:flex; flex-direction:column; gap:2px; }
        .adc-nav-item {
          display:flex; align-items:center; gap:11px; width:100%; padding:9px 12px; border-radius:10px;
          background:transparent; border:none; cursor:pointer; font-family:inherit; font-size:0.87rem;
          font-weight:500; color:var(--p-muted); text-align:left; transition:background .14s,color .14s;
        }
        .adc-nav-item:hover:not(:disabled) { background:var(--p-row-hover); color:var(--p-text); }
        .adc-nav-item[data-active="true"] { background:var(--p-primary-soft); color:var(--p-primary); font-weight:650; }
        .adc-nav-item:disabled { opacity:.5; cursor:default; }
        .adc-nav-item svg { flex-shrink:0; }
        .adc-nav-tag { margin-left:auto; font-size:.58rem; font-weight:800; letter-spacing:.4px; padding:2px 6px; border-radius:5px; background:var(--p-surface2); color:var(--p-muted2); }
        .adc-nav-badge { margin-left:auto; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--p-primary); color:#fff; font-size:.65rem; font-weight:800; display:flex; align-items:center; justify-content:center; }

        .adc-side-foot { padding:12px; border-top:1px solid var(--p-border); display:flex; flex-direction:column; gap:10px; }
        .adc-help { background:var(--p-primary-soft); border:1px solid var(--p-primary-border); border-radius:12px; padding:14px; }
        .adc-help-btn { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; margin-top:10px; padding:8px; border-radius:9px; background:var(--p-primary); border:none; color:#fff; font-family:inherit; font-size:.78rem; font-weight:700; cursor:pointer; transition:filter .15s; }
        .adc-help-btn:hover { filter:brightness(1.1); }
        .adc-user-chip { display:flex; align-items:center; gap:10px; flex:1; min-width:0; padding:8px; border-radius:11px; background:transparent; border:none; cursor:pointer; font-family:inherit; text-align:left; transition:background .14s; }
        .adc-user-chip:hover { background:var(--p-row-hover); }
        .adc-avatar { width:34px; height:34px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:800; color:#fff; background:linear-gradient(135deg,#8B5CF6,#6D28D9); object-fit:cover; }
        .adc-logout { width:32px; height:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:9px; background:transparent; border:1px solid var(--p-border); color:var(--p-muted2); cursor:pointer; transition:all .15s; }
        .adc-logout:hover { color:#dc2626; border-color:rgba(220,38,38,.4); background:rgba(220,38,38,.07); }

        /* ── Body / topbar ── */
        .adc-body { flex:1; min-width:0; display:flex; flex-direction:column; }
        .adc-top { position:sticky; top:0; z-index:50; height:64px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 28px; background:var(--p-bg); border-bottom:1px solid var(--p-border); }
        .adc-burger { display:none; width:34px; height:34px; align-items:center; justify-content:center; border-radius:9px; background:transparent; border:1px solid var(--p-border); color:var(--p-text); cursor:pointer; }
        .adc-top-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .adc-icon-btn { position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:transparent; border:1px solid var(--p-border); color:var(--p-muted); cursor:pointer; transition:all .15s; }
        .adc-icon-btn:hover { color:var(--p-text); border-color:var(--p-border2); }
        .adc-dot { position:absolute; top:7px; right:8px; width:6px; height:6px; border-radius:50%; background:var(--p-primary); }
        .adc-toggle-slot button.theme-toggle,.adc-toggle-slot [class*="theme-toggle"] { width:34px!important; height:34px!important; border-radius:10px!important; background:transparent!important; border:1px solid var(--p-border)!important; color:var(--p-muted)!important; }
        .adc-toggle-slot button.theme-toggle:hover { color:var(--p-text)!important; border-color:var(--p-border2)!important; }
        .adc-admin-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:9px; border:1px solid var(--p-primary-border); background:var(--p-primary-soft); color:var(--p-primary); font-size:.72rem; font-weight:700; letter-spacing:.5px; text-transform:uppercase; transition:filter .15s; }
        .adc-admin-btn:hover { filter:brightness(1.15); }

        .adc-main { padding:24px 28px 72px; display:flex; flex-direction:column; gap:18px; }

        /* ── Hero ── */
        .adc-hero { position:relative; overflow:hidden; border-radius:18px; border:1px solid var(--p-primary-border); background:linear-gradient(115deg,var(--p-primary-soft) 0%,var(--p-surface) 62%); padding:30px 32px; min-height:150px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
        .adc-hero-art { flex-shrink:0; opacity:.9; }
        .adc-pill { display:inline-flex; align-items:center; gap:7px; padding:6px 13px; border-radius:999px; font-size:.75rem; font-weight:600; }

        /* ── Cards / linhas ── */
        /* minmax(0,…) e não 1fr puro: 1fr equivale a minmax(auto,1fr) e respeita
           o min-content da coluna — o texto com white-space:nowrap dos cards
           esticava uma coluna e espremia as outras (275/580/246 em vez de 1.12/1/1). */
        .adc-row3 { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr) minmax(0,1fr); gap:16px; align-items:stretch; }
        .adc-row2 { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(0,1fr); gap:16px; align-items:start; }
        .adc-card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px 12px; }
        .adc-card-head-l { display:flex; align-items:center; gap:9px; min-width:0; }
        .adc-list-row { display:flex; align-items:center; gap:11px; width:100%; padding:10px 20px; background:transparent; border:none; cursor:pointer; font-family:inherit; text-align:left; transition:background .13s; }
        .adc-list-row:hover { background:var(--p-row-hover); }
        .adc-ico { width:34px; height:34px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--p-primary-soft); border:1px solid var(--p-primary-border); color:var(--p-primary); }
        .adc-qa { display:grid; grid-template-columns:1fr 1fr; gap:9px; padding:0 16px 16px; }
        .adc-qa-tile { display:flex; flex-direction:column; gap:7px; padding:13px; border-radius:12px; background:var(--p-surface2); border:1px solid var(--p-border); cursor:pointer; font-family:inherit; text-align:left; transition:all .15s; }
        .adc-qa-tile:hover { border-color:var(--p-primary-border); background:var(--p-primary-soft); }
        .adc-summary-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 20px; border-bottom:1px solid var(--p-border); font-size:.83rem; }
        .adc-foot-btn { display:flex; align-items:center; justify-content:center; gap:6px; width:calc(100% - 40px); margin:14px 20px 18px; padding:10px; border-radius:10px; background:var(--p-primary-soft); border:1px solid var(--p-primary-border); color:var(--p-primary); font-family:inherit; font-size:.82rem; font-weight:700; cursor:pointer; transition:filter .15s; }
        .adc-foot-btn:hover { filter:brightness(1.12); }
        .system-card:hover { border-color:var(--p-primary-border)!important; background:var(--p-primary-soft)!important; }
        @keyframes pulse { 0%,100%{opacity:.9} 50%{opacity:.4} }
        .live-dot { animation:pulse 1.6s ease-in-out infinite; }
        .adc-scrim { display:none; }

        @media (max-width:1180px) { .adc-row3 { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } .adc-row3 > :first-child { grid-column:1 / -1; } }
        @media (max-width:900px) {
          .adc-side { position:fixed; left:0; top:0; transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 40px rgba(0,0,0,.4); }
          .adc-shell[data-nav="open"] .adc-side { transform:translateX(0); }
          .adc-shell[data-nav="open"] .adc-scrim { display:block; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:55; }
          .adc-burger { display:flex; }
          .adc-row3, .adc-row2 { grid-template-columns:minmax(0,1fr); }
          .adc-row3 > :first-child { grid-column:auto; }
          .adc-hero-art { display:none; }
        }
        @media (max-width:600px) {
          .adc-top { padding:0 14px; } .adc-main { padding:16px 14px 64px; }
          .adc-hero { padding:22px 20px; } .adc-qa { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="adc-scrim" onClick={() => setMobileNavOpen(false)} />

      {/* ══ Sidebar ══ */}
      <aside className="adc-side">
        <Link to="/" className="adc-brand" aria-label="Voltar ao site">
          <span className="adc-brand-mark">N</span>
          <span className="adc-brand-name">NoraTech</span>
        </Link>

        <nav className="adc-nav">
          {navItems.map((n) => (
            <button key={n.key} type="button" className="adc-nav-item" data-active={activeNav === n.key}
              disabled={n.disabled} onClick={n.onClick}>
              {n.icon}
              <span>{n.label}</span>
              {n.tag && <span className="adc-nav-tag">{n.tag}</span>}
              {n.badge && <span className="adc-nav-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="adc-side-foot">
          <div className="adc-help">
            <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--p-text)' }}>Precisa de ajuda?</div>
            <p style={{ fontSize: '.75rem', color: 'var(--p-muted)', lineHeight: 1.45, marginTop: 3 }}>
              Estamos aqui para te ajudar.
            </p>
            <button type="button" className="adc-help-btn" onClick={() => setSupportModalOpen(true)}>
              {ICON.support} Falar com suporte
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" className="adc-user-chip" onClick={() => setProfileModalOpen(true)}>
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="" className="adc-avatar" />
                : <span className="adc-avatar">{initials}</span>}
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'Minha conta'}
                </span>
                <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--p-muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hasCompany ? `${companyName} · ${roleLabel}` : 'Sem equipe'}
                </span>
              </span>
            </button>
            <button type="button" className="adc-logout" onClick={handleLogout} title="Encerrar sessão" aria-label="Encerrar sessão">
              {ICON.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* ══ Conteúdo ══ */}
      <div className="adc-body">
        <header className="adc-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button type="button" className="adc-burger" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
              {ICON.menu}
            </button>
            <span style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--p-text)' }}>Área do Cliente</span>
          </div>
          <div className="adc-top-actions">
            {isAdmin && (
              <Link to="/admin" className="adc-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Admin
              </Link>
            )}
            <button type="button" className="adc-icon-btn" onClick={() => goTo('inicio', 'sec-atividade')} title="Atividade recente" aria-label="Atividade recente">
              {ICON.bell}
              {activity.length > 0 && <span className="adc-dot" />}
            </button>
            <span className="adc-toggle-slot" style={{ display: 'inline-flex' }}><ThemeToggle /></span>
            <UserProfileMenu />
          </div>
        </header>

        <main className="adc-main" id="inicio">
          {/* ── Hero ── */}
          <section className="adc-hero">
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 'clamp(1.5rem,2.4vw,1.95rem)', fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.15 }}>
                Olá, <span style={{ color: P.primary }}>{firstName}</span>! 👋
              </h1>
              <p style={{ fontSize: '.9rem', color: 'var(--p-muted)', marginTop: 6 }}>
                {systems.length > 0
                  ? 'Bem-vindo à sua central NoraTech.'
                  : 'Bem-vindo! Contrate um sistema e sua operação aparece aqui.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 16 }}>
                <span className="adc-pill" style={{ background: 'rgba(0,212,138,.1)', border: '1px solid rgba(0,212,138,.28)', color: '#00d48a' }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d48a' }} />
                  Conta ativa
                </span>
                <span className="adc-pill" style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)', color: 'var(--p-text)' }}>
                  {systems.length} {systems.length === 1 ? 'sistema contratado' : 'sistemas contratados'}
                </span>
                {memberSince && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: '.7rem', color: 'var(--p-muted2)' }}>
                    Membro desde {memberSince}
                  </span>
                )}
              </div>
            </div>

            <svg className="adc-hero-art" width="230" height="130" viewBox="0 0 230 130" fill="none" aria-hidden="true">
              <rect x="42" y="14" width="150" height="98" rx="10" fill="var(--p-primary-soft)" stroke="var(--p-primary-border)" />
              <rect x="42" y="14" width="150" height="20" rx="10" fill="var(--p-primary-border)" opacity=".5" />
              <circle cx="55" cy="24" r="3" fill="var(--p-primary)" opacity=".7" />
              <circle cx="65" cy="24" r="3" fill="var(--p-primary)" opacity=".45" />
              <circle cx="75" cy="24" r="3" fill="var(--p-primary)" opacity=".3" />
              <rect x="54" y="46" width="40" height="40" rx="8" fill="var(--p-primary)" opacity=".22" />
              <path d="M62 74v-12M70 74v-20M78 74v-8" stroke="var(--p-primary)" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="106" y="46" width="70" height="8" rx="4" fill="var(--p-primary)" opacity=".3" />
              <rect x="106" y="62" width="52" height="8" rx="4" fill="var(--p-primary)" opacity=".2" />
              <rect x="106" y="78" width="62" height="8" rx="4" fill="var(--p-primary)" opacity=".14" />
              <path d="M18 40l4-8 4 8-4 3zM206 92l4-8 4 8-4 3z" fill="var(--p-primary)" opacity=".35" />
            </svg>
          </section>

          {/* ── Linha 1 ── */}
          <div className="adc-row3">
            {/* Meus sistemas */}
            <section id="sec-sistemas" style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div className="adc-card-head">
                <div className="adc-card-head-l">
                  <span className="adc-ico">{ICON.grid}</span>
                  <h2 style={CARD_TITLE}>Meus sistemas</h2>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: '.72rem', color: 'var(--p-muted2)' }}>
                  {systems.length} ativo{systems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <SystemsGrid systems={systems} onAcquire={() => setAcquireModalOpen(true)} />
              </div>
            </section>

            {/* Explore nossos sistemas */}
            <section style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div className="adc-card-head" style={{ paddingBottom: 4 }}>
                <div className="adc-card-head-l">
                  <span className="adc-ico">{ICON.bag}</span>
                  <h2 style={CARD_TITLE}>Explore nossos sistemas</h2>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ padding: '0 20px 10px', fontSize: '.8rem', color: 'var(--p-muted)', lineHeight: 1.5 }}>
                  {exploreSystems.length > 0
                    ? 'Encontre soluções para transformar sua empresa.'
                    : 'Você já contratou todos os sistemas disponíveis.'}
                </p>
                {exploreSystems.map((s) => (
                  <button key={s.slug} type="button" className="adc-list-row"
                    onClick={() => navigate(`/area-do-cliente/sistemas/${s.slug}`)}>
                    {s.logo_url
                      ? <img src={s.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                      : <span className="adc-ico" style={{ fontSize: '1rem' }}>{s.icon}</span>}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '.85rem', fontWeight: 650, color: 'var(--p-text)' }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: '.72rem', color: 'var(--p-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.description}
                      </span>
                    </span>
                    <span style={{ color: 'var(--p-muted2)', display: 'flex' }}>{ICON.chevron}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="adc-foot-btn" onClick={() => setAcquireModalOpen(true)}>
                Ver todos os sistemas {ICON.arrow}
              </button>
            </section>

            {/* Ações rápidas */}
            <section style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div className="adc-card-head">
                <div className="adc-card-head-l">
                  <span className="adc-ico">{ICON.bolt}</span>
                  <h2 style={CARD_TITLE}>Ações rápidas</h2>
                </div>
              </div>
              <div className="adc-qa">
                {quickActions.map((a) => (
                  <button key={a.title} type="button" className="adc-qa-tile" onClick={a.onClick}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--p-primary)', display: 'flex' }}>{a.icon}</span>
                      <span style={{ color: 'var(--p-muted2)', display: 'flex' }}>{ICON.chevron}</span>
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: 'var(--p-text)' }}>{a.title}</span>
                      <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--p-muted)', lineHeight: 1.4, marginTop: 2 }}>{a.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* ── Linha 2 ── */}
          <div className="adc-row2">
            {/* Atividade recente */}
            <section id="sec-atividade" style={CARD}>
              <div className="adc-card-head">
                <div className="adc-card-head-l">
                  <span className="adc-ico">{ICON.clock}</span>
                  <h2 style={CARD_TITLE}>Atividade recente</h2>
                </div>
              </div>
              {activity.length === 0 ? (
                <p style={{ color: 'var(--p-muted)', fontSize: '.85rem', textAlign: 'center', padding: '24px 20px 32px' }}>
                  Nenhuma atividade registrada ainda.
                </p>
              ) : (
                <div style={{ paddingBottom: 10 }}>
                  {activity.map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 20px' }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: ev.type === 'member' ? 'rgba(99,102,241,.12)' : 'rgba(16,185,129,.12)',
                        border: `1px solid ${ev.type === 'member' ? 'rgba(99,102,241,.25)' : 'rgba(16,185,129,.25)'}`,
                        color: ev.type === 'member' ? '#6366f1' : '#10b981' }}>
                        {ev.type === 'member' ? ICON.user : ICON.grid}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '.85rem', fontWeight: 650, color: 'var(--p-text)' }}>{ev.label}</span>
                        <span style={{ fontSize: '.78rem', color: 'var(--p-muted)', marginLeft: 6 }}>{ev.sublabel}</span>
                      </span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '.68rem', color: 'var(--p-muted2)', whiteSpace: 'nowrap' }}>
                        {formatRelativeDate(ev.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Resumo da conta */}
            <section style={CARD}>
              <div className="adc-card-head">
                <div className="adc-card-head-l">
                  <span className="adc-ico">{ICON.chart}</span>
                  <h2 style={CARD_TITLE}>Resumo da conta</h2>
                </div>
              </div>
              {[
                { k: 'Plano atual', v: accountSummary.plan || (accountSummary.systemsCount > 0 ? (accountSummary.trial ? 'Trial' : 'Ativo') : '—'), strong: true },
                { k: 'Sistemas contratados', v: String(accountSummary.systemsCount) },
                { k: 'Membros da equipe', v: hasCompany ? String(accountSummary.membersCount) : '—' },
                { k: 'Próxima cobrança', v: formatShortDate(accountSummary.nextCharge) || '—' },
              ].map((r) => (
                <div key={r.k} className="adc-summary-row">
                  <span style={{ color: 'var(--p-muted)' }}>{r.k}</span>
                  <span style={{ fontWeight: 700, color: r.strong ? 'var(--p-primary)' : 'var(--p-text)' }}>{r.v}</span>
                </div>
              ))}
              <button type="button" className="adc-foot-btn" onClick={() => navigate('/area-do-cliente/financeiro')}>
                Ver assinaturas {ICON.arrow}
              </button>
            </section>
          </div>
        </main>
      </div>

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

      {acquireModalOpen && (
        <AcquireSystemsModal
          activeSlugs={new Set(systems.map((s) => s.slug))}
          onClose={() => setAcquireModalOpen(false)}
          P={P}
        />
      )}
    </div>
  );
}
