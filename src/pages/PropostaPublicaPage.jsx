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
          />
        )}
      </main>

      <Rodape />
    </div>
  );
}

function Conteudo({ proposta, acao, erroAcao, mostrarRecusa, setMostrarRecusa, motivoRecusa, setMotivoRecusa, onAceitar, onRecusar }) {
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
        {(proposta.items || []).map((item) => (
          <div key={item.system_slug} style={estilos.itemLinha}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{item.icon || '🧩'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#16151c' }}>{item.name}</div>
              {item.description && <div style={{ fontSize: '0.85rem', color: '#6b6878', marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#16151c', whiteSpace: 'nowrap' }}>{formatBRL(item.amount)}</div>
          </div>
        ))}
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

      @media print {
        .no-print { display: none !important; }
        body, html { background: #fff !important; }
      }
    `}</style>
  );
}
