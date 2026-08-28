// Tela de uma categoria (módulo) dentro de um sistema — ex.: Fiscal, dentro
// de NoraHub. Mesma forma da tela do sistema, um nível abaixo: "Visualização"
// edita a própria categoria, "Ferramentas" lista e gerencia o que mora nela,
// cada uma levando para /admin/sistemas/:slug/modulos/:categoria/:ferramenta.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import {
  buscarCategoria, salvarCategoria, listarFerramentas, salvarFerramenta, excluirFerramenta,
} from '../../lib/hubModuleCatalog';
import { Field } from './adminFormHelpers';
import { slugify } from './adminFormUtils';
import { painelInternoDe } from './sistemaModulos/paineisInternos';

const FERRAMENTA_VAZIA = {
  name: '', slug: '', icon: '', color: '#7C3AED', description: '', status: 'available', active: true, sortOrder: 0,
};

const ABAS = [
  { id: 'visualizacao', label: 'Visualização' },
  { id: 'ferramentas', label: 'Ferramentas' },
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

export default function AdminSystemModulePage() {
  const { slug, categoriaSlug } = useParams();
  const { toasts, showToast, dismissToast } = useToasts();

  const [aba, setAba] = useState('visualizacao');
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [ferramentas, setFerramentas] = useState([]);
  const [carregandoFerramentas, setCarregandoFerramentas] = useState(true);
  const [editandoFerramenta, setEditandoFerramenta] = useState(null);
  const [salvandoFerramenta, setSalvandoFerramenta] = useState(false);
  const [excluindoFerramenta, setExcluindoFerramenta] = useState(null);

  const carregarCategoria = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await buscarCategoria(slug, categoriaSlug);
      setCategoria(c);
      setForm(c ? { ...c } : null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarFerramentas = async (categoriaId) => {
    if (!categoriaId) return;
    setCarregandoFerramentas(true);
    try {
      setFerramentas(await listarFerramentas(categoriaId));
    } catch (e) {
      setError(e.message);
    } finally {
      setCarregandoFerramentas(false);
    }
  };

  useEffect(() => { carregarCategoria(); }, [slug, categoriaSlug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (categoria?.id) carregarFerramentas(categoria.id); }, [categoria?.id]);

  const salvarVisualizacao = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }
    setSaving(true);
    setError('');
    try {
      await salvarCategoria({
        systemSlug: slug, slug: categoria.slug, name,
        icon: form.icon, description: form.description,
        status: form.status, active: form.active, sortOrder: form.sort_order,
      }, categoria.id);
      await carregarCategoria();
      showToast('Categoria atualizada.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarFerramenta = async (e) => {
    e.preventDefault();
    const name = (editandoFerramenta.name || '').trim();
    if (name.length < 2) { setError('Nome da ferramenta muito curto.'); return; }
    const ferramentaSlug = editandoFerramenta.slug || slugify(name);
    if (!ferramentaSlug) { setError('Não foi possível gerar um identificador para a ferramenta.'); return; }
    setSalvandoFerramenta(true);
    setError('');
    try {
      await salvarFerramenta({
        categoriaId: categoria.id,
        slug: ferramentaSlug,
        name,
        icon: editandoFerramenta.icon,
        color: editandoFerramenta.color,
        description: editandoFerramenta.description,
        status: editandoFerramenta.status,
        active: editandoFerramenta.active,
        sortOrder: editandoFerramenta.sortOrder,
      }, editandoFerramenta.id || null);
      setEditandoFerramenta(null);
      await carregarFerramentas(categoria.id);
      showToast('Ferramenta salva.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvandoFerramenta(false);
    }
  };

  const confirmarExclusaoFerramenta = async () => {
    if (!excluindoFerramenta) return;
    try {
      await excluirFerramenta(excluindoFerramenta.id);
      setExcluindoFerramenta(null);
      await carregarFerramentas(categoria.id);
      showToast(`Ferramenta "${excluindoFerramenta.name}" excluída.`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <AdminLayout title="Categoria" subtitle="Carregando..."><Spinner /></AdminLayout>;
  }

  if (!categoria) {
    return (
      <AdminLayout title="Categoria não encontrada">
        <EmptyState>
          Não achei a categoria "{categoriaSlug}" neste sistema.{' '}
          <Link to={`/admin/sistemas/${slug}`} style={{ color: '#a78bfa' }}>Voltar</Link>
        </EmptyState>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={categoria.name}
      subtitle={`Módulo do sistema ${slug} · identificador: ${categoria.slug}`}
      actions={<Link to={`/admin/sistemas/${slug}`} className="admin-btn">← {slug}</Link>}
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <Tabs aba={aba} setAba={setAba} />

      {aba === 'visualizacao' && (
        <Card style={{ padding: 22, maxWidth: 640 }}>
          <form onSubmit={salvarVisualizacao} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nome" full>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Ícone (emoji)">
              <input className="admin-input" value={form.icon || ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} />
            </Field>
            <Field label="Ordem de exibição">
              <input className="admin-input" type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </Field>
            <Field label="Descrição" full>
              <textarea className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="admin-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="available">Disponível</option>
                <option value="soon">Em breve</option>
              </select>
            </Field>
            <Field label="Visível no hub">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem' }}>Ativa</span>
              </label>
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="admin-btn primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Card>
      )}

      {aba === 'ferramentas' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="admin-btn primary" onClick={() => setEditandoFerramenta({ ...FERRAMENTA_VAZIA, isNew: true })}>+ Nova ferramenta</button>
          </div>
          <Card style={{ padding: 0 }}>
            {carregandoFerramentas ? <Spinner /> : ferramentas.length === 0 ? (
              <EmptyState>Nenhuma ferramenta cadastrada nesta categoria ainda.</EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ferramenta</th>
                      <th>Status</th>
                      <th>Ativa</th>
                      <th>Config. interna</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ferramentas.map((f) => {
                      const painel = painelInternoDe(f.slug);
                      return (
                        <tr key={f.id}>
                          <td>
                            <Link
                              to={`/admin/sistemas/${slug}/modulos/${categoriaSlug}/${f.slug}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}
                            >
                              <span style={{ fontSize: '1.1rem' }}>{f.icon || '🧩'}</span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{f.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{f.slug}</div>
                              </div>
                            </Link>
                          </td>
                          <td>
                            <span className="admin-pill" style={{
                              background: f.status === 'available' ? 'rgba(0,212,138,0.12)' : 'rgba(245,158,11,0.12)',
                              color: f.status === 'available' ? '#00d48a' : '#f59e0b',
                              borderColor: f.status === 'available' ? 'rgba(0,212,138,0.25)' : 'rgba(245,158,11,0.25)',
                            }}>
                              {f.status === 'available' ? 'Disponível' : 'Em breve'}
                            </span>
                          </td>
                          <td>{f.active ? 'Sim' : 'Não'}</td>
                          <td>{painel ? painel.aba : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                              <button
                                className="admin-btn"
                                onClick={() => setEditandoFerramenta({
                                  id: f.id, slug: f.slug, name: f.name, icon: f.icon || '', color: f.color || '#7C3AED',
                                  description: f.description || '', status: f.status, active: f.active, sortOrder: f.sort_order, isNew: false,
                                })}
                              >
                                Editar
                              </button>
                              <button className="admin-btn danger" onClick={() => setExcluindoFerramenta(f)}>Excluir</button>
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
        </>
      )}

      {/* ── Modal: criar/editar ferramenta ── */}
      <Modal
        open={!!editandoFerramenta}
        onClose={() => !salvandoFerramenta && setEditandoFerramenta(null)}
        title={editandoFerramenta?.isNew ? 'Nova ferramenta' : 'Editar ferramenta'}
        footer={
          <>
            <button className="admin-btn" onClick={() => setEditandoFerramenta(null)} disabled={salvandoFerramenta}>Cancelar</button>
            <button className="admin-btn primary" type="submit" form="ferramenta-form" disabled={salvandoFerramenta}>
              {salvandoFerramenta ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editandoFerramenta && (
          <form id="ferramenta-form" onSubmit={handleSalvarFerramenta} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nome" full>
              <input className="admin-input" value={editandoFerramenta.name} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, name: e.target.value })} placeholder="Ex: Calculadora de DIFAL" required autoFocus />
            </Field>
            <Field label="Identificador (slug)" full hint={editandoFerramenta.isNew ? 'Usado na rota do hub. Gerado a partir do nome se deixar em branco.' : 'Fixo — a rota do hub depende dele.'}>
              <input
                className="admin-input"
                value={editandoFerramenta.isNew ? (editandoFerramenta.slug || slugify(editandoFerramenta.name)) : editandoFerramenta.slug}
                onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, slug: slugify(e.target.value) })}
                disabled={!editandoFerramenta.isNew}
                style={!editandoFerramenta.isNew ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              />
            </Field>
            <Field label="Ícone (emoji)">
              <input className="admin-input" value={editandoFerramenta.icon || ''} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, icon: e.target.value })} maxLength={4} placeholder="🧾" />
            </Field>
            <Field label="Cor de destaque">
              <input className="admin-input" type="color" value={editandoFerramenta.color || '#7C3AED'} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, color: e.target.value })} style={{ padding: 4, height: 38, cursor: 'pointer' }} />
            </Field>
            <Field label="Descrição" full>
              <textarea className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={editandoFerramenta.description || ''} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, description: e.target.value })} />
            </Field>
            <Field label="Ordem de exibição">
              <input className="admin-input" type="number" value={editandoFerramenta.sortOrder ?? 0} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, sortOrder: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="admin-select" value={editandoFerramenta.status} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, status: e.target.value })}>
                <option value="available">Disponível</option>
                <option value="soon">Em breve</option>
              </select>
            </Field>
            <Field label="Ativa">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editandoFerramenta.active} onChange={(e) => setEditandoFerramenta({ ...editandoFerramenta, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem' }}>Visível no hub</span>
              </label>
            </Field>
          </form>
        )}
      </Modal>

      {/* ── Modal: confirmar exclusão de ferramenta ── */}
      <Modal
        open={!!excluindoFerramenta}
        onClose={() => setExcluindoFerramenta(null)}
        title="Excluir ferramenta"
        footer={
          <>
            <button className="admin-btn" onClick={() => setExcluindoFerramenta(null)}>Cancelar</button>
            <button className="admin-btn danger" onClick={confirmarExclusaoFerramenta}>Excluir definitivamente</button>
          </>
        }
      >
        {excluindoFerramenta && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Excluir a ferramenta <strong style={{ color: '#eeede9' }}>{excluindoFerramenta.name}</strong> do catálogo?
            {painelInternoDe(excluindoFerramenta.slug) && ' A configuração interna dela continua no código, só some daqui.'}
            {' '}Esta ação não pode ser desfeita.
          </p>
        )}
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
