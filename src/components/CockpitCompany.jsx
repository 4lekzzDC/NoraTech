import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveMember,
  createCompany,
  fetchCompanyMembers,
  fetchMyCompany,
  leaveCompany,
  rejectMember,
  requestJoinCompany,
  setMemberRole,
  updateCompanyLogo,
} from '../lib/companies';
import { supabase } from '../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "'Inter', sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const LOGO_BUCKET = 'company-logos';
const ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(name) {
  return (name || '?').trim()[0].toUpperCase();
}

function validateLogoFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type))
    return 'Use PNG, JPG, SVG ou WebP.';
  if (file.size > 3 * 1024 * 1024) return 'Imagem acima de 3 MB.';
  return null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  const ok = type === 'success';
  return (
    <div role="status" style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 20000,
      padding: '12px 18px', borderRadius: 10, maxWidth: 360,
      background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(255,80,80,0.12)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(255,80,80,0.3)'}`,
      color: ok ? '#22c55e' : '#ff6b6b',
      fontSize: '0.88rem', fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      fontFamily: FONT,
    }}>
      {message}
    </div>
  );
}

// ─── CompanyLogoSection ───────────────────────────────────────────────────────

function CompanyLogoSection({ company, isOwner, onLogoUpdate, showToast }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // local blob preview before upload
  const [uploading, setUploading] = useState(false);

  const currentLogo = preview || company?.logo_url || null;
  const initial = getInitial(company?.name || '?');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateLogoFile(file);
    if (err) { showToast(err, 'error'); return; }
    setPreview(URL.createObjectURL(file));
    // stash file on the ref so we can upload on confirm
    fileRef._pendingFile = file;
  };

  const handleUpload = async () => {
    const file = fileRef._pendingFile;
    if (!file || !company?.id) return;
    try {
      setUploading(true);
      const ext = file.name.split('.').pop().toLowerCase() || 'png';
      const path = `${company.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      await updateCompanyLogo(company.id, pub.publicUrl);
      onLogoUpdate(pub.publicUrl);
      setPreview(null);
      fileRef._pendingFile = null;
      showToast('Logo atualizado com sucesso!');
    } catch (err) {
      showToast(err.message || 'Erro ao enviar logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!company?.id) return;
    try {
      setUploading(true);
      await updateCompanyLogo(company.id, null);
      onLogoUpdate(null);
      setPreview(null);
      fileRef._pendingFile = null;
      showToast('Logo removido.');
    } catch (err) {
      showToast(err.message || 'Erro ao remover logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    fileRef._pendingFile = null;
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ padding: '16px 24px 18px', borderBottom: '1px solid var(--p-border)' }}>

      {/* Section label + subtitle inline */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.8,
          color: 'var(--p-primary)', textTransform: 'uppercase',
        }}>
          Identidade visual
        </div>
        <span style={{ fontSize: '0.73rem', color: 'var(--p-muted)' }}>
          PNG, JPG ou SVG · máx 3 MB
        </span>
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 16,
        alignItems: 'stretch',
      }}>

        {/* LEFT — preview box */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 92, height: 92, borderRadius: 18,
            border: '1px solid var(--p-border)',
            background: currentLogo
              ? 'var(--p-surface2)'
              : 'linear-gradient(135deg, rgba(124,58,237,0.13) 0%, rgba(99,102,241,0.07) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.09)',
            position: 'relative',
          }}>
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="Logo da empresa"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }}
              />
            ) : (
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--p-primary)', lineHeight: 1, userSelect: 'none' }}>
                {initial}
              </span>
            )}
            {preview && !uploading && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 18,
                border: '2px solid var(--p-primary)',
                pointerEvents: 'none',
              }} />
            )}
          </div>
          <span style={{
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.5,
            color: 'var(--p-muted)', textTransform: 'uppercase',
          }}>
            Pré-visualização
          </span>
        </div>

        {/* RIGHT — dropzone + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Dropzone */}
          <button
            type="button"
            disabled={!isOwner || uploading}
            onClick={() => isOwner && fileRef.current?.click()}
            style={{
              flex: 1,
              padding: '0 16px',
              minHeight: 58,
              borderRadius: 12,
              border: '1.5px dashed var(--p-border2)',
              background: 'var(--p-surface2)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 5,
              cursor: isOwner && !uploading ? 'pointer' : 'default',
              transition: 'border-color 0.15s, background 0.15s',
              fontFamily: FONT,
              opacity: isOwner ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (!isOwner || uploading) return;
              e.currentTarget.style.borderColor = 'var(--p-primary)';
              e.currentTarget.style.background = 'var(--p-primary-soft)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--p-border2)';
              e.currentTarget.style.background = 'var(--p-surface2)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--p-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--p-text)', lineHeight: 1 }}>
              {uploading ? 'Enviando…' : 'Envie o logo da empresa'}
            </span>
            <span style={{ fontSize: '0.67rem', color: 'var(--p-muted)' }}>PNG, JPG ou SVG</span>
          </button>

          {/* Action row — flush with dropzone width */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 7 }}>
              {!preview ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 9,
                      background: 'var(--p-primary)', border: 'none',
                      color: '#fff', fontSize: '0.76rem', fontWeight: 700,
                      cursor: uploading ? 'wait' : 'pointer', fontFamily: FONT,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 16 12 12 8 16" />
                      <line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                    </svg>
                    Enviar logo
                  </button>
                  {company?.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={uploading}
                      style={{
                        padding: '7px 14px', borderRadius: 9,
                        background: 'transparent',
                        border: '1px solid rgba(220,38,38,0.28)',
                        color: 'rgba(220,38,38,0.8)', fontSize: '0.76rem', fontWeight: 700,
                        cursor: uploading ? 'wait' : 'pointer', fontFamily: FONT,
                        transition: 'all 0.14s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.07)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)'; e.currentTarget.style.color = '#dc2626'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.28)'; e.currentTarget.style.color = 'rgba(220,38,38,0.8)'; }}
                    >
                      Remover
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{
                      padding: '7px 16px', borderRadius: 9,
                      background: 'var(--p-primary)', border: 'none',
                      color: '#fff', fontSize: '0.76rem', fontWeight: 700,
                      cursor: uploading ? 'wait' : 'pointer', fontFamily: FONT,
                    }}
                  >
                    {uploading ? 'Salvando…' : 'Salvar logo'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPreview}
                    disabled={uploading}
                    style={{
                      padding: '7px 12px', borderRadius: 9,
                      background: 'transparent', border: '1px solid var(--p-border)',
                      color: 'var(--p-muted)', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatBlock({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.4, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: -0.8, color: accent || 'var(--p-primary)' }}>
        {value}
      </div>
    </div>
  );
}

// ─── CodePill ─────────────────────────────────────────────────────────────────

function CodePill({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* silent */ }
  }, [code]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {/* Code — full width pill */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: '1rem', fontWeight: 700,
        letterSpacing: 3, color: 'var(--p-primary)',
        padding: '7px 10px', borderRadius: 8,
        background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)',
        lineHeight: 1, width: '100%', boxSizing: 'border-box',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {code}
      </div>
      {/* Copy button — below code, aligned left, never overflows */}
      <button
        type="button"
        onClick={copy}
        title="Copiar código"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7, alignSelf: 'flex-start',
          background: copied ? 'rgba(34,197,94,0.10)' : 'var(--p-surface2)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.28)' : 'var(--p-border)'}`,
          color: copied ? '#22c55e' : 'var(--p-muted)',
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.4,
          cursor: 'pointer', fontFamily: FONT, transition: 'all 0.14s',
          maxWidth: '100%',
        }}
        onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.borderColor = 'var(--p-primary)'; e.currentTarget.style.color = 'var(--p-primary)'; } }}
        onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.borderColor = 'var(--p-border)'; e.currentTarget.style.color = 'var(--p-muted)'; } }}
      >
        {copied ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({ member, currentUserId, isOwner, onApprove, onReject, onChangeRole, busyId }) {
  const profile = member.profile;
  const name = profile?.name || 'Convidado';
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const isMe = member.user_id === currentUserId;
  const busy = busyId === member.id;
  const canChangeRole = isOwner && !isMe && member.status === 'active' && member.role !== 'owner';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 2px 11px 0', borderTop: '1px solid var(--p-border)',
      flexWrap: 'wrap',
    }}>
      {profile?.photo_url ? (
        <img src={profile.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--p-primary-soft)', border: '1px solid var(--p-primary-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: 'var(--p-primary)',
        }}>
          {initials}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--p-text)' }}>
          {name}
          {isMe && <span style={{ color: 'var(--p-muted)', fontWeight: 500 }}> · você</span>}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--p-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
          {ROLE_LABEL[member.role] || 'Membro'}
          {member.status === 'pending' && ' · Aguardando'}
        </div>
      </div>

      {canChangeRole && (
        <select
          value={member.role}
          onChange={(e) => onChangeRole(member.id, e.target.value)}
          disabled={busy}
          aria-label={`Alterar cargo de ${name}`}
          style={{
            padding: '7px 10px', borderRadius: 9,
            background: 'var(--p-input-bg)', border: '1px solid var(--p-border)',
            color: 'var(--p-text)', fontSize: '0.76rem', fontFamily: FONT,
            outline: 'none', cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <option value="member">Membro</option>
          <option value="admin">Admin / Gestor</option>
        </select>
      )}

      {isOwner && member.status === 'pending' && (
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={() => onApprove(member.id)} disabled={busy} style={{
            padding: '6px 12px', borderRadius: 9, background: 'var(--p-primary)',
            border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1,
          }}>Aceitar</button>
          <button onClick={() => onReject(member.id)} disabled={busy} style={{
            padding: '6px 12px', borderRadius: 9, background: 'transparent',
            border: '1px solid var(--p-border)', color: 'var(--p-muted)',
            fontSize: '0.75rem', fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            fontFamily: FONT, opacity: busy ? 0.6 : 1,
          }}>Recusar</button>
        </div>
      )}

      {isOwner && member.status === 'active' && member.role !== 'owner' && (
        <button onClick={() => onReject(member.id)} disabled={busy} style={{
          padding: '6px 12px', borderRadius: 9, background: 'transparent',
          border: '1px solid rgba(220,38,38,0.25)', color: 'rgba(220,38,38,0.75)',
          fontSize: '0.75rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          fontFamily: FONT, opacity: busy ? 0.6 : 1, transition: 'all 0.12s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.45)'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)'; e.currentTarget.style.color = 'rgba(220,38,38,0.75)'; }}
        >
          Remover
        </button>
      )}
    </div>
  );
}

