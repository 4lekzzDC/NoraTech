import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AdminLayout, { Card, Spinner, EmptyState } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logAccess } from '../../lib/logAccess';

// ─────────────────────────────────────────────────────────────────────────────
// Theme palette
// ─────────────────────────────────────────────────────────────────────────────

function getModalPalette(theme) {
  const dark = {
    bg:               '#101015',
    sidebar:          '#0d0d12',
    surface:          'rgba(255,255,255,0.025)',
    surfaceHover:     'rgba(255,255,255,0.04)',
    border:           'rgba(255,255,255,0.08)',
    borderDiv:        'rgba(255,255,255,0.07)',
    text:             '#eeede9',
    muted:            'rgba(255,255,255,0.45)',
    muted2:           'rgba(255,255,255,0.3)',
    label:            'rgba(255,255,255,0.35)',
    inputBg:          'rgba(255,255,255,0.04)',
    inputBorder:      'rgba(255,255,255,0.09)',
    inputText:        '#eeede9',
    overlay:          'rgba(0,0,0,0.72)',
    primary:          '#7C3AED',
    primarySoft:      'rgba(124,58,237,0.15)',
    primaryText:      '#a78bfa',
    primaryBorder:    'rgba(124,58,237,0.35)',
    tabActive:        '#eeede9',
    tabInactive:      'rgba(255,255,255,0.42)',
    shadow:           '0 32px 80px rgba(0,0,0,0.65)',
    cardActiveBorder: 'rgba(124,58,237,0.4)',
    cardActiveHover:  'rgba(124,58,237,0.07)',
    dangerBg:         'rgba(255,107,107,0.05)',
    dangerBorder:     'rgba(255,107,107,0.18)',
    dangerIconBg:     'rgba(255,107,107,0.14)',
    danger:           '#ff6b6b',
    success:          '#00d48a',
    successBg:        'rgba(0,212,138,0.12)',
    successBorder:    'rgba(0,212,138,0.28)',
    failBg:           'rgba(255,107,107,0.12)',
    failBorder:       'rgba(255,107,107,0.28)',
    codeBg:           'rgba(255,255,255,0.07)',
    btnBg:            'rgba(255,255,255,0.06)',
    btnBorder:        'rgba(255,255,255,0.1)',
    btnText:          '#eeede9',
    sidebarCard:      'rgba(255,255,255,0.035)',
    sidebarBorder:    'rgba(255,255,255,0.08)',
    infoBg:           'rgba(37,99,235,0.12)',
    infoText:         '#60a5fa',
    infoBorder:       'rgba(37,99,235,0.28)',
    warnBg:           'rgba(245,158,11,0.08)',
    warnBorder:       'rgba(245,158,11,0.2)',
    warnText:         'rgba(245,158,11,0.9)',
  };
  const light = {
    bg:               '#ffffff',
    sidebar:          '#f5f4f8',
    surface:          '#f9f8fc',
    surfaceHover:     '#f0eef8',
    border:           'rgba(0,0,0,0.08)',
    borderDiv:        'rgba(0,0,0,0.07)',
    text:             '#111827',
    muted:            'rgba(0,0,0,0.5)',
    muted2:           'rgba(0,0,0,0.35)',
    label:            'rgba(0,0,0,0.4)',
    inputBg:          '#f3f4f6',
    inputBorder:      'rgba(0,0,0,0.12)',
    inputText:        '#111827',
    overlay:          'rgba(0,0,0,0.45)',
    primary:          '#7C3AED',
    primarySoft:      'rgba(124,58,237,0.1)',
    primaryText:      '#6d28d9',
    primaryBorder:    'rgba(124,58,237,0.35)',
    tabActive:        '#111827',
    tabInactive:      'rgba(0,0,0,0.4)',
    shadow:           '0 24px 60px rgba(0,0,0,0.18)',
    cardActiveBorder: 'rgba(124,58,237,0.35)',
    cardActiveHover:  'rgba(124,58,237,0.05)',
    dangerBg:         'rgba(220,38,38,0.04)',
    dangerBorder:     'rgba(220,38,38,0.15)',
    dangerIconBg:     'rgba(220,38,38,0.1)',
    danger:           '#dc2626',
    success:          '#059669',
    successBg:        'rgba(5,150,105,0.1)',
    successBorder:    'rgba(5,150,105,0.25)',
    failBg:           'rgba(220,38,38,0.1)',
    failBorder:       'rgba(220,38,38,0.25)',
    codeBg:           'rgba(0,0,0,0.05)',
    btnBg:            '#f3f4f6',
    btnBorder:        'rgba(0,0,0,0.12)',
    btnText:          '#374151',
    sidebarCard:      '#ffffff',
    sidebarBorder:    'rgba(0,0,0,0.09)',
    infoBg:           'rgba(37,99,235,0.07)',
    infoText:         '#2563eb',
    infoBorder:       'rgba(37,99,235,0.2)',
    warnBg:           'rgba(245,158,11,0.07)',
    warnBorder:       'rgba(245,158,11,0.2)',
    warnText:         '#92400e',
  };
  return theme === 'light' ? light : dark;
}

