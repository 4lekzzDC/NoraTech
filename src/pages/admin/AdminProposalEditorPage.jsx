// Editor de proposta — cria (rota /admin/propostas/novo) ou edita
// (/admin/propostas/:id). Empresa + sistemas do catálogo (nome/descrição/
// valor puxados automaticamente, editáveis) + desconto + implantação +
// observações à esquerda; resumo financeiro e ações à direita.
//
// Editar uma proposta já enviada não é bloqueado — o formulário continua
// aberto, e salvar bifurca uma versão nova automaticamente (a mesma regra
// que admin_save_proposal aplica no banco). O aviso amarelo abaixo do
// título é o que avisa disso antes de acontecer.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout, { Card, Spinner, StatusPill } from '../../components/AdminLayout';
import { Dropdown, DropdownStyles } from '../../components/AdminDropdown';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import { supabase } from '../../lib/supabase';
import { formatBRL, formatDateTime } from '../../lib/admin';
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

  const [aba, setAba] = useState('detalhes');
  const [eventos, setEventos] = useState([]);
  const [versoes, setVersoes] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

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

  const carregarHistorico = async () => {
    if (!proposta) return;
    setHistoricoLoading(true);
    try {
      const raiz = proposta.root_proposal_id || proposta.id;
      const [ev, vs] = await Promise.all([listarEventos(proposta.id), listarVersoes(raiz)]);
      setEventos(ev);
      setVersoes(vs);
    } catch (e) {
      setError(e.message);
    } finally {
      setHistoricoLoading(false);
    }
  };

  useEffect(() => { if (aba === 'historico' && proposta) carregarHistorico(); }, [aba, proposta]); // eslint-disable-line react-hooks/exhaustive-deps

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
      showToast(status === 'aceita' ? 'Proposta aceita — assinatura atualizada.' : 'Proposta marcada como recusada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDecidindo(false);
    }
  }

  const botaoSalvarLabel = saving ? 'Salvando...' : !proposta ? 'Criar proposta' : proposta.status === 'rascunho' ? 'Salvar' : `Salvar nova versão`;

  return (
    <AdminLayout
      title={isNew ? 'Nova proposta' : (proposta?.title || 'Proposta')}
      subtitle={proposta ? `${proposta.companies?.name || ''} · v${proposta.version}` : 'Escolha a empresa e monte os sistemas incluídos.'}
      actions={
        <>
          <Link to="/admin/propostas" className="admin-btn">← Propostas</Link>
          {proposta && <StatusPill status={proposta.status} />}
        </>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {proposta && (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 20, gap: 0 }}>
              {['detalhes', 'historico'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAba(tab)}
                  style={{
                    padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: aba === tab ? '2px solid #7C3AED' : '2px solid transparent',
                    color: aba === tab ? '#eeede9' : 'rgba(255,255,255,0.42)',
                    fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', marginBottom: -1,
                  }}
                >
                  {tab === 'detalhes' ? 'Detalhes' : 'Histórico'}
                </button>
              ))}
            </div>
          )}

          {aba === 'detalhes' && (
            <>
              {proposta && proposta.status !== 'rascunho' && (
                <div style={{ padding: '12px 16px', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.25)', borderRadius: 10, marginBottom: 18, color: '#f0b429', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  Esta proposta já foi {PROPOSAL_STATUS_LABEL[proposta.status]?.toLowerCase()}.
                  Qualquer alteração salva aqui cria a versão v{proposta.version + 1} — o link público continua o mesmo, passando a mostrar a versão nova.
                </div>
              )}

              <form onSubmit={handleSalvar} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                  <Card style={{ padding: 22 }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                      <span style={LABEL}>Sistemas incluídos</span>
                      <div style={{ width: 260 }}>
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
                    </div>

                    {items.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum sistema incluído ainda — adicione pelo menos um.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {items.map((it) => {
                          const sistema = sistemaPorSlug[it.systemSlug];
                          return (
                            <div key={it.systemSlug} style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{sistema?.icon || '🧩'}</span>
                                <input
                                  className="admin-input" value={it.name} style={{ flex: 1, fontWeight: 600 }}
                                  onChange={(e) => atualizarItem(it.systemSlug, 'name', e.target.value)}
                                />
                                <button
                                  type="button" onClick={() => removerItem(it.systemSlug)} aria-label={`Remover ${it.name}`}
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem', padding: 4, lineHeight: 1 }}
                                >
                                  ×
                                </button>
                              </div>
                              <textarea
                                className="admin-input" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }}
                                value={it.description} onChange={(e) => atualizarItem(it.systemSlug, 'description', e.target.value)}
                                placeholder="Descrição que aparece na proposta"
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ ...LABEL, fontSize: '0.68rem' }}>Preço (R$)</span>
                                <input
                                  className="admin-input" type="number" step="0.01" min="0" style={{ width: 130 }}
                                  value={it.amount} onChange={(e) => atualizarItem(it.systemSlug, 'amount', e.target.value)}
                                />
                                {Number(it.amount) !== Number(it.unitAmount) && (
                                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>catálogo: {formatBRL(it.unitAmount)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                  <Card style={{ padding: 22 }}>
                    <div style={{ ...LABEL, marginBottom: 14 }}>Condições comerciais</div>
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

                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <LinhaResumo label="Subtotal" valor={totais.subtotal} />
                      {discountType && <LinhaResumo label="Desconto" valor={-totais.discountAmount} />}
                      {Number(setupFee) > 0 && <LinhaResumo label="Implantação" valor={Number(setupFee)} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Total</span>
                        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#a78bfa' }}>{formatBRL(totais.total)}</span>
                      </div>
                    </div>
                  </Card>

                  {proposta && proposta.status !== 'rascunho' && proposta.public_token && (
                    <Card style={{ padding: 22 }}>
                      <div style={{ ...LABEL, marginBottom: 12 }}>Página pública</div>
                      <input className="admin-input" readOnly value={linkPublico(proposta.public_token)} onFocus={(e) => e.target.select()} style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: '0.78rem' }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a className="admin-btn" href={linkPublico(proposta.public_token)} target="_blank" rel="noreferrer">Abrir página</a>
                        <a className="admin-btn" href={`${linkPublico(proposta.public_token)}?imprimir=1`} target="_blank" rel="noreferrer">Baixar PDF</a>
                      </div>
                    </Card>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="admin-btn primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                        {botaoSalvarLabel}
                      </button>
                      {proposta?.status === 'rascunho' && (
                        <button type="button" className="admin-btn" onClick={handleEnviar} disabled={sending}>
                          {sending ? 'Enviando e-mail...' : 'Enviar por e-mail'}
                        </button>
                      )}
                    </div>
                    {proposta && ['enviada', 'visualizada'].includes(proposta.status) && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button" className="admin-btn" disabled={decidindo}
                          style={{ flex: 1, justifyContent: 'center', color: '#00d48a', borderColor: 'rgba(0,212,138,0.3)' }}
                          onClick={() => handleDecidir('aceita')}
                        >
                          Marcar como aceita
                        </button>
                        <button
                          type="button" className="admin-btn danger" disabled={decidindo}
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => handleDecidir('recusada')}
                        >
                          Marcar como recusada
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </>
          )}

          {aba === 'historico' && (
            <HistoricoTab eventos={eventos} versoes={versoes} loading={historicoLoading} proposta={proposta} />
          )}
        </>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      <DropdownStyles />
    </AdminLayout>
  );
}

function LinhaResumo({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
      <span>{label}</span>
      <span>{valor < 0 ? `− ${formatBRL(Math.abs(valor))}` : formatBRL(valor)}</span>
    </div>
  );
}

function HistoricoTab({ eventos, versoes, loading, proposta }) {
  if (loading) return <Spinner />;
  const temVersoes = versoes.length > 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: temVersoes ? '1fr 1fr' : '1fr', gap: 18, alignItems: 'start' }}>
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
        <div style={{ ...LABEL, marginBottom: 10 }}>Histórico de eventos</div>
        {eventos.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>Nenhum evento ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eventos.map((ev) => {
              const meta = EVENT_META[ev.event_type] || { label: ev.event_type, color: 'rgba(255,255,255,0.5)' };
              return (
                <div key={ev.id} style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{formatDateTime(ev.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{origemEvento(ev)}</div>
                  {ev.notes && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 5, lineHeight: 1.4 }}>{ev.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
