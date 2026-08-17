import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Spinner, EmptyState, StatusPill } from './AdminLayout';
import { Dropdown, DropdownStyles } from './AdminDropdown';
import { supabase } from '../lib/supabase';
import { ToastHost } from './Toast';
import { useToasts } from '../lib/useToasts';
import { updateCompanyLogo } from '../lib/companies';
import { fetchPaymentMethod, chargeInvoice } from '../lib/payments';
import { formatBRL, formatDate } from '../lib/admin';
import { useTheme } from '../contexts/ThemeContext';
import { fetchSystems, indexSystems } from '../lib/systems';
import {
  HUB_MODULES, SOLUCOES_CONTABEIS_SLUG, SOLUCOES_CONTABEIS_LEGACY_SLUGS,
} from '../modules/solucoes-contabeis/constants';

// Sistemas com módulos internos que o admin pode liberar seletivamente. Hoje
// só Soluções Contábeis tem essa granularidade — os "sistemas" da tabela
// `systems` normalmente são vendidos como um bloco só.
const CONTABIL_SUB_SLUGS = new Set([SOLUCOES_CONTABEIS_SLUG, ...SOLUCOES_CONTABEIS_LEGACY_SLUGS]);
const CONTABIL_MODULES = HUB_MODULES.filter((m) => m.section === 'ferramentas' && m.status === 'available');

const LOGO_BUCKET = 'company-logos';

function validateLogoFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type))
    return 'Use PNG, JPG, SVG ou WebP.';
  if (file.size > 3 * 1024 * 1024) return 'Imagem acima de 3 MB.';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme palette (mesmo esquema visual do modal "Gerenciar usuário")
// ─────────────────────────────────────────────────────────────────────────────

function getModalPalette(theme) {
  const dark = {
    bg:               '#101015',
    sidebar:          '#0d0d12',
    surface:          'rgba(255,255,255,0.025)',
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
    dangerBg:         'rgba(255,107,107,0.05)',
    dangerBorder:     'rgba(255,107,107,0.18)',
    danger:           '#ff6b6b',
    success:          '#00d48a',
    successBg:        'rgba(0,212,138,0.12)',
    successBorder:    'rgba(0,212,138,0.28)',
    btnBg:            'rgba(255,255,255,0.06)',
    btnBorder:        'rgba(255,255,255,0.1)',
    btnText:          '#eeede9',
    sidebarCard:      'rgba(255,255,255,0.035)',
    sidebarBorder:    'rgba(255,255,255,0.08)',
  };
  const light = {
    bg:               '#ffffff',
    sidebar:          '#f6f7fa',
    surface:          'rgba(15,17,21,0.02)',
    border:           'rgba(15,17,21,0.08)',
    borderDiv:        'rgba(15,17,21,0.07)',
    text:             '#111116',
    muted:            'rgba(0,0,0,0.5)',
    muted2:           'rgba(0,0,0,0.35)',
    label:            'rgba(0,0,0,0.4)',
    inputBg:          '#ffffff',
    inputBorder:      'rgba(15,17,21,0.14)',
    inputText:        '#111116',
    overlay:          'rgba(15,17,21,0.45)',
    primary:          '#7C3AED',
    primarySoft:      'rgba(124,58,237,0.1)',
    primaryText:      '#6d28d9',
    primaryBorder:    'rgba(124,58,237,0.25)',
    tabActive:        '#111116',
    tabInactive:      'rgba(0,0,0,0.42)',
    shadow:           '0 24px 60px rgba(0,0,0,0.16)',
    dangerBg:         'rgba(239,68,68,0.05)',
    dangerBorder:     'rgba(239,68,68,0.18)',
    danger:           '#dc2626',
    success:          '#059669',
    successBg:        'rgba(5,150,105,0.1)',
    successBorder:    'rgba(5,150,105,0.25)',
    btnBg:            'rgba(15,17,21,0.04)',
    btnBorder:        'rgba(15,17,21,0.12)',
    btnText:          '#111116',
    sidebarCard:      '#ffffff',
    sidebarBorder:    'rgba(15,17,21,0.08)',
  };
  return theme === 'light' ? light : dark;
}

const ModalThemeCtx = createContext(null);
const useMP = () => useContext(ModalThemeCtx);

const TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'membros', label: 'Membros' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'faturas', label: 'Faturas' },
];

const ROLE_LABEL = { owner: 'Dono', admin: 'Admin', member: 'Membro' };
const MEMBER_STATUS_LABEL = { active: 'Ativo', pending: 'Pendente', rejected: 'Rejeitado' };

