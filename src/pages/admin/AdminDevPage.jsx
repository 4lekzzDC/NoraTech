import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout, { Card, Spinner, EmptyState } from '../../components/AdminLayout';
import { ToastHost } from '../../components/Toast';
import { useToasts } from '../../lib/useToasts';
import {
  CATEGORIAS, buscarLogs, contarPorCategoria,
  useIdentidadeDoSite, salvarIdentidade, enviarArquivoDeMarca,
} from '../../lib/dev';

const PAGINA = 100;

// Cor por severidade. Vermelho só para erro: se tudo grita, nada é urgente.
const COR_SEVERIDADE = {
  error:   { fundo: 'rgba(239,68,68,.12)',  borda: 'rgba(239,68,68,.32)',  texto: '#f87171' },
  warning: { fundo: 'rgba(245,158,11,.12)', borda: 'rgba(245,158,11,.3)',  texto: '#fbbf24' },
  failure: { fundo: 'rgba(239,68,68,.12)',  borda: 'rgba(239,68,68,.32)',  texto: '#f87171' },
  success: { fundo: 'rgba(16,185,129,.1)',  borda: 'rgba(16,185,129,.28)', texto: '#34d399' },
  info:    { fundo: 'rgba(255,255,255,.05)', borda: 'rgba(255,255,255,.1)', texto: '#bbb' },
};

const PERIODOS = [
  { id: '24h', label: '24 horas', horas: 24 },
  { id: '7d',  label: '7 dias',   horas: 24 * 7 },
  { id: '30d', label: '30 dias',  horas: 24 * 30 },
  { id: 'tudo', label: 'Tudo',    horas: null },
];

function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Logs ────────────────────────────────────────────────────────────────