// ─── Chooser (no company) ─────────────────────────────────────────────────────

function Chooser({ onCreate, onJoin }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      border: '1.5px dashed var(--p-border2)', borderRadius: 16,
      background: 'var(--p-surface2)',
    }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: 1.5, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
        Sem empresa vinculada
      </span>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 8, color: 'var(--p-text)' }}>
        Configure sua empresa
      </h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--p-muted)', maxWidth: 440, margin: '0 auto 22px', lineHeight: 1.55 }}>
        Crie uma empresa para gerenciar sua operação ou ingresse em uma existente com o código fornecido pelo dono.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={onCreate} style={{
          padding: '10px 20px', background: 'var(--p-primary)', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: '0.88rem', fontWeight: 700,
          cursor: 'pointer', fontFamily: FONT,
        }}>Criar empresa</button>
        <button onClick={onJoin} style={{
          padding: '10px 20px', background: 'transparent',
          border: '1px solid var(--p-border2)', borderRadius: 10,
          color: 'var(--p-text)', fontSize: '0.88rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: FONT,
        }}>Ingressar com código</button>
      </div>
    </div>
  );
}

// ─── InlineForm ───────────────────────────────────────────────────────────────

function InlineForm({ mode, busy, onSubmit, onCancel }) {
  const [value, setValue] = useState('');
  const isCreate = mode === 'create';
  const submit = (e) => { e.preventDefault(); if (!busy && value.trim()) onSubmit(value.trim()); };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: 1, color: 'var(--p-muted)', textTransform: 'uppercase' }}>
        {isCreate ? 'Nome da empresa' : 'Código da empresa'}
      </label>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(isCreate ? e.target.value : e.target.value.toUpperCase())}
        placeholder={isCreate ? 'Ex.: Noratech' : 'Ex.: A2K9PX'}
        maxLength={isCreate ? 80 : 12}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          background: 'var(--p-input-bg)', border: '1px solid var(--p-border)',
          color: 'var(--p-text)', fontSize: isCreate ? '0.92rem' : '1.1rem',
          fontFamily: isCreate ? FONT : FONT_MONO,
          letterSpacing: isCreate ? 'normal' : 3, textAlign: isCreate ? 'left' : 'center',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      <p style={{ fontSize: '0.82rem', color: 'var(--p-muted)', lineHeight: 1.55 }}>
        {isCreate
          ? 'Você receberá um código único para convidar membros. Apenas você poderá aprovar ingressos.'
          : 'Sua solicitação ficará pendente até o dono da empresa aprovar o ingresso.'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={{
          padding: '9px 16px', background: 'transparent',
          border: '1px solid var(--p-border)', borderRadius: 10,
          color: 'var(--p-muted)', fontSize: '0.85rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: FONT,
        }}>Cancelar</button>
        <button type="submit" disabled={busy || !value.trim()} style={{
          padding: '9px 18px', background: 'var(--p-primary)', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: '0.85rem', fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: FONT,
          opacity: busy || !value.trim() ? 0.65 : 1,
        }}>
          {busy ? (isCreate ? 'Criando…' : 'Enviando…') : (isCreate ? 'Criar empresa' : 'Solicitar ingresso')}
        </button>
      </div>
    </form>
  );
}