const EMPTY_SUB = {
  system_slug: '',
  plan: '',
  status: 'active',
  amount: '',
  currency: 'BRL',
  billing_cycle: 'monthly',
  current_period_end: '',
  notes: '',
  // null = todos os módulos liberados (padrão). Array = restrito a esses slugs.
  enabled_modules: null,
};

function SectionCard({ title, children, style }) {
  const mp = useMP();
  return (
    <div style={{ background: mp.surface, border: `1px solid ${mp.border}`, borderRadius: 14, padding: '18px 20px', ...style }}>
      {title && (
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: mp.label, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, children, full }) {
  const mp = useMP();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.8, color: mp.label, textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
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

function SidebarMetaRow({ icon, label, value, mono, action }) {
  const mp = useMP();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1, background: mp.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mp.primaryText }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: mp.label, marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: mono ? '0.73rem' : '0.8rem', color: mp.text, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all', lineHeight: 1.4 }}>
            {value}
          </span>
          {action}
        </div>
      </div>
    </div>
  );
}

function IconButton({ icon, title, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`admin-btn${danger ? ' danger' : ''}`}
      style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </button>
  );
}

function SystemBadge({ system, slug }) {
  const name = system?.name || slug || '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {system?.logo_url ? (
        <img src={system.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>
          {system?.icon || '🧩'}
        </div>
      )}
      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Geral
// ─────────────────────────────────────────────────────────────────────────────