function AbaLogs({ push }) {
  const [categoria, setCategoria] = useState(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [periodo, setPeriodo] = useState('7d');
  const [linhas, setLinhas] = useState([]);
  const [contagens, setContagens] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [temMais, setTemMais] = useState(false);
  const [expandida, setExpandida] = useState(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const desde = useMemo(() => {
    const p = PERIODOS.find((x) => x.id === periodo);
    if (!p?.horas) return null;
    return new Date(Date.now() - p.horas * 3600_000).toISOString();
  }, [periodo]);

  // Debounce da busca: cada tecla dispararia uma união de seis tabelas no banco.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async (offset = 0) => {
    setCarregando(true);
    try {
      const dados = await buscarLogs({ categoria, busca: buscaAplicada, desde, limite: PAGINA, offset });
      if (!montado.current) return;
      setLinhas((antes) => (offset === 0 ? dados : [...antes, ...dados]));
      setTemMais(dados.length === PAGINA);
    } catch (err) {
      if (montado.current) push(err.message || 'Falha ao carregar os logs', 'error');
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, [categoria, buscaAplicada, desde, push]);

  useEffect(() => { carregar(0); }, [carregar]);

  useEffect(() => {
    contarPorCategoria(desde)
      .then((c) => { if (montado.current) setContagens(c); })
      .catch(() => {});
  }, [desde]);

  const total = Object.values(contagens).reduce((a, b) => a + b, 0);

  return (
    <>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no título, detalhe ou ator…"
            style={{
              flex: '1 1 260px', minWidth: 0, padding: '9px 12px', borderRadius: 9,
              background: '#111114', border: '1px solid rgba(255,255,255,.12)',
              color: '#eeede9', fontSize: '.85rem', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                style={{
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '.78rem',
                  fontWeight: periodo === p.id ? 700 : 500,
                  background: periodo === p.id ? 'rgba(124,58,237,.18)' : 'transparent',
                  border: `1px solid ${periodo === p.id ? 'rgba(124,58,237,.4)' : 'rgba(255,255,255,.1)'}`,
                  color: periodo === p.id ? '#a78bfa' : '#999',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {CATEGORIAS.map((c) => {
            const n = c.id === null ? total : (contagens[c.id] ?? 0);
            const ativa = categoria === c.id;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setCategoria(c.id)}
                style={{
                  padding: '6px 11px', borderRadius: 20, cursor: 'pointer', fontSize: '.76rem',
                  fontWeight: ativa ? 700 : 500,
                  background: ativa ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${ativa ? 'rgba(124,58,237,.4)' : 'rgba(255,255,255,.08)'}`,
                  color: ativa ? '#a78bfa' : '#aaa',
                }}
              >
                {c.label}
                <span style={{ opacity: .6, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {carregando && linhas.length === 0 ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : linhas.length === 0 ? (
          <EmptyState>Nenhum registro no período e filtro escolhidos.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  {['Quando', 'Categoria', 'Ator', 'Evento', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: '.68rem', fontWeight: 700,
                      color: '#888', textTransform: 'uppercase', letterSpacing: .7,
                      borderBottom: '1px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const chave = `${l.origem}-${l.quando}-${i}`;
                  const cor = COR_SEVERIDADE[l.severidade] || COR_SEVERIDADE.info;
                  const aberta = expandida === chave;
                  return (
                    <Fragment key={chave}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                        <td style={{ padding: '9px 14px', color: '#888', whiteSpace: 'nowrap',
                                     fontVariantNumeric: 'tabular-nums', fontSize: '.76rem' }}>
                          {dataHora(l.quando)}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: '.68rem', fontWeight: 700,
                            background: cor.fundo, border: `1px solid ${cor.borda}`, color: cor.texto,
                            whiteSpace: 'nowrap',
                          }}>
                            {l.categoria}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#bbb', whiteSpace: 'nowrap' }}>
                          {l.ator || '—'}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#eeede9' }}>
                          {l.titulo}
                          {l.detalhe && (
                            <div style={{ color: '#777', fontSize: '.74rem', marginTop: 2,
                                          whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {l.detalhe.length > 160 && !aberta ? `${l.detalhe.slice(0, 160)}…` : l.detalhe}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setExpandida(aberta ? null : chave)}
                            style={{
                              background: 'none', border: '1px solid rgba(255,255,255,.12)',
                              color: '#999', borderRadius: 7, padding: '3px 9px',
                              fontSize: '.7rem', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {aberta ? 'Fechar' : 'Dados'}
                          </button>
                        </td>
                      </tr>
                      {aberta && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 14px 12px', background: 'rgba(255,255,255,.02)' }}>
                            <div style={{ fontSize: '.68rem', color: '#666', marginBottom: 4 }}>
                              origem: {l.origem}
                            </div>
                            <pre style={{
                              margin: 0, padding: 12, borderRadius: 8, background: '#0d0d10',
                              border: '1px solid rgba(255,255,255,.08)', color: '#bbb',
                              fontSize: '.72rem', overflowX: 'auto', maxHeight: 280,
                            }}>
                              {JSON.stringify(l.dados, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {temMais && (
          <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <button
              type="button"
              onClick={() => carregar(linhas.length)}
              disabled={carregando}
              style={{
                padding: '8px 18px', borderRadius: 9, cursor: carregando ? 'wait' : 'pointer',
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
                color: '#ccc', fontSize: '.8rem', fontWeight: 600,
              }}
            >
              {carregando ? 'Carregando…' : 'Carregar mais'}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Identidade do site ──────────────────────────────────────────────────

function CampoImagem({ rotulo, ajuda, valor, onEnviar, enviando }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0',
                  borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {valor
          ? <img src={valor} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <span style={{ color: '#555', fontSize: '.7rem' }}>vazio</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#eeede9' }}>{rotulo}</div>
        <div style={{ fontSize: '.74rem', color: '#777', marginTop: 2 }}>{ajuda}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
        style={{ display: 'none' }}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (arquivo) onEnviar(arquivo);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        style={{
          padding: '7px 14px', borderRadius: 8, cursor: enviando ? 'wait' : 'pointer',
          background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.35)',
          color: '#a78bfa', fontSize: '.78rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        {enviando ? 'Enviando…' : 'Trocar'}
      </button>
    </div>
  );
}

function AbaIdentidade({ push }) {
  const { identidade, carregando, setIdentidade, recarregar } = useIdentidadeDoSite();
  const [nome, setNome] = useState('');
  const [tagline, setTagline] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    if (!identidade) return;
    setNome(identidade.site_name || '');
    setTagline(identidade.tagline || '');
  }, [identidade]);

  const salvarTexto = async () => {
    setSalvando(true);
    try {
      await salvarIdentidade({ site_name: nome.trim(), tagline: tagline.trim() || null });
      await recarregar();
      push('Identidade salva. Recarregue para ver na aba do navegador.', 'success');
    } catch (err) {
      push(err.message || 'Falha ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const trocarImagem = async (campo, arquivo) => {
    setEnviando(campo);
    try {
      const url = await enviarArquivoDeMarca(campo, arquivo);
      await salvarIdentidade({ [campo]: url });
      setIdentidade((antes) => ({ ...antes, [campo]: url }));
      push('Imagem atualizada.', 'success');
    } catch (err) {
      push(err.message || 'Falha ao enviar', 'error');
    } finally {
      setEnviando(null);
    }
  };

  if (carregando) {
    return <Card><div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div></Card>;
  }

  const campoTexto = {
    width: '100%', padding: '9px 12px', borderRadius: 9, background: '#111114',
    border: '1px solid rgba(255,255,255,.12)', color: '#eeede9', fontSize: '.85rem', outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
      <Card>
        <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase',
                      letterSpacing: 1, marginBottom: 14 }}>
          Nome e assinatura
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label htmlFor="dev-nome" style={{ display: 'block', fontSize: '.76rem', color: '#999', marginBottom: 5 }}>
              Nome do site
            </label>
            <input id="dev-nome" value={nome} onChange={(e) => setNome(e.target.value)} style={campoTexto} />
          </div>
          <div>
            <label htmlFor="dev-tag" style={{ display: 'block', fontSize: '.76rem', color: '#999', marginBottom: 5 }}>
              Assinatura <span style={{ color: '#666' }}>— aparece na aba, depois do nome</span>
            </label>
            <input id="dev-tag" value={tagline} onChange={(e) => setTagline(e.target.value)}
                   placeholder="Software sob medida para empresas" style={campoTexto} />
          </div>
          <div style={{ fontSize: '.74rem', color: '#666' }}>
            Título da aba: <span style={{ color: '#aaa' }}>
              {nome || 'NoraTech'}{tagline ? ` — ${tagline}` : ''}
            </span>
          </div>
          <div>
            <button
              type="button" onClick={salvarTexto} disabled={salvando || !nome.trim()}
              style={{
                padding: '9px 20px', borderRadius: 9,
                cursor: salvando || !nome.trim() ? 'not-allowed' : 'pointer',
                background: '#7c3aed', border: 'none', color: '#fff',
                fontSize: '.82rem', fontWeight: 700, opacity: salvando || !nome.trim() ? .5 : 1,
              }}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase',
                      letterSpacing: 1, marginBottom: 4 }}>
          Imagens
        </div>
        <CampoImagem
          rotulo="Favicon" ajuda="Ícone da aba. PNG ou SVG quadrado, 32px ou mais."
          valor={identidade?.favicon_url} enviando={enviando === 'favicon_url'}
          onEnviar={(a) => trocarImagem('favicon_url', a)}
        />
        <CampoImagem
          rotulo="Logo" ajuda="Usada sobre fundo claro."
          valor={identidade?.logo_url} enviando={enviando === 'logo_url'}
          onEnviar={(a) => trocarImagem('logo_url', a)}
        />
        <CampoImagem
          rotulo="Logo para fundo escuro" ajuda="Opcional. Sem ela, a logo acima é usada nos dois temas."
          valor={identidade?.logo_dark_url} enviando={enviando === 'logo_dark_url'}
          onEnviar={(a) => trocarImagem('logo_dark_url', a)}
        />
        <p style={{ fontSize: '.73rem', color: '#666', marginTop: 12, lineHeight: 1.55, marginBottom: 0 }}>
          Cada envio gera um arquivo com nome novo em vez de sobrescrever o anterior. É o que
          garante que navegador e CDN não continuem servindo a imagem antiga do cache — com nome
          fixo, a troca pareceria não ter funcionado.
        </p>
      </Card>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────

export default function AdminDevPage() {
  const [aba, setAba] = useState('logs');
  const { toasts, showToast, dismissToast } = useToasts();

  return (
    <AdminLayout
      title="DEV"
      subtitle="Logs do sistema e identidade do site. Área restrita ao desenvolvedor."
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {[{ id: 'logs', label: 'Logs do sistema' }, { id: 'identidade', label: 'Identidade do site' }].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            style={{
              padding: '9px 16px', background: 'none', cursor: 'pointer',
              border: 'none', borderBottom: `2px solid ${aba === t.id ? '#7c3aed' : 'transparent'}`,
              color: aba === t.id ? '#eeede9' : '#888',
              fontSize: '.85rem', fontWeight: aba === t.id ? 700 : 500, marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'logs' ? <AbaLogs push={showToast} /> : <AbaIdentidade push={showToast} />}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
