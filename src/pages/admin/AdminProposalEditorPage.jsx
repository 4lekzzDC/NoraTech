// Editor de proposta — cria (rota /admin/propostas/novo) ou edita
// (/admin/propostas/:id). Empresa + sistemas do catálogo (nome/descrição/
// valor puxados automaticamente, editáveis) + desconto + implantação +
// observações à esquerda; resumo financeiro, condições, link público e
// status à direita — tudo em uma única coluna rolável, sem abas: o
// histórico mora junto dos dados, não escondido atrás de um clique.
//
// Editar uma proposta já enviada não é bloqueado — o formulário continua
// aberto, e salvar bifurca uma versão nova automaticamente (a mesma regra
// que admin_save_proposal aplica no banco). O aviso amarelo abaixo do
// título é o que avisa disso antes de acontecer.
//
// O botão "Salvar" mora no cabeçalho (fora do <form> no DOM, já que o
// cabeçalho é passado pra AdminLayout como prop), então ele se liga ao
// formulário pelo atributo `form="proposta-form"` em vez de aninhamento —
// suportado nativamente, sem precisar subir estado extra.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout, { Card, Spinner, StatusPill } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDate, formatDateTime } from '../../lib/admin';
import { fetchSystems } from '../../lib/systems';
import {
  buscarProposta, listarItens, listarEventos, listarVersoes, salvarProposta,
  enviarProposta, definirStatusProposta, linkPublico, PROPOSAL_STATUS_LABEL,
} from '../../lib/proposals';
import { calcularTotais } from '../../lib/proposalCalc';
import { Field } from './adminFormHelpers';

const EVENT_META = {
  criada:      { label: 'Proposta criada',    color: '#a78bfa' },
  editada:     { label: 'Rascunho editado',   color: 'rgba(255,255,255,0.55)' },
  nova_versao: { label: 'Nova versão criada', color: '#a78bfa' },
  enviada:     { label: 'Enviada ao cliente', color: '#60a5fa' },
  visualizada: { label: 'Cliente visualizou', color: '#f0b429' },
  aceita:      { label: 'Aceita',             color: '#00d48a' },
  recusada:    { label: 'Recusada',           color: '#ff6b6b' },
  expirada:    { label: 'Expirou',            color: 'rgba(255,255,255,0.55)' },
  envio_falhou: { label: 'Falha ao enviar e-mail', color: '#ff6b6b' },
};

function origemEvento(ev) {
  if (ev.actor_id) return 'Pelo admin';
  if (ev.event_type === 'expirada') return 'Automático — validade vencida';
  if (['visualizada', 'aceita', 'recusada'].includes(ev.event_type)) return 'Pelo cliente, na página pública';
  return 'Pelo sistema';
}

const LABEL = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' };

/** Ícone num quadrado colorido + título — o mesmo cabeçalho em todo card da tela. */
function SectionHeading({ icon, children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
        }}>
          {icon}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#eeede9' }}>{children}</span>
      </div>
      {right}
    </div>
  );
}