const ModalThemeCtx = createContext(null);
const useMP = () => useContext(ModalThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFullProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data || null;
}

async function fetchAccessLogs(userId) {
  const { data, error } = await supabase
    .from('access_logs')
    .select('id, action, ip, device, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return error ? [] : (data || []);
}

/**
 * Calls the admin-get-user Edge Function to retrieve auth.users data
 * (email, last_sign_in_at, email_confirmed_at, created_at) for a given userId.
 * Returns null if the function is unavailable or the request fails.
 */
async function fetchUserFromAuth(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-get-user', {
      body: { user_id: userId },
    });
    if (error) {
      console.warn('[admin-get-user]', error.message);
      return null;
    }
    if (data?.error) {
      console.warn('[admin-get-user]', data.error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[admin-get-user] unavailable:', err);
    return null;
  }
}

/**
 * Calls the admin-reset-password Edge Function to send a password reset email
 * to the target user without needing their email on the frontend.
 * Returns { ok: boolean, msg: string }.
 */
async function resetPasswordViaAdmin(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { user_id: userId },
    });
    if (error) return { ok: false, msg: error.message || 'Erro ao enviar e-mail.' };
    if (data?.error) return { ok: false, msg: data.error };
    return { ok: true, msg: data?.message || 'E-mail enviado com sucesso!' };
  } catch (err) {
    return { ok: false, msg: 'Não foi possível conectar ao servidor.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, children, style }) {
  const mp = useMP();
  return (
    <div style={{
      background: mp.surface,
      border: `1px solid ${mp.border}`,
      borderRadius: 14,
      padding: '18px 20px',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: '0.7rem', fontWeight: 800, color: mp.label,
          textTransform: 'uppercase', letterSpacing: 1,
          marginBottom: 16,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  const mp = useMP();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.8, color: mp.label, textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ children, action }) {
  const mp = useMP();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: mp.text, margin: 0 }}>{children}</h3>
      {action}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  const mp = useMP();
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? mp.primary : mp.border,
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function ActionFeedback({ state }) {
  const mp = useMP();
  if (!state?.msg) return null;
  return (
    <div style={{ marginTop: 8, fontSize: '0.72rem', color: state.ok ? mp.success : mp.danger, lineHeight: 1.4 }}>
      {state.msg}
    </div>
  );
}

function useInputStyle() {
  const mp = useMP();
  return {
    width: '100%', boxSizing: 'border-box',
    background: mp.inputBg, color: mp.inputText,
    border: `1px solid ${mp.inputBorder}`, borderRadius: 8,
    padding: '8px 12px', fontSize: '0.85rem', outline: 'none',
    transition: 'border-color 0.15s',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Perfil
// ─────────────────────────────────────────────────────────────────────────────

function TabPerfil({ user, setUser, onSwitchTab }) {
  const mp = useMP();
  const inputStyle = useInputStyle();
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const quickActions = [
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
      label: 'Alterar e-mail',
      action: () => onSwitchTab('seguranca'),
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      ),
      label: copied ? 'Copiado!' : 'Copiar ID',
      action: copyId,
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      label: 'Ver logs',
      action: () => onSwitchTab('logs'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <SectionCard title="Informações básicas">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nome completo">
            <input
              style={inputStyle}
              value={user.name || ''}
              onChange={(e) => setUser((u) => ({ ...u, name: e.target.value }))}
              placeholder="Nome do usuário"
            />
          </Field>
          <Field label="E-mail">
            <input
              style={{ ...inputStyle, color: mp.muted, cursor: 'not-allowed' }}
              value={user.email || ''}
              disabled
              placeholder="—"
            />
          </Field>
          <Field label="Empresa">
            <input
              style={{ ...inputStyle, color: mp.muted, cursor: 'not-allowed' }}
              value={user.company || '—'}
              disabled
            />
          </Field>
          <Field label="Role do sistema">
            <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
              <span style={{
                fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: user.role === 'admin' ? mp.primarySoft : mp.surface,
                color: user.role === 'admin' ? mp.primaryText : mp.muted,
                border: `1px solid ${user.role === 'admin' ? mp.primaryBorder : mp.border}`,
              }}>
                {user.role === 'admin' ? '★ Administrador' : 'Usuário padrão'}
              </span>
            </div>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Ações rápidas">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.action}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: copied && a.label === 'Copiado!' ? mp.successBg : mp.btnBg,
                border: `1px solid ${copied && a.label === 'Copiado!' ? mp.successBorder : mp.btnBorder}`,
                color: copied && a.label === 'Copiado!' ? mp.success : mp.btnText,
                borderRadius: 8, padding: '7px 14px',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Detalhes da conta">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'ID do usuário', value: user.id, mono: true, truncate: true },
            { label: 'Última atualização', value: user.updated_at ? formatDate(user.updated_at) : '—' },
            { label: 'Criado em', value: user.created_at ? formatDate(user.created_at) : '—' },
            { label: 'Último acesso', value: user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—' },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: mp.label, marginBottom: 4 }}>
                {row.label}
              </div>
              <div style={{
                fontSize: row.mono ? '0.76rem' : '0.82rem',
                color: mp.muted,
                fontFamily: row.mono ? 'monospace' : 'inherit',
                overflow: row.truncate ? 'hidden' : 'visible',
                textOverflow: row.truncate ? 'ellipsis' : 'clip',
                whiteSpace: row.truncate ? 'nowrap' : 'normal',
              }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Segurança
// ─────────────────────────────────────────────────────────────────────────────

function SecurityActionCard({ icon, title, description, btnLabel, onAction, state, variant }) {
  const mp = useMP();
  const isDanger = variant === 'danger';
  return (
    <div style={{
      padding: '20px 18px', borderRadius: 14,
      border: `1px solid ${isDanger ? mp.dangerBorder : mp.border}`,
      background: isDanger ? mp.dangerBg : mp.surface,
      display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'border-color 0.15s',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: isDanger ? mp.dangerIconBg : mp.primarySoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDanger ? mp.danger : mp.primaryText, fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: 5, color: mp.text }}>{title}</div>
        <div style={{ fontSize: '0.76rem', color: mp.muted, lineHeight: 1.55 }}>{description}</div>
        <ActionFeedback state={state} />
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={state?.loading}
        style={{
          background: isDanger ? mp.dangerBg : mp.btnBg,
          border: `1px solid ${isDanger ? mp.dangerBorder : mp.btnBorder}`,
          color: isDanger ? mp.danger : mp.btnText,
          borderRadius: 8, padding: '7px 0', width: '100%',
          fontSize: '0.82rem', fontWeight: 600,
          cursor: state?.loading ? 'wait' : 'pointer',
          opacity: state?.loading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {state?.loading ? '...' : btnLabel}
      </button>
    </div>
  );
}

function TabSeguranca({ user, actionState, onSendReset, onForceReset, onTerminateSessions }) {
  const mp = useMP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard>
        <SectionTitle>Ações de segurança</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <SecurityActionCard
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            }
            title="Redefinição de senha"
            description="Envia um e-mail com link seguro para o usuário criar uma nova senha."
            btnLabel="Enviar e-mail"
            onAction={onSendReset}
            state={actionState.reset}
          />
          <SecurityActionCard
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            }
            title="Forçar troca de senha"
            description="O usuário deverá redefinir a senha no próximo login ao sistema."
            btnLabel="Forçar troca"
            onAction={onForceReset}
            state={actionState.forceReset}
          />
          <SecurityActionCard
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            }
            title="Encerrar sessões"
            description="Desconecta o usuário de todos os dispositivos. Disponível após configuração de Edge Function."
            btnLabel="Encerrar tudo"
            onAction={onTerminateSessions}
            state={actionState.terminate}
            variant="danger"
          />
        </div>
      </SectionCard>

      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: mp.warnBg, border: `1px solid ${mp.warnBorder}`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mp.warnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: '0.77rem', color: mp.warnText, lineHeight: 1.5 }}>
          "Forçar troca de senha" grava diretamente no banco. "Encerrar sessões" e "Alterar e-mail" requerem uma Edge Function com chave de serviço — ative conforme necessário.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Empresa e permissões
// ─────────────────────────────────────────────────────────────────────────────

const CARGO_OPTIONS = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Gerente',       label: 'Gerente' },
  { value: 'Colaborador',   label: 'Colaborador' },
  { value: 'Financeiro',    label: 'Financeiro' },
  { value: 'RH',            label: 'RH' },
  { value: 'Contador',      label: 'Contador' },
];

const ROLE_OPTIONS = [
  { value: 'user',  label: 'Usuário padrão' },
  { value: 'admin', label: 'Administrador' },
];

const PERMISSIONS = [
  {
    key:   'can_manage_team',
    label: 'Gerenciar equipe',
    desc:  'Adicionar, editar e remover usuários da empresa.',
    icon:  '👥',
  },
  {
    key:   'can_manage_subscriptions',
    label: 'Gerenciar assinaturas',
    desc:  'Criar, alterar e cancelar assinaturas da empresa.',
    icon:  '📋',
  },
  {
    key:   'can_access_billing',
    label: 'Acessar faturamento',
    desc:  'Visualizar faturas e histórico de pagamentos.',
    icon:  '💳',
  },
  {
    key:   'can_access_admin',
    label: 'Acessar área admin',
    desc:  'Acesso ao painel administrativo do sistema.',
    icon:  '🔑',
  },
];

function PermissionCard({ perm, user, onToggle }) {
  const mp = useMP();
  const active = !!user[perm.key];
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      border: `1px solid ${active ? mp.cardActiveBorder : mp.border}`,
      background: active ? mp.cardActiveHover : mp.surface,
      transition: 'border-color 0.18s, background 0.18s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{perm.icon}</span>
          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: mp.text }}>{perm.label}</span>
        </div>
        <Toggle checked={active} onChange={onToggle} />
      </div>
      <div style={{ fontSize: '0.74rem', color: mp.muted, lineHeight: 1.45, paddingLeft: 24 }}>
        {perm.desc}
      </div>
    </div>
  );
}

function TabEmpresa({ user, setUser, companies, me }) {
  const mp = useMP();

  function handlePermToggle(perm, val) {
    setUser((u) => ({ ...u, [perm.key]: val }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title="Vínculos e cargo">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Empresa vinculada">
            <Dropdown
              searchable freeInput
              value={user.company || ''}
              onChange={(v) => setUser((u) => ({ ...u, company: v }))}
              options={companies.map((c) => ({ value: c.name, label: c.name }))}
              placeholder="Selecione ou digite..."
              emptyText="Nenhuma empresa"
            />
          </Field>
          <Field label="Cargo na empresa">
            <Dropdown
              searchable freeInput
              value={user.job_title || ''}
              onChange={(v) => setUser((u) => ({ ...u, job_title: v }))}
              options={CARGO_OPTIONS}
              placeholder="Selecione ou digite..."
              emptyText="Nenhum cargo"
            />
          </Field>
          <Field label="Role do painel">
            <Dropdown
              value={user.role || 'user'}
              onChange={(v) => setUser((u) => ({ ...u, role: v }))}
              options={ROLE_OPTIONS}
              disabled={user.id === me?.id}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Permissões de acesso">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {PERMISSIONS.map((perm) => (
            <PermissionCard
              key={perm.key}
              perm={perm}
              user={user}
              onToggle={(v) => handlePermToggle(perm, v)}
            />
          ))}
        </div>
      </SectionCard>

      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: mp.warnBg, border: `1px solid ${mp.warnBorder}`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={mp.warnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: '0.77rem', color: mp.warnText, lineHeight: 1.5 }}>
          Alterações de permissão têm efeito imediato após salvar e afetam o acesso do usuário ao sistema.
          Permissões extras requerem colunas adicionais no banco de dados.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Logs de acesso
// ─────────────────────────────────────────────────────────────────────────────

function LogStatusPill({ status }) {
  const mp = useMP();
  const ok = status === 'success';
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      background: ok ? mp.successBg : mp.failBg,
      color: ok ? mp.success : mp.danger,
      border: `1px solid ${ok ? mp.successBorder : mp.failBorder}`,
      whiteSpace: 'nowrap',
    }}>
      {ok ? '✓ Sucesso' : '✕ Falha'}
    </span>
  );
}

