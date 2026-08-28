// Editor de um sistema — uma tela só, sem navegar entre páginas.
//
// Abas no topo: Visão geral | Estrutura | Empresas | Configurações.
// "Estrutura" é uma árvore (categorias → ferramentas) à esquerda; clicar em
// qualquer nó edita ele no painel à direita, sem sair da tela. Uma
// ferramenta com configuração interna registrada (paineisInternos.jsx)
// ganha uma aba extra dentro do próprio painel — é onde as regras de DIFAL
// moram agora, dentro de Fiscal → Calculadora de DIFAL.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { Card, Modal, Spinner, EmptyState, StatusPill } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { SYSTEM_LOGOS_BUCKET } from '../../lib/systems';
import {
  listarCategorias, listarSubcategorias, listarFerramentas, salvarCategoria, excluirCategoria,
  salvarFerramenta, excluirFerramenta, moverFerramenta, moverCategoria,
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

const RASCUNHO_CATEGORIA = { name: '', slug: '', icon: '', description: '', status: 'available', active: true, parentCategoriaId: null };
const RASCUNHO_FERRAMENTA = { name: '', slug: '', icon: '', color: '#7C3AED', description: '', status: 'available', active: true };

// Achata a árvore (categorias de topo + suas sub-categorias) numa lista só
// — usada pra achar um nó por id (drag-and-drop, cálculo de posição) e pra
// montar o select "Exibir em" sem duplicar a travessia em vários lugares.
function nosFlat(categorias) {
  const flat = [];
  for (const c of categorias) {
    flat.push(c);
    for (const s of c.subcategorias || []) flat.push(s);
  }
  return flat;
}

// Ícone de arraste — só um afago visual (⠿), a linha inteira já é
// arrastável, não precisa acertar o pixel exato do ícone.
function IArrastar() {
  return (
    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.28)', cursor: 'grab', flexShrink: 0, userSelect: 'none' }} title="Arraste para reordenar ou mover">
      ⠿
    </span>
  );
}

// Realça a parte do texto que bateu com a busca — só cosmético, não muda o
// texto real (o rascunho de edição continua usando o nome original).
function Realce({ texto, termo }) {
  if (!termo) return texto;
  const idx = String(texto || '').toLowerCase().indexOf(termo);
  if (idx === -1) return texto;
  return (
    <>
      {texto.slice(0, idx)}
      <mark style={{ background: 'rgba(124,58,237,0.4)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}>
        {texto.slice(idx, idx + termo.length)}
      </mark>
      {texto.slice(idx + termo.length)}
    </>
  );
}

// Menu de ações "⋯" por linha da árvore — substitui os botões fixos de
// adicionar/excluir que antes ficavam sempre visíveis (poluindo a árvore) e
// concentra adicionar/renomear/excluir num só lugar por nó.
function MenuAcoes({ itens }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(e) { if (ref.current && !ref.current.contains(e.target)) setAberto(false); }
    function aoTeclarEsc(e) { if (e.key === 'Escape') setAberto(false); }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclarEsc);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclarEsc);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="adm-genjutsu" style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Mais ações" aria-haspopup="menu" aria-expanded={aberto}
        style={{
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: aberto ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: 6,
          color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1,
          transition: 'background 0.12s ease-out, color 0.12s ease-out',
        }}
      >
        ⋯
      </button>
      {aberto && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 172, zIndex: 30,
            background: '#16161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            boxShadow: '0 14px 34px rgba(0,0,0,0.55)', padding: 4,
            animation: 'admMenuIn 0.12s cubic-bezier(0.2,0,0,1) both',
          }}
        >
          {itens.map((it, i) => (it.divisor ? (
            <div key={`div-${i}`} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />
          ) : (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => { setAberto(false); it.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '7px 9px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                color: it.perigo ? '#ff6b6b' : '#eeede9',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = it.perigo ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {it.label}
            </button>
          )))}
        </div>
      )}
    </div>
  );
}

// Metade de cima ou de baixo da linha, a partir do Y do cursor — decide se
// soltar aqui insere ANTES ou DEPOIS deste item, em vez de sempre antes.
function metadeDaLinha(e) {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'antes' : 'depois';
}