export default function AdminProposalEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToasts();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [decidindo, setDecidindo] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [systems, setSystems] = useState([]);
  const [proposta, setProposta] = useState(null);

  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [setupFee, setSetupFee] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  const [eventos, setEventos] = useState([]);
  const [versoes, setVersoes] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [companiesRes, systemsList] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        fetchSystems(),
      ]);
      if (!ativo) return;
      setCompanies(companiesRes.data || []);
      setSystems(systemsList);
    })();
    return () => { ativo = false; };
  }, []);

  const carregarProposta = async (proposalId) => {
    setLoading(true);
    setError('');
    try {
      const [p, itensDb] = await Promise.all([buscarProposta(proposalId), listarItens(proposalId)]);
      if (!p) { setError('Proposta não encontrada.'); return; }
      setProposta(p);
      setCompanyId(p.company_id);
      setTitle(p.title);
      setValidUntil(p.valid_until || '');
      setDiscountType(p.discount_type || '');
      setDiscountValue(p.discount_type ? String(p.discount_value) : '');
      setSetupFee(Number(p.setup_fee) > 0 ? String(p.setup_fee) : '');
      setNotes(p.notes || '');
      setItems(itensDb.map((it) => ({
        systemSlug: it.system_slug, name: it.name, description: it.description || '',
        unitAmount: it.unit_amount, amount: String(it.amount),
      })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!isNew) carregarProposta(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Histórico mora na mesma coluna dos dados (sem aba pra trocar), então
  // carrega assim que a proposta existir — sem esperar um clique. Recarrega
  // pelo id (entrar na tela de uma proposta existente) e também é chamado
  // explicitamente depois de salvar/enviar/decidir: essas ações mudam o
  // status sem trocar o id, então um efeito preso só ao id não pegaria o
  // evento novo.
  const carregarHistorico = async (p) => {
    if (!p) return;
    setHistoricoLoading(true);
    try {
      const raiz = p.root_proposal_id || p.id;
      const [ev, vs] = await Promise.all([listarEventos(p.id), listarVersoes(raiz)]);
      setEventos(ev);
      setVersoes(vs);
    } catch (e) {
      setError(e.message);
    } finally {
      setHistoricoLoading(false);
    }
  };

  useEffect(() => { carregarHistorico(proposta); }, [proposta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sistemaPorSlug = useMemo(() => Object.fromEntries(systems.map((s) => [s.slug, s])), [systems]);
  const sistemasDisponiveis = useMemo(
    () => systems.filter((s) => !items.some((it) => it.systemSlug === s.slug)),
    [systems, items],
  );

  function adicionarSistema(slug) {
    const sistema = sistemaPorSlug[slug];
    if (!sistema) return;
    setItems((atual) => [...atual, {
      systemSlug: sistema.slug, name: sistema.name, description: sistema.description || '',
      unitAmount: sistema.default_amount || 0, amount: String(sistema.default_amount || 0),
    }]);
  }

  function atualizarItem(slug, campo, valor) {
    setItems((atual) => atual.map((it) => (it.systemSlug === slug ? { ...it, [campo]: valor } : it)));
  }

  function removerItem(slug) {
    setItems((atual) => atual.filter((it) => it.systemSlug !== slug));
  }

  const totais = useMemo(
    () => calcularTotais({ items, discountType: discountType || null, discountValue, setupFee }),
    [items, discountType, discountValue, setupFee],
  );

  async function handleSalvar(e) {
    e?.preventDefault();
    if (!companyId) { setError('Selecione uma empresa.'); return; }
    if (title.trim().length < 2) { setError('Dê um título pra proposta.'); return; }
    if (items.length === 0) { setError('Inclua pelo menos um sistema.'); return; }
    setSaving(true);
    setError('');
    try {
      const houveFork = proposta && proposta.status !== 'rascunho';
      const salva = await salvarProposta({
        id: proposta?.id || null,
        companyId, title, validUntil: validUntil || null,
        discountType: discountType || null, discountValue, setupFee, notes, items,
      });
      setProposta(salva);
      carregarHistorico(salva);
      showToast(houveFork ? `Nova versão criada (v${salva.version}).` : 'Proposta salva.');
      if (salva.id !== id) navigate(`/admin/propostas/${salva.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEnviar() {
    if (!proposta) return;
    setSending(true);
    setError('');
    try {
      const atualizada = await enviarProposta(proposta.id);
      setProposta(atualizada);
      carregarHistorico(atualizada);
      showToast('E-mail enviado — a proposta já pode ser acompanhada pelo cliente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDecidir(status) {
    if (!proposta) return;
    const confirmMsg = status === 'aceita'
      ? 'Marcar esta proposta como aceita? Isso cria ou atualiza a assinatura da empresa com os sistemas aprovados.'
      : 'Marcar esta proposta como recusada?';
    if (!window.confirm(confirmMsg)) return;
    setDecidindo(true);
    setError('');
    try {
      const atualizada = await definirStatusProposta(proposta.id, status);
      setProposta(atualizada);
      carregarHistorico(atualizada);
      showToast(status === 'aceita' ? 'Proposta aceita — assinatura atualizada.' : 'Proposta marcada como recusada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDecidindo(false);
    }
  }

  async function handleCopiarLink() {
    if (!proposta?.public_token) return;
    try {
      await navigator.clipboard.writeText(linkPublico(proposta.public_token));
      setLinkCopiado(true);
      showToast('Link copiado.');
      setTimeout(() => setLinkCopiado(false), 1800);
    } catch {
      setError('Não foi possível copiar o link automaticamente — copie manualmente pelo campo ao lado.');
    }
  }

  const botaoSalvarLabel = saving ? 'Salvando...' : !proposta ? 'Criar proposta' : proposta.status === 'rascunho' ? 'Salvar' : 'Salvar nova versão';
  const podeEnviar = proposta?.status === 'rascunho';
  const temPaginaPublica = proposta && proposta.status !== 'rascunho' && proposta.public_token;

  return (
    <AdminLayout
      breadcrumb={
        <Link
          to="/admin/propostas"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          ← Propostas
        </Link>
      }
      title={isNew ? 'Nova proposta' : (proposta?.title || 'Proposta')}
      subtitle={proposta ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{proposta.companies?.name}</span>
          <Ponto />
          <span>v{proposta.version}</span>
          <Ponto />
          <StatusPill status={proposta.status} />
          {proposta.valid_until && (
            <>
              <Ponto />
              <span>📅 Válida até {formatDate(proposta.valid_until)}</span>
            </>
          )}
        </div>
      ) : 'Escolha a empresa e monte os sistemas incluídos.'}
      actions={!loading && (
        <>
          <button className={`admin-btn ${proposta ? '' : 'primary'}`} type="submit" form="proposta-form" disabled={saving}>
            {botaoSalvarLabel}
          </button>
          {temPaginaPublica && (
            <>
              <a className="admin-btn" href={linkPublico(proposta.public_token)} target="_blank" rel="noreferrer">👁 Visualizar</a>
              <a className="admin-btn" href={`${linkPublico(proposta.public_token)}?imprimir=1`} target="_blank" rel="noreferrer">📄 Baixar PDF</a>
            </>
          )}
          {podeEnviar && (
            <button type="button" className="admin-btn primary" onClick={handleEnviar} disabled={sending}>
              {sending ? 'Enviando...' : '✉ Enviar proposta'}
            </button>
          )}
        </>
      )}
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {proposta && proposta.status !== 'rascunho' && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.025)', borderLeft: '3px solid rgba(240,180,41,0.4)', borderRadius: 8, marginBottom: 18, color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', lineHeight: 1.5 }}>
              Esta proposta já foi {PROPOSAL_STATUS_LABEL[proposta.status]?.toLowerCase()}.
              Qualquer alteração salva aqui cria a versão v{proposta.version + 1} — o link público continua o mesmo, passando a mostrar a versão nova.
            </div>
          )}

          <form id="proposta-form" onSubmit={handleSalvar} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <Card style={{ padding: 22 }}>
                <SectionHeading icon="📄">Dados da proposta</SectionHeading>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Empresa" full>
                    <Dropdown
                      searchable
                      value={companyId}
                      onChange={setCompanyId}
                      options={companies.map((c) => ({ value: c.id, label: c.name }))}
                      placeholder="Selecione a empresa..."
                      emptyText="Nenhuma empresa encontrada"
                    />
                  </Field>
                  <Field label="Título da proposta" full>
                    <input
                      className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Proposta NoraHub + NoraChat — Setembro/2026" required autoFocus={isNew}
                    />
                  </Field>
                  <Field label="Observações" full hint="Aparece na página pública, logo abaixo dos sistemas.">
                    <textarea
                      className="admin-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: implantação em até 10 dias úteis após a assinatura; suporte incluso."
                    />
                  </Field>
                </div>
              </Card>

              <Card style={{ padding: 22 }}>
                <SectionHeading
                  icon="🧩"
                  right={
                    <div style={{ width: 250 }}>
                      <Dropdown
                        searchable
                        value=""
                        onChange={adicionarSistema}
                        disabled={sistemasDisponiveis.length === 0}
                        options={sistemasDisponiveis.map((s) => ({ value: s.slug, label: `${s.icon || '🧩'} ${s.name} — ${formatBRL(s.default_amount)}` }))}
                        placeholder={sistemasDisponiveis.length ? '+ Adicionar sistema...' : 'Todos os sistemas já incluídos'}
                        emptyText="Nenhum sistema encontrado"
                      />
                    </div>
                  }
                >
                  Sistemas incluídos
                </SectionHeading>

                {items.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum sistema incluído ainda — adicione pelo menos um.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map((it) => {
                      const sistema = sistemaPorSlug[it.systemSlug];
                      return (
                        <div
                          key={it.systemSlug}
                          className="proposal-item-row"
                          style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', display: 'flex', gap: 14, alignItems: 'flex-start' }}
                        >
                          <span style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: `${sistema?.color || '#7C3AED'}1f`, color: sistema?.color || '#a78bfa',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', marginTop: 2,
                          }}>
                            {sistema?.icon || '🧩'}
                          </span>

                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                              className="proposal-ghost-input" value={it.name} style={{ fontWeight: 700, fontSize: '0.92rem' }}
                              onChange={(e) => atualizarItem(it.systemSlug, 'name', e.target.value)}
                            />
                            <textarea
                              className="proposal-ghost-input" rows={2} style={{ resize: 'vertical', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}
                              value={it.description} onChange={(e) => atualizarItem(it.systemSlug, 'description', e.target.value)}
                              placeholder="Descrição que aparece na proposta"
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                              <span style={{ ...LABEL, fontSize: '0.64rem' }}>Mensalidade</span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                {Number(it.amount) !== Number(it.unitAmount) && (
                                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>catálogo: {formatBRL(it.unitAmount)}</span>
                                )}
                                <span style={{ color: '#a78bfa', fontSize: '0.9rem', fontWeight: 700 }}>R$</span>
                                <input
                                  className="proposal-ghost-input proposal-price-input" type="number" step="0.01" min="0" style={{ width: 100, fontWeight: 800, fontSize: '1.2rem', color: '#a78bfa', textAlign: 'right' }}
                                  value={it.amount} onChange={(e) => atualizarItem(it.systemSlug, 'amount', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button" onClick={() => removerItem(it.systemSlug)} aria-label={`Remover ${it.name}`}
                            className="proposal-item-remove"
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '1rem', padding: 6, lineHeight: 1, borderRadius: 6, flexShrink: 0 }}
                          >
                            🗑
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {proposta && (
                <Card style={{ padding: 22 }}>
                  <SectionHeading icon="🕐">Histórico</SectionHeading>
                  {historicoLoading ? <Spinner /> : (
                    <HistoricoConteudo eventos={eventos} versoes={versoes} proposta={proposta} />
                  )}
                </Card>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <Card style={{ padding: 22 }}>
                <SectionHeading icon="📊">Resumo comercial</SectionHeading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <LinhaResumo label="Subtotal" valor={totais.subtotal} />
                  {discountType && <LinhaResumo label="Desconto" valor={-totais.discountAmount} />}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Mensal</span>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#eeede9' }}>{formatBRL(totais.subtotal - totais.discountAmount)}</span>
                  </div>

                  {Number(setupFee) > 0 && <LinhaResumo label="Implantação" valor={Number(setupFee)} />}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Inicial</div>
                      {Number(setupFee) > 0 && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>1ª cobrança, com implantação</div>}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#a78bfa' }}>{formatBRL(totais.total)}</span>
                  </div>
                </div>
              </Card>

              <Card style={{ padding: 22 }}>
                <SectionHeading icon="⚙️">Condições comerciais</SectionHeading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Desconto">
                    <select className="admin-select" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                      <option value="">Sem desconto</option>
                      <option value="percent">Percentual (%)</option>
                      <option value="amount">Valor fixo (R$)</option>
                    </select>
                  </Field>
                  {discountType && (
                    <Field label={discountType === 'percent' ? 'Percentual de desconto' : 'Valor do desconto (R$)'}>
                      <input className="admin-input" type="number" step="0.01" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                    </Field>
                  )}
                  <Field label="Implantação (R$)" hint="Valor único, somado depois do desconto.">
                    <input className="admin-input" type="number" step="0.01" min="0" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
                  </Field>
                  <Field label="Validade da proposta">
                    <input className="admin-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  </Field>
                </div>
              </Card>

              {proposta && proposta.status !== 'rascunho' && proposta.public_token && (
                <Card style={{ padding: 22 }}>
                  <SectionHeading icon="🌐">Página pública</SectionHeading>
                  <input className="admin-input" readOnly value={linkPublico(proposta.public_token)} onFocus={(e) => e.target.select()} style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: '0.78rem' }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button" className="admin-btn" onClick={handleCopiarLink}
                      style={linkCopiado ? { color: '#00d48a', borderColor: 'rgba(0,212,138,0.3)' } : undefined}
                    >
                      {linkCopiado ? '✓ Copiado' : 'Copiar link'}
                    </button>
                    <a className="admin-btn" href={linkPublico(proposta.public_token)} target="_blank" rel="noreferrer">Abrir página</a>
                  </div>
                </Card>
              )}

              {proposta && proposta.status !== 'rascunho' && (
                <Card style={{ padding: 22 }}>
                  <SectionHeading icon="🚩">Status da proposta</SectionHeading>
                  <StatusTimeline proposta={proposta} />

                  {['enviada', 'visualizada'].includes(proposta.status) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <button
                        type="button" className="admin-btn" disabled={decidindo}
                        style={{ justifyContent: 'center', color: '#00d48a', borderColor: 'rgba(0,212,138,0.3)' }}
                        onClick={() => handleDecidir('aceita')}
                      >
                        Marcar como aceita
                      </button>
                      <button
                        type="button" className="admin-btn danger" disabled={decidindo}
                        style={{ justifyContent: 'center' }}
                        onClick={() => handleDecidir('recusada')}
                      >
                        Marcar como recusada
                      </button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </form>
        </>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      <DropdownStyles />
      <style>{`
        .proposal-ghost-input {
          width: 100%; background: transparent; border: 1px solid transparent;
          border-radius: 7px; padding: 5px 7px; margin: -5px -7px;
          color: #eeede9; font-family: inherit; outline: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .proposal-ghost-input::placeholder { color: rgba(255,255,255,0.3); }
        .proposal-ghost-input:hover { background: rgba(255,255,255,0.025); }
        .proposal-ghost-input:focus { background: rgba(255,255,255,0.04); border-color: rgba(124,58,237,0.35); }
        .proposal-item-row { transition: border-color 0.15s, background 0.15s; }
        .proposal-item-row:hover { border-color: rgba(255,255,255,0.14); }
        .proposal-item-remove:hover { background: rgba(255,107,107,0.1); color: #ff6b6b; }
      `}</style>
    </AdminLayout>
  );
}

function Ponto() {
  return <span style={{ color: 'rgba(255,255,255,0.25)' }}>•</span>;
}

function LinhaResumo({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
      <span>{label}</span>
      <span>{valor < 0 ? `− ${formatBRL(Math.abs(valor))}` : formatBRL(valor)}</span>
    </div>
  );
}

/** Checklist vertical com linha conectando as etapas — enviada → visualizada → decisão. */
function StatusTimeline({ proposta }) {
  const etapas = [
    { label: 'Enviada', done: !!proposta.sent_at, timestamp: proposta.sent_at },
    { label: 'Visualizada', done: !!proposta.first_viewed_at, timestamp: proposta.first_viewed_at },
  ];
  if (['aceita', 'recusada', 'expirada'].includes(proposta.status)) {
    etapas.push({
      label: proposta.status === 'aceita' ? 'Aceita' : proposta.status === 'recusada' ? 'Recusada' : 'Expirada',
      done: true, timestamp: proposta.decided_at, cor: proposta.status === 'aceita' ? '#00d48a' : proposta.status === 'recusada' ? '#ff6b6b' : 'rgba(255,255,255,0.4)',
    });
  } else {
    etapas.push({ label: 'Aguardando decisão', done: false, timestamp: null });
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, background: 'rgba(255,255,255,0.08)' }} />
      {etapas.map((etapa) => (
        <div key={etapa.label} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0, zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 900,
            background: etapa.done ? (etapa.cor || '#00d48a') : '#101015',
            border: etapa.done ? 'none' : '2px solid rgba(255,255,255,0.18)',
            color: '#08080a',
          }}>
            {etapa.done && '✓'}
          </span>
          <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: etapa.done ? '#eeede9' : 'rgba(255,255,255,0.4)' }}>
            {etapa.label}
          </span>
          {etapa.timestamp && (
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{formatDateTime(etapa.timestamp)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function HistoricoConteudo({ eventos, versoes, proposta }) {
  const temVersoes = versoes.length > 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {temVersoes && (
        <div>
          <div style={{ ...LABEL, marginBottom: 10 }}>Versões</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {versoes.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: '11px 14px', borderRadius: 10, background: v.id === proposta?.id ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${v.id === proposta?.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    v{v.version} — {v.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    {formatBRL(v.total)} · {formatDateTime(v.created_at)}
                  </div>
                </div>
                <StatusPill status={v.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        {temVersoes && <div style={{ ...LABEL, marginBottom: 10 }}>Eventos</div>}
        {eventos.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum evento ainda.</p>
        ) : (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'rgba(255,255,255,0.08)' }} />
            {eventos.map((ev) => {
              const meta = EVENT_META[ev.event_type] || { label: ev.event_type, color: 'rgba(255,255,255,0.5)' };
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 4, zIndex: 1, boxShadow: '0 0 0 3px #0e0e12' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{formatDateTime(ev.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{origemEvento(ev)}</div>
                    {ev.notes && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 5, lineHeight: 1.4 }}>{ev.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
