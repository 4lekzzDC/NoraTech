// Tela de gerenciamento de um sistema — substitui o antigo modal de edição.
// Duas abas: "Visualização" (os mesmos campos que o modal tinha: nome, logo,
// descrição etc.) e "Módulos" (categorias do hub deste sistema, cada uma
// levando para suas ferramentas em /admin/sistemas/:slug/modulos/:categoria).

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { SYSTEM_LOGOS_BUCKET } from '../../lib/systems';
import { listarCategorias, salvarCategoria, excluirCategoria } from '../../lib/hubModuleCatalog';
import { SystemLogo, Field } from './adminFormHelpers';
import { slugify, validateLogoFile } from './adminFormUtils';

const CATEGORIA_VAZIA = {
  name: '', slug: '', icon: '', description: '', status: 'available', active: true, sortOrder: 0,
};

const ABAS = [
  { id: 'visualizacao', label: 'Visualização' },
  { id: 'modulos', label: 'Módulos' },
];

function Tabs({ aba, setAba }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {ABAS.map((a) => (
        <button
          key={a.id}
          onClick={() => setAba(a.id)}
          style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit',
            color: aba === a.id ? '#eeede9' : 'rgba(255,255,255,0.45)',
            borderBottom: aba === a.id ? '2px solid #7C3AED' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminSystemDetailPage() {
  const { slug } = useParams();
  const { toasts, showToast, dismissToast } = useToasts();

  const [aba, setAba] = useState('visualizacao');
  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const [categorias, setCategorias] = useState([]);
  const [carregandoCategorias, setCarregandoCategorias] = useState(true);
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [excluindoCategoria, setExcluindoCategoria] = useState(null);

  const carregarSistema = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('systems').select('*').eq('slug', slug).maybeSingle();
    if (err) setError(err.message);
    setSystem(data);
    setForm(data ? { ...data, default_amount: data.default_amount ?? '' } : null);
    setLoading(false);
  };

  const carregarCategorias = async () => {
    setCarregandoCategorias(true);
    try {
      setCategorias(await listarCategorias(slug));
    } catch (e) {
      setError(e.message);
    } finally {
      setCarregandoCategorias(false);
    }
  };

  useEffect(() => { carregarSistema(); carregarCategorias(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarVisualizacao = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name,
      description: form.description?.trim() || null,
      default_amount: form.default_amount === '' ? 0 : Number(form.default_amount),
      logo_url: form.logo_url || null,
      icon: form.icon?.trim() || null,
      color: form.color?.trim() || null,
      video_url: form.video_url?.trim() || null,
      active: !!form.active,
      sort_order: Number(form.sort_order) || 0,
    };
    if (!form.internal) payload.url = form.url?.trim() || null;
    const { error: err } = await supabase.from('systems').update(payload).eq('slug', slug);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await carregarSistema();
    showToast('Sistema atualizado.');
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
      const path = `${slug}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(SYSTEM_LOGOS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(SYSTEM_LOGOS_BUCKET).getPublicUrl(path);
      setForm((prev) => ({ ...prev, logo_url: pub.publicUrl }));
      showToast('Logo enviada. Salve para aplicar.');
    } catch (err) {
      setError(err.message || 'Erro ao enviar logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSalvarCategoria = async (e) => {
    e.preventDefault();
    const name = (editandoCategoria.name || '').trim();
    if (name.length < 2) { setError('Nome da categoria muito curto.'); return; }
    const categoriaSlug = editandoCategoria.slug || slugify(name);
    if (!categoriaSlug) { setError('Não foi possível gerar um identificador para a categoria.'); return; }
    setSalvandoCategoria(true);
    setError('');
    try {
      await salvarCategoria({
        systemSlug: slug,
        slug: categoriaSlug,
        name,
        icon: editandoCategoria.icon,
        description: editandoCategoria.description,
        status: editandoCategoria.status,
        active: editandoCategoria.active,
        sortOrder: editandoCategoria.sortOrder,
      }, editandoCategoria.id || null);
      setEditandoCategoria(null);
      await carregarCategorias();
      showToast('Categoria salva.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvandoCategoria(false);
    }
  };

  const confirmarExclusaoCategoria = async () => {
    if (!excluindoCategoria) return;
    try {
      await excluirCategoria(excluindoCategoria.id);
      setExcluindoCategoria(null);
      await carregarCategorias();
      showToast(`Categoria "${excluindoCategoria.name}" excluída.`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Sistema" subtitle="Carregando...">
        <Spinner />
      </AdminLayout>
    );
  }

  if (!system) {
    return (
      <AdminLayout title="Sistema não encontrado">
        <EmptyState>
          Não achei um sistema com o identificador "{slug}".{' '}
          <Link to="/admin/sistemas" style={{ color: '#a78bfa' }}>Voltar para Sistemas</Link>
        </EmptyState>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={system.name}
      subtitle={`Identificador: ${system.slug}${system.internal ? ' · sistema interno' : ''}`}
      actions={
        <Link to="/admin/sistemas" className="admin-btn">← Sistemas</Link>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <Tabs aba={aba} setAba={setAba} />

      {aba === 'visualizacao' && (
        <Card style={{ padding: 22, maxWidth: 720 }}>
          <form onSubmit={salvarVisualizacao} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16 }}>
              <SystemLogo system={form} size={64} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" className="admin-btn" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? 'Enviando...' : form.logo_url ? 'Trocar logo' : 'Enviar logo'}
                </button>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: null })}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    Remover logo
                  </button>
                )}
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>PNG, JPG, SVG ou WebP até 3 MB.</span>
              </div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" hidden onChange={handleLogoChange} />
            </div>

            <Field label="Nome" full>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>

            <Field label="Descrição" full>
              <textarea
                className="admin-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Aparece no card do sistema no cockpit do cliente."
              />
            </Field>

            <Field label="Valor padrão (R$)">
              <input className="admin-input" type="number" step="0.01" min="0" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} />
            </Field>

            <Field label="Ícone (emoji, fallback)">
              <input className="admin-input" value={form.icon || ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} placeholder="💬" />
            </Field>

            <Field label="Link de acesso" full hint={system.internal ? 'Sistema interno — a rota é definida no código da aplicação.' : 'URL externa aberta pelo card do sistema no cockpit.'}>
              <input
                className="admin-input" value={form.url || ''} onChange={(e) => setForm({ ...form, url: e.target.value })}
                disabled={!!system.internal} style={system.internal ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                placeholder="https://..."
              />
            </Field>

            <Field label="Link do vídeo de demonstração" full>
              <input className="admin-input" value={form.video_url || ''} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </Field>

            <Field label="Ordem de exibição">
              <input className="admin-input" type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </Field>

            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem' }}>Sistema ativo</span>
              </label>
            </Field>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="admin-btn primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Card>
      )}

      {aba === 'modulos' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="admin-btn primary" onClick={() => setEditandoCategoria({ ...CATEGORIA_VAZIA, isNew: true })}>+ Nova categoria</button>
          </div>
          <Card style={{ padding: 0 }}>
            {carregandoCategorias ? <Spinner /> : categorias.length === 0 ? (
              <EmptyState>Nenhuma categoria cadastrada para este sistema ainda.</EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Status</th>
                      <th>Ativa</th>
                      <th>Ordem</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorias.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            to={`/admin/sistemas/${slug}/modulos/${c.slug}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}
                          >
                            <span style={{ fontSize: '1.1rem' }}>{c.icon || '🧩'}</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{c.slug}</div>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <span className="admin-pill" style={{
                            background: c.status === 'available' ? 'rgba(0,212,138,0.12)' : 'rgba(245,158,11,0.12)',
                            color: c.status === 'available' ? '#00d48a' : '#f59e0b',
                            borderColor: c.status === 'available' ? 'rgba(0,212,138,0.25)' : 'rgba(245,158,11,0.25)',
                          }}>
                            {c.status === 'available' ? 'Disponível' : 'Em breve'}
                          </span>
                        </td>
                        <td>{c.active ? 'Sim' : 'Não'}</td>
                        <td>{c.sort_order}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              className="admin-btn"
                              onClick={() => setEditandoCategoria({
                                id: c.id, slug: c.slug, name: c.name, icon: c.icon || '', description: c.description || '',
                                status: c.status, active: c.active, sortOrder: c.sort_order, isNew: false,
                              })}
                            >
                              Editar
                            </button>
                            <button className="admin-btn danger" onClick={() => setExcluindoCategoria(c)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Modal: criar/editar categoria ── */}
      <Modal
        open={!!editandoCategoria}
        onClose={() => !salvandoCategoria && setEditandoCategoria(null)}
        title={editandoCategoria?.isNew ? 'Nova categoria' : 'Editar categoria'}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditandoCategoria(null)} disabled={salvandoCategoria}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="categoria-form" disabled={salvandoCategoria}>
              {salvandoCategoria ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editandoCategoria && (
          <form id="categoria-form" onSubmit={handleSalvarCategoria} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nome" full>
              <input
                className="admin-input" value={editandoCategoria.name}
                onChange={(e) => setEditandoCategoria({ ...editandoCategoria, name: e.target.value })}
                placeholder="Ex: Fiscal" required autoFocus
              />
            </Field>
            <Field label="Identificador (slug)" full hint={editandoCategoria.isNew ? 'Usado na URL. Gerado a partir do nome se deixar em branco.' : 'Fixo — a rota do hub depende dele.'}>
              <input
                className="admin-input"
                value={editandoCategoria.isNew ? (editandoCategoria.slug || slugify(editandoCategoria.name)) : editandoCategoria.slug}
                onChange={(e) => setEditandoCategoria({ ...editandoCategoria, slug: slugify(e.target.value) })}
                disabled={!editandoCategoria.isNew}
                style={!editandoCategoria.isNew ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              />
            </Field>
            <Field label="Ícone (emoji)">
              <input className="admin-input" value={editandoCategoria.icon || ''} onChange={(e) => setEditandoCategoria({ ...editandoCategoria, icon: e.target.value })} maxLength={4} placeholder="🧾" />
            </Field>
            <Field label="Ordem de exibição">
              <input className="admin-input" type="number" value={editandoCategoria.sortOrder ?? 0} onChange={(e) => setEditandoCategoria({ ...editandoCategoria, sortOrder: e.target.value })} />
            </Field>
            <Field label="Descrição" full>
              <textarea className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={editandoCategoria.description || ''} onChange={(e) => setEditandoCategoria({ ...editandoCategoria, description: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="admin-select" value={editandoCategoria.status} onChange={(e) => setEditandoCategoria({ ...editandoCategoria, status: e.target.value })}>
                <option value="available">Disponível</option>
                <option value="soon">Em breve</option>
              </select>
            </Field>
            <Field label="Ativa">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editandoCategoria.active} onChange={(e) => setEditandoCategoria({ ...editandoCategoria, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem' }}>Visível no hub</span>
              </label>
            </Field>
          </form>
        )}
      </Modal>

      {/* ── Modal: confirmar exclusão de categoria ── */}
      <Modal
        open={!!excluindoCategoria}
        onClose={() => setExcluindoCategoria(null)}
        title="Excluir categoria"
        footer={
          <>
            <button className="admin-btn" onClick={() => setExcluindoCategoria(null)}>Cancelar</button>
            <button className="admin-btn danger" onClick={confirmarExclusaoCategoria}>Excluir definitivamente</button>
          </>
        }
      >
        {excluindoCategoria && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Excluir a categoria <strong style={{ color: '#eeede9' }}>{excluindoCategoria.name}</strong> e todas as suas ferramentas do catálogo?
            Esta ação não pode ser desfeita.
          </p>
        )}
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
