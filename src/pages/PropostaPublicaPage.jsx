// Página pública da proposta — /proposta/:token, sem login. Identidade
// NoraTech (Inter, roxo #7C3AED), clara e "comercial" de propósito: quem
// abre este link é o cliente decidindo se assina, não um admin — e um
// documento assim precisa imprimir bem (o botão "Baixar PDF" é
// window.print() com folha de estilo própria pra impressão).
//
// Efeito colateral da leitura: a primeira visita marca a proposta como
// "visualizada" no banco (get_proposal_by_token cuida disso) — o motivo de
// não cachear/reusar essa chamada em lugar nenhum.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { formatBRL, formatDate, formatDateTime } from '../lib/admin';
import { buscarPropostaPorToken, aceitarPropostaPorToken, recusarPropostaPorToken } from '../lib/proposals';
import { getProposalSystemContent } from '../lib/proposalSystemContent';

const ROXO = '#7C3AED';

export default function PropostaPublicaPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [proposta, setProposta] = useState(null);

  const [acao, setAcao] = useState(null); // 'aceitar' | 'recusar' | null
  const [erroAcao, setErroAcao] = useState('');
  const [mostrarRecusa, setMostrarRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  const [itemDetalhe, setItemDetalhe] = useState(null); // item da proposta com "Ver detalhes" aberto, ou null

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const data = await buscarPropostaPorToken(token);
        if (!ativo) return;
        if (!data) { setErro('Não encontramos esta proposta — o link pode estar incorreto ou ela ainda não foi enviada.'); return; }
        setProposta(data);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  // ?imprimir=1 — link que o admin abre pra gerar o PDF (window.print do
  // navegador; sem biblioteca nova, a folha de estilo @media print abaixo
  // já deixa o documento limpo pra imprimir/salvar como PDF).
  useEffect(() => {
    if (loading || !proposta || searchParams.get('imprimir') !== '1') return undefined;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [loading, proposta, searchParams]);

  async function handleAceitar() {
    setAcao('aceitar');
    setErroAcao('');
    try {
      await aceitarPropostaPorToken(token);
      setProposta((p) => ({ ...p, status: 'aceita', decided_at: new Date().toISOString() }));
    } catch (e) {
      setErroAcao(e.message);
    } finally {
      setAcao(null);
    }
  }

  async function handleRecusar() {
    setAcao('recusar');
    setErroAcao('');
    try {
      await recusarPropostaPorToken(token, motivoRecusa);
      setProposta((p) => ({ ...p, status: 'recusada', decided_at: new Date().toISOString() }));
    } catch (e) {
      setErroAcao(e.message);
    } finally {
      setAcao(null);
    }
  }

  return (
    <div style={estilos.pagina}>
      <EstilosGlobais />
      <Cabecalho />

      <main style={estilos.main}>
        {loading ? (
          <Carregando />
        ) : erro ? (
          <MensagemEstado titulo="Não foi possível abrir esta proposta" texto={erro} tom="neutro" />
        ) : (
          <Conteudo
            proposta={proposta}
            acao={acao}
            erroAcao={erroAcao}
            mostrarRecusa={mostrarRecusa}
            setMostrarRecusa={setMostrarRecusa}
            motivoRecusa={motivoRecusa}
            setMotivoRecusa={setMotivoRecusa}
            onAceitar={handleAceitar}
            onRecusar={handleRecusar}
            onVerDetalhes={setItemDetalhe}
          />
        )}
      </main>

      <Rodape />

      {itemDetalhe && <SistemaDetalheModal item={itemDetalhe} onClose={() => setItemDetalhe(null)} />}
    </div>
  );
}

function Conteudo({ proposta, acao, erroAcao, mostrarRecusa, setMostrarRecusa, motivoRecusa, setMotivoRecusa, onAceitar, onRecusar, onVerDetalhes }) {
  const decidivel = proposta.status === 'enviada' || proposta.status === 'visualizada';
  const temDesconto = proposta.discount_type && Number(proposta.discount_amount) > 0;
  const temImplantacao = Number(proposta.setup_fee) > 0;

  return (
    <div className="np-reveal" style={estilos.card}>
      {proposta.status === 'aceita' && <FaixaDecisao tom="aceita" texto={`Proposta aceita em ${formatDateTime(proposta.decided_at)} — obrigado!`} />}
      {proposta.status === 'recusada' && <FaixaDecisao tom="recusada" texto={`Proposta recusada em ${formatDateTime(proposta.decided_at)}.`} />}
      {proposta.status === 'expirada' && <FaixaDecisao tom="expirada" texto="Esta proposta expirou. Entre em contato para receber uma nova." />}

      <div style={{ padding: '40px 44px 8px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1.5, color: ROXO, textTransform: 'uppercase', marginBottom: 10 }}>
          Proposta comercial
        </div>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: -0.6, margin: '0 0 8px', color: '#16151c' }}>{proposta.title}</h1>
        <p style={{ fontSize: '0.95rem', color: '#6b6878', margin: 0 }}>
          Preparada para <strong style={{ color: '#16151c' }}>{proposta.company?.name}</strong>
          {proposta.sent_at && <> · enviada em {formatDate(proposta.sent_at)}</>}
        </p>
      </div>

      <div style={{ padding: '28px 44px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(proposta.items || []).map((item) => {
          const temDetalhes = !!getProposalSystemContent(item.system_slug);
          return (
            <div key={item.system_slug} style={estilos.itemLinha}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{item.icon || '🧩'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#16151c' }}>{item.name}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#16151c', whiteSpace: 'nowrap' }}>
                    {formatBRL(item.amount)}
                    <span style={{ fontWeight: 500, fontSize: '0.72rem', color: '#a6a3b0' }}> /mês</span>
                  </div>
                </div>
                {item.description && <div style={{ fontSize: '0.85rem', color: '#6b6878', marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>}
                {temDetalhes && (
                  <button type="button" className="np-btn-detalhes no-print" onClick={() => onVerDetalhes(item)}>
                    Ver detalhes <span aria-hidden="true">›</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '20px 44px', margin: '20px 44px 0', background: '#f7f6fb', borderRadius: 14 }}>
        <LinhaValor label="Subtotal" valor={formatBRL(proposta.subtotal)} />
        {temDesconto && (
          <LinhaValor
            label={proposta.discount_type === 'percent' ? `Desconto (${proposta.discount_value}%)` : 'Desconto'}
            valor={`− ${formatBRL(proposta.discount_amount)}`}
          />
        )}
        {temImplantacao && <LinhaValor label="Implantação" valor={formatBRL(proposta.setup_fee)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 14, borderTop: '1px solid rgba(124,58,237,0.18)' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#16151c' }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: '1.7rem', color: ROXO }}>{formatBRL(proposta.total)}</span>
        </div>
      </div>

      <div style={{ padding: '18px 44px 0', display: 'flex', flexWrap: 'wrap', gap: '10px 28px', fontSize: '0.85rem', color: '#6b6878' }}>
        {proposta.valid_until && (
          <span>Válida até <strong style={{ color: '#16151c' }}>{formatDate(proposta.valid_until)}</strong></span>
        )}
        {proposta.version > 1 && <span>Versão {proposta.version}</span>}
      </div>

      {proposta.notes && (
        <div style={{ padding: '24px 44px 0' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: '#6b6878', textTransform: 'uppercase', marginBottom: 8 }}>Observações</div>
          <p style={{ fontSize: '0.88rem', color: '#3a3844', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{proposta.notes}</p>
        </div>
      )}

      {decidivel && (
        <div className="no-print" style={{ padding: '32px 44px 40px' }}>
          {erroAcao && (
            <div style={{ padding: '11px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.85rem', marginBottom: 14 }}>
              {erroAcao}
            </div>
          )}

          {!mostrarRecusa ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="np-btn-primario" onClick={onAceitar} disabled={!!acao}>
                {acao === 'aceitar' ? 'Confirmando...' : 'Aceitar proposta'}
              </button>
              <button className="np-btn-texto" onClick={() => setMostrarRecusa(true)} disabled={!!acao}>Recusar</button>
              <button className="np-btn-texto" onClick={() => window.print()} disabled={!!acao}>Baixar PDF</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3a3844' }}>Quer contar o motivo? (opcional)</label>
              <textarea
                className="np-textarea" rows={2} value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex: ficou fora do orçamento deste momento"
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="np-btn-perigo" onClick={onRecusar} disabled={!!acao}>
                  {acao === 'recusar' ? 'Enviando...' : 'Confirmar recusa'}
                </button>
                <button className="np-btn-texto" onClick={() => setMostrarRecusa(false)} disabled={!!acao}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!decidivel && (
        <div className="no-print" style={{ padding: '0 44px 40px' }}>
          <button className="np-btn-texto" onClick={() => window.print()}>Baixar PDF</button>
        </div>
      )}
    </div>
  );
}

const ABAS_DETALHE = [
  { slug: 'geral', label: 'Visão geral' },
  { slug: 'funcionalidades', label: 'Funcionalidades' },
  { slug: 'modulos', label: 'Módulos incluídos' },
  { slug: 'demo', label: 'Demonstração' },
];

/**
 * "Ver detalhes" de um sistema da proposta — visão comercial (não é o app
 * de verdade): conteúdo estático de src/lib/proposalSystemContent.js, preço
 * vem do ITEM da proposta (o valor negociado, não o preço de catálogo). Só
 * abre se `getProposalSystemContent(item.system_slug)` existir — o botão
 * "Ver detalhes" já nem aparece nos sistemas sem conteúdo cadastrado.
 */
function SistemaDetalheModal({ item, onClose }) {
  const conteudo = getProposalSystemContent(item.system_slug);
  const [aba, setAba] = useState('geral');

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [onClose]);

  if (!conteudo) return null;

  return (
    <div className="no-print np-modal-overlay" onClick={onClose}>
      <div className="np-reveal-modal" style={estilos.modalCaixa} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '26px 30px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0, fontSize: '1.5rem',
            background: `${item.color || ROXO}1a`, color: item.color || ROXO,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {item.icon || '🧩'}
          </span>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: -0.4, margin: 0, color: '#16151c' }}>{item.name}</h2>
            {conteudo.tagline && <p style={{ fontSize: '0.88rem', color: '#6b6878', margin: '4px 0 0' }}>{conteudo.tagline}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="np-modal-close">×</button>
        </div>

        <div style={{ padding: '18px 30px 0', display: 'flex', gap: 4, borderBottom: '1px solid #eeecf3', flexWrap: 'wrap' }}>
          {ABAS_DETALHE.map((a) => (
            <button
              key={a.slug} type="button" onClick={() => setAba(a.slug)}
              className={`np-tab ${aba === a.slug ? 'ativa' : ''}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 30px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {aba === 'geral' && (
            <div className="np-detalhe-grid">
              <div>
                <p style={{ fontSize: '0.9rem', color: '#3a3844', lineHeight: 1.7, margin: '0 0 20px' }}>{conteudo.overview}</p>
                {conteudo.previewImage && (
                  <img src={conteudo.previewImage} alt={`Prévia de ${item.name}`} style={{ width: '100%', borderRadius: 12, marginBottom: 20, display: 'block' }} />
                )}
                {(conteudo.highlights?.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 10, marginBottom: 24 }}>
                    {conteudo.highlights.map((h) => (
                      <div key={h.title} style={{ padding: '12px 8px', borderRadius: 12, background: '#faf9fc', textAlign: 'center' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px',
                          background: `${item.color || ROXO}1a`, color: item.color || ROXO, fontSize: '0.92rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {h.icon}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.76rem', color: '#16151c', marginBottom: 3 }}>{h.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6b6878', lineHeight: 1.45 }}>{h.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
                {(conteudo.features?.length > 0) && (
                  <div>
                    <div style={estilos.tituloColuna}>Principais benefícios</div>
                    <ListaChecklist itens={conteudo.features} cor={item.color} />
                  </div>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={estilos.tituloColuna}>Demonstração do sistema</div>
                  <DemoVideo video={conteudo.video} nome={item.name} cor={item.color} icone={item.icon} />
                </div>
                {(conteudo.modules?.length > 0) && (
                  <div>
                    <div style={estilos.tituloColuna}>Módulos incluídos</div>
                    <ListaChecklist itens={conteudo.modules} cor={item.color} />
                  </div>
                )}
              </div>
            </div>
          )}

          {aba === 'funcionalidades' && <ListaChecklist itens={conteudo.features} cor={item.color} />}
          {aba === 'modulos' && <ListaChecklist itens={conteudo.modules} cor={item.color} />}
          {aba === 'demo' && <DemoVideo video={conteudo.video} nome={item.name} cor={item.color} icone={item.icon} />}
        </div>

        <div style={{ padding: '18px 30px', borderTop: '1px solid #eeecf3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, color: '#a6a3b0', textTransform: 'uppercase' }}>Incluso na sua proposta</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: ROXO }}>
              {formatBRL(item.amount)}<span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#6b6878' }}> /mês</span>
            </div>
          </div>
          <button type="button" className="np-btn-texto" style={{ textDecoration: 'none', border: '1px solid #e2e0e8', borderRadius: 12, padding: '11px 22px' }} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Usado tanto na coluna direita de "Visão geral" quanto na aba "Demonstração" — mesmo componente, ocupa a largura disponível. */
/**
 * Sem `video` cadastrado ainda: mostra uma prévia de marca (não finge ser
 * um player de verdade — sem link, sem duração, com a etiqueta "Em
 * produção") em vez de esconder o espaço. Assim que existir um vídeo de
 * verdade, é só preencher `video` no conteúdo do sistema e este mesmo
 * componente vira o player clicável.
 */
function DemoVideo({ video, nome, cor, icone }) {
  const corBase = cor || ROXO;

  if (!video) {
    return (
      <div style={{
        position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9',
        background: `linear-gradient(135deg, ${corBase}22, ${corBase}08)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <span style={{
          position: 'absolute', left: 12, top: 12, padding: '3px 10px', borderRadius: 100,
          background: '#ffffff', color: corBase, fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>
          Em produção
        </span>
        <span style={{
          width: 52, height: 52, borderRadius: '50%', background: '#ffffff', color: corBase, fontSize: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -8px rgba(22,21,28,0.3)',
        }}>
          {icone || '▶'}
        </span>
        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#6b6878' }}>Vídeo de demonstração em breve</span>
      </div>
    );
  }

  return (
    <a
      href={video.url} target="_blank" rel="noreferrer"
      style={{ display: 'block', position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#16151c', aspectRatio: '16/9' }}
    >
      {video.thumbnail && (
        <img src={video.thumbnail} alt={`Demonstração de ${nome}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
      )}
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          width: 52, height: 52, borderRadius: '50%', background: ROXO, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
        }}>
          ▶
        </span>
      </span>
      {video.duration && (
        <span style={{
          position: 'absolute', right: 10, bottom: 10, padding: '2px 8px', borderRadius: 6,
          background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.68rem', fontWeight: 600,
        }}>
          {video.duration}
        </span>
      )}
    </a>
  );
}

function ListaChecklist({ itens, cor }) {
  if (!itens?.length) return <p style={{ fontSize: '0.88rem', color: '#6b6878' }}>Nada cadastrado por enquanto.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {itens.map((texto) => (
        <li key={texto} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem', color: '#3a3844', lineHeight: 1.5 }}>
          <span style={{ color: cor || ROXO, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
          {texto}
        </li>
      ))}
    </ul>
  );
}

function LinhaValor({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#3a3844', padding: '4px 0' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  );
}

function FaixaDecisao({ tom, texto }) {
  const cores = {
    aceita:   { bg: '#ecfdf5', fg: '#059669', bd: '#a7f3d0' },
    recusada: { bg: '#f4f4f6', fg: '#6b6878', bd: '#e2e0e8' },
    expirada: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' },
  }[tom];
  return (
    <div style={{ padding: '14px 44px', background: cores.bg, borderBottom: `1px solid ${cores.bd}`, color: cores.fg, fontSize: '0.88rem', fontWeight: 600 }}>
      {texto}
    </div>
  );
}

function Carregando() {
  return (
    <div className="np-reveal" style={{ ...estilos.card, padding: 60, display: 'flex', justifyContent: 'center' }}>
      <div className="np-spinner" />
    </div>
  );
}

function MensagemEstado({ titulo, texto, tom }) {
  return (
    <div className="np-reveal" style={{ ...estilos.card, padding: '48px 44px', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: 14 }}>{tom === 'neutro' ? '🔗' : '⚠️'}</div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px', color: '#16151c' }}>{titulo}</h2>
      <p style={{ fontSize: '0.9rem', color: '#6b6878', margin: 0, lineHeight: 1.6 }}>{texto}</p>
    </div>
  );
}

function Cabecalho() {
  return (
    <header className="no-print" style={{ padding: '22px 6vw', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: -0.4, color: '#16151c' }}>
        Nora<span style={{ color: ROXO }}>tech</span>
      </span>
    </header>
  );
}

function Rodape() {
  return (
    <footer className="no-print" style={{ padding: '30px 6vw 50px', textAlign: 'center' }}>
      <span style={{ fontSize: '0.72rem', color: '#a6a3b0' }}>© {new Date().getFullYear()} Noratech — Todos os direitos reservados</span>
    </footer>
  );
}

const estilos = {
  pagina: { minHeight: '100vh', background: '#f0eef6', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' },
  main: { flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10px 6vw 40px' },
  card: { width: '100%', maxWidth: 720, background: '#ffffff', borderRadius: 20, boxShadow: '0 1px 2px rgba(22,21,28,0.04), 0 20px 50px -20px rgba(22,21,28,0.15)', overflow: 'hidden' },
  itemLinha: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 12, background: '#faf9fc' },
  modalCaixa: {
    width: '100%', maxWidth: 800, maxHeight: 'calc(100vh - 48px)', background: '#ffffff', borderRadius: 20,
    boxShadow: '0 24px 60px -20px rgba(22,21,28,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  tituloColuna: { fontSize: '0.78rem', fontWeight: 700, color: '#16151c', marginBottom: 12 },
};

function EstilosGlobais() {
  return (
    <style>{`
      @keyframes np-reveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes np-spin { to { transform: rotate(360deg); } }
      .np-reveal { animation: np-reveal 0.32s cubic-bezier(0.2,0,0,1) both; }
      @media (prefers-reduced-motion: reduce) { .np-reveal { animation: none; } }

      .np-spinner { width: 28px; height: 28px; border: 2px solid rgba(124,58,237,0.18); border-top-color: ${ROXO}; border-radius: 50%; animation: np-spin 0.8s linear infinite; }

      .np-btn-primario {
        padding: 13px 26px; border-radius: 12px; border: none; background: ${ROXO}; color: #fff;
        font-size: 0.92rem; font-weight: 700; font-family: inherit; cursor: pointer;
        transition: background 0.15s ease-out, transform 0.15s ease-out;
        box-shadow: 0 8px 20px -8px rgba(124,58,237,0.5);
      }
      .np-btn-primario:hover:not(:disabled) { background: #6d28d9; transform: translateY(-1px); }
      .np-btn-primario:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

      .np-btn-texto {
        padding: 13px 6px; border: none; background: none; color: #6b6878;
        font-size: 0.88rem; font-weight: 600; font-family: inherit; cursor: pointer;
        text-decoration: underline; text-underline-offset: 3px;
        transition: color 0.15s ease-out;
      }
      .np-btn-texto:hover:not(:disabled) { color: #16151c; }
      .np-btn-texto:disabled { opacity: 0.5; cursor: not-allowed; }

      .np-btn-perigo {
        padding: 11px 20px; border-radius: 12px; border: 1px solid #fecaca; background: #fef2f2; color: #dc2626;
        font-size: 0.88rem; font-weight: 700; font-family: inherit; cursor: pointer;
        transition: background 0.15s ease-out;
      }
      .np-btn-perigo:hover:not(:disabled) { background: #fee2e2; }
      .np-btn-perigo:disabled { opacity: 0.6; cursor: not-allowed; }

      .np-textarea {
        padding: 10px 12px; border-radius: 10px; border: 1px solid #e2e0e8; background: #faf9fc;
        font-size: 0.85rem; font-family: inherit; resize: vertical; outline: none;
        transition: border-color 0.15s ease-out;
      }
      .np-textarea:focus { border-color: ${ROXO}; }

      .np-btn-detalhes {
        margin-top: 8px; padding: 0; border: none; background: none; color: ${ROXO};
        font-size: 0.82rem; font-weight: 700; font-family: inherit; cursor: pointer;
        display: inline-flex; align-items: center; gap: 3px;
        transition: gap 0.15s ease-out;
      }
      .np-btn-detalhes:hover { gap: 6px; }

      @keyframes np-reveal-modal { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .np-reveal-modal { animation: np-reveal-modal 0.22s cubic-bezier(0.2,0,0,1) both; }
      @media (prefers-reduced-motion: reduce) { .np-reveal-modal { animation: none; } }

      .np-modal-overlay {
        position: fixed; inset: 0; background: rgba(22,21,28,0.55); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 200;
      }

      .np-modal-close {
        border: none; background: none; color: #a6a3b0; font-size: 1.5rem; line-height: 1;
        cursor: pointer; padding: 4px; margin: -4px; border-radius: 8px; flex-shrink: 0;
        transition: background 0.15s ease-out, color 0.15s ease-out;
      }
      .np-modal-close:hover { background: #f4f4f6; color: #16151c; }

      .np-tab {
        padding: 10px 4px; margin-right: 22px; border: none; background: none; cursor: pointer;
        font-size: 0.85rem; font-weight: 600; font-family: inherit; color: #a6a3b0;
        border-bottom: 2px solid transparent; margin-bottom: -1px;
        transition: color 0.15s ease-out, border-color 0.15s ease-out;
      }
      .np-tab:hover { color: #6b6878; }
      .np-tab.ativa { color: ${ROXO}; border-bottom-color: ${ROXO}; }

      .np-detalhe-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 30px; align-items: start; }
      @media (max-width: 620px) { .np-detalhe-grid { grid-template-columns: 1fr; gap: 24px; } }

      @media print {
        .no-print { display: none !important; }
        body, html { background: #fff !important; }
      }
    `}</style>
  );
}
