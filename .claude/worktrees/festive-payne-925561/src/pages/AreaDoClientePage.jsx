import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import ThemeToggle from '../components/ThemeToggle';
import CockpitCompany from '../components/CockpitCompany';
import UserProfileMenu from '../components/UserProfileMenu';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';
import { fetchMyCompany } from '../lib/companies';
import { getSystem, SYSTEMS } from '../lib/systems';

const TABS = [
  { id: 'cockpit', num: '01', label: 'Cockpit' },
  { id: 'operacao', num: '02', label: 'Operação' },
  { id: 'financeiro', num: '03', label: 'Financeiro' },
  { id: 'oportunidades', num: '04', label: 'Oportunidades' },
  { id: 'comando', num: '05', label: 'Comando' },
];

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const COMPANY_ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };
const PRESENCE = {
  online: { label: 'Online', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', bd: 'rgba(34,197,94,0.26)' },
  busy: { label: 'Ocupado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.28)' },
  away: { label: 'Ausente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', bd: 'rgba(245,158,11,0.3)' },
  invisible: { label: 'Invisível', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', bd: 'rgba(156,163,175,0.28)' },
};

function formatMemberSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
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
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 999, background: 'rgba(124,58,237,0.13)', border: '1px solid rgba(167,139,250,0.32)', color: '#ddd6fe', fontSize: '0.72rem', fontWeight: 800, letterSpacing: 0.4 }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6, #22c55e)', boxShadow: '0 0 18px rgba(139,92,246,0.42)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      E-mail verificado
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
    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34)), url(${user.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'radial-gradient(circle at 18% 20%, rgba(196,181,253,0.28) 0%, transparent 34%), linear-gradient(135deg, #15151c 0%, #2b145d 48%, #08080a 100%)' };

  const uploadImage = async (file, kind) => {
    const maxMb = kind === 'avatar' ? 2 : 5;
    const validationError = validateProfileImage(file, maxMb);
    if (validationError) { setMessage({ type: 'error', text: validationError }); return; }

    try {
      setSaving(kind);
      setMessage(null);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      const column = kind === 'avatar' ? 'photo_url' : 'banner_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
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
      setMessage({ type: 'error', text: 'Status deve ter no máximo 80 caracteres.' });
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
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
        style={{ width: 'min(640px, 100%)', background: '#111116', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, boxShadow: '0 28px 90px rgba(0,0,0,0.78)', overflow: 'hidden', color: '#eeede9', position: 'relative', fontFamily: "'Inter', sans-serif" }}
      >
        <style>{`
          .profile-avatar-edit .profile-avatar-overlay,
          .profile-banner-edit .profile-banner-overlay {
            opacity: 0;
            transition: opacity 0.18s ease, background 0.18s ease;
          }
          .profile-avatar-edit:hover .profile-avatar-overlay,
          .profile-avatar-edit:focus-visible .profile-avatar-overlay,
          .profile-banner-edit:hover .profile-banner-overlay,
          .profile-banner-edit:focus-visible .profile-banner-overlay {
            opacity: 1;
          }
        `}</style>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar perfil"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.34)', color: 'rgba(255,255,255,0.78)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
        >
          ×
        </button>

        <div className="profile-banner-edit" style={{ height: 156, borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden', cursor: 'pointer', ...bannerStyle }}>
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={saving === 'banner'}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', color: '#fff', cursor: saving === 'banner' ? 'wait' : 'pointer', zIndex: 1 }}
          >
            <span className="profile-banner-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 18px', background: 'rgba(0,0,0,0.34)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.42)', fontSize: '0.74rem', fontWeight: 800, backdropFilter: 'blur(10px)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {saving === 'banner' ? 'Enviando...' : 'Alterar banner'}
              </span>
            </span>
          </button>
          <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'banner')} />
        </div>

        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: -46, flexWrap: 'wrap' }}>
            <button
              className="profile-avatar-edit"
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={saving === 'avatar'}
              title="Alterar foto"
              style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', padding: 6, background: '#111116', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)', border: 'none', cursor: saving === 'avatar' ? 'wait' : 'pointer' }}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.18)', color: '#a78bfa', fontSize: '1.6rem', fontWeight: 900 }}>
                  {initials}
                </div>
              )}
              <span className="profile-avatar-overlay" style={{ position: 'absolute', inset: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.48)', color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}>
                {saving === 'avatar' ? '...' : 'Editar'}
              </span>
              <span title={presenceConfig.label} style={{ position: 'absolute', right: 8, bottom: 10, width: 22, height: 22, borderRadius: '50%', background: presenceConfig.color, border: '5px solid #111116', boxShadow: `0 0 14px ${presenceConfig.color}88` }} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => uploadImage(e.target.files?.[0], 'avatar')} />

            <div style={{ minWidth: 0, flex: 1, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div ref={presenceMenuRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setPresenceOpen((v) => !v)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: presenceConfig.bg, border: `1px solid ${presenceConfig.bd}`, color: presenceConfig.color, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: presenceConfig.color }} />
                    {presenceConfig.label}
                  </button>
                  {presenceOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 5, minWidth: 150, padding: 6, borderRadius: 12, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.55)' }}>
                      {Object.entries(PRESENCE).map(([key, item]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setPresence(key); setPresenceOpen(false); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 9, border: 'none', background: key === presence ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'rgba(255,255,255,0.82)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', textAlign: 'left' }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={statusEditorRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.76rem' }}>
                    {activeStatus || 'Status 24h não configurado'}
                  </span>
                  <button
                    type="button"
                    aria-label="Editar status 24h"
                    onClick={() => { setStatusDraft(activeStatus || ''); setStatusEditing((v) => !v); }}
                    style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  {statusEditing && (
                    <form onSubmit={saveStatus} style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 6, width: 300, maxWidth: 'calc(100vw - 56px)', padding: 12, borderRadius: 14, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 44px rgba(0,0,0,0.62)' }}>
                      <input
                        autoFocus
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        maxLength={80}
                        placeholder="Ex.: Em reunião, Focado, Ausente"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.26)', color: '#eeede9', outline: 'none', fontFamily: 'inherit', marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" onClick={() => { setStatusDraft(statusText); setStatusEditing(false); }} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.62)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancelar
                        </button>
                        <button type="submit" disabled={saving === 'status'} style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.34)', background: 'rgba(124,58,237,0.16)', color: '#ddd6fe', fontWeight: 800, cursor: saving === 'status' ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
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
                <h2 style={{ fontSize: '1.55rem', fontWeight: 850, letterSpacing: -0.6, lineHeight: 1.1 }}>
                  {user?.name || 'Usuário'}
                </h2>
                <span style={{ color: '#a78bfa', fontSize: '0.88rem', fontWeight: 700 }}>
                  {companyName}
                </span>
              </div>
              <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.46)', fontSize: '0.9rem' }}>
                {user?.email}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.38)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
                Badges
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {user?.emailVerified ? <VerifiedBadge /> : <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.82rem' }}>Nenhuma badge disponível.</span>}
              </div>
            </div>

            {message && (
              <div style={{ padding: '11px 13px', borderRadius: 12, background: message.type === 'error' ? 'rgba(255,80,80,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${message.type === 'error' ? 'rgba(255,80,80,0.24)' : 'rgba(34,197,94,0.24)'}`, color: message.type === 'error' ? '#ff9ab4' : '#86efac', fontSize: '0.82rem', fontWeight: 700 }}>
                {message.text}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 14, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.36)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Empresa</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{companyName}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 14, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.36)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Cargo</div>
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

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
        {eyebrow}
      </span>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6, marginBottom: description ? 8 : 0 }}>
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', maxWidth: 620 }}>{description}</p>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, accent = '#7C3AED' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: -1, marginTop: 8, color: accent }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function OperacaoTab() {
  return (
    <>
      <SectionHeader
        eyebrow="Operação"
        title="Monitoramento em tempo real"
        description="Acompanhe a saúde dos seus sistemas, eventos e indicadores operacionais assim que sua automação for ativada."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard label="Uptime 30d" value="—" hint="Sem operação ativa" />
        <StatCard label="Execuções hoje" value="0" hint="Nenhum evento processado" />
        <StatCard label="Tempo médio" value="—" hint="Aguardando coleta" />
        <StatCard label="Incidentes" value="0" hint="Nenhum registro" accent="#7dff7d" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Eventos recentes</h3>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Últimas 24h
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '20px 0', textAlign: 'center' }}>
            Nenhum evento registrado.
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Serviços conectados</h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              0 ativos
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '20px 0', textAlign: 'center' }}>
            Nenhuma integração configurada ainda.
          </div>
        </div>
      </div>
    </>
  );
}

