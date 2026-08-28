// Tela de uma ferramenta — ex.: Calculadora de DIFAL, dentro de Fiscal,
// dentro de NoraHub. "Visualização" edita nome/ícone/descrição/status, como
// as telas acima. Quando a ferramenta tem uma configuração interna própria
// registrada (paineisInternos.jsx), uma segunda aba a hospeda — é aqui que
// o antigo /admin/difal-regras passou a morar.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { Card, Spinner, EmptyState } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { buscarCategoria, buscarFerramenta, salvarFerramenta } from '../../lib/hubModuleCatalog';
import { Field } from './adminFormHelpers';
import { painelInternoDe } from './sistemaModulos/paineisInternos';

function Tabs({ abas, aba, setAba }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {abas.map((a) => (
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

export default function AdminSystemFerramentaPage() {
  const { slug, categoriaSlug, ferramentaSlug } = useParams();
  const { toasts, showToast, dismissToast } = useToasts();

  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState(null);
  const [ferramenta, setFerramenta] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aba, setAba] = useState('visualizacao');

  const painel = ferramenta ? painelInternoDe(ferramenta.slug) : null;
  const abas = [
    { id: 'visualizacao', label: 'Visualização' },
    ...(painel ? [{ id: 'interno', label: painel.aba }] : []),
  ];

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await buscarCategoria(slug, categoriaSlug);
      setCategoria(c);
      if (c) {
        const f = await buscarFerramenta(c.id, ferramentaSlug);
        setFerramenta(f);
        setForm(f ? { ...f } : null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [slug, categoriaSlug, ferramentaSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarVisualizacao = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    if (name.length < 2) { setError('Nome muito curto.'); return; }
    setSaving(true);
    setError('');
    try {
      await salvarFerramenta({
        categoriaId: categoria.id, slug: ferramenta.slug, name,
        icon: form.icon, color: form.color, description: form.description,
        status: form.status, active: form.active, sortOrder: form.sort_order,
      }, ferramenta.id);
      await carregar();
      showToast('Ferramenta atualizada.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLayout title="Ferramenta" subtitle="Carregando..."><Spinner /></AdminLayout>;
  }

  if (!categoria || !ferramenta) {
    return (
      <AdminLayout title="Ferramenta não encontrada">
        <EmptyState>
          Não achei essa ferramenta.{' '}
          <Link to={`/admin/sistemas/${slug}/modulos/${categoriaSlug}`} style={{ color: '#a78bfa' }}>Voltar</Link>
        </EmptyState>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={ferramenta.name}
      subtitle={`${categoria.name} · ${slug} · identificador: ${ferramenta.slug}`}
      actions={<Link to={`/admin/sistemas/${slug}/modulos/${categoriaSlug}`} className="admin-btn">← {categoria.name}</Link>}
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {abas.length > 1 && <Tabs abas={abas} aba={aba} setAba={setAba} />}

      {aba === 'visualizacao' && (
        <Card style={{ padding: 22, maxWidth: 640 }}>
          <form onSubmit={salvarVisualizacao} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nome" full>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Ícone (emoji)">
              <input className="admin-input" value={form.icon || ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} />
            </Field>
            <Field label="Cor de destaque">
              <input className="admin-input" type="color" value={form.color || '#7C3AED'} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ padding: 4, height: 38, cursor: 'pointer' }} />
            </Field>
            <Field label="Descrição" full>
              <textarea className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Ordem de exibição">
              <input className="admin-input" type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
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

      {aba === 'interno' && painel && <painel.Componente />}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
