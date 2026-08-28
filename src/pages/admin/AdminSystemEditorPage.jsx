// Editor de um sistema — uma tela só, sem navegar entre páginas.
//
// Abas no topo: Visão geral | Estrutura | Empresas | Configurações.
// "Estrutura" é uma árvore (categorias → ferramentas) à esquerda; clicar em
// qualquer nó edita ele no painel à direita, sem sair da tela. Uma
// ferramenta com configuração interna registrada (paineisInternos.jsx)
// ganha uma aba extra dentro do próprio painel — é onde as regras de DIFAL
// moram agora, dentro de Fiscal → Calculadora de DIFAL.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { SYSTEM_LOGOS_BUCKET } from '../../lib/systems';
import {
  listarCategorias, listarFerramentas, salvarCategoria, excluirCategoria,
  salvarFerramenta, excluirFerramenta,
} from '../../lib/hubModuleCatalog';
import { SystemLogo, Field } from './adminFormHelpers';
import { slugify, validateLogoFile } from './adminFormUtils';
import { painelInternoDe } from './sistemaModulos/paineisInternos';

const ABAS_TOPO = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'configuracoes', label: 'Configurações' },
];

const RASCUNHO_CATEGORIA = { name: '', slug: '', icon: '', description: '', status: 'available', active: true, sortOrder: 0 };
const RASCUNHO_FERRAMENTA = { name: '', slug: '', icon: '', color: '#7C3AED', description: '', status: 'available', active: true, sortOrder: 0 };