function TabLogs({ logs, loading, onRefresh }) {
  const mp = useMP();

  const refreshBtn = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: mp.btnBg, border: `1px solid ${mp.btnBorder}`,
        color: mp.btnText, borderRadius: 8, padding: '5px 12px',
        fontSize: '0.78rem', fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      Atualizar
    </button>
  );

  if (loading) {
    return (
      <SectionCard>
        <SectionTitle action={refreshBtn}>Logs de acesso recentes</SectionTitle>
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      </SectionCard>
    );
  }

  if (logs.length === 0) {
    return (
      <SectionCard>
        <SectionTitle action={refreshBtn}>Logs de acesso recentes</SectionTitle>
        <div style={{
          padding: '36px 20px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: mp.primarySoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={mp.primaryText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: mp.text, marginBottom: 6 }}>
              Nenhum log encontrado
            </div>
            <div style={{ fontSize: '0.78rem', color: mp.muted, lineHeight: 1.55, maxWidth: 320 }}>
              Nenhum log de acesso registrado para este usuário.
              Crie a tabela <code style={{ background: mp.codeBg, padding: '1px 5px', borderRadius: 4, fontSize: '0.74rem' }}>access_logs</code> no
              Supabase para habilitar este recurso.
            </div>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard style={{ padding: 0 }}>
      <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: mp.label, textTransform: 'uppercase', letterSpacing: 1 }}>
          Logs de acesso recentes
        </div>
        {refreshBtn}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: '0.8rem', color: mp.text,
        }}>
          <thead>
            <tr style={{ background: mp.surface }}>
              {['Data / hora', 'Ação', 'IP', 'Dispositivo', 'Status'].map((h) => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: '0.68rem', fontWeight: 700, color: mp.label,
                  textTransform: 'uppercase', letterSpacing: 0.7,
                  borderBottom: `1px solid ${mp.border}`,
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} style={{
                borderBottom: i < logs.length - 1 ? `1px solid ${mp.border}` : 'none',
                transition: 'background 0.1s',
              }}>
                <td style={{ padding: '10px 16px', color: mp.muted, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                  {formatDateTime(log.created_at)}
                </td>
                <td style={{ padding: '10px 16px', color: mp.text }}>{log.action || '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: mp.muted }}>
                  {log.ip || '—'}
                </td>
                <td style={{ padding: '10px 16px', fontSize: '0.76rem', color: mp.muted }}>
                  {log.device || '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <LogStatusPill status={log.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${mp.border}` }}>
        <button
          type="button"
          style={{
            background: 'none', border: 'none', color: mp.primary,
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          Ver todos os logs de acesso
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManageUserModal
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'perfil',    label: 'Perfil' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'empresa',   label: 'Empresa e permissões' },
  { id: 'logs',      label: 'Logs de acesso' },
];

function SidebarMetaRow({ icon, label, value, mono }) {
  const mp = useMP();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: mp.primarySoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: mp.primaryText,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: mp.label, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{
          fontSize: mono ? '0.73rem' : '0.8rem',
          color: mp.text,
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
          lineHeight: 1.4,
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ManageUserModal({
  user, setUser, me, companies,
  activeTab, setActiveTab,
  saving, actionState, logs, loadingLogs,
  onSave, onClose, onDeactivate,
  onSendReset, onForceReset, onTerminateSessions,
  onRefreshLogs,
}) {
  const { theme } = useTheme();
  const mp = getModalPalette(theme);

  const isInactive = user.status === 'inactive';
  const initial    = (user.name || '?').slice(0, 2).toUpperCase();
  const [idCopied, setIdCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(user.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  }

  return (
    <ModalThemeCtx.Provider value={mp}>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: mp.overlay, backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, zIndex: 100,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 1020,
            background: mp.bg, border: `1px solid ${mp.border}`,
            borderRadius: 20, overflow: 'hidden',
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex', flexDirection: 'column',
            boxShadow: mp.shadow,
            color: mp.text,
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '16px 24px', borderBottom: `1px solid ${mp.borderDiv}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: mp.primarySoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: mp.primaryText,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: mp.text }}>Gerenciar usuário</h2>
                <div style={{ fontSize: '0.72rem', color: mp.muted, marginTop: 1 }}>{user.name || user.email || 'Usuário'}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: mp.btnBg, border: `1px solid ${mp.btnBorder}`, color: mp.muted, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <div style={{
              width: 236, flexShrink: 0,
              borderRight: `1px solid ${mp.borderDiv}`,
              background: mp.sidebar,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}>
              {/* Profile card */}
              <div style={{
                margin: 16, padding: '20px 16px',
                background: mp.sidebarCard, border: `1px solid ${mp.sidebarBorder}`,
                borderRadius: 14,
              }}>
                {/* Avatar */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 76, height: 76, borderRadius: '50%',
                    background: mp.primarySoft, border: `2.5px solid ${mp.primaryBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: mp.primaryText, fontSize: '1.4rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden',
                    boxShadow: `0 0 0 4px ${mp.primarySoft}`,
                  }}>
                    {user.photo_url
                      ? <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initial}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, color: mp.text }}>
                      {user.name || '(sem nome)'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: mp.muted, marginTop: 3, wordBreak: 'break-all', lineHeight: 1.4 }}>
                      {user.email || '—'}
                    </div>
                  </div>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: isInactive ? mp.failBg : mp.successBg,
                      color: isInactive ? mp.danger : mp.success,
                      border: `1px solid ${isInactive ? mp.failBorder : mp.successBorder}`,
                    }}>
                      {isInactive ? '● Inativo' : '● Ativo'}
                    </span>
                    {user.role === 'admin' && (
                      <span style={{
                        fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: mp.primarySoft, color: mp.primaryText,
                        border: `1px solid ${mp.primaryBorder}`,
                      }}>
                        ★ Admin
                      </span>
                    )}
                    {user.email_confirmed_at && (
                      <span style={{
                        fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: mp.infoBg, color: mp.infoText,
                        border: `1px solid ${mp.infoBorder}`,
                      }}>
                        ✓ E-mail verificado
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${mp.border}`, paddingTop: 14 }}>
                  {user.company && (
                    <SidebarMetaRow
                      label="Empresa"
                      value={user.company}
                      icon={
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                      }
                    />
                  )}
                  <SidebarMetaRow
                    label="Último acesso"
                    value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Nunca'}
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    }
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: mp.primarySoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: mp.primaryText,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: mp.label, marginBottom: 2 }}>
                          ID do usuário
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: mp.text }}>
                            {user.id.slice(0, 8)}…
                          </span>
                          <button
                            type="button"
                            onClick={copyId}
                            title="Copiar ID completo"
                            style={{
                              background: idCopied ? mp.successBg : 'none',
                              border: 'none', color: idCopied ? mp.success : mp.muted2,
                              cursor: 'pointer', padding: '1px 4px', borderRadius: 4, fontSize: 11, lineHeight: 1,
                            }}
                          >
                            {idCopied ? '✓' : '⧉'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }} />

              {/* Deactivate section */}
              <div style={{ margin: '0 16px 16px', padding: '14px 16px', background: mp.dangerBg, border: `1px solid ${mp.dangerBorder}`, borderRadius: 12 }}>
                <button
                  type="button"
                  onClick={onDeactivate}
                  disabled={user.id === me?.id}
                  title={user.id === me?.id ? 'Não é possível desativar a própria conta' : ''}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, fontSize: '0.8rem', fontWeight: 700, borderRadius: 8,
                    padding: '7px 14px', cursor: user.id === me?.id ? 'not-allowed' : 'pointer',
                    opacity: user.id === me?.id ? 0.5 : 1,
                    background: 'none', border: `1px solid ${mp.dangerBorder}`, color: mp.danger,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  {isInactive ? 'Reativar usuário' : 'Desativar usuário'}
                </button>
                <div style={{ marginTop: 8, fontSize: '0.68rem', color: mp.danger, textAlign: 'center', lineHeight: 1.45, opacity: 0.7 }}>
                  {isInactive
                    ? 'O usuário está atualmente desativado.'
                    : 'O acesso do usuário será bloqueado imediatamente.'}
                </div>
              </div>
            </div>

            {/* ── Right: tabs + content ── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Tab bar */}
              <div style={{
                display: 'flex', borderBottom: `1px solid ${mp.borderDiv}`,
                padding: '0 24px', flexShrink: 0, gap: 0, background: mp.bg,
              }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '14px 16px', background: 'none', border: 'none',
                      borderBottom: activeTab === tab.id ? `2px solid ${mp.primary}` : '2px solid transparent',
                      color: activeTab === tab.id ? mp.tabActive : mp.tabInactive,
                      fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
                      transition: 'color 0.15s', marginBottom: -1, whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                <form id="manage-user-form" onSubmit={onSave}>
                  {activeTab === 'perfil' && (
                    <TabPerfil user={user} setUser={setUser} onSwitchTab={setActiveTab} />
                  )}
                  {activeTab === 'seguranca' && (
                    <TabSeguranca
                      user={user}
                      actionState={actionState}
                      onSendReset={onSendReset}
                      onForceReset={onForceReset}
                      onTerminateSessions={onTerminateSessions}
                    />
                  )}
                  {activeTab === 'empresa' && (
                    <TabEmpresa user={user} setUser={setUser} companies={companies} me={me} />
                  )}
                  {activeTab === 'logs' && (
                    <TabLogs logs={logs} loading={loadingLogs} onRefresh={onRefreshLogs} />
                  )}
                </form>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: '14px 24px', borderTop: `1px solid ${mp.borderDiv}`,
            display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0,
            background: mp.bg,
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background: mp.btnBg, border: `1px solid ${mp.btnBorder}`,
                color: mp.btnText, borderRadius: 8, padding: '8px 20px',
                fontSize: '0.85rem', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="manage-user-form"
              disabled={saving}
              style={{
                background: mp.primary, border: `1px solid ${mp.primary}`,
                color: '#fff', borderRadius: 8, padding: '8px 22px',
                fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: `0 2px 12px ${mp.primarySoft}`,
              }}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </ModalThemeCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [loading,   setLoading]   = useState(true);
  const [users,     setUsers]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search,    setSearch]    = useState('');
  const [editing,   setEditing]   = useState(null);
  const [savingId,  setSavingId]  = useState(null);
  const [error,     setError]     = useState('');

  const [activeTab,   setActiveTab]   = useState('perfil');
  const [logs,        setLogs]        = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionState, setActionState] = useState({});

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    const [usersRes, companiesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, photo_url, company, role, status, updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name'),
    ]);
    if (usersRes.error) setError(usersRes.error.message);
    setUsers(usersRes.data || []);
    setCompanies(companiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [usersRes, companiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, photo_url, company, role, status, updated_at')
          .order('updated_at', { ascending: false }),
        supabase.from('companies').select('id, name').order('name'),
      ]);
      if (!active) return;
      if (usersRes.error) setError(usersRes.error.message);
      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.company, u.id].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [users, search]);

  // ── Modal actions ──────────────────────────────────────────────────────────

  const openEdit = async (u) => {
    setEditing({ ...u });
    setActiveTab('perfil');
    setActionState({});
    setLogs([]);

    // Fetch profile row and auth.users data in parallel
    const [full, authData] = await Promise.all([
      fetchFullProfile(u.id),
      fetchUserFromAuth(u.id),
    ]);

    setEditing((prev) => ({
      ...prev,
      ...(full     || {}),
      ...(authData || {}),
    }));

    logAccess('open_admin_user', { targetUserId: u.id });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editing) return;
    setSavingId(editing.id);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        name:                     editing.name?.trim() || null,
        company:                  editing.company?.trim() || null,
        role:                     editing.role || 'user',
        job_title:                editing.job_title?.trim() || null,
        status:                   editing.status || 'active',
        can_manage_team:          !!editing.can_manage_team,
        can_manage_subscriptions: !!editing.can_manage_subscriptions,
        can_access_billing:       !!editing.can_access_billing,
        can_access_admin:         !!editing.can_access_admin,
        force_password_reset:     !!editing.force_password_reset,
        updated_at:               new Date().toISOString(),
      })
      .eq('id', editing.id);
    setSavingId(null);
    if (err) { setError(err.message); return; }
    logAccess('update_user_permissions', { targetUserId: editing.id });
    setEditing(null);
    await load();
  };

  const toggleRole = async (u) => {
    if (u.id === me?.id) { setError('Você não pode rebaixar o próprio admin daqui.'); return; }
    const next = u.role === 'admin' ? 'user' : 'admin';
    setSavingId(u.id);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: next, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    setSavingId(null);
    if (err) { setError(err.message); return; }
    await load();
  };

  const handleDeactivate = async () => {
    if (!editing) return;
    const next = editing.status === 'inactive' ? 'active' : 'inactive';
    const label = next === 'inactive' ? 'Desativar este usuário?' : 'Reativar este usuário?';
    if (!window.confirm(label)) return;
    const { error: err } = await supabase
      .from('profiles')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', editing.id);
    if (err) { setError(err.message); return; }
    logAccess(next === 'inactive' ? 'deactivate_user' : 'reactivate_user', { targetUserId: editing.id });
    setEditing((u) => ({ ...u, status: next }));
    await load();
  };

  const handleSendReset = async () => {
    setActionState((s) => ({ ...s, reset: { loading: true } }));
    const result = await resetPasswordViaAdmin(editing.id);
    if (result.ok) logAccess('admin_password_reset', { targetUserId: editing.id });
    setActionState((s) => ({
      ...s,
      reset: { loading: false, ok: result.ok, msg: result.msg },
    }));
  };

  const handleForceReset = async () => {
    setActionState((s) => ({ ...s, forceReset: { loading: true } }));
    const { error: err } = await supabase
      .from('profiles')
      .update({ force_password_reset: true, updated_at: new Date().toISOString() })
      .eq('id', editing.id);
    if (!err) {
      setEditing((u) => ({ ...u, force_password_reset: true }));
      logAccess('force_password_reset', { targetUserId: editing.id });
    }
    setActionState((s) => ({
      ...s,
      forceReset: {
        loading: false, ok: !err,
        msg: err ? 'Não foi possível aplicar a restrição.' : 'Troca de senha exigida no próximo login.',
      },
    }));
  };

  const handleTerminateSessions = () => {
    setActionState((s) => ({
      ...s,
      terminate: { ok: false, msg: 'Disponível em breve. Requer configuração adicional no servidor.' },
    }));
  };

  const handleLoadLogs = useCallback(async () => {
    if (!editing?.id) return;
    setLoadingLogs(true);
    const data = await fetchAccessLogs(editing.id);
    setLogs(data);
    setLoadingLogs(false);
  }, [editing?.id]);

  useEffect(() => {
    if (activeTab === 'logs' && editing?.id) {
      handleLoadLogs();
    }
  }, [activeTab, editing?.id, handleLoadLogs]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminLayout
      title="Usuários"
      subtitle="Lista de todos os clientes cadastrados via Supabase Auth."
      actions={
        <input
          className="admin-input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nome, empresa, id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)',
          borderRadius: 10, color: '#ff6b6b', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState>Nenhum usuário encontrado.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Empresa</th>
                  <th>Role</th>
                  <th>Atualizado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                          background: 'rgba(124,58,237,0.15)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          color: '#a78bfa', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {u.photo_url
                            ? <img src={u.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (u.name || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {u.name || <span style={{ color: 'rgba(255,255,255,0.4)' }}>(sem nome)</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                            {u.id.slice(0, 8)}…
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{u.company || '—'}</td>
                    <td>
                      <span className="admin-pill" style={{
                        background:  u.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                        color:       u.role === 'admin' ? '#a78bfa' : '#bbb',
                        borderColor: u.role === 'admin' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)',
                      }}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td>{formatDate(u.updated_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          className="admin-btn"
                          onClick={() => toggleRole(u)}
                          disabled={savingId === u.id || u.id === me?.id}
                          title={u.id === me?.id ? 'Não é possível alterar o próprio role' : ''}
                        >
                          {u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                        </button>
                        <button className="admin-btn primary" onClick={() => openEdit(u)}>
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <ManageUserModal
          user={editing}
          setUser={setEditing}
          me={me}
          companies={companies}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          saving={!!savingId}
          actionState={actionState}
          logs={logs}
          loadingLogs={loadingLogs}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDeactivate={handleDeactivate}
          onSendReset={handleSendReset}
          onForceReset={handleForceReset}
          onTerminateSessions={handleTerminateSessions}
          onRefreshLogs={handleLoadLogs}
        />
      )}

      <DropdownStyles />
    </AdminLayout>
  );
}