function FinanceiroTab() {
  return (
    <>
      <SectionHeader
        eyebrow="Financeiro"
        title="Plano, faturas e pagamentos"
        description="Consulte o seu plano atual, histórico de faturas e método de pagamento em um único lugar."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard label="Plano atual" value="Free" hint="Nenhum serviço contratado" />
        <StatCard label="Mensalidade" value="R$ 0,00" hint="Ativa ao contratar um serviço" />
        <StatCard label="Próxima fatura" value="—" hint="Sem cobrança programada" />
        <StatCard label="Status" value="Em dia" hint="Sem pendências" accent="#7dff7d" />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Histórico de faturas</h3>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
            0 faturas
          </span>
        </div>
        <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '24px 0', textAlign: 'center' }}>
          Você ainda não possui faturas emitidas.
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Método de pagamento</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              Nenhum cartão ou método cadastrado.
            </p>
          </div>
          <Link
            to="/#contato"
            className="btn-ghost"
            style={{ padding: '10px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
          >
            Configurar
          </Link>
        </div>
      </div>
    </>
  );
}

function OportunidadesTab() {
  const opportunities = [
    {
      tag: 'Automação',
      title: 'Automação de atendimento 24/7',
      description: 'Implante um agente inteligente para responder leads e clientes com tom humano e integração direta ao seu CRM.',
      to: '/servicos/automacao-ia',
    },
    {
      tag: 'Sistemas',
      title: 'Sistema sob medida para a sua operação',
      description: 'Plataforma web exclusiva, desenhada para os fluxos do seu negócio — sem planilhas, sem gambiarras.',
      to: '/servicos/sistemas-sob-medida',
    },
    {
      tag: 'Estratégia',
      title: 'Diagnóstico gratuito de operação',
      description: 'Agende uma conversa de 30 minutos com a Noratech para mapear gargalos e oportunidades de automação.',
      to: '/#contato',
    },
  ];

  return (
    <>
      <SectionHeader
        eyebrow="Oportunidades"
        title="Próximos passos sugeridos"
        description="Uma curadoria de serviços e melhorias que podem acelerar seus resultados."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {opportunities.map((op) => (
          <Link
            key={op.title}
            to={op.to}
            className="system-card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', transition: 'all 0.2s' }}
          >
            <span style={{ alignSelf: 'flex-start', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(124, 58, 237,0.25)', background: 'rgba(124, 58, 237,0.06)', borderRadius: 6 }}>
              {op.tag}
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, marginTop: 4 }}>
              {op.title}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {op.description}
            </p>
            <span style={{ marginTop: 'auto', fontSize: '0.82rem', fontWeight: 700, color: '#b197ff' }}>
              Saiba mais ↗
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

function ComandoTab({ user, onLogout }) {
  const actions = [
    {
      title: 'Editar perfil',
      description: 'Atualize nome, foto e informações da sua conta.',
      cta: 'Abrir perfil',
      to: '/perfil',
      external: false,
    },
    {
      title: 'Falar com suporte',
      description: 'Tire dúvidas, abra chamados ou peça ajustes na operação.',
      cta: 'Enviar mensagem',
      to: '/#contato',
      external: false,
    },
    {
      title: 'Solicitar novo projeto',
      description: 'Conte o que você precisa construir e receba uma proposta.',
      cta: 'Iniciar briefing',
      to: '/#contato',
      external: false,
    },
  ];

  return (
    <>
      <SectionHeader
        eyebrow="Comando"
        title="Ações rápidas e configurações"
        description="Centralize os comandos da sua conta e fale com a Noratech em poucos cliques."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        {actions.map((a) => (
          <div
            key={a.title}
            className="system-card"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}
          >
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: -0.3 }}>
              {a.title}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {a.description}
            </p>
            <Link
              to={a.to}
              style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: '9px 16px', background: '#7C3AED', borderRadius: 10, color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}
            >
              {a.cta}
            </Link>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Resumo da conta</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Nome</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{user?.name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, wordBreak: 'break-all' }}>{user?.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Empresa</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{user?.company || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'rgba(255,0,80,0.04)', border: '1px solid rgba(255,0,80,0.18)', borderRadius: 14, padding: '18px 22px' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Encerrar sessão</h3>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
            Você pode entrar novamente a qualquer momento com seu e-mail e senha.
          </p>
        </div>
        <button
          onClick={onLogout}
          style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,0,80,0.35)', borderRadius: 10, color: '#ff9ab4', fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Sair ↗
        </button>
      </div>
    </>
  );
}

const BASE_CARD_STYLE = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px', transition: 'all 0.2s', cursor: 'pointer', display: 'block' };

function SystemCard({ s }) {
  const isTrial = s.subscription?.status === 'trialing';
  const statusColor = isTrial ? '#60a5fa' : '#7dff7d';
  const statusLabel = isTrial ? 'Trial' : 'Ativa';
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{s.icon}</span> {s.name}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{s.description}</p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#7C3AED' }}>
        {s.url ? 'Abrir sistema ↗' : s.subscription?.plan || ''}
      </p>
    </>
  );
  if (!s.url) return <div className="system-card" style={BASE_CARD_STYLE}>{inner}</div>;
  if (s.internal) return <Link to={s.url} className="system-card" style={BASE_CARD_STYLE}>{inner}</Link>;
  return <a href={s.url} target="_blank" rel="noopener noreferrer" className="system-card" style={BASE_CARD_STYLE}>{inner}</a>;
}

function SystemsGrid({ systems, isAdmin }) {
  // Admin tem bypass: vê todos os sistemas internos do catálogo, mesmo sem assinatura.
  const adminInternals = isAdmin
    ? SYSTEMS
        .filter((s) => s.internal && !systems.some((sub) => sub.slug === s.slug))
        .map((s) => ({ ...s, subscription: { status: 'active' } }))
    : [];
  const all = [...systems, ...adminInternals];

  if (all.length === 0) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
          Nenhum sistema contratado
        </span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 10 }}>
          Você ainda não tem sistemas ativos
        </h3>
        <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto 22px' }}>
          Explore nossos serviços ou fale com a Noratech para começar sua operação.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/servicos/sistemas-sob-medida" className="btn-ghost" style={{ padding: '10px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Ver serviços
          </Link>
          <Link to="/#contato" style={{ padding: '10px 18px', background: '#7C3AED', borderRadius: 10, color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
            Falar com a Noratech
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
      {all.map((s) => <SystemCard key={s.slug} s={s} />)}
    </div>
  );
}

function StatusGauge({ count = 0 }) {
  const size = 96;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const active = count > 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={active ? 'rgba(0,212,138,0.3)' : 'rgba(255,255,255,0.08)'} strokeWidth={stroke} strokeDasharray={active ? '0' : '4 8'} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: active ? '1.7rem' : '1.5rem', fontWeight: 800, color: active ? '#00d48a' : 'rgba(255,255,255,0.25)', letterSpacing: -1, lineHeight: 1 }}>
          {active ? count : '—'}
        </div>
        <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: 1.2, color: active ? 'rgba(0,212,138,0.65)' : 'rgba(255,255,255,0.3)', marginTop: 4, textTransform: 'uppercase' }}>
          {active ? (count === 1 ? 'sistema' : 'sistemas') : 'nenhum'}
        </div>
      </div>
    </div>
  );
}