function TopTabs({ aba, setAba }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {ABAS_TOPO.map((a) => (
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

// Sub-abas dentro do painel direito (só aparecem quando há mais de uma —
// hoje, só uma ferramenta com config interna registrada).
function InnerTabs({ abas, aba, setAba }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
      {abas.map((a) => (
        <button
          key={a.id}
          onClick={() => setAba(a.id)}
          style={{
            padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.8rem', fontWeight: 600,
            border: `1px solid ${aba === a.id ? '#7C3AED' : 'rgba(255,255,255,0.1)'}`,
            background: aba === a.id ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.02)',
            color: aba === a.id ? '#eeede9' : 'rgba(255,255,255,0.55)',
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminSystemEditorPage() {
  const { slug } = useParams();
  const { toasts, showToast, dismissToast } = useToasts();

  const [abaTopo, setAbaTopo] = useState('visao-geral');
  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState(null);
  const [error, setError] = useState('');

  // ── Visão geral ──────────────────────────────────────────────────────
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  // ── Estrutura (árvore) ───────────────────────────────────────────────
  const [categorias, setCategorias] = useState([]); // cada uma com .ferramentas
  const [carregandoEstrutura, setCarregandoEstrutura] = useState(true);
  const [expandidas, setExpandidas] = useState(() => new Set());
  const [selecionado, setSelecionado] = useState(null); // {tipo, id, categoriaId, isNew}
  const [rascunho, setRascunho] = useState(null);
  const [salvandoNo, setSalvandoNo] = useState(false);
  const [excluindoNo, setExcluindoNo] = useState(null);
  const [abaPainel, setAbaPainel] = useState('visualizacao');

  // ── Empresas ─────────────────────────────────────────────────────────
  const [empresas, setEmpresas] = useState(null);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);

  const carregarSistema = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('systems').select('*').eq('slug', slug).maybeSingle();
    if (err) setError(err.message);
    setSystem(data);
    setForm(data ? { ...data, default_amount: data.default_amount ?? '' } : null);
    setLoading(false);
  };

  const carregarEstrutura = async () => {
    setCarregandoEstrutura(true);
    try {
      const cats = await listarCategorias(slug);
      const comFerramentas = await Promise.all(
        cats.map(async (c) => ({ ...c, ferramentas: await listarFerramentas(c.id) })),
      );
      setCategorias(comFerramentas);
    } catch (e) {
      setError(e.message);
    } finally {
      setCarregandoEstrutura(false);
    }
  };

  const carregarEmpresas = async () => {
    setCarregandoEmpresas(true);
    try {
      // Inclui aliases legados — uma assinatura gravada antes de uma
      // renomeação de slug ainda aponta pro nome antigo (ver systems.js).
      const slugs = [slug, ...(system?.aliases || [])];
      const { data, error: err } = await supabase
        .from('subscriptions')
        .select('company_id, status, plan, amount, created_at, companies(name)')
        .in('system_slug', slugs)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setEmpresas(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCarregandoEmpresas(false);
    }
  };

  useEffect(() => {
    carregarSistema();
    carregarEstrutura();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (abaTopo === 'empresas' && empresas === null) carregarEmpresas();
  }, [abaTopo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visão geral: salvar ──────────────────────────────────────────────
  const salvarVisaoGeral = async (e) => {
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

  // ── Estrutura: seleção na árvore ─────────────────────────────────────
  function toggleExpandida(categoriaId) {
    setExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(categoriaId)) novo.delete(categoriaId); else novo.add(categoriaId);
      return novo;
    });
  }

  function selecionarCategoria(c) {
    setSelecionado({ tipo: 'categoria', id: c.id });
    setRascunho({
      name: c.name, slug: c.slug, icon: c.icon || '', description: c.description || '',
      status: c.status, active: c.active, sortOrder: c.sort_order,
    });
    setAbaPainel('visualizacao');
  }

  function selecionarFerramenta(f, categoriaId) {
    setSelecionado({ tipo: 'ferramenta', id: f.id, categoriaId });
    setRascunho({
      name: f.name, slug: f.slug, icon: f.icon || '', color: f.color || '#7C3AED',
      description: f.description || '', status: f.status, active: f.active, sortOrder: f.sort_order,
      categoriaId,
    });
    setAbaPainel('visualizacao');
  }

  function novaCategoria() {
    setSelecionado({ tipo: 'categoria', id: null, isNew: true });
    setRascunho({ ...RASCUNHO_CATEGORIA });
    setAbaPainel('visualizacao');
  }

  function novaFerramenta(categoriaId) {
    setSelecionado({ tipo: 'ferramenta', id: null, categoriaId, isNew: true });
    setRascunho({ ...RASCUNHO_FERRAMENTA, categoriaId });
    setAbaPainel('visualizacao');
    setExpandidas((atual) => new Set(atual).add(categoriaId));
  }

  // ── Estrutura: salvar/excluir o nó selecionado ───────────────────────
  async function salvarNo(e) {
    e.preventDefault();
    const name = (rascunho.name || '').trim();
    if (name.length < 2) { setError(`Nome ${selecionado.tipo === 'categoria' ? 'da categoria' : 'da ferramenta'} muito curto.`); return; }
    const noSlug = selecionado.isNew ? (rascunho.slug || slugify(name)) : rascunho.slug;
    if (!noSlug) { setError('Não foi possível gerar um identificador.'); return; }
    if (selecionado.tipo === 'ferramenta' && !rascunho.categoriaId) { setError('Selecione em qual categoria a ferramenta aparece.'); return; }

    setSalvandoNo(true);
    setError('');
    try {
      if (selecionado.tipo === 'categoria') {
        const salva = await salvarCategoria({
          systemSlug: slug, slug: noSlug, name, icon: rascunho.icon, description: rascunho.description,
          status: rascunho.status, active: rascunho.active, sortOrder: rascunho.sortOrder,
        }, selecionado.isNew ? null : selecionado.id);
        await carregarEstrutura();
        setSelecionado({ tipo: 'categoria', id: salva.id });
        showToast('Categoria salva.');
      } else {
        const salva = await salvarFerramenta({
          categoriaId: rascunho.categoriaId, slug: noSlug, name, icon: rascunho.icon, color: rascunho.color,
          description: rascunho.description, status: rascunho.status, active: rascunho.active, sortOrder: rascunho.sortOrder,
        }, selecionado.isNew ? null : selecionado.id);
        await carregarEstrutura();
        // Se a ferramenta mudou de categoria, mostra onde ela caiu — abre a
        // categoria de destino na árvore em vez de deixar a seleção "órfã".
        setExpandidas((atual) => new Set(atual).add(rascunho.categoriaId));
        setSelecionado({ tipo: 'ferramenta', id: salva.id, categoriaId: rascunho.categoriaId });
        showToast('Ferramenta salva.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvandoNo(false);
    }
  }

  async function confirmarExclusaoNo() {
    if (!excluindoNo) return;
    try {
      if (excluindoNo.tipo === 'categoria') await excluirCategoria(excluindoNo.id);
      else await excluirFerramenta(excluindoNo.id);
      if (selecionado?.id === excluindoNo.id) { setSelecionado(null); setRascunho(null); }
      setExcluindoNo(null);
      await carregarEstrutura();
      showToast(`"${excluindoNo.name}" excluído.`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return <AdminLayout title="Sistema" subtitle="Carregando..."><Spinner /></AdminLayout>;
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

  const categoriaSelecionada = selecionado
    ? categorias.find((c) => c.id === (selecionado.tipo === 'categoria' ? selecionado.id : selecionado.categoriaId))
    : null;
  const ferramentaSelecionada = selecionado?.tipo === 'ferramenta' && !selecionado.isNew
    ? categoriaSelecionada?.ferramentas.find((f) => f.id === selecionado.id)
    : null;
  const painel = ferramentaSelecionada ? painelInternoDe(ferramentaSelecionada.slug) : null;
  const abasPainel = [
    { id: 'visualizacao', label: 'Visualização' },
    ...(painel ? [{ id: 'interno', label: painel.aba }] : []),
  ];

  return (
    <AdminLayout
      title={system.name}
      subtitle={`Identificador: ${system.slug}${system.internal ? ' · sistema interno' : ''}`}
      actions={<Link to="/admin/sistemas" className="admin-btn">← Sistemas</Link>}
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <TopTabs aba={abaTopo} setAba={setAbaTopo} />

      {/* ── Visão geral ── */}
      {abaTopo === 'visao-geral' && (
        <Card style={{ padding: 22, maxWidth: 720 }}>
          <form onSubmit={salvarVisaoGeral} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

      {/* ── Estrutura: árvore + painel ── */}
      {abaTopo === 'estrutura' && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          <Card style={{ width: 280, flexShrink: 0, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 10px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>Módulos</span>
              <button className="admin-btn" style={{ padding: '4px 9px', fontSize: '0.75rem' }} onClick={novaCategoria}>+ Categoria</button>
            </div>

            {carregandoEstrutura ? <Spinner /> : categorias.length === 0 ? (
              <div style={{ padding: '16px 6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Nenhuma categoria ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {categorias.map((c) => {
                  const aberta = expandidas.has(c.id);
                  const ativaSel = selecionado?.tipo === 'categoria' && selecionado.id === c.id;
                  return (
                    <div key={c.id}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 8,
                          cursor: 'pointer', background: ativaSel ? 'rgba(124,58,237,0.14)' : 'transparent',
                        }}
                        onClick={() => selecionarCategoria(c)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandida(c.id); }}
                          style={{
                            width: 18, height: 18, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: '0.65rem',
                          }}
                        >
                          ▶
                        </button>
                        <span style={{ fontSize: '0.95rem' }}>{c.icon || '🧩'}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: ativaSel ? '#eeede9' : 'rgba(255,255,255,0.85)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        {!c.active && <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>oculta</span>}
                      </div>

                      {aberta && (
                        <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                          {c.ferramentas.map((f) => {
                            const ativaFerr = selecionado?.tipo === 'ferramenta' && selecionado.id === f.id;
                            return (
                              <div
                                key={f.id}
                                onClick={() => selecionarFerramenta(f, c.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 8,
                                  cursor: 'pointer', background: ativaFerr ? 'rgba(124,58,237,0.14)' : 'transparent',
                                }}
                              >
                                <span style={{ fontSize: '0.85rem' }}>{f.icon || '🧩'}</span>
                                <span style={{ fontSize: '0.8rem', color: ativaFerr ? '#eeede9' : 'rgba(255,255,255,0.7)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.name}
                                </span>
                                {!f.active && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>oculta</span>}
                              </div>
                            );
                          })}
                          <button
                            className="admin-btn"
                            style={{ margin: '2px 8px 6px', padding: '4px 9px', fontSize: '0.72rem', alignSelf: 'flex-start' }}
                            onClick={() => novaFerramenta(c.id)}
                          >
                            + Ferramenta
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card style={{ flex: 1, minWidth: 0, padding: 22 }}>
            {!selecionado ? (
              <EmptyState>Selecione um módulo ou uma ferramenta à esquerda para editar — ou crie um novo.</EmptyState>
            ) : (
              <>
                {abasPainel.length > 1 && <InnerTabs abas={abasPainel} aba={abaPainel} setAba={setAbaPainel} />}

                {abaPainel === 'visualizacao' && rascunho && (
                  <form onSubmit={salvarNo} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Nome" full>
                      <input
                        className="admin-input" value={rascunho.name}
                        onChange={(e) => setRascunho({ ...rascunho, name: e.target.value })}
                        placeholder={selecionado.tipo === 'categoria' ? 'Ex: Fiscal' : 'Ex: Calculadora de DIFAL'}
                        required autoFocus
                      />
                    </Field>
                    <Field
                      label="Identificador (slug)" full
                      hint={selecionado.isNew ? 'Usado na rota do hub. Gerado a partir do nome se deixar em branco.' : 'Fixo — a rota do hub depende dele.'}
                    >
                      <input
                        className="admin-input"
                        value={selecionado.isNew ? (rascunho.slug || slugify(rascunho.name)) : rascunho.slug}
                        onChange={(e) => setRascunho({ ...rascunho, slug: slugify(e.target.value) })}
                        disabled={!selecionado.isNew}
                        style={!selecionado.isNew ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                      />
                    </Field>
                    <Field label="Ícone (emoji)">
                      <input className="admin-input" value={rascunho.icon || ''} onChange={(e) => setRascunho({ ...rascunho, icon: e.target.value })} maxLength={4} placeholder="🧾" />
                    </Field>
                    {selecionado.tipo === 'ferramenta' && (
                      <>
                        <Field label="Cor de destaque">
                          <input className="admin-input" type="color" value={rascunho.color || '#7C3AED'} onChange={(e) => setRascunho({ ...rascunho, color: e.target.value })} style={{ padding: 4, height: 38, cursor: 'pointer' }} />
                        </Field>
                        <Field label="Exibir em" full hint="Categoria/módulo do hub onde esta ferramenta aparece. Mudar aqui move o card para lá.">
                          <select className="admin-select" value={rascunho.categoriaId || ''} onChange={(e) => setRascunho({ ...rascunho, categoriaId: e.target.value })} required>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                    <Field label="Ordem de exibição">
                      <input className="admin-input" type="number" value={rascunho.sortOrder ?? 0} onChange={(e) => setRascunho({ ...rascunho, sortOrder: e.target.value })} />
                    </Field>
                    <Field label="Descrição" full>
                      <textarea className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={rascunho.description || ''} onChange={(e) => setRascunho({ ...rascunho, description: e.target.value })} />
                    </Field>
                    <Field label="Status">
                      <select className="admin-select" value={rascunho.status} onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}>
                        <option value="available">Disponível</option>
                        <option value="soon">Em breve</option>
                      </select>
                    </Field>
                    <Field label="Visível no hub">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!rascunho.active} onChange={(e) => setRascunho({ ...rascunho, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }} />
                        <span style={{ fontSize: '0.85rem' }}>Ativa</span>
                      </label>
                    </Field>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {!selecionado.isNew ? (
                        <button
                          type="button" className="admin-btn danger"
                          onClick={() => setExcluindoNo({ tipo: selecionado.tipo, id: selecionado.id, name: rascunho.name })}
                        >
                          Excluir {selecionado.tipo === 'categoria' ? 'categoria' : 'ferramenta'}
                        </button>
                      ) : <span />}
                      <button className="admin-btn primary" type="submit" disabled={salvandoNo}>{salvandoNo ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  </form>
                )}

                {abaPainel === 'interno' && painel && <painel.Componente />}
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Empresas ── */}
      {abaTopo === 'empresas' && (
        <Card style={{ padding: 0 }}>
          {carregandoEmpresas ? <Spinner /> : !empresas?.length ? (
            <EmptyState>Nenhuma empresa com assinatura deste sistema ainda.</EmptyState>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.companies?.name || '—'}</td>
                      <td>{s.plan || '—'}</td>
                      <td><StatusPill status={s.status} /></td>
                      <td>{s.amount != null ? `R$ ${Number(s.amount).toFixed(2)}` : '—'}</td>
                      <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Configurações ── */}
      {abaTopo === 'configuracoes' && (
        <Card style={{ padding: 22, maxWidth: 560 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Identificador (slug)" hint="Fixo — assinaturas existentes dependem dele.">
              <input className="admin-input" value={system.slug} disabled style={{ opacity: 0.6, cursor: 'not-allowed', fontFamily: 'monospace' }} />
            </Field>
            <Field label="Tipo" hint={system.internal ? 'A rota é definida no código da aplicação.' : 'Sistema externo — o link de acesso vale como está em Visão geral.'}>
              <span className="admin-pill" style={{
                background: system.internal ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.05)',
                color: system.internal ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                borderColor: system.internal ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.12)',
                width: 'fit-content',
              }}>
                {system.internal ? 'Interno' : 'Externo'}
              </span>
            </Field>
            {system.aliases?.length > 0 && (
              <Field label="Identificadores antigos (aliases)" hint="Mantidos para não quebrar assinaturas gravadas antes de uma renomeação.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {system.aliases.map((a) => (
                    <span key={a} className="admin-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>{a}</span>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </Card>
      )}

      {/* ── Modal: confirmar exclusão de categoria/ferramenta ── */}
      <Modal
        open={!!excluindoNo}
        onClose={() => setExcluindoNo(null)}
        title={`Excluir ${excluindoNo?.tipo === 'categoria' ? 'categoria' : 'ferramenta'}`}
        footer={
          <>
            <button className="admin-btn" onClick={() => setExcluindoNo(null)}>Cancelar</button>
            <button className="admin-btn danger" onClick={confirmarExclusaoNo}>Excluir definitivamente</button>
          </>
        }
      >
        {excluindoNo && (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
            Excluir {excluindoNo.tipo === 'categoria' ? 'a categoria' : 'a ferramenta'}{' '}
            <strong style={{ color: '#eeede9' }}>{excluindoNo.name}</strong>
            {excluindoNo.tipo === 'categoria' ? ' e todas as suas ferramentas' : ''} do catálogo?
            Esta ação não pode ser desfeita.
          </p>
        )}
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