// Uma ferramenta na árvore — arrastável (reordena dentro da lista ou muda
// de categoria/subcategoria ao soltar em outro pai). `alvoArraste` pinta uma
// linha de inserção antes OU depois do item sob o cursor, conforme a metade
// da linha em que o ponteiro está — não só "sempre antes".
function NoFerramenta({
  f, categoriaId, selecionado, arrastando, alvoArraste, renomeando, termoBusca,
  onSelecionar, onDragStart, onDragEnd, onDragOverRow, onDrop,
  onIniciarRenomeio, onRenomeioMudar, onRenomeioConfirmar, onRenomeioCancelar, onExcluir,
}) {
  const ativaSel = selecionado?.tipo === 'ferramenta' && selecionado.id === f.id;
  const sendoArrastada = arrastando?.id === f.id;
  const alvoNestaLinha = alvoArraste?.categoriaId === categoriaId && alvoArraste?.itemId === f.id;
  const renomeandoEsta = renomeando?.tipo === 'ferramenta' && renomeando.id === f.id;

  return (
    <div
      draggable={!renomeandoEsta}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (arrastando) { e.preventDefault(); e.stopPropagation(); onDragOverRow(metadeDaLinha(e)); } }}
      onDrop={(e) => { if (arrastando) { e.preventDefault(); e.stopPropagation(); onDrop(metadeDaLinha(e)); } }}
      onClick={() => !renomeandoEsta && onSelecionar(f, categoriaId)}
      className="adm-genjutsu"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8,
        cursor: renomeandoEsta ? 'default' : 'pointer', background: ativaSel ? 'rgba(124,58,237,0.14)' : 'transparent',
        opacity: sendoArrastada ? 0.35 : 1,
        outline: sendoArrastada ? '1px dashed rgba(124,58,237,0.5)' : 'none', outlineOffset: -1,
        borderTop: alvoNestaLinha && alvoArraste.posicao === 'antes' ? '2px solid #7C3AED' : '2px solid transparent',
        borderBottom: alvoNestaLinha && alvoArraste.posicao === 'depois' ? '2px solid #7C3AED' : '2px solid transparent',
        transition: 'background 0.12s ease-out, opacity 0.15s ease-out, border-color 0.1s ease-out',
      }}
    >
      <IArrastar />
      <span style={{ fontSize: '0.85rem' }}>{f.icon || '🧩'}</span>
      {renomeandoEsta ? (
        <input
          autoFocus
          className="admin-input"
          value={renomeando.valor}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRenomeioMudar(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onRenomeioConfirmar(); }
            if (e.key === 'Escape') { e.preventDefault(); onRenomeioCancelar(); }
          }}
          onBlur={onRenomeioConfirmar}
          style={{ flex: 1, minWidth: 0, padding: '3px 7px', fontSize: '0.8rem', height: 26 }}
        />
      ) : (
        <span title={f.name} style={{ fontSize: '0.8rem', fontWeight: 600, color: ativaSel ? '#eeede9' : 'rgba(255,255,255,0.75)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Realce texto={f.name} termo={termoBusca} />
        </span>
      )}
      {f.status === 'soon' && <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>em breve</span>}
      {!f.active && <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>oculta</span>}
      {!renomeandoEsta && (
        <MenuAcoes itens={[
          { label: 'Renomear', onClick: () => onIniciarRenomeio(f) },
          { divisor: true },
          { label: 'Excluir', perigo: true, onClick: onExcluir },
        ]}
        />
      )}
    </div>
  );
}

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
  const [busca, setBusca] = useState('');
  const [renomeando, setRenomeando] = useState(null); // { tipo, id, valor } | null
  const renomeioConfirmadoRef = useRef(false);

  // Largura da árvore, redimensionável arrastando a borda direita —
  // lembrada entre sessões (preferência do admin, não do sistema aberto).
  const arvoreRef = useRef(null);
  const [larguraArvore, setLarguraArvore] = useState(() => {
    const salva = Number(localStorage.getItem('admin-estrutura-largura'));
    return Number.isFinite(salva) && salva >= 220 && salva <= 560 ? salva : 300;
  });
  const [redimensionando, setRedimensionando] = useState(false);

  useEffect(() => {
    if (!redimensionando) return undefined;
    function aoMover(e) {
      if (!arvoreRef.current) return;
      const rect = arvoreRef.current.getBoundingClientRect();
      setLarguraArvore(Math.min(560, Math.max(220, e.clientX - rect.left)));
    }
    function aoSoltar() {
      setRedimensionando(false);
      setLarguraArvore((atual) => { localStorage.setItem('admin-estrutura-largura', String(atual)); return atual; });
    }
    document.addEventListener('mousemove', aoMover);
    document.addEventListener('mouseup', aoSoltar);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', aoMover);
      document.removeEventListener('mouseup', aoSoltar);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [redimensionando]);

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
      const raizes = await listarCategorias(slug, { apenasRaiz: true });
      const completo = await Promise.all(raizes.map(async (c) => {
        const [ferramentas, subs] = await Promise.all([
          listarFerramentas(c.id),
          listarSubcategorias(c.id),
        ]);
        const subcategorias = await Promise.all(
          subs.map(async (s) => ({ ...s, ferramentas: await listarFerramentas(s.id) })),
        );
        return { ...c, ferramentas, subcategorias };
      }));
      setCategorias(completo);
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

  // Busca na árvore: acha quais nós (por id) batem com o termo e quais
  // categorias precisam abrir à força pra revelar o resultado — sem isso, um
  // resultado dentro de uma sub-categoria fechada fica invisível mesmo tendo
  // "achado". `null` quando não há busca ativa = usa `expandidas` normal.
  const termoBusca = busca.trim().toLowerCase();
  const resultadoBusca = useMemo(() => {
    if (!termoBusca) return null;
    const bate = (nome) => String(nome || '').toLowerCase().includes(termoBusca);
    const visiveis = new Set();
    const abrirForcado = new Set();
    for (const c of categorias) {
      const ferramentasBatem = c.ferramentas.filter((f) => bate(f.name));
      ferramentasBatem.forEach((f) => visiveis.add(f.id));
      let algumaSubBateu = false;
      for (const s of c.subcategorias) {
        const ferramentasSubBatem = s.ferramentas.filter((f) => bate(f.name));
        ferramentasSubBatem.forEach((f) => visiveis.add(f.id));
        if (bate(s.name) || ferramentasSubBatem.length) {
          visiveis.add(s.id);
          algumaSubBateu = true;
          if (ferramentasSubBatem.length) abrirForcado.add(s.id);
        }
      }
      if (bate(c.name) || ferramentasBatem.length || algumaSubBateu) {
        visiveis.add(c.id);
        abrirForcado.add(c.id);
      }
    }
    return { visiveis, abrirForcado };
  }, [categorias, termoBusca]);

  function categoriaVisivel(id) { return !resultadoBusca || resultadoBusca.visiveis.has(id); }
  function categoriaAberta(id) { return resultadoBusca ? resultadoBusca.abrirForcado.has(id) : expandidas.has(id); }

  // ── Estrutura: renomear rápido pelo menu "⋯" (só o nome — o resto do
  // cadastro fica como está; para editar mais campos, clique no nó) ──────
  function iniciarRenomeio(tipo, no) {
    renomeioConfirmadoRef.current = false;
    setRenomeando({ tipo, id: no.id, valor: no.name });
  }

  function cancelarRenomeio() {
    renomeioConfirmadoRef.current = true;
    setRenomeando(null);
  }

  async function confirmarRenomeio() {
    if (!renomeando || renomeioConfirmadoRef.current) return;
    renomeioConfirmadoRef.current = true;
    const { tipo, id, valor } = renomeando;
    const nome = valor.trim();
    setRenomeando(null);
    if (nome.length < 2) return;
    try {
      if (tipo === 'categoria') {
        const no = nosFlat(categorias).find((c) => c.id === id);
        if (!no || no.name === nome) return;
        await salvarCategoria({
          systemSlug: slug, slug: no.slug, name: nome, icon: no.icon, description: no.description,
          status: no.status, active: no.active, sortOrder: no.sort_order, parentCategoriaId: no.parent_categoria_id || null,
        }, id);
      } else {
        const no = nosFlat(categorias).flatMap((n) => n.ferramentas).find((f) => f.id === id);
        if (!no || no.name === nome) return;
        await salvarFerramenta({
          categoriaId: no.categoria_id, slug: no.slug, name: nome, icon: no.icon, color: no.color,
          description: no.description, status: no.status, active: no.active, sortOrder: no.sort_order,
        }, id);
      }
      await carregarEstrutura();
      showToast('Nome atualizado.');
    } catch (e) {
      setError(e.message);
    }
  }

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
      status: c.status, active: c.active,
      parentCategoriaId: c.parent_categoria_id || null,
    });
    setAbaPainel('visualizacao');
  }

  function selecionarFerramenta(f, categoriaId) {
    setSelecionado({ tipo: 'ferramenta', id: f.id, categoriaId });
    setRascunho({
      name: f.name, slug: f.slug, icon: f.icon || '', color: f.color || '#7C3AED',
      description: f.description || '', status: f.status, active: f.active,
      categoriaId,
    });
    setAbaPainel('visualizacao');
  }

  function novaCategoria() {
    setSelecionado({ tipo: 'categoria', id: null, isNew: true });
    setRascunho({ ...RASCUNHO_CATEGORIA });
    setAbaPainel('visualizacao');
  }

  function novaSubcategoria(parentCategoriaId) {
    setSelecionado({ tipo: 'categoria', id: null, isNew: true });
    setRascunho({ ...RASCUNHO_CATEGORIA, parentCategoriaId });
    setAbaPainel('visualizacao');
    setExpandidas((atual) => new Set(atual).add(parentCategoriaId));
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
        // A ordem não é mais digitada — segue o mesmo padrão da ferramenta:
        // categoria existente mantém a posição que já tinha (a árvore é que
        // muda isso, arrastando); categoria nova entra no fim da lista onde
        // vai aparecer (topo, ou sub-categorias do pai escolhido).
        const paiId = rascunho.parentCategoriaId || null;
        const sortOrder = selecionado.isNew
          ? (paiId ? (categorias.find((c) => c.id === paiId)?.subcategorias.length || 0) : categorias.length)
          : nosFlat(categorias).find((c) => c.id === selecionado.id)?.sort_order ?? 0;
        const salva = await salvarCategoria({
          systemSlug: slug, slug: noSlug, name, icon: rascunho.icon, description: rascunho.description,
          status: rascunho.status, active: rascunho.active, sortOrder,
          parentCategoriaId: paiId,
        }, selecionado.isNew ? null : selecionado.id);
        await carregarEstrutura();
        setSelecionado({ tipo: 'categoria', id: salva.id });
        showToast('Categoria salva.');
      } else {
        // A ordem não vem mais de um campo digitado — o formulário não mexe
        // nela: se a ferramenta ficou na mesma categoria, mantém a posição
        // que já tinha; se é nova ou mudou de categoria, entra no fim da
        // lista de destino (dali, arrastar reordena).
        const destino = nosFlat(categorias).find((n) => n.id === rascunho.categoriaId);
        const original = !selecionado.isNew
          ? nosFlat(categorias).flatMap((n) => n.ferramentas).find((f) => f.id === selecionado.id)
          : null;
        const categoriaMudou = selecionado.isNew || original?.categoria_id !== rascunho.categoriaId;
        const sortOrder = categoriaMudou ? (destino?.ferramentas.length || 0) : original.sort_order;

        const salva = await salvarFerramenta({
          categoriaId: rascunho.categoriaId, slug: noSlug, name, icon: rascunho.icon, color: rascunho.color,
          description: rascunho.description, status: rascunho.status, active: rascunho.active, sortOrder,
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

  // ── Estrutura: arrastar e soltar ferramentas ─────────────────────────
  const [arrastando, setArrastando] = useState(null); // { id, categoriaId } | null
  const [alvoArraste, setAlvoArraste] = useState(null); // { categoriaId, itemId, posicao } | null — só visual

  // Desfaz o último arrastar — devolve cada ferramenta tocada pra
  // categoria/posição exata que tinha antes, sem precisar recalcular nada:
  // o snapshot já é a lista pronta pra reaplicar.
  async function desfazerMovimento(snapshotAntes) {
    setError('');
    try {
      await Promise.all(snapshotAntes.map((s) => moverFerramenta(s.id, { categoriaId: s.categoriaId, sortOrder: s.sortOrder })));
      await carregarEstrutura();
      showToast('Movimento desfeito.');
    } catch (e) {
      setError(e.message);
    }
  }

  // `alvo` é { itemId, posicao: 'antes'|'depois' } quando soltou em cima de
  // outra ferramenta, ou `null` quando soltou no cabeçalho da categoria (vai
  // pro fim da lista).
  async function soltarFerramenta(categoriaId, alvo) {
    const origem = arrastando;
    setArrastando(null);
    setAlvoArraste(null);
    if (!origem) return;
    if (alvo && alvo.itemId === origem.id) return; // soltou em cima de si mesma

    const todos = nosFlat(categorias);
    const noOrigem = todos.find((n) => n.id === origem.categoriaId);
    const noDestino = todos.find((n) => n.id === categoriaId);
    if (!noOrigem || !noDestino) return;
    const item = noOrigem.ferramentas.find((f) => f.id === origem.id);
    if (!item) return;

    const mesmaLista = origem.categoriaId === categoriaId;

    // Antes de mexer em qualquer coisa, guarda onde cada ferramenta tocada
    // estava — é o que "Desfazer" no toast restaura.
    const snapshotAntes = [
      ...noOrigem.ferramentas.map((f) => ({ id: f.id, categoriaId: origem.categoriaId, sortOrder: f.sort_order })),
      ...(mesmaLista ? [] : noDestino.ferramentas.map((f) => ({ id: f.id, categoriaId, sortOrder: f.sort_order }))),
    ];

    const listaDestino = noDestino.ferramentas.filter((f) => f.id !== origem.id);
    let indice = listaDestino.length; // padrão: soltou no cabeçalho → fim da lista
    if (alvo) {
      const posAlvo = listaDestino.findIndex((f) => f.id === alvo.itemId);
      if (posAlvo !== -1) indice = alvo.posicao === 'depois' ? posAlvo + 1 : posAlvo;
    }
    listaDestino.splice(indice, 0, item);

    setError('');
    try {
      await Promise.all(listaDestino.map((f, i) => moverFerramenta(f.id, { categoriaId, sortOrder: i })));
      if (!mesmaLista) {
        const listaOrigem = noOrigem.ferramentas.filter((f) => f.id !== origem.id);
        await Promise.all(listaOrigem.map((f, i) => moverFerramenta(f.id, { categoriaId: origem.categoriaId, sortOrder: i })));
        setExpandidas((atual) => new Set(atual).add(categoriaId));
      }
      await carregarEstrutura();
      if (selecionado?.tipo === 'ferramenta' && selecionado.id === origem.id) {
        setSelecionado({ tipo: 'ferramenta', id: origem.id, categoriaId });
        setRascunho((r) => (r ? { ...r, categoriaId } : r));
      }
      showToast(mesmaLista ? 'Ordem atualizada.' : `"${item.name}" movida.`, 'success', {
        label: 'Desfazer',
        onClick: () => desfazerMovimento(snapshotAntes),
      });
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Estrutura: arrastar e soltar categorias/sub-categorias (reordenar só
  // dentro do mesmo pai — não é o que move uma categoria pra outro nível) ──
  const [arrastandoNo, setArrastandoNo] = useState(null); // { id, parentId } | null
  const [alvoArrasteNo, setAlvoArrasteNo] = useState(null); // { parentId, itemId, posicao } | null

  async function desfazerOrdemNo(snapshotAntes) {
    setError('');
    try {
      await Promise.all(snapshotAntes.map((s) => moverCategoria(s.id, s.sortOrder)));
      await carregarEstrutura();
      showToast('Ordem desfeita.');
    } catch (e) {
      setError(e.message);
    }
  }

  // `parentId` null = módulos de topo; um id = sub-categorias daquele módulo.
  // `alvo` é { itemId, posicao } quando soltou em cima de outra categoria da
  // mesma lista, ou `null` quando soltou no fim (cabeçalho do próprio pai).
  async function soltarNo(parentId, alvo) {
    const origem = arrastandoNo;
    setArrastandoNo(null);
    setAlvoArrasteNo(null);
    if (!origem || origem.parentId !== parentId) return; // não muda de nível arrastando
    if (alvo && alvo.itemId === origem.id) return;

    const lista = parentId ? categorias.find((c) => c.id === parentId)?.subcategorias : categorias;
    if (!lista) return;
    const item = lista.find((n) => n.id === origem.id);
    if (!item) return;

    const snapshotAntes = lista.map((n) => ({ id: n.id, sortOrder: n.sort_order }));

    const listaSemOrigem = lista.filter((n) => n.id !== origem.id);
    let indice = listaSemOrigem.length;
    if (alvo) {
      const posAlvo = listaSemOrigem.findIndex((n) => n.id === alvo.itemId);
      if (posAlvo !== -1) indice = alvo.posicao === 'depois' ? posAlvo + 1 : posAlvo;
    }
    listaSemOrigem.splice(indice, 0, item);
    if (listaSemOrigem.every((n, i) => n.id === lista[i]?.id)) return; // soltou no mesmo lugar

    setError('');
    try {
      await Promise.all(listaSemOrigem.map((n, i) => moverCategoria(n.id, i)));
      await carregarEstrutura();
      showToast('Ordem atualizada.', 'success', { label: 'Desfazer', onClick: () => desfazerOrdemNo(snapshotAntes) });
    } catch (e) {
      setError(e.message);
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
    ? nosFlat(categorias).find((c) => c.id === (selecionado.tipo === 'categoria' ? selecionado.id : selecionado.categoriaId))
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
          <style>{`
            @keyframes admMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @media (prefers-reduced-motion: reduce) {
              .adm-genjutsu, .adm-genjutsu * { transition: none !important; animation: none !important; }
            }
            .adm-resize-handle { background: transparent; transition: background 0.15s ease-out; }
            .adm-resize-handle:hover, .adm-resize-handle.ativo { background: rgba(124,58,237,0.4); }
          `}</style>
          <div
            ref={arvoreRef}
            className="adm-genjutsu"
            style={{
              width: larguraArvore, flexShrink: 0, padding: 12, display: 'flex', flexDirection: 'column',
              position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 10px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>Módulos</span>
              <button className="admin-btn" style={{ padding: '4px 9px', fontSize: '0.75rem' }} onClick={novaCategoria}>+ Categoria</button>
            </div>

            <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
              <input
                className="admin-input"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar módulo ou ferramenta…"
                style={{ padding: '7px 26px 7px 26px', fontSize: '0.8rem', height: 32 }}
              />
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>⌕</span>
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  aria-label="Limpar busca"
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.85rem', padding: 5, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {carregandoEstrutura ? <Spinner /> : categorias.length === 0 ? (
                <div style={{ padding: '16px 6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Nenhuma categoria ainda.</div>
              ) : resultadoBusca && resultadoBusca.visiveis.size === 0 ? (
                <div style={{ padding: '16px 6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Nada encontrado para "{busca.trim()}".</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {categorias.filter((c) => categoriaVisivel(c.id)).map((c) => {
                    const aberta = categoriaAberta(c.id);
                    const ativaSel = selecionado?.tipo === 'categoria' && selecionado.id === c.id;
                    const renomeandoEsta = renomeando?.tipo === 'categoria' && renomeando.id === c.id;
                    const alvoCabecalho = arrastando && alvoArraste?.categoriaId === c.id && !alvoArraste?.itemId;
                    const sendoArrastadaNo = arrastandoNo?.id === c.id;
                    const alvoNoAqui = alvoArrasteNo?.parentId === null && alvoArrasteNo?.itemId === c.id;
                    return (
                      <div key={c.id}>
                        <div
                          className="adm-genjutsu"
                          draggable={!renomeandoEsta}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 9,
                            cursor: renomeandoEsta ? 'default' : 'pointer',
                            background: ativaSel ? 'rgba(124,58,237,0.16)' : alvoCabecalho ? 'rgba(124,58,237,0.08)' : 'transparent',
                            outline: alvoCabecalho ? '1px dashed rgba(124,58,237,0.5)' : 'none', outlineOffset: -1,
                            opacity: sendoArrastadaNo ? 0.35 : 1,
                            borderTop: alvoNoAqui && alvoArrasteNo.posicao === 'antes' ? '2px solid #7C3AED' : '2px solid transparent',
                            borderBottom: alvoNoAqui && alvoArrasteNo.posicao === 'depois' ? '2px solid #7C3AED' : '2px solid transparent',
                            transition: 'background 0.12s ease-out, opacity 0.15s ease-out, border-color 0.1s ease-out',
                          }}
                          onClick={() => !renomeandoEsta && selecionarCategoria(c)}
                          onDragStart={(e) => { e.stopPropagation(); setArrastandoNo({ id: c.id, parentId: null }); }}
                          onDragEnd={() => { setArrastandoNo(null); setAlvoArrasteNo(null); }}
                          onDragOver={(e) => {
                            if (arrastando) { e.preventDefault(); setAlvoArraste({ categoriaId: c.id, itemId: null, posicao: null }); }
                            else if (arrastandoNo && arrastandoNo.parentId === null && arrastandoNo.id !== c.id) {
                              e.preventDefault(); e.stopPropagation();
                              setAlvoArrasteNo({ parentId: null, itemId: c.id, posicao: metadeDaLinha(e) });
                            }
                          }}
                          onDrop={(e) => {
                            if (arrastando) { e.preventDefault(); e.stopPropagation(); soltarFerramenta(c.id, null); }
                            else if (arrastandoNo && arrastandoNo.parentId === null) {
                              e.preventDefault(); e.stopPropagation();
                              soltarNo(null, { itemId: c.id, posicao: metadeDaLinha(e) });
                            }
                          }}
                        >
                          <IArrastar />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpandida(c.id); }}
                            style={{
                              width: 18, height: 18, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease-out', fontSize: '0.65rem',
                            }}
                          >
                            ▶
                          </button>
                          <span style={{
                            width: 24, height: 24, flexShrink: 0, borderRadius: 7, background: 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.92rem',
                          }}
                          >
                            {c.icon || '🧩'}
                          </span>
                          {renomeandoEsta ? (
                            <input
                              autoFocus className="admin-input" value={renomeando.valor}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenomeando((r) => ({ ...r, valor: e.target.value }))}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); confirmarRenomeio(); }
                                if (e.key === 'Escape') { e.preventDefault(); cancelarRenomeio(); }
                              }}
                              onBlur={confirmarRenomeio}
                              style={{ flex: 1, minWidth: 0, padding: '3px 7px', fontSize: '0.85rem', height: 28 }}
                            />
                          ) : (
                            <span title={c.name} style={{ fontSize: '0.86rem', fontWeight: 700, color: ativaSel ? '#eeede9' : 'rgba(255,255,255,0.92)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Realce texto={c.name} termo={termoBusca} />
                            </span>
                          )}
                          {!c.active && <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>oculta</span>}
                          {!renomeandoEsta && (
                            <MenuAcoes itens={[
                              { label: 'Renomear', onClick: () => iniciarRenomeio('categoria', c) },
                              { label: 'Nova ferramenta', onClick: () => novaFerramenta(c.id) },
                              { label: 'Nova subcategoria', onClick: () => novaSubcategoria(c.id) },
                              { divisor: true },
                              { label: 'Excluir', perigo: true, onClick: () => setExcluindoNo({ tipo: 'categoria', id: c.id, name: c.name }) },
                            ]}
                            />
                          )}
                        </div>

                        {aberta && (c.ferramentas.length > 0 || c.subcategorias.length > 0) && (
                          <div style={{ marginLeft: 20, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, marginBottom: 2 }}>
                            {c.ferramentas.filter((f) => categoriaVisivel(f.id)).map((f) => (
                              <NoFerramenta
                                key={f.id} f={f} categoriaId={c.id} termoBusca={termoBusca}
                                selecionado={selecionado} arrastando={arrastando} alvoArraste={alvoArraste} renomeando={renomeando}
                                onSelecionar={selecionarFerramenta}
                                onDragStart={() => setArrastando({ id: f.id, categoriaId: c.id })}
                                onDragEnd={() => { setArrastando(null); setAlvoArraste(null); }}
                                onDragOverRow={(pos) => setAlvoArraste({ categoriaId: c.id, itemId: f.id, posicao: pos })}
                                onDrop={(pos) => soltarFerramenta(c.id, { itemId: f.id, posicao: pos })}
                                onIniciarRenomeio={(no) => iniciarRenomeio('ferramenta', no)}
                                onRenomeioMudar={(valor) => setRenomeando((r) => ({ ...r, valor }))}
                                onRenomeioConfirmar={confirmarRenomeio}
                                onRenomeioCancelar={cancelarRenomeio}
                                onExcluir={() => setExcluindoNo({ tipo: 'ferramenta', id: f.id, name: f.name })}
                              />
                            ))}

                            {c.subcategorias.filter((s) => categoriaVisivel(s.id)).map((s) => {
                              const subAberta = categoriaAberta(s.id);
                              const subAtivaSel = selecionado?.tipo === 'categoria' && selecionado.id === s.id;
                              const renomeandoSub = renomeando?.tipo === 'categoria' && renomeando.id === s.id;
                              const alvoCabecalhoSub = arrastando && alvoArraste?.categoriaId === s.id && !alvoArraste?.itemId;
                              const sendoArrastadaNoSub = arrastandoNo?.id === s.id;
                              const alvoNoAquiSub = alvoArrasteNo?.parentId === c.id && alvoArrasteNo?.itemId === s.id;
                              return (
                                <div key={s.id}>
                                  <div
                                    className="adm-genjutsu"
                                    draggable={!renomeandoSub}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 7px', borderRadius: 8,
                                      cursor: renomeandoSub ? 'default' : 'pointer',
                                      background: subAtivaSel ? 'rgba(124,58,237,0.14)' : alvoCabecalhoSub ? 'rgba(124,58,237,0.08)' : 'transparent',
                                      outline: alvoCabecalhoSub ? '1px dashed rgba(124,58,237,0.5)' : 'none', outlineOffset: -1,
                                      opacity: sendoArrastadaNoSub ? 0.35 : 1,
                                      borderTop: alvoNoAquiSub && alvoArrasteNo.posicao === 'antes' ? '2px solid #7C3AED' : '2px solid transparent',
                                      borderBottom: alvoNoAquiSub && alvoArrasteNo.posicao === 'depois' ? '2px solid #7C3AED' : '2px solid transparent',
                                      transition: 'background 0.12s ease-out, opacity 0.15s ease-out, border-color 0.1s ease-out',
                                    }}
                                    onClick={() => !renomeandoSub && selecionarCategoria(s)}
                                    onDragStart={(e) => { e.stopPropagation(); setArrastandoNo({ id: s.id, parentId: c.id }); }}
                                    onDragEnd={() => { setArrastandoNo(null); setAlvoArrasteNo(null); }}
                                    onDragOver={(e) => {
                                      if (arrastando) { e.preventDefault(); setAlvoArraste({ categoriaId: s.id, itemId: null, posicao: null }); }
                                      else if (arrastandoNo && arrastandoNo.parentId === c.id && arrastandoNo.id !== s.id) {
                                        e.preventDefault(); e.stopPropagation();
                                        setAlvoArrasteNo({ parentId: c.id, itemId: s.id, posicao: metadeDaLinha(e) });
                                      }
                                    }}
                                    onDrop={(e) => {
                                      if (arrastando) { e.preventDefault(); e.stopPropagation(); soltarFerramenta(s.id, null); }
                                      else if (arrastandoNo && arrastandoNo.parentId === c.id) {
                                        e.preventDefault(); e.stopPropagation();
                                        soltarNo(c.id, { itemId: s.id, posicao: metadeDaLinha(e) });
                                      }
                                    }}
                                  >
                                    <IArrastar />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleExpandida(s.id); }}
                                      style={{
                                        width: 16, height: 16, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transform: subAberta ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease-out', fontSize: '0.6rem',
                                      }}
                                    >
                                      ▶
                                    </button>
                                    <span style={{ fontSize: '0.82rem' }}>{s.icon || '🧩'}</span>
                                    {renomeandoSub ? (
                                      <input
                                        autoFocus className="admin-input" value={renomeando.valor}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setRenomeando((r) => ({ ...r, valor: e.target.value }))}
                                        onFocus={(e) => e.target.select()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') { e.preventDefault(); confirmarRenomeio(); }
                                          if (e.key === 'Escape') { e.preventDefault(); cancelarRenomeio(); }
                                        }}
                                        onBlur={confirmarRenomeio}
                                        style={{ flex: 1, minWidth: 0, padding: '3px 7px', fontSize: '0.8rem', height: 26 }}
                                      />
                                    ) : (
                                      <span title={s.name} style={{ fontSize: '0.78rem', fontWeight: 600, color: subAtivaSel ? '#eeede9' : 'rgba(255,255,255,0.78)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <Realce texto={s.name} termo={termoBusca} />
                                      </span>
                                    )}
                                    {!s.active && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>oculta</span>}
                                    {!renomeandoSub && (
                                      <MenuAcoes itens={[
                                        { label: 'Renomear', onClick: () => iniciarRenomeio('categoria', s) },
                                        { label: 'Nova ferramenta', onClick: () => novaFerramenta(s.id) },
                                        { divisor: true },
                                        { label: 'Excluir', perigo: true, onClick: () => setExcluindoNo({ tipo: 'categoria', id: s.id, name: s.name }) },
                                      ]}
                                      />
                                    )}
                                  </div>

                                  {subAberta && (
                                    <div style={{ marginLeft: 18, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1, marginBottom: 1 }}>
                                      {s.ferramentas.filter((f) => categoriaVisivel(f.id)).map((f) => (
                                        <NoFerramenta
                                          key={f.id} f={f} categoriaId={s.id} termoBusca={termoBusca}
                                          selecionado={selecionado} arrastando={arrastando} alvoArraste={alvoArraste} renomeando={renomeando}
                                          onSelecionar={selecionarFerramenta}
                                          onDragStart={() => setArrastando({ id: f.id, categoriaId: s.id })}
                                          onDragEnd={() => { setArrastando(null); setAlvoArraste(null); }}
                                          onDragOverRow={(pos) => setAlvoArraste({ categoriaId: s.id, itemId: f.id, posicao: pos })}
                                          onDrop={(pos) => soltarFerramenta(s.id, { itemId: f.id, posicao: pos })}
                                          onIniciarRenomeio={(no) => iniciarRenomeio('ferramenta', no)}
                                          onRenomeioMudar={(valor) => setRenomeando((r) => ({ ...r, valor }))}
                                          onRenomeioConfirmar={confirmarRenomeio}
                                          onRenomeioCancelar={cancelarRenomeio}
                                          onExcluir={() => setExcluindoNo({ tipo: 'ferramenta', id: f.id, name: f.name })}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              className={`adm-resize-handle${redimensionando ? ' ativo' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setRedimensionando(true); }}
              title="Arraste para redimensionar a árvore"
              style={{ position: 'absolute', top: 0, right: -4, bottom: 0, width: 8, cursor: 'col-resize', zIndex: 5 }}
            />
          </div>

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
                        <Field label="Exibir em" full hint="Categoria/módulo do hub onde esta ferramenta aparece. Mudar aqui move o card para lá — a mesma coisa que arrastar na árvore.">
                          <select className="admin-select" value={rascunho.categoriaId || ''} onChange={(e) => setRascunho({ ...rascunho, categoriaId: e.target.value })} required>
                            {nosFlat(categorias).map((c) => (
                              <option key={c.id} value={c.id}>{c.parent_categoria_id ? '— ' : ''}{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
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