// ─── PendingCard ──────────────────────────────────────────────────────────────

function PendingCard({ company, onCancel, busy }) {
  return (
    <div style={{
      padding: '28px 22px', borderRadius: 16,
      border: '1px solid var(--p-border)', background: 'var(--p-surface2)',
    }}>
      <span style={{
        display: 'inline-block', fontSize: '0.65rem', fontWeight: 800, letterSpacing: 1.4,
        color: '#d97706', textTransform: 'uppercase',
        padding: '3px 10px', border: '1px solid rgba(245,158,11,0.3)',
        background: 'rgba(245,158,11,0.08)', borderRadius: 6, marginBottom: 14,
      }}>
        Aguardando aprovação
      </span>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 6, color: 'var(--p-text)' }}>
        {company.name}
      </h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--p-muted)', marginBottom: 18, lineHeight: 1.5 }}>
        Sua solicitação foi enviada. Você terá acesso assim que o dono aprovar.
      </p>
      <button onClick={onCancel} disabled={busy} style={{
        padding: '8px 16px', background: 'transparent',
        border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10,
        color: 'rgba(220,38,38,0.75)', fontSize: '0.85rem', fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1,
      }}>
        Cancelar solicitação
      </button>
    </div>
  );
}

// ─── InlineModal (for create/join forms inside the panel) ─────────────────────

function InlineModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 15000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460,
        background: 'var(--p-surface)', border: '1px solid var(--p-border)',
        borderRadius: 18, overflow: 'hidden',
        maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--p-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--p-text)' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={{
            background: 'transparent', border: 'none', color: 'var(--p-muted)',
            fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CockpitCompany({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [openModal, setOpenModal] = useState(null); // 'create' | 'join'
  const [busy, setBusy] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [toast, setToast] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchMyCompany();
      setData(result);
      setLogoUrl(result?.company?.logo_url || null);
      if (result?.membership?.status === 'active') {
        const list = await fetchCompanyMembers(result.company.id);
        setMembers(list);
      } else {
        setMembers([]);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar empresa', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = useCallback(async (name) => {
    try { setBusy(true); await createCompany(name); setOpenModal(null); showToast('Empresa criada!'); await refresh(); }
    catch (err) { showToast(err.message || 'Erro ao criar empresa', 'error'); }
    finally { setBusy(false); }
  }, [refresh, showToast]);

  const handleJoin = useCallback(async (code) => {
    try { setBusy(true); await requestJoinCompany(code); setOpenModal(null); showToast('Solicitação enviada! Aguarde aprovação.'); await refresh(); }
    catch (err) { showToast(err.message || 'Erro ao solicitar ingresso', 'error'); }
    finally { setBusy(false); }
  }, [refresh, showToast]);

  const handleApprove = useCallback(async (memberId) => {
    try { setBusyMemberId(memberId); await approveMember(memberId); showToast('Membro aprovado.'); await refresh(); }
    catch (err) { showToast(err.message || 'Erro ao aprovar', 'error'); }
    finally { setBusyMemberId(null); }
  }, [refresh, showToast]);

  const handleReject = useCallback(async (memberId) => {
    try { setBusyMemberId(memberId); await rejectMember(memberId); showToast('Membro removido.'); await refresh(); }
    catch (err) { showToast(err.message || 'Erro ao remover', 'error'); }
    finally { setBusyMemberId(null); }
  }, [refresh, showToast]);

  const handleChangeRole = useCallback(async (memberId, role) => {
    const member = members.find((m) => m.id === memberId);
    if (!member || member.user_id === user?.id || member.role === 'owner') {
      showToast('Não é possível alterar o cargo do dono.', 'error'); return;
    }
    if (!['admin', 'member'].includes(role)) { showToast('Cargo inválido.', 'error'); return; }
    try {
      setBusyMemberId(memberId);
      const updated = await setMemberRole(memberId, role);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...updated } : m)));
      showToast(role === 'admin' ? 'Cargo: Admin / Gestor.' : 'Cargo: Membro.');
      await refresh();
    } catch (err) { showToast(err.message || 'Erro ao alterar cargo', 'error'); }
    finally { setBusyMemberId(null); }
  }, [members, refresh, showToast, user?.id]);

  const handleLeave = useCallback(async () => {
    if (!data?.company) return;
    try { setBusy(true); await leaveCompany(data.company.id); showToast('Você saiu da empresa.'); await refresh(); }
    catch (err) { showToast(err.message || 'Erro ao sair', 'error'); }
    finally { setBusy(false); }
  }, [data, refresh, showToast]);

  const isOwner = useMemo(() => data?.membership?.role === 'owner', [data]);
  const isAdmin = useMemo(() => ['owner', 'admin'].includes(data?.membership?.role), [data]);
  const pendingMembers = useMemo(() => members.filter((m) => m.status === 'pending'), [members]);
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        padding: '40px 24px', textAlign: 'center',
        color: 'var(--p-muted)', fontSize: '0.9rem', fontFamily: FONT,
      }}>
        Carregando empresa…
      </div>
    );
  }

  // ── No company ──
  if (!data) {
    return (
      <>
        <Chooser onCreate={() => setOpenModal('create')} onJoin={() => setOpenModal('join')} />
        <InlineModal open={openModal === 'create'} onClose={() => !busy && setOpenModal(null)} title="Criar empresa">
          <InlineForm mode="create" busy={busy} onSubmit={handleCreate} onCancel={() => setOpenModal(null)} />
        </InlineModal>
        <InlineModal open={openModal === 'join'} onClose={() => !busy && setOpenModal(null)} title="Ingressar em uma empresa">
          <InlineForm mode="join" busy={busy} onSubmit={handleJoin} onCancel={() => setOpenModal(null)} />
        </InlineModal>
        <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      </>
    );
  }

  // ── Pending ──
  if (data.membership.status === 'pending') {
    return (
      <>
        <PendingCard company={data.company} onCancel={handleLeave} busy={busy} />
        <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      </>
    );
  }

  // ── Active member ──
  const companyWithLogo = { ...data.company, logo_url: logoUrl };

  return (
    <>
      {/* ── Logo / Identidade visual (owner only) ── */}
      {isOwner && (
        <CompanyLogoSection
          company={companyWithLogo}
          isOwner={isOwner}
          onLogoUpdate={setLogoUrl}
          showToast={showToast}
        />
      )}

      {/* ── Company header + stats ── */}
      <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--p-border)' }}>
        {/* eyebrow + name */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            display: 'inline-block',
            fontSize: '0.58rem', fontWeight: 800, letterSpacing: 1.6,
            color: 'var(--p-primary)', textTransform: 'uppercase',
            marginBottom: 5,
          }}>
            Empresa · {ROLE_LABEL[data.membership?.role] || 'Membro'}
          </span>
          <h3 style={{
            fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.5,
            color: 'var(--p-text)', lineHeight: 1.15, margin: 0,
          }}>
            {data.company.name}
          </h3>
        </div>

        {/* Stats cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 9 }}>
          {/* Code stat */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--p-surface2)', border: '1px solid var(--p-border)',
          }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: 1.3, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Código de ingresso
            </div>
            <CodePill code={data.company.code} />
            <p style={{ fontSize: '0.68rem', color: 'var(--p-muted)', marginTop: 7, lineHeight: 1.4 }}>
              {isAdmin
                ? 'Compartilhe este código com quem quiser ingressar.'
                : 'Use este código para convidar outras pessoas.'}
            </p>
          </div>

          {/* Members stat */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--p-surface2)', border: '1px solid var(--p-border)',
          }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: 1.3, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Membros ativos
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: -0.8, color: 'var(--p-primary)', lineHeight: 1 }}>
              {activeMembers.length}
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--p-muted)', marginTop: 5, lineHeight: 1.4 }}>
              Membros com acesso à organização.
            </p>
          </div>

          {/* Pending stat */}
          {isAdmin && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'var(--p-surface2)', border: '1px solid var(--p-border)',
            }}>
              <div style={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: 1.3, color: 'var(--p-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Solicitações pendentes
              </div>
              <div style={{
                fontSize: '1.75rem', fontWeight: 800, letterSpacing: -0.8, lineHeight: 1,
                color: pendingMembers.length > 0 ? '#d97706' : 'var(--p-muted)',
              }}>
                {pendingMembers.length}
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--p-muted)', marginTop: 5, lineHeight: 1.4 }}>
                Solicitações de ingresso aguardando aprovação.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Pending requests ── */}
      {isAdmin && pendingMembers.length > 0 && (
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--p-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.4, color: '#d97706', textTransform: 'uppercase' }}>
              Solicitações de ingresso
            </div>
            <span style={{
              fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6,
              background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.28)', color: '#d97706',
            }}>{pendingMembers.length}</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--p-muted)', marginBottom: 4, lineHeight: 1.45 }}>
            Aprove ou recuse quem solicitou acesso à sua empresa.
          </p>
          {pendingMembers.map((m) => (
            <MemberRow key={m.id} member={m} currentUserId={user?.id} isOwner={isAdmin}
              onApprove={handleApprove} onReject={handleReject} onChangeRole={handleChangeRole} busyId={busyMemberId} />
          ))}
        </div>
      )}

      {/* ── Members list ── */}
      <div style={{ padding: '18px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.4, color: 'var(--p-muted)', textTransform: 'uppercase' }}>
            Membros
          </div>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--p-muted)', marginBottom: 6, lineHeight: 1.45 }}>
          {activeMembers.length === 1 ? '1 pessoa nesta empresa.' : `${activeMembers.length} pessoas nesta empresa.`}
        </p>
        {activeMembers.map((m) => (
          <MemberRow key={m.id} member={m} currentUserId={user?.id} isOwner={isAdmin}
            onApprove={handleApprove} onReject={handleReject} onChangeRole={handleChangeRole} busyId={busyMemberId} />
        ))}
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  );
}