function TabGeral({ form, setForm, users, onSave, saving, dirty }) {
  const inputStyle = useInputStyle();
  return (
    <form onSubmit={onSave}>
      <SectionCard title="Informações básicas">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nome da empresa" full>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Acme S/A"
            />
          </Field>
          <Field label="Dono" full>
            <Dropdown
              searchable
              value={form.owner_id || ''}
              onChange={(v) => setForm({ ...form, owner_id: v })}
              options={users.map((u) => ({ value: u.id, label: u.name || u.id.slice(0, 8) }))}
              placeholder="Selecione o dono..."
              emptyText="Nenhum usuário encontrado"
            />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="submit"
            className="admin-btn primary"
            disabled={!dirty || saving}
            style={{ opacity: dirty && !saving ? 1 : 0.4 }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SectionCard>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Membros
// ─────────────────────────────────────────────────────────────────────────────

function TabMembros({ members, availableUsers, onAdd, onRoleChange, onApprove, onRemove }) {
  const [adding, setAdding] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!adding.user_id) return;
    setSaving(true);
    await onAdd(adding);
    setSaving(false);
    setAdding(null);
  };

  const handleConfirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    await onRemove(removing);
    setRemoveBusy(false);
    setRemoving(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="admin-btn primary"
          onClick={() => setAdding({ user_id: '', role: 'member' })}
          disabled={availableUsers.length === 0}
          title={availableUsers.length === 0 ? 'Todos os usuários já são membros' : ''}
        >
          + Adicionar membro
        </button>
      </div>

      {members.length === 0 ? (
        <EmptyState>Nenhum membro nesta equipe.</EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Entrou em</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.profile?.name || <span style={{ color: 'rgba(255,255,255,0.4)' }}>(desconhecido)</span>}</div>
                    {m.profile?.email && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{m.profile.email}</div>}
                  </td>
                  <td style={{ maxWidth: 160 }}>
                    {m.role === 'owner' ? (
                      <span className="admin-pill" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.25)' }}>
                        {ROLE_LABEL.owner}
                      </span>
                    ) : (
                      <Dropdown
                        value={m.role}
                        onChange={(v) => onRoleChange(m, v)}
                        options={[
                          { value: 'member', label: ROLE_LABEL.member },
                          { value: 'admin', label: ROLE_LABEL.admin },
                        ]}
                      />
                    )}
                  </td>
                  <td>
                    <StatusPill status={m.status === 'active' ? 'active' : m.status === 'pending' ? 'pending' : 'canceled'} />
                    {m.status !== 'active' && MEMBER_STATUS_LABEL[m.status] && (
                      <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{MEMBER_STATUS_LABEL[m.status]}</span>
                    )}
                  </td>
                  <td>{formatDate(m.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      {m.status === 'pending' && (
                        <button className="admin-btn" onClick={() => onApprove(m)}>Aprovar</button>
                      )}
                      <button
                        className="admin-btn danger"
                        onClick={() => setRemoving(m)}
                        disabled={m.role === 'owner'}
                        title={m.role === 'owner' ? 'Não é possível remover o dono' : ''}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!adding}
        onClose={() => !saving && setAdding(null)}
        title="Adicionar membro"
        footer={
          <>
            <button className="admin-btn" onClick={() => setAdding(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="member-add-form" disabled={saving}>
              {saving ? 'Adicionando...' : 'Adicionar'}
            </button>
          </>
        }
      >
        {adding && (
          <form id="member-add-form" onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Usuário">
              <Dropdown
                searchable
                value={adding.user_id}
                onChange={(v) => setAdding({ ...adding, user_id: v })}
                options={availableUsers.map((u) => ({ value: u.id, label: u.email ? `${u.name || u.id.slice(0, 8)} (${u.email})` : (u.name || u.id.slice(0, 8)) }))}
                placeholder="Selecione um usuário..."
                emptyText="Nenhum usuário disponível"
              />
            </Field>
            <Field label="Cargo">
              <Dropdown
                value={adding.role}
                onChange={(v) => setAdding({ ...adding, role: v })}
                options={[
                  { value: 'member', label: ROLE_LABEL.member },
                  { value: 'admin', label: ROLE_LABEL.admin },
                ]}
              />
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => !removeBusy && setRemoving(null)}
        title="Remover membro"
        footer={
          <>
            <button className="admin-btn" onClick={() => setRemoving(null)} disabled={removeBusy}>Cancelar</button>
            <button className="admin-btn danger" onClick={handleConfirmRemove} disabled={removeBusy}>
              {removeBusy ? 'Removendo...' : 'Remover'}
            </button>
          </>
        }
      >
        {removing && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Remover <strong style={{ color: '#eeede9' }}>{removing.profile?.name || removing.profile?.email || 'este membro'}</strong> da equipe?
          </p>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Assinaturas
// ─────────────────────────────────────────────────────────────────────────────

function TabAssinaturas({ subs, systems, systemBySlug, onSave, onDelete }) {
  const mp = useMP();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [moduleError, setModuleError] = useState('');

  const picked = editing?.system_slug ? systemBySlug[editing.system_slug] : null;
  const defaultAmount = Number(picked?.default_amount ?? 0);
  const isContabil = editing ? CONTABIL_SUB_SLUGS.has(editing.system_slug) : false;

  const toggleAllModules = (liberarTodos) => {
    setModuleError('');
    setEditing((prev) => ({
      ...prev,
      enabled_modules: liberarTodos ? null : CONTABIL_MODULES.map((m) => m.slug),
    }));
  };
  const toggleModule = (slug, on) => {
    setModuleError('');
    setEditing((prev) => {
      const atual = new Set(prev.enabled_modules || CONTABIL_MODULES.map((m) => m.slug));
      if (on) atual.add(slug); else atual.delete(slug);
      return { ...prev, enabled_modules: Array.from(atual) };
    });
  };

  const startNew = () => { setModuleError(''); setEditing({ ...EMPTY_SUB, custom_amount: false }); };

  const startEdit = (s) => {
    const sys = systemBySlug[s.system_slug];
    const std = Number(sys?.default_amount ?? 0);
    setModuleError('');
    setEditing({
      ...s,
      system_slug: s.system_slug || '',
      custom_amount: Number(s.amount) !== std,
      current_period_end: s.current_period_end ? s.current_period_end.slice(0, 10) : '',
    });
  };

  const pickSystem = (slug) => {
    const sys = systemBySlug[slug];
    setEditing((prev) => ({
      ...prev,
      system_slug: slug,
      plan: sys?.name || slug,
      amount: prev.custom_amount ? prev.amount : (sys?.default_amount ?? 0),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.system_slug) return;
    // Array vazio de módulos e "liberar todos" (null) resultam no MESMO
    // acesso irrestrito lá no gate — array vazio não existe como "bloquear
    // tudo". Se deixasse salvar, o admin veria a tela com nada marcado e a
    // empresa continuaria com acesso total, silenciosamente ao contrário do
    // que a tela mostra.
    if (isContabil && Array.isArray(editing.enabled_modules) && editing.enabled_modules.length === 0) {
      setModuleError('Selecione ao menos um módulo, ou marque "liberar todos".');
      return;
    }
    setModuleError('');
    setSaving(true);
    const ok = await onSave({
      ...editing,
      amount: editing.custom_amount ? editing.amount : defaultAmount,
    });
    setSaving(false);
    if (ok) setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    await onDelete(deleting);
    setDeleteBusy(false);
    setDeleting(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="admin-btn primary" onClick={startNew}>+ Nova assinatura</button>
      </div>

      {subs.length === 0 ? (
        <EmptyState>Nenhuma assinatura cadastrada.</EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sistema</th>
                <th>Adquirido em</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td><SystemBadge system={systemBySlug[s.system_slug]} slug={s.system_slug} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.started_at)}</td>
                  <td style={{ fontWeight: 600 }}>{formatBRL(s.amount)}</td>
                  <td><StatusPill status={s.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <IconButton
                        title="Editar assinatura"
                        onClick={() => startEdit(s)}
                        icon={<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />}
                      />
                      <IconButton
                        title="Excluir assinatura"
                        danger
                        onClick={() => setDeleting(s)}
                        icon={<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Editar assinatura' : 'Nova assinatura'}
        width={560}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="sub-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="sub-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Sistema">
              <Dropdown
                value={editing.system_slug}
                onChange={pickSystem}
                options={[
                  { value: '', label: 'Selecione um sistema...' },
                  ...systems.map((s) => ({ value: s.slug, label: `${s.logo_url ? '' : `${s.icon || '🧩'} `}${s.name}` })),
                ]}
                placeholder="Selecione um sistema..."
              />
            </Field>

            {picked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <SystemBadge system={picked} slug={picked.slug} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Valor padrão</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a78bfa' }}>{formatBRL(defaultAmount)}</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={!!editing.custom_amount}
                    onChange={(e) => setEditing({
                      ...editing,
                      custom_amount: e.target.checked,
                      amount: e.target.checked ? editing.amount : defaultAmount,
                    })}
                    style={{ width: 15, height: 15, accentColor: '#7C3AED', cursor: 'pointer' }}
                  />
                  Cobrar um valor diferente desta empresa
                </label>

                {editing.custom_amount && (
                  <input
                    className="admin-input"
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={editing.amount}
                    onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                    placeholder="Valor personalizado"
                  />
                )}
              </div>
            )}

            {isContabil && CONTABIL_MODULES.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 12, background: mp.surface, border: `1px solid ${mp.border}` }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: mp.text }}>Módulos liberados</div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '0.82rem', color: mp.text }}>
                  <input
                    type="checkbox"
                    checked={!editing.enabled_modules}
                    onChange={(e) => toggleAllModules(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: '#7C3AED', cursor: 'pointer' }}
                  />
                  Liberar todos os módulos do sistema
                </label>

                {/* Sem esse fallback pra "todos", desmarcar um módulo com
                    enabled_modules ainda null quebraria — não haveria lista
                    prévia de onde remover o slug. */}
                {editing.enabled_modules && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 2 }}>
                    {CONTABIL_MODULES.map((m) => (
                      <label key={m.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: mp.text, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editing.enabled_modules.includes(m.slug)}
                          onChange={(e) => toggleModule(m.slug, e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: '#7C3AED', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.icon} {m.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: '0.72rem', color: mp.muted2, lineHeight: 1.5, margin: 0 }}>
                  Módulos fora da lista ficam marcados como "fora do plano" para o cliente e o acesso direto por link também é bloqueado.
                </p>

                {moduleError && (
                  <p style={{ fontSize: '0.76rem', color: mp.danger, lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
                    {moduleError}
                  </p>
                )}
              </div>
            )}

            <Field label="Status">
              <Dropdown
                value={editing.status}
                onChange={(v) => setEditing({ ...editing, status: v })}
                options={[
                  { value: 'active', label: 'Ativa' },
                  { value: 'trialing', label: 'Trial' },
                  { value: 'paused', label: 'Pausada' },
                  { value: 'past_due', label: 'Atrasada' },
                  { value: 'canceled', label: 'Cancelada' },
                ]}
              />
            </Field>

            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, margin: 0 }}>
              Ciclo de cobrança e próxima cobrança são configurados na aba <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Faturas</strong>.
            </p>
          </form>
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir assinatura"
        footer={
          <>
            <button className="admin-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancelar</button>
            <button className="admin-btn danger" onClick={handleConfirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Excluindo...' : 'Excluir'}
            </button>
          </>
        }
      >
        {deleting && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Excluir a assinatura <strong style={{ color: '#eeede9' }}>{deleting.plan}</strong>? Esta ação não pode ser desfeita.
          </p>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Faturas — dia de vencimento da empresa, prévia consolidada e histórico
// ─────────────────────────────────────────────────────────────────────────────

function TabFaturas({ company, invoices, itemsByInvoice, preview, systemBySlug, paymentMethod, onSaveBillingDay, onMarkPaid, onCharge }) {
  const mp = useMP();
  const [day, setDay] = useState(company.billing_day ?? '');
  const [busy, setBusy] = useState(false);
  const [chargingId, setChargingId] = useState(null);

  const handleCharge = async (invoice) => {
    setChargingId(invoice.id);
    await onCharge(invoice);
    setChargingId(null);
  };

  const current = company.billing_day ?? '';
  const dirty = String(day) === '' ? current !== '' : Number(day) !== Number(current);
  const valid = day === '' || (Number(day) >= 1 && Number(day) <= 31);

  const save = async () => {
    setBusy(true);
    await onSaveBillingDay(day === '' ? null : Number(day));
    setBusy(false);
  };

  const previewTotal = preview.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const period = preview[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title="Dia de vencimento">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 110 }}>
            <input
              className="admin-input"
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Ex: 10"
            />
          </div>
          <button
            type="button"
            className="admin-btn primary"
            onClick={save}
            disabled={!dirty || !valid || busy}
            style={{ opacity: dirty && valid ? 1 : 0.4 }}
          >
            {busy ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: mp.muted, lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>
          Todos os sistemas contratados são cobrados numa <strong style={{ color: mp.text }}>única fatura mensal</strong> neste dia.
          Sistemas assinados no meio do período entram com valor proporcional aos dias vigentes.
          Em meses mais curtos, o vencimento cai no último dia do mês.
        </p>
      </SectionCard>

      {company.billing_day && (
        <SectionCard title="Prévia do próximo fechamento">
          {preview.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: mp.muted }}>
              Nenhuma assinatura ativa para cobrar neste período.
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.76rem', color: mp.muted, marginBottom: 12 }}>
                Período {formatDate(period.period_start)} a {formatDate(period.period_end)} · vencimento em{' '}
                <strong style={{ color: mp.text }}>{formatDate(period.period_end)}</strong>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sistema</th>
                      <th>Dias cobrados</th>
                      <th>Valor cheio</th>
                      <th style={{ textAlign: 'right' }}>Valor a cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((l) => (
                      <tr key={l.subscription_id}>
                        <td><SystemBadge system={systemBySlug[l.system_slug]} slug={l.system_slug} /></td>
                        <td>
                          {l.days_charged}/{l.days_in_period}
                          {l.prorated && (
                            <span className="admin-pill" style={{ marginLeft: 8, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.28)', whiteSpace: 'nowrap' }}>
                              pro-rata
                            </span>
                          )}
                        </td>
                        <td style={{ color: mp.muted }}>{formatBRL(l.unit_amount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBRL(l.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total da fatura</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#a78bfa', fontSize: '1rem' }}>
                        {formatBRL(previewTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '0.74rem', color: mp.muted, marginTop: 10, marginBottom: 0 }}>
                A fatura é gerada automaticamente no dia do vencimento.
              </p>
            </>
          )}
        </SectionCard>
      )}

      <SectionCard title="Faturas emitidas">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.8rem', color: mp.muted }}>
          {paymentMethod ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mp.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              Cartão salvo: <strong style={{ color: mp.text, textTransform: 'capitalize' }}>{paymentMethod.brand} •••• {paymentMethod.last4}</strong>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mp.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              Empresa ainda não cadastrou um cartão — "Cobrar agora" fica indisponível até lá.
            </>
          )}
        </div>

        {invoices.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: mp.muted }}>
            Nenhuma fatura emitida para esta empresa ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {invoices.map((i) => (
              <div key={i.id} style={{ border: `1px solid ${mp.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{i.description}</div>
                    <div style={{ fontSize: '0.74rem', color: mp.muted, marginTop: 2 }}>
                      Vence em {formatDate(i.due_date)}
                      {i.paid_at && ` · pago em ${formatDate(i.paid_at)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusPill status={i.status} />
                    <span style={{ fontWeight: 800, fontSize: '1rem' }}>{formatBRL(i.amount)}</span>
                    {i.status !== 'paid' && (
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          className="admin-btn primary"
                          onClick={() => handleCharge(i)}
                          disabled={!paymentMethod || chargingId === i.id}
                          title={!paymentMethod ? 'Empresa sem cartão salvo' : ''}
                          style={{ opacity: paymentMethod ? 1 : 0.5 }}
                        >
                          {chargingId === i.id ? 'Cobrando...' : 'Cobrar agora'}
                        </button>
                        <button className="admin-btn" onClick={() => onMarkPaid(i)}>Marcar como paga</button>
                      </div>
                    )}
                  </div>
                </div>
                {i.payment_error && (
                  <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: mp.dangerBg, border: `1px solid ${mp.dangerBorder}`, color: mp.danger, fontSize: '0.76rem' }}>
                    {i.payment_error}
                  </div>
                )}
                {(itemsByInvoice[i.id] || []).length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${mp.borderDiv}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {itemsByInvoice[i.id].map((it) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.8rem' }}>
                        <span style={{ color: mp.muted }}>{it.description}</span>
                        <span>{formatBRL(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ManageCompanyModal({ companyId, onClose, onChanged }) {
  const { theme } = useTheme();
  const mp = getModalPalette(theme);

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [itemsByInvoice, setItemsByInvoice] = useState({});
  const [preview, setPreview] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [activeTab, setActiveTab] = useState('geral');
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, dismissToast } = useToasts();
  const [idCopied, setIdCopied] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const [form, setForm] = useState({ name: '', owner_id: '' });

  const load = async () => {
    setLoading(true);
    const [companyRes, membersRes, subsRes, usersRes, systemsList] = await Promise.all([
      supabase.from('companies').select('id, name, code, owner_id, logo_url, billing_day, created_at, updated_at').eq('id', companyId).maybeSingle(),
      supabase.from('company_members').select('id, user_id, role, status, created_at').eq('company_id', companyId).order('created_at', { ascending: true }),
      supabase.from('subscriptions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, email').order('name'),
      fetchSystems(),
    ]);
    if (membersRes.error) showToast(membersRes.error.message, 'error');
    if (subsRes.error) showToast(subsRes.error.message, 'error');

    const [invRes, previewRes, pmData] = await Promise.all([
      supabase.from('invoices').select('*').eq('company_id', companyId).order('due_date', { ascending: false }),
      supabase.rpc('preview_company_invoice', { p_company_id: companyId }),
      fetchPaymentMethod(companyId).catch(() => null),
    ]);
    const invoiceRows = invRes.data || [];

    // Composição de cada fatura emitida.
    let itemsMap = {};
    if (invoiceRows.length > 0) {
      const { data: itemRows } = await supabase
        .from('invoice_items')
        .select('*')
        .in('invoice_id', invoiceRows.map((i) => i.id));
      itemsMap = (itemRows || []).reduce((acc, it) => {
        (acc[it.invoice_id] ||= []).push(it);
        return acc;
      }, {});
    }

    setCompany(companyRes.data || null);
    setItemsByInvoice(itemsMap);
    setPreview(previewRes.data || []);
    setPaymentMethod(pmData);
    setForm({ name: companyRes.data?.name || '', owner_id: companyRes.data?.owner_id || '' });
    setMembers(membersRes.data || []);
    setSubs(subsRes.data || []);
    setUsers(usersRes.data || []);
    setSystems(systemsList || []);
    setInvoices(invoiceRows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const userById = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const membersWithProfile = useMemo(
    () => members.map((m) => ({ ...m, profile: userById.get(m.user_id) || null })),
    [members, userById]
  );

  const systemBySlug = useMemo(() => indexSystems(systems), [systems]);

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.user_id));
    return users.filter((u) => !memberIds.has(u.id));
  }, [users, members]);

  const owner = company ? userById.get(company.owner_id) : null;

  const geralDirty = !!company && (
    (form.name || '') !== (company.name || '') ||
    (form.owner_id || '') !== (company.owner_id || '')
  );

  const copyId = () => {
    navigator.clipboard.writeText(companyId);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    if (name.length < 2) { showToast('Nome muito curto.', 'error'); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc('admin_update_company', {
      p_id: companyId,
      p_name: name,
      p_owner_id: form.owner_id || null,
    });
    setSaving(false);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    onChanged?.();
    showToast('Dados da empresa atualizados.');
  };

  const handleAddMember = async (adding) => {
    const { error: err } = await supabase.from('company_members').insert({
      company_id: companyId,
      user_id: adding.user_id,
      role: adding.role,
      status: 'active',
    });
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    showToast('Membro adicionado à equipe.');
  };

  const handleRoleChange = async (member, role) => {
    const { error: err } = await supabase.from('company_members').update({ role }).eq('id', member.id);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    showToast(`Cargo alterado para ${ROLE_LABEL[role] || role}.`);
  };

  const handleApproveMember = async (member) => {
    const { error: err } = await supabase.from('company_members').update({ status: 'active' }).eq('id', member.id);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    showToast('Membro aprovado.');
  };

  const handleRemoveMember = async (member) => {
    if (member.role === 'owner') return;
    const { error: err } = await supabase.from('company_members').delete().eq('id', member.id);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    showToast('Membro removido da equipe.');
  };

  const handleSaveSub = async (subEditing) => {
    const sys = systemBySlug[subEditing.system_slug];
    const payload = {
      company_id: companyId,
      user_id: null,
      system_slug: subEditing.system_slug,
      plan: (subEditing.plan || sys?.name || subEditing.system_slug).trim(),
      status: subEditing.status,
      amount: subEditing.amount === '' ? 0 : Number(subEditing.amount),
      currency: subEditing.currency || 'BRL',
      // Ciclo e próxima cobrança são gerenciados na aba Faturas; aqui só
      // garantimos um default para assinaturas novas.
      billing_cycle: subEditing.billing_cycle || 'monthly',
      notes: subEditing.notes?.trim() || null,
      // null = todos os módulos liberados. O formulário já bloqueia salvar
      // com array vazio (ver handleSave em TabAssinaturas — nesse schema
      // vazio e null dão o mesmo acesso irrestrito no gate, então deixar
      // vazio passar mostraria a tela "nada marcado" enquanto a empresa
      // continuaria com acesso total). Normaliza aqui também por segurança,
      // caso `onSave` seja chamado por outro caminho no futuro.
      enabled_modules: (subEditing.enabled_modules && subEditing.enabled_modules.length > 0)
        ? subEditing.enabled_modules
        : null,
    };
    const res = subEditing.id
      ? await supabase.from('subscriptions').update(payload).eq('id', subEditing.id)
      : await supabase.from('subscriptions').insert(payload);
    if (res.error) { showToast(res.error.message, 'error'); return false; }
    await load();
    onChanged?.();
    showToast(subEditing.id ? 'Assinatura atualizada.' : `${payload.plan} assinado.`);
    return true;
  };

  const handleDeleteSub = async (sub) => {
    const { error: err } = await supabase.from('subscriptions').delete().eq('id', sub.id);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    onChanged?.();
    showToast(`Assinatura de ${sub.plan} excluída.`);
  };

  const handleSaveBillingDay = async (billingDay) => {
    const { error: err } = await supabase
      .from('companies')
      .update({ billing_day: billingDay })
      .eq('id', companyId);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    onChanged?.();
    showToast(billingDay ? `Vencimento definido para todo dia ${billingDay}.` : 'Dia de vencimento removido.');
  };

  const handleMarkPaid = async (invoice) => {
    const { error: err } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice.id);
    if (err) { showToast(err.message, 'error'); return; }
    await load();
    showToast('Fatura marcada como paga.');
  };

  const handleChargeInvoice = async (invoice) => {
    try {
      const result = await chargeInvoice(invoice.id);
      await load();
      if (result.ok) {
        showToast('Cobrança feita com sucesso — fatura paga.');
      } else {
        showToast(`Cobrança enviada, mas ainda não confirmada (${result.status}).`, 'error');
      }
    } catch (err) {
      await load();
      showToast(err.message || 'Não foi possível cobrar esta fatura.', 'error');
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validationError = validateLogoFile(file);
    if (validationError) { showToast(validationError, 'error'); return; }
    try {
      setLogoUploading(true);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      await updateCompanyLogo(companyId, pub.publicUrl);
      await load();
      onChanged?.();
      showToast('Logo da equipe atualizada.');
    } catch (err) {
      showToast(err.message || 'Erro ao enviar logo.', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      setLogoUploading(true);
      await updateCompanyLogo(companyId, null);
      await load();
      onChanged?.();
      showToast('Logo da equipe removida.');
    } catch (err) {
      showToast(err.message || 'Erro ao remover logo.', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const initial = (company?.name || '?').slice(0, 2).toUpperCase();

  return (
    <ModalThemeCtx.Provider value={mp}>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: mp.overlay, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 90 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 1020, background: mp.bg, border: `1px solid ${mp.border}`, borderRadius: 20, overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', boxShadow: mp.shadow, color: mp.text }}
        >
          {/* ── Header ── */}
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${mp.borderDiv}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: mp.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mp.primaryText }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: mp.text }}>Gerenciar empresa</h2>
                <div style={{ fontSize: '0.72rem', color: mp.muted, marginTop: 1 }}>{company?.name || 'Empresa'}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: mp.btnBg, border: `1px solid ${mp.btnBorder}`, color: mp.muted, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }} aria-label="Fechar">×</button>
          </div>

          {loading ? (
            <div style={{ padding: 60 }}><Spinner /></div>
          ) : !company ? (
            <div style={{ padding: 40 }}><EmptyState>Esta empresa não existe ou foi removida.</EmptyState></div>
          ) : (
            <>
              {/* ── Body ── */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* ── Sidebar ── */}
                <div style={{ width: 236, flexShrink: 0, borderRight: `1px solid ${mp.borderDiv}`, background: mp.sidebar, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div style={{ margin: 16, padding: '20px 16px', background: mp.sidebarCard, border: `1px solid ${mp.sidebarBorder}`, borderRadius: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <button
                        type="button"
                        onClick={() => !logoUploading && logoInputRef.current?.click()}
                        title="Alterar logo da empresa"
                        disabled={logoUploading}
                        style={{
                          position: 'relative', width: 76, height: 76, borderRadius: 20, padding: 0,
                          background: mp.primarySoft, border: `2.5px solid ${mp.primaryBorder}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: mp.primaryText, fontSize: '1.4rem', fontWeight: 700, flexShrink: 0,
                          boxShadow: `0 0 0 4px ${mp.primarySoft}`, cursor: logoUploading ? 'wait' : 'pointer',
                          overflow: 'hidden',
                        }}
                        className="company-logo-btn"
                      >
                        {company.logo_url
                          ? <img src={company.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initial}
                        <span className="company-logo-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, opacity: 0, transition: 'opacity 0.15s' }}>
                          {logoUploading ? '...' : 'Alterar'}
                        </span>
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        hidden
                        onChange={handleLogoChange}
                      />
                      <style>{`.company-logo-btn:hover .company-logo-overlay, .company-logo-btn:focus-visible .company-logo-overlay { opacity: 1; }`}</style>
                      {company.logo_url && (
                        <button type="button" onClick={handleLogoRemove} disabled={logoUploading} style={{ background: 'none', border: 'none', color: mp.danger, fontSize: '0.68rem', fontWeight: 700, cursor: logoUploading ? 'wait' : 'pointer', padding: 0 }}>
                          Remover logo
                        </button>
                      )}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, color: mp.text }}>{company.name}</div>
                        <div style={{ fontSize: '0.7rem', color: mp.muted, marginTop: 3 }}>{company.code}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: mp.successBg, color: mp.success, border: `1px solid ${mp.successBorder}` }}>
                          {members.length} {members.length === 1 ? 'membro' : 'membros'}
                        </span>
                        <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: mp.primarySoft, color: mp.primaryText, border: `1px solid ${mp.primaryBorder}` }}>
                          {subs.length} {subs.length === 1 ? 'assinatura' : 'assinaturas'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${mp.border}`, paddingTop: 14 }}>
                      <SidebarMetaRow
                        label="Dono"
                        value={owner?.name || '(desconhecido)'}
                        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                      />
                      <SidebarMetaRow
                        label="Criada em"
                        value={formatDate(company.created_at)}
                        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                      />
                      <SidebarMetaRow
                        label="ID da empresa"
                        mono
                        value={`${companyId.slice(0, 8)}…`}
                        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>}
                        action={
                          <button type="button" onClick={copyId} title="Copiar ID completo" style={{ background: idCopied ? mp.successBg : 'none', border: 'none', color: idCopied ? mp.success : mp.muted2, cursor: 'pointer', padding: '1px 4px', borderRadius: 4, fontSize: 11, lineHeight: 1 }}>
                            {idCopied ? '✓' : '⧉'}
                          </button>
                        }
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }} />
                </div>

                {/* ── Right: tabs + content ── */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: `1px solid ${mp.borderDiv}`, padding: '0 24px', flexShrink: 0, gap: 0, background: mp.bg }}>
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

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                    {activeTab === 'geral' && (
                      <TabGeral
                        form={form}
                        setForm={setForm}
                        users={users}
                        onSave={handleSave}
                        saving={saving}
                        dirty={geralDirty}
                      />
                    )}
                    {activeTab === 'membros' && (
                      <TabMembros
                        members={membersWithProfile}
                        availableUsers={availableUsers}
                        onAdd={handleAddMember}
                        onRoleChange={handleRoleChange}
                        onApprove={handleApproveMember}
                        onRemove={handleRemoveMember}
                      />
                    )}
                    {activeTab === 'assinaturas' && (
                      <TabAssinaturas
                        subs={subs}
                        systems={systems}
                        systemBySlug={systemBySlug}
                        onSave={handleSaveSub}
                        onDelete={handleDeleteSub}
                      />
                    )}
                    {activeTab === 'faturas' && (
                      <TabFaturas
                        company={company}
                        invoices={invoices}
                        itemsByInvoice={itemsByInvoice}
                        preview={preview}
                        systemBySlug={systemBySlug}
                        paymentMethod={paymentMethod}
                        onSaveBillingDay={handleSaveBillingDay}
                        onMarkPaid={handleMarkPaid}
                        onCharge={handleChargeInvoice}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <DropdownStyles />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </ModalThemeCtx.Provider>
  );
}
