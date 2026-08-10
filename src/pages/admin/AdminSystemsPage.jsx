import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { DropdownStyles } from '../../components/AdminDropdown';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { formatBRL } from '../../lib/admin';
import { SYSTEM_LOGOS_BUCKET } from '../../lib/systems';

const EMPTY = {
  slug: '',
  name: '',
  description: '',
  default_amount: '',
  url: '',
  video_url: '',
  logo_url: null,
  icon: '',
  color: '',
  active: true,
  sort_order: 0,
};

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateLogoFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type))
    return 'Use PNG, JPG, SVG ou WebP.';
  if (file.size > 3 * 1024 * 1024) return 'Imagem acima de 3 MB.';
  return null;
}

function SystemLogo({ system, size = 38 }) {
  if (system.logo_url) {
    return (
      <img
        src={system.logo_url}
        alt=""
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45,
    }}>
      {system.icon || '🧩'}
    </div>
  );
}

export default function AdminSystemsPage() {
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [companyCounts, setCompanyCounts] = useState({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);
  const { toasts, showToast, dismissToast } = useToasts();

  const load = async () => {
    setLoading(true);
    setError('');
    const [sysRes, subsRes] = await Promise.all([
      supabase.from('systems').select('*').order('sort_order', { ascending: true }),
      supabase.from('subscriptions').select('company_id, system_slug, status').in('status', ['active', 'trialing']),
    ]);
    if (sysRes.error) setError(sysRes.error.message);

    const list = sysRes.data || [];
    // Resolve aliases legados para o slug canônico antes de contar.
    const canonical = {};
    list.forEach((s) => {
      canonical[s.slug] = s.slug;
      (s.aliases || []).forEach((a) => { canonical[a] = s.slug; });
    });
    const perSystem = {};
    (subsRes.data || []).forEach((sub) => {
      const slug = canonical[sub.system_slug] || sub.system_slug;
      if (!sub.company_id) return;
      (perSystem[slug] ||= new Set()).add(sub.company_id);
    });

    setSystems(list);
    setCompanyCounts(Object.fromEntries(Object.entries(perSystem).map(([k, v]) => [k, v.size])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) => [s.name, s.slug, s.description].some((v) => (v || '').toLowerCase().includes(q)));
  }, [systems, search]);

  const handleSave = async (e) => {
    e.preventDefault();
    const name = (editing.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }

    const slug = editing.slug || slugify(name);
    if (!slug) { setError('Não foi possível gerar um identificador a partir do nome.'); return; }

    setSaving(true);
    setError('');

    const payload = {
      name,
      description: editing.description?.trim() || null,
      default_amount: editing.default_amount === '' ? 0 : Number(editing.default_amount),
      logo_url: editing.logo_url || null,
      icon: editing.icon?.trim() || null,
      color: editing.color?.trim() || null,
      video_url: editing.video_url?.trim() || null,
      active: !!editing.active,
      sort_order: Number(editing.sort_order) || 0,
    };
    // A rota de sistemas internos vive no código — não sobrescreve pelo painel.
    if (!editing.internal) payload.url = editing.url?.trim() || null;

    const res = editing.isNew
      ? await supabase.from('systems').insert({ ...payload, slug })
      : await supabase.from('systems').update(payload).eq('slug', editing.slug);

    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    const wasNew = editing.isNew;
    setEditing(null);
    await load();
    showToast(wasNew ? `Sistema "${name}" criado.` : `Sistema "${name}" atualizado.`);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validationError = validateLogoFile(file);
    if (validationError) { setError(validationError); return; }
    try {
      setLogoUploading(true);
      setError('');
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const key = editing.slug || slugify(editing.name) || 'novo';
      const path = `${key}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(SYSTEM_LOGOS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(SYSTEM_LOGOS_BUCKET).getPublicUrl(path);
      setEditing((prev) => ({ ...prev, logo_url: pub.publicUrl }));
      showToast('Logo enviada. Salve para aplicar.');
    } catch (err) {
      setError(err.message || 'Erro ao enviar logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setError('');
    const { error: err } = await supabase.from('systems').delete().eq('slug', deleting.slug);
    setDeleteBusy(false);
    if (err) { setError(err.message); setDeleting(null); return; }
    const name = deleting.name;
    setDeleting(null);
    await load();
    showToast(`Sistema "${name}" excluído.`);
  };

  return (
    <AdminLayout
      title="Sistemas"
      subtitle="Catálogo de sistemas — nome, logo e valor padrão usado nas assinaturas."
      actions={
        <>
          <input
            className="admin-input"
            style={{ maxWidth: 240 }}
            placeholder="Buscar sistema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-btn primary" onClick={() => setEditing({ ...EMPTY, isNew: true })}>+ Novo</button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState>Nenhum sistema cadastrado.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sistema</th>
                  <th>Valor padrão</th>
                  <th>Empresas</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const count = companyCounts[s.slug] || 0;
                  return (
                    <tr key={s.slug}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <SystemLogo system={s} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                              {s.slug}{s.internal ? ' · interno' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(s.default_amount)}</td>
                      <td>
                        <span className="admin-pill" style={{
                          background: count > 0 ? 'rgba(0,212,138,0.12)' : 'rgba(255,255,255,0.05)',
                          color: count > 0 ? '#00d48a' : 'rgba(255,255,255,0.5)',
                          borderColor: count > 0 ? 'rgba(0,212,138,0.25)' : 'rgba(255,255,255,0.12)',
                          whiteSpace: 'nowrap',
                        }}>
                          {count} {count === 1 ? 'empresa' : 'empresas'}
                        </span>
                      </td>
                      <td>
                        <span className="admin-pill" style={{
                          background: s.active ? 'rgba(0,212,138,0.12)' : 'rgba(255,255,255,0.05)',
                          color: s.active ? '#00d48a' : 'rgba(255,255,255,0.5)',
                          borderColor: s.active ? 'rgba(0,212,138,0.25)' : 'rgba(255,255,255,0.12)',
                        }}>
                          {s.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button className="admin-btn" onClick={() => setEditing({ ...s, default_amount: s.default_amount ?? '', isNew: false })}>
                            Editar
                          </button>
                          <button
                            className="admin-btn danger"
                            onClick={() => setDeleting(s)}
                            disabled={s.internal || count > 0}
                            title={
                              s.internal ? 'Sistema interno — depende de rotas no código'
                                : count > 0 ? 'Há empresas com assinatura ativa deste sistema'
                                : ''
                            }
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: criar / editar sistema ── */}
      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.isNew ? 'Novo sistema' : 'Editar sistema'}
        width={580}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="system-form" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="system-form" onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16 }}>
              <SystemLogo system={editing} size={64} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? 'Enviando...' : editing.logo_url ? 'Trocar logo' : 'Enviar logo'}
                </button>
                {editing.logo_url && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, logo_url: null })}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    Remover logo
                  </button>
                )}
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>PNG, JPG, SVG ou WebP até 3 MB.</span>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                hidden
                onChange={handleLogoChange}
              />
            </div>

            <Field label="Nome" full>
              <input
                className="admin-input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: WhatsApp Bot"
                required
                autoFocus
              />
            </Field>

            <Field label="Identificador (slug)" full>
              <input
                className="admin-input"
                value={editing.isNew ? (editing.slug || slugify(editing.name)) : editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                disabled={!editing.isNew}
                style={!editing.isNew ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                placeholder="gerado a partir do nome"
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                {editing.isNew
                  ? 'Usado para vincular assinaturas. Não pode ser alterado depois.'
                  : 'O slug é fixo — assinaturas existentes dependem dele.'}
              </span>
            </Field>

            <Field label="Descrição" full>
              <textarea
                className="admin-input"
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Aparece no card do sistema no cockpit do cliente."
              />
            </Field>

            <Field label="Valor padrão (R$)">
              <input
                className="admin-input"
                type="number"
                step="0.01"
                min="0"
                value={editing.default_amount}
                onChange={(e) => setEditing({ ...editing, default_amount: e.target.value })}
                placeholder="0,00"
              />
            </Field>

            <Field label="Ícone (emoji, fallback)">
              <input
                className="admin-input"
                value={editing.icon || ''}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                maxLength={4}
                placeholder="💬"
              />
            </Field>

            <Field label="Link de acesso" full>
              <input
                className="admin-input"
                value={editing.url || ''}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                disabled={!!editing.internal}
                style={editing.internal ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                placeholder="https://..."
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                {editing.internal
                  ? 'Sistema interno — a rota é definida no código da aplicação.'
                  : 'URL externa aberta pelo card do sistema no cockpit.'}
              </span>
            </Field>

            <Field label="Link do vídeo de demonstração" full>
              <input
                className="admin-input"
                value={editing.video_url || ''}
                onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=... ou link direto do vídeo"
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                Mostrado na página de detalhes do sistema. Aceita link do YouTube/Vimeo ou arquivo de vídeo direto.
              </span>
            </Field>

            <Field label="Ordem de exibição">
              <input
                className="admin-input"
                type="number"
                value={editing.sort_order ?? 0}
                onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })}
              />
            </Field>

            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem' }}>Sistema ativo</span>
              </label>
            </Field>
          </form>
        )}
      </Modal>

      {/* ── Modal: confirmar exclusão ── */}
      <Modal
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Excluir sistema"
        footer={
          <>
            <button className="admin-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancelar</button>
            <button className="admin-btn danger" onClick={handleConfirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          </>
        }
      >
        {deleting && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Excluir o sistema <strong style={{ color: '#eeede9' }}>{deleting.name}</strong> do catálogo?
            Esta ação não pode ser desfeita.
          </p>
        )}
      </Modal>

      <DropdownStyles />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}

function Field({ label, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
