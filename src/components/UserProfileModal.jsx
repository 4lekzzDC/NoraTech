// Modal de perfil do usuário — único na aplicação.
//
// Antes existiam duas cópias divergentes: uma em AreaDoClientePage (com tema
// claro/escuro) e outra em UserProfileMenu (só escura, sem as abas de conta e
// contato). Agora as duas entradas — o card "Meu perfil" do dashboard e o menu
// do avatar no topo — renderizam este mesmo componente.
//
// O tema vem do contexto (useTheme), não de prop: assim qualquer chamador
// recebe o modal já correto sem precisar saber disso.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';
import { COMPANY_ROLE_LABEL } from '../lib/companies';
import {
  EMPTY_CONTACT, fetchProfileContact, saveProfileContact,
  formatPhone, formatZip, isValidPhone, isValidZip, lookupZip,
} from '../lib/profileContacts';

const PRESENCE = {
  online:    { label: 'Online',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   bd: 'rgba(34,197,94,0.26)'   },
  busy:      { label: 'Ocupado',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.28)'   },
  away:      { label: 'Ausente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.3)'   },
  invisible: { label: 'Invisível', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', bd: 'rgba(156,163,175,0.28)' },
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
      {/* 18px: a badge agora fica em linha com o nome da equipe (0.88rem) —
          nos 26px do antigo card "Badges" ela ficava quase o dobro do texto. */}
      <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6, #22c55e)', boxShadow: '0 0 10px rgba(139,92,246,0.38)', cursor: 'default' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Campos reutilizados pelas abas do perfil ─────────────────────────────────

// `half`: campo solto que ocupa só a largura de uma coluna do .pf-grid2, para
// alinhar com os campos que vêm em par (e não esticar de ponta a ponta).
function Field({ label, hint, children, span, half }) {
  return (
    <label className={half ? 'pf-field-half' : undefined}
      style={{ display: 'grid', gap: 5, gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      <span className="pf-label">{label}</span>
      {children}
      {hint && <span className="pf-hint">{hint}</span>}
    </label>
  );
}

function SectionCard({ title, desc, children, footer }) {
  return (
    <div className="pf-section">
      <div style={{ marginBottom: 14 }}>
        <div className="pf-section-title">{title}</div>
        {desc && <p className="pf-section-desc">{desc}</p>}
      </div>
      {children}
      {footer}
    </div>
  );
}

// ─── Aba "Conta": e-mail, confirmação e senha ─────────────────────────────────

function AccountTab({ user, onNotify }) {
  const { updateProfile, changePassword, resendEmailConfirmation } = useAuth();
  const [busy, setBusy] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });

  const emailDirty = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();

  const handleResend = async () => {
    try {
      setBusy('resend');
      await resendEmailConfirmation();
      onNotify({ type: 'success', text: 'E-mail de confirmação reenviado. Verifique sua caixa de entrada.' });
    } catch (err) {
      onNotify({ type: 'error', text: err.message || 'Não foi possível reenviar o e-mail.' });
    } finally { setBusy(''); }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      onNotify({ type: 'error', text: 'Informe um e-mail válido.' });
      return;
    }
    try {
      setBusy('email');
      await updateProfile({ email: next });
      onNotify({ type: 'success', text: 'Enviamos um link de confirmação para o novo e-mail. A troca só vale após confirmar.' });
    } catch (err) {
      onNotify({ type: 'error', text: err.message || 'Não foi possível alterar o e-mail.' });
    } finally { setBusy(''); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (pwd.next.length < 8) {
      onNotify({ type: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      onNotify({ type: 'error', text: 'A confirmação não confere com a nova senha.' });
      return;
    }
    try {
      setBusy('password');
      await changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      onNotify({ type: 'success', text: 'Senha alterada com sucesso.' });
    } catch (err) {
      onNotify({ type: 'error', text: err.message || 'Não foi possível alterar a senha.' });
    } finally { setBusy(''); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionCard
        title="E-mail de acesso"
        desc="É com ele que você entra na plataforma e recebe avisos de cobrança."
      >
        <div className="pf-status-line">
          {user?.emailVerified ? (
            <span className="pf-chip pf-chip-ok">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              E-mail confirmado
            </span>
          ) : (
            <>
              <span className="pf-chip pf-chip-warn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
                E-mail não confirmado
              </span>
              <button type="button" className="pf-btn-ghost" onClick={handleResend} disabled={busy === 'resend'}>
                {busy === 'resend' ? 'Enviando...' : 'Reenviar confirmação'}
              </button>
            </>
          )}
        </div>

        {/* Botão em linha com o campo (não embaixo, alinhado à direita): com o
            input em meia largura, um botão "flex-end" ficava boiando sozinho
            no vão vazio da direita, sem relação visual com o campo. */}
        <form onSubmit={handleEmail} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Field label="Endereço de e-mail" half>
            <input type="email" className="pf-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
          </Field>
          <button type="submit" className="pf-btn-primary" disabled={!emailDirty || busy === 'email'}>
            {busy === 'email' ? 'Enviando...' : 'Alterar e-mail'}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Senha" desc="Use pelo menos 8 caracteres. Confirmamos sua senha atual antes de trocar.">
        <form onSubmit={handlePassword} style={{ display: 'grid', gap: 12 }}>
          <Field label="Senha atual" half>
            <input type="password" className="pf-input" autoComplete="current-password" value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="••••••••" />
          </Field>
          <div className="pf-grid2">
            <Field label="Nova senha">
              <input type="password" className="pf-input" autoComplete="new-password" value={pwd.next}
                onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="••••••••" />
            </Field>
            <Field label="Confirmar nova senha">
              <input type="password" className="pf-input" autoComplete="new-password" value={pwd.confirm}
                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" />
            </Field>
          </div>
          {/* Alinhado à esquerda, sob os campos: o botão depende dos três
              campos (não de um só), então não faz sentido colado a nenhum
              deles — mas "flex-end" o jogava sozinho no vão vazio à direita,
              sem nenhuma relação visual com o formulário. */}
          <button type="submit" className="pf-btn-primary" style={{ justifySelf: 'start' }} disabled={!pwd.current || !pwd.next || busy === 'password'}>
            {busy === 'password' ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}

// ─── Aba "Contato": telefone e endereço ───────────────────────────────────────

const UF_LIST = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function ContactTab({ user, onNotify }) {
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchProfileContact(user.id);
        if (active) setContact(data);
      } catch (err) {
        if (active) onNotify({ type: 'error', text: err.message || 'Não foi possível carregar seus dados de contato.' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id, onNotify]);

  const set = (key) => (e) => setContact((c) => ({ ...c, [key]: e.target.value }));

  // Ao completar o CEP, preenche o endereço automaticamente (ViaCEP).
  const handleZip = async (e) => {
    const masked = formatZip(e.target.value);
    setContact((c) => ({ ...c, addressZip: masked }));
    if (masked.replace(/\D/g, '').length !== 8) return;
    setZipBusy(true);
    const found = await lookupZip(masked);
    setZipBusy(false);
    if (found) setContact((c) => ({ ...c, ...found }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPhone(contact.phone)) {
      onNotify({ type: 'error', text: 'Telefone incompleto. Use DDD + número.' });
      return;
    }
    if (!isValidZip(contact.addressZip)) {
      onNotify({ type: 'error', text: 'CEP incompleto. Use 8 dígitos.' });
      return;
    }
    try {
      setSaving(true);
      await saveProfileContact(user.id, contact);
      onNotify({ type: 'success', text: 'Dados de contato salvos.' });
    } catch (err) {
      onNotify({ type: 'error', text: err.message || 'Não foi possível salvar seus dados.' });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="pf-section" style={{ textAlign: 'center' }}><span className="pf-hint">Carregando seus dados...</span></div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <SectionCard title="Telefone" desc="Usamos para contato sobre suporte e cobranças. Nunca é exibido para outros clientes.">
        <Field label="Celular / WhatsApp" half>
          <input type="tel" className="pf-input" value={contact.phone}
            onChange={(e) => setContact((c) => ({ ...c, phone: formatPhone(e.target.value) }))}
            placeholder="(11) 91234-5678" />
        </Field>
      </SectionCard>

      <SectionCard title="Endereço" desc="Preencha o CEP que o resto vem automático.">
        <div className="pf-grid2">
          <Field label="CEP" hint={zipBusy ? 'Buscando endereço...' : null}>
            <input className="pf-input" value={contact.addressZip} onChange={handleZip} placeholder="01310-100" inputMode="numeric" />
          </Field>
          <Field label="Número">
            <input className="pf-input" value={contact.addressNumber} onChange={set('addressNumber')} placeholder="1000" />
          </Field>
          <Field label="Logradouro" span={2}>
            <input className="pf-input" value={contact.addressStreet} onChange={set('addressStreet')} placeholder="Av. Paulista" />
          </Field>
          <Field label="Complemento">
            <input className="pf-input" value={contact.addressComplement} onChange={set('addressComplement')} placeholder="Sala 42" />
          </Field>
          <Field label="Bairro">
            <input className="pf-input" value={contact.addressDistrict} onChange={set('addressDistrict')} placeholder="Bela Vista" />
          </Field>
          <Field label="Cidade">
            <input className="pf-input" value={contact.addressCity} onChange={set('addressCity')} placeholder="São Paulo" />
          </Field>
          <Field label="Estado">
            <select className="pf-input" value={contact.addressState} onChange={set('addressState')}>
              <option value="">—</option>
              {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="pf-btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar dados de contato'}
        </button>
      </div>
    </form>
  );
}

// ─── UserProfileModal ─────────────────────────────────────────────────────────

const PROFILE_TABS = [
  { key: 'perfil',  label: 'Perfil' },
  { key: 'conta',   label: 'Conta' },
  { key: 'contato', label: 'Contato' },
];

export default function UserProfileModal({ user, companyInfo, initials, onClose, onUserUpdate }) {
  const { theme } = useTheme();
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
  const [tab, setTab] = useState('perfil');
  // Estável: ContactTab usa onNotify numa dependência de useEffect.
  const notify = useCallback((msg) => setMessage(msg), []);
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
        // 760px e não os 640px originais: a aba "Conta" empilha formulários
        // (e-mail + senha em duas colunas) que ficavam espremidos e altos
        // demais na largura pensada só para a aba "Perfil".
        //
        // Coluna flex com overflow hidden: quem rola é só o painel da aba
        // (ver adiante). Antes o <section> inteiro rolava, então para chegar
        // no botão de salvar da aba "Conta" era preciso rolar o banner, o
        // avatar e as próprias abas para fora da tela.
        style={{ width: 'min(760px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: C.panelBg, border: `1px solid ${C.panelBorder}`, borderRadius: 20, boxShadow: '0 28px 90px rgba(0,0,0,0.78)', overflow: 'hidden', color: C.text, position: 'relative', fontFamily: "'Inter', sans-serif" }}>
        <style>{`
          .profile-avatar-edit .profile-avatar-overlay, .profile-banner-edit .profile-banner-overlay { opacity: 0; transition: opacity 0.18s ease; }
          .profile-avatar-edit:hover .profile-avatar-overlay, .profile-avatar-edit:focus-visible .profile-avatar-overlay,
          .profile-banner-edit:hover .profile-banner-overlay, .profile-banner-edit:focus-visible .profile-banner-overlay { opacity: 1; }

          .pf-tabs { display:flex; gap:4px; border-bottom:1px solid ${C.sectionBd}; margin-top:18px; }
          .pf-tab { position:relative; padding:10px 14px; background:transparent; border:none; border-bottom:2px solid transparent; color:${C.muted}; font-family:inherit; font-size:.85rem; font-weight:700; cursor:pointer; transition:color .15s, border-color .15s; }
          .pf-tab:hover { color:${C.text}; }
          .pf-tab[data-active="true"] { color:#a78bfa; border-bottom-color:#a78bfa; }

          .pf-section { background:${C.sectionBg}; border:1px solid ${C.sectionBd}; border-radius:14px; padding:16px; }
          .pf-section-title { font-size:.86rem; font-weight:800; color:${C.text}; letter-spacing:-.2px; }
          .pf-section-desc { font-size:.76rem; color:${C.muted}; line-height:1.5; margin-top:3px; }
          .pf-label { font-size:.7rem; font-weight:800; color:${C.gridLabel}; letter-spacing:1px; text-transform:uppercase; }
          .pf-hint { font-size:.72rem; color:${C.muted}; }
          .pf-grid2 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; }
          /* mesma largura de uma coluna do .pf-grid2 (metade menos o gap) */
          .pf-field-half { max-width:calc((100% - 12px) / 2); }

          .pf-input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid ${C.inputBd}; background:${C.inputBg}; color:${C.inputColor}; outline:none; font-family:inherit; font-size:.86rem; transition:border-color .15s; }
          .pf-input:focus { border-color:rgba(124,58,237,.55); }
          .pf-input option { background:${C.popupBg}; color:${C.inputColor}; }

          .pf-btn-primary { padding:9px 15px; border-radius:10px; border:1px solid rgba(124,58,237,.34); background:rgba(124,58,237,.16); color:#c4b5fd; font-family:inherit; font-size:.82rem; font-weight:800; cursor:pointer; transition:filter .15s; }
          .pf-btn-primary:hover:not(:disabled) { filter:brightness(1.22); }
          .pf-btn-primary:disabled { opacity:.45; cursor:not-allowed; }
          .pf-btn-ghost { padding:7px 12px; border-radius:9px; border:1px solid ${C.cancelBd}; background:transparent; color:${C.cancelCol}; font-family:inherit; font-size:.78rem; font-weight:700; cursor:pointer; transition:all .15s; }
          .pf-btn-ghost:hover:not(:disabled) { border-color:rgba(124,58,237,.4); color:#a78bfa; }
          .pf-btn-ghost:disabled { opacity:.5; cursor:wait; }

          .pf-status-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
          .pf-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:.74rem; font-weight:800; }
          .pf-chip-ok { background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.28); color:#22c55e; }
          .pf-chip-warn { background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.3); color:#f59e0b; }

          @media (max-width:560px) { .pf-grid2 { grid-template-columns:minmax(0,1fr); } .pf-field-half { max-width:none; } }
        `}</style>
        <button type="button" onClick={onClose} aria-label="Fechar perfil"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.closeBd}`, background: C.closeBg, color: C.closeColor, cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>

        {/* 120px e não 156px: o banner era o maior consumidor de altura do
            modal e empurrava o botão de salvar da aba "Conta" para fora da
            área visível em telas de 900px. */}
        <div className="profile-banner-edit" style={{ height: 120, flexShrink: 0, borderBottom: `1px solid ${C.bannerBd}`, position: 'relative', overflow: 'hidden', cursor: 'pointer', ...bannerStyle }}>
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

        {/* padding-bottom vai para o painel rolável, senão sobraria um vão
            morto embaixo da barra de rolagem. */}
        <div style={{ padding: '0 28px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: -46, flexShrink: 0, flexWrap: 'wrap' }}>
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

          <div style={{ marginTop: 18, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.55rem', fontWeight: 850, letterSpacing: -0.6, lineHeight: 1.1, color: C.text }}>{user?.name || 'Usuário'}</h2>
                {/* alignItems center (e não o baseline da linha) para a badge
                    centralizar na altura do texto da equipe, não sentar nele. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: '#a78bfa', fontSize: '0.88rem', fontWeight: 700 }}>{companyName}</span>
                  {user?.emailVerified && <VerifiedBadge />}
                </span>
              </div>
              <div style={{ marginTop: 6, color: C.muted, fontSize: '0.9rem' }}>{user?.email}</div>
            </div>

            <div className="pf-tabs" role="tablist">
              {PROFILE_TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                  className="pf-tab" data-active={tab === t.key}
                  onClick={() => { setTab(t.key); setMessage(null); }}>
                  {t.label}
                </button>
              ))}
            </div>

            {message && (
              <div style={{ marginTop: 16, flexShrink: 0, padding: '11px 13px', borderRadius: 12, background: message.type === 'error' ? 'rgba(255,80,80,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${message.type === 'error' ? 'rgba(255,80,80,0.24)' : 'rgba(34,197,94,0.24)'}`, color: message.type === 'error' ? '#ff9ab4' : '#86efac', fontSize: '0.82rem', fontWeight: 700 }}>
                {message.text}
              </div>
            )}

            <div style={{ marginTop: 16, flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 28 }}>
              {tab === 'perfil' && (
                <div style={{ display: 'grid', gap: 16 }}>
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
              )}

              {tab === 'conta' && <AccountTab user={user} onNotify={notify} />}
              {tab === 'contato' && <ContactTab user={user} onNotify={notify} />}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