export default function AreaDoClientePage() {
  const { user, logout, updateUser } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');

  const firstName = useMemo(() => (user?.name || '').split(' ')[0] || 'você', [user]);
  const initials = useMemo(
    () => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
    [user]
  );
  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user]);

  const [systems, setSystems] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);

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
            .select('id, system_slug, plan, status, current_period_end')
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
        }
        if (active) setSystems(list);
      } catch {
        if (active) setCompanyInfo(null);
        if (active) setSystems([]);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const avatarRef = useRef(null);
  const profileMenuRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (
        avatarRef.current && !avatarRef.current.contains(e.target) &&
        profileMenuRef.current && !profileMenuRef.current.contains(e.target)
      ) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .tab-btn:hover { color: rgba(255,255,255,0.9); }
        .btn-ghost:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.2) !important; }
        .btn-primary:hover { background: #d4ff33 !important; transform: translateY(-1px); }
        .system-card:hover { border-color: rgba(124, 58, 237,0.25) !important; background: rgba(255,255,255,0.03) !important; }
        .tabs-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .tabs-nav::-webkit-scrollbar { display: none; width: 0; height: 0; }
        @keyframes pulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.4; } }
        .live-dot { animation: pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5, flexShrink: 0 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Central de Controle
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isAdmin && (
              <Link
                to="/admin"
                className="btn-ghost"
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(124, 58, 237,0.35)', background: 'rgba(124, 58, 237,0.08)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s' }}
              >
                ⚙ Admin
              </Link>
            )}
            <ThemeToggle />
            <UserProfileMenu />
            {/* Avatar button — click reveals name/email/logout */}
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              title={user?.name || 'Usuário'}
              aria-label="Menu do usuário"
              style={{ display: 'none', padding: 0, background: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', transition: 'border-color 0.2s' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: profileOpen ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, border: `2px solid ${profileOpen ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s' }}>
                  {initials}
                </div>
              )}
            </button>
            {profileOpen && createPortal(
              (() => {
                const rect = avatarRef.current?.getBoundingClientRect();
                const top = rect ? rect.bottom + 8 : 80;
                const right = rect ? window.innerWidth - rect.right : 32;
                return (
                  <div ref={profileMenuRef} style={{ position: 'fixed', top, right, zIndex: 9999, minWidth: 220, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
                    <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {user?.photoUrl ? (
                          <img src={user.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                            {initials}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eeede9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Usuário'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
                      style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.78)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.78)'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.72 }}>
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Meu perfil
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sair
                    </button>
                  </div>
                );
              })(),
              document.body
            )}
            {profileModalOpen && (
              <UserProfileModal
                user={user}
                companyInfo={companyInfo}
                initials={initials}
                onClose={() => setProfileModalOpen(false)}
                onUserUpdate={updateUser}
              />
            )}
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '28px 32px 96px' }}>
        {/* Tabs */}
        <nav className="tabs-nav" style={{ display: 'flex', gap: 36, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 56, overflowX: 'auto', overflowY: 'hidden' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                className="tab-btn"
                onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#7C3AED' : 'rgba(255,255,255,0.45)', fontSize: '0.92rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: active ? 'rgba(124, 58, 237,0.6)' : 'rgba(255,255,255,0.25)' }}>
                  {t.num}
                </span>
                {t.label}
                {active && (
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#7C3AED', borderRadius: 2 }} />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === 'cockpit' && (
          <>
            {/* Hero banner */}
            <section style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 28px', marginBottom: 36, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
              <StatusGauge count={systems.length} />

              {/* Divider */}
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

              {/* Greeting + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15, marginBottom: 4 }}>
                  Olá, <span style={{ color: '#7C3AED' }}>{firstName}</span>
                </h1>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, marginBottom: 14 }}>
                  {systems.length > 0
                    ? 'Sua central está ativa. Acompanhe seus sistemas, membros e operações em tempo real.'
                    : 'Sua Central de Controle ainda não tem sistemas ativos. Quando você contratar um serviço, a operação aparece aqui.'}
                </p>
                {/* Pills row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: systems.length > 0 ? 'rgba(0,212,138,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${systems.length > 0 ? 'rgba(0,212,138,0.25)' : 'rgba(255,255,255,0.1)'}`, fontSize: '0.71rem', fontWeight: 700, letterSpacing: 0.8, color: systems.length > 0 ? '#00d48a' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: systems.length > 0 ? '#00d48a' : 'rgba(255,255,255,0.25)', boxShadow: systems.length > 0 ? '0 0 8px rgba(0,212,138,0.55)' : 'none' }} className={systems.length > 0 ? 'live-dot' : ''} />
                    {systems.length > 0 ? 'Operação ativa' : 'Aguardando ativação'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', fontSize: '0.71rem', fontWeight: 700, letterSpacing: 0.8, color: '#a78bfa', textTransform: 'uppercase' }}>
                    {systems.length} {systems.length === 1 ? 'sistema ativo' : 'sistemas ativos'}
                  </span>
                  {memberSince && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                      Membro desde {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Empresa */}
            <section style={{ marginBottom: 48 }}>
              <div style={{ marginBottom: 22 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
                  Empresa
                </span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                  Sua organização
                </h2>
              </div>
              <CockpitCompany user={user} />
            </section>

            {/* Systems */}
            <section>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
                    Operação
                  </span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                    Seus sistemas em tempo real
                  </h2>
                </div>
              </div>

              {SystemsGrid({ systems, isAdmin })}
            </section>
          </>
        )}

        {activeTab === 'operacao' && <OperacaoTab />}
        {activeTab === 'financeiro' && <FinanceiroTab />}
        {activeTab === 'oportunidades' && <OportunidadesTab />}
        {activeTab === 'comando' && <ComandoTab user={user} onLogout={handleLogout} />}
      </main>
    </div>
  );
}
