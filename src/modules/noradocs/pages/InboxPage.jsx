import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToastHost } from '../../../components/Toast';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import DocumentTable from '../components/DocumentTable';
import NoraDocsLayout from '../components/NoraDocsLayout';
import ReviewDrawer from '../components/ReviewDrawer';
import UploadDropzone from '../components/UploadDropzone';
import { noradocsRoute } from '../constants';
import { podeConfirmarEmLote } from '../domain/status';
import {
  countByStatus, fetchContextoDeClassificacao, fetchSettingsCompletas, listDocuments,
} from '../services/documents.service';
import { confirmarDocumento, criarRegra, descartarDocumento, reprocessarDocumento } from '../services/review.service';
import { fetchConnectionStatus } from '../services/googleDrive.service';
import { resolveTenant } from '../services/tenant';
import { processarArquivo } from '../services/upload.service';
import { getPalette } from '../theme';

// Rodapé de sincronização — status ambiente do Drive, sempre visível
// enquanto há conexão carregada. O anel só gira quando há upload de
// verdade em curso; parado o resto do tempo, senão vira ruído visual numa
// tela olhada o dia todo.
function RodapeSync({ conexao, sincronizando, P }) {
  if (!conexao) return null;
  const conectado = conexao.status === 'connected';
  return (
    <div style={{
      marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      border: `1px solid ${P.border}`, background: P.surface,
      fontSize: '0.78rem', color: P.muted,
    }}>
      <span style={{
        position: 'relative', width: 20, height: 20, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {sincronizando && (
          <span
            className="nd-sync-anel"
            aria-hidden="true"
            style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: `2px solid ${P.primaryBorder}`, borderTopColor: P.primary,
            }}
          />
        )}
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={conectado ? P.green : P.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3h8l5 9-5 9H8l-5-9z" />
          <path d="M8 3l-5 9 5 9" />
        </svg>
      </span>
      <span>
        {sincronizando
          ? 'Sincronizando com o Google Drive…'
          : conectado
            ? <>Sincronizado com o Google Drive{conexao.google_email && <span style={{ color: P.muted2 }}> · {conexao.google_email}</span>}</>
            : 'Desconectado do Google Drive'}
      </span>
    </div>
  );
}

// Tela principal do produto: os arquivos que ainda exigem alguma ação.
// O que já foi arquivado sai daqui e vive no Histórico.

const ABAS = [
  { id: null, label: 'Tudo' },
  { id: 'revisar', label: 'Revisar' },
  { id: 'erro', label: 'Erro' },
];

const VAZIO = {
  tudo: {
    titulo: 'Nada aguardando ação.',
    detalhe: 'Envie arquivos acima. Os que forem identificados sem ambiguidade vão direto para a '
      + 'pasta certa no Drive; os demais aparecem aqui para você confirmar.',
  },
  revisar: {
    titulo: 'Nenhum documento esperando revisão.',
    detalhe: 'Tudo que chegou foi identificado sozinho e já está arquivado. O que as regras não '
      + 'conseguirem fechar cai aqui para você confirmar.',
  },
  erro: {
    titulo: 'Nenhuma falha de arquivamento.',
    detalhe: 'Aqui aparece o que não conseguiu chegar ao Drive — conexão caída, arquivo recusado '
      + 'pelo Google — com a causa e o caminho para tentar de novo.',
  },
};

export default function InboxPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const { toasts, showToast, dismissToast } = useToasts();

  const [tenantId, setTenantId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [contagens, setContagens] = useState({});
  const [aba, setAba] = useState(null);
  const [progresso, setProgresso] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [emRevisao, setEmRevisao] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  // Linha sob o cursor do teclado. Índice, não id: a lista é recarregada
  // inteira a cada ação, e um id guardado apontaria para um documento que
  // acabou de sair da fila.
  const [cursor, setCursor] = useState(-1);
  const [confirmando, setConfirmando] = useState(false);
  // Cadastro do escritório, usado pelo painel de revisão. Carregado junto com
  // a tela para o drawer abrir instantâneo — a fila de revisão é percorrida
  // documento a documento, e esperar rede a cada abertura seria sensível.
  const [cadastro, setCadastro] = useState({ clients: [], categories: [] });
  const [conexao, setConexao] = useState(null);

  const recarregar = useCallback(async (statusAtual) => {
    const [docs, counts] = await Promise.all([
      listDocuments({ status: statusAtual }),
      countByStatus(),
    ]);
    setDocumentos(docs);
    setContagens(counts);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { tenantId: id } = await resolveTenant();
      if (!ativo) return;
      if (!id) { setCarregando(false); return; }
      setTenantId(id);
      const [cfg, ctx, conn] = await Promise.all([
        fetchSettingsCompletas(id),
        fetchContextoDeClassificacao(),
        fetchConnectionStatus(id),
      ]);
      if (!ativo) return;
      setSettings(cfg);
      setConexao(conn.account);
      setCadastro({ clients: ctx.clients, categories: ctx.categories });
      await recarregar(null);
      if (ativo) setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [recarregar]);

  // 'processando' é estado de trânsito: o upload e, pela entrada de e-mail, a
  // reclassificação com o texto do PDF terminam sozinhos, no servidor,
  // segundos depois de a linha aparecer aqui. Sem recarregar, a tela fica
  // presa no primeiro palpite (antes do PDF ser lido) até alguém trocar de
  // aba ou dar F5 — foi o que aconteceu num teste real: cliente, categoria e
  // pré-visualização já estavam certos no banco, mas a tela ainda mostrava o
  // estado de antes do envio terminar.
  const temProcessando = documentos.some((d) => d.status === 'processando');
  useEffect(() => {
    if (!temProcessando) return undefined;
    const t = setInterval(() => recarregar(aba), 3000);
    return () => clearInterval(t);
  }, [temProcessando, aba, recarregar]);

  // O painel de revisão abre com uma cópia do documento; sem isto, ele fica
  // com essa cópia parada mesmo depois de a lista acima trazer os dados
  // atualizados.
  useEffect(() => {
    if (!emRevisao) return;
    const atualizado = documentos.find((d) => d.id === emRevisao.id);
    if (atualizado && atualizado !== emRevisao) setEmRevisao(atualizado);
  }, [documentos, emRevisao]);

  // Guarda o File de cada arquivo do lote — só assim dá pra reprocessar um
  // que falhou sem pedir pro usuário arrastar de novo (o clique de "tentar
  // novamente" não carrega o arquivo consigo, só o nome).
  const arquivosRef = useRef(new Map());

  async function processarUm(file, contexto) {
    const marcar = (patch) =>
      setProgresso((p) => ({ ...p, [file.name]: { ...p[file.name], ...patch } }));
    try {
      const doc = await processarArquivo(file, {
        tenantId,
        settings,
        contexto,
        onEtapa: (etapa) => marcar({ etapa }),
      });
      marcar(doc.status === 'organizado' ? { pronto: 'Arquivado', erro: null, etapa: null } : { pronto: 'Para revisar', erro: null, etapa: null });
      return doc.status === 'organizado' ? 'organizado' : 'revisar';
    } catch (err) {
      marcar({ erro: err.message, pronto: null, etapa: null });
      return 'falha';
    }
  }

  async function enviarArquivos(arquivos) {
    setEnviando(true);
    arquivos.forEach((f) => arquivosRef.current.set(f.name, f));
    setProgresso((p) => ({ ...p, ...Object.fromEntries(arquivos.map((f) => [f.name, { etapa: null }])) }));

    // O contexto é lido UMA vez para o lote inteiro: o cadastro não muda no
    // meio de um envio de 30 arquivos, e reconsultar a cada um seria 30 idas
    // de rede sem ganho.
    const contexto = await fetchContextoDeClassificacao();

    let organizados = 0;
    let paraRevisar = 0;
    let falhas = 0;

    // Sequencial, não em paralelo: uploads simultâneos do mesmo cliente
    // disputariam a criação da mesma pasta no Drive, e um lote grande
    // estouraria a cota da API. A fila é lenta e previsível — melhor assim.
    for (const file of arquivos) {
      const resultado = await processarUm(file, contexto);
      if (resultado === 'organizado') organizados += 1;
      else if (resultado === 'revisar') paraRevisar += 1;
      else falhas += 1;
    }

    const partes = [];
    if (organizados) partes.push(`${organizados} arquivado(s)`);
    if (paraRevisar) partes.push(`${paraRevisar} para revisar`);
    if (falhas) partes.push(`${falhas} com problema`);
    showToast(partes.join(' · ') || 'Nada a processar.', falhas && !organizados ? 'error' : 'success');

    await recarregar(aba);
    setEnviando(false);
  }

  async function retentarArquivo(nome) {
    const file = arquivosRef.current.get(nome);
    if (!file) return;
    setEnviando(true);
    const contexto = await fetchContextoDeClassificacao();
    await processarUm(file, contexto);
    await recarregar(aba);
    setEnviando(false);
  }

  function limparProgresso() {
    setProgresso({});
    arquivosRef.current.clear();
  }

  async function confirmar(escolha, regra) {
    setConfirmando(true);
    try {
      await confirmarDocumento(emRevisao, escolha, {
        tenantId, settings, clients: cadastro.clients, categories: cadastro.categories,
      });
      if (regra) {
        // Falhar ao criar a regra não pode desfazer um arquivamento que já
        // aconteceu: o documento está na pasta certa. Vira aviso, não erro.
        await criarRegra({ tenantId, ...regra }).catch((err) =>
          showToast(`Documento arquivado, mas a regra não foi criada: ${err.message}`, 'error'));
      }
      showToast('Documento arquivado.');
      setEmRevisao(null);
      await recarregar(aba);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConfirmando(false);
    }
  }

  async function reprocessar(doc) {
    setConfirmando(true);
    try {
      const resultado = await reprocessarDocumento(doc, {
        tenantId, settings, clients: cadastro.clients, categories: cadastro.categories,
      });
      showToast(resultado ? 'Documento arquivado.' : 'Documento voltou para revisão — confirme os campos.');
      setEmRevisao(null);
      await recarregar(aba);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConfirmando(false);
    }
  }

  function alternarSelecao(id) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  // Confirma de uma vez o que só precisava de um aval. Sequencial pelo mesmo
  // motivo do upload: confirmações simultâneas do mesmo cliente disputariam a
  // criação da mesma pasta no Drive.
  async function confirmarSelecionados() {
    const alvos = documentos.filter((d) => selecionados.has(d.id) && podeConfirmarEmLote(d));
    if (!alvos.length) return;

    setConfirmando(true);
    let feitos = 0;
    const falhas = [];

    for (const doc of alvos) {
      try {
        await confirmarDocumento(
          doc,
          { clientId: doc.client.id, competencia: doc.competencia, categoryId: doc.category.id },
          { tenantId, settings, clients: cadastro.clients, categories: cadastro.categories },
        );
        feitos += 1;
      } catch (err) {
        falhas.push(`${doc.file_name}: ${err.message}`);
      }
    }

    // Nomeia o que falhou: num lote, "3 com problema" sem dizer quais obriga o
    // contador a conferir os 30 na mão.
    showToast(
      falhas.length
        ? `${feitos} arquivado(s). Falhou: ${falhas.join(' · ')}`
        : `${feitos} documento(s) arquivado(s).`,
      falhas.length ? 'error' : 'success',
    );
    setSelecionados(new Set());
    await recarregar(aba);
    setConfirmando(false);
  }

  async function descartar(doc) {
    const ok = window.confirm(
      `Descartar "${doc.file_name}"?\n\nEle sai da fila e o arquivo vai para a pasta _descartados no Drive.`
    );
    if (!ok) return;
    setConfirmando(true);
    try {
      await descartarDocumento(doc, tenantId);
      showToast('Documento descartado.');
      setEmRevisao(null);
      await recarregar(aba);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConfirmando(false);
    }
  }

  // A lista encolhe a cada documento arquivado; o cursor guardado pode passar
  // do fim. Vale o índice clampado, não o cru.
  const focado = documentos.length ? Math.min(cursor, documentos.length - 1) : -1;
  const docFocado = focado >= 0 ? documentos[focado] : null;

  // Zerar a fila é trabalho repetitivo de dezenas de itens: ↑↓ percorre,
  // enter abre, espaço marca para o lote. Sem isso, cada documento custa um
  // deslocamento de mão até o mouse e uma busca visual pela linha certa.
  //
  // Dois cuidados que fazem a diferença entre atalho e estorvo: nada dispara
  // enquanto o foco está num campo (senão "espaço" vira seleção no meio de
  // uma busca digitada), e nada dispara com o painel de revisão aberto —
  // lá o teclado é dele, que já trata esc e ⌘↵.
  useEffect(() => {
    if (emRevisao) return undefined;

    const aoTeclar = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target;
      const digitando = alvo?.isContentEditable
        || ['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo?.tagName);
      if (digitando) return;
      if (!documentos.length) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, documentos.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'Enter' && docFocado) {
        e.preventDefault();
        setEmRevisao(docFocado);
      } else if (e.key === ' ' && docFocado) {
        // preventDefault obrigatório: espaço rola a página por padrão, e a
        // linha marcada sairia da vista no mesmo gesto que a marcou.
        e.preventDefault();
        if (podeConfirmarEmLote(docFocado)) alternarSelecao(docFocado.id);
      } else if (e.key === 'Escape') {
        setCursor(-1);
        setSelecionados(new Set());
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [documentos, docFocado, emRevisao]);

  const semDrive = settings && !settings.drive_root_folder_id;
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);

  const cartao = {
    border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
    padding: '26px 24px', boxShadow: P.shadow,
  };

  return (
    <NoraDocsLayout
      title="Caixa de entrada"
      subtitle="Arquivos recebidos aguardando identificação de cliente, competência e categoria."
    >
      <style>{`
        @keyframes nd-sync-spin { to { transform: rotate(360deg); } }
        .nd-sync-anel { animation: nd-sync-spin 0.8s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nd-sync-anel { animation: none; }
        }
      `}</style>
      {!carregando && !tenantId && (
        <div style={cartao}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhum escritório vinculado a este usuário.</p>
          <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.88rem' }}>
            O NoraDocs organiza os documentos de um escritório, e o seu usuário precisa ser membro
            ativo de um. Crie ou entre em uma empresa na Central de Controle e volte aqui.
          </p>
        </div>
      )}

      {!carregando && tenantId && semDrive && (
        <div style={{ ...cartao, marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Falta escolher a pasta raiz no Google Drive.</p>
          <p style={{ margin: '8px 0 14px', color: P.muted, fontSize: '0.88rem', maxWidth: '58ch' }}>
            É para onde os documentos organizados vão. Sem ela, não há onde arquivar.
          </p>
          <Link
            to={noradocsRoute('configuracoes')}
            style={{ color: P.primaryText, fontSize: '0.86rem', fontWeight: 600 }}
          >
            Ir para Configurações →
          </Link>
        </div>
      )}

      {!carregando && tenantId && !semDrive && (
        <>
          {conexao && conexao.status !== 'connected' && (
            <div style={{
              marginBottom: 16, padding: '13px 16px', borderRadius: 12,
              border: `1px solid ${P.gold}44`,
              background: theme === 'light' ? 'rgba(180,83,9,0.07)' : 'rgba(240,180,41,0.09)',
            }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.87rem' }}>
                A conexão com o Google Drive caiu.
              </p>
              <p style={{ margin: '6px 0 0', color: P.muted, fontSize: '0.83rem' }}>
                Nada será arquivado até reconectar.{' '}
                <Link to={noradocsRoute('configuracoes')} style={{ color: P.primaryText, fontWeight: 600 }}>
                  Reconectar em Configurações →
                </Link>
              </p>
            </div>
          )}

          <UploadDropzone
            onArquivos={enviarArquivos} progresso={progresso} ocupado={enviando}
            onRetry={retentarArquivo} onClear={limparProgresso}
          />

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {ABAS.map((t) => {
              const ativa = aba === t.id;
              const n = t.id ? (contagens[t.id] || 0) : total;
              return (
                <button
                  key={t.label}
                  // Recarrega no clique, não por efeito: trocar de aba é um
                  // evento do usuário, não sincronização de estado externo.
                  onClick={() => { setAba(t.id); setCursor(-1); recarregar(t.id); }}
                  style={{
                    padding: '6px 13px', borderRadius: 999, fontFamily: 'inherit', fontSize: '0.82rem',
                    fontWeight: ativa ? 700 : 500, cursor: 'pointer',
                    color: ativa ? P.primaryText : P.muted,
                    background: ativa ? P.primarySoft : 'transparent',
                    border: `1px solid ${ativa ? P.primaryBorder : P.border}`,
                  }}
                >
                  {t.label} {n > 0 && <span style={{ opacity: 0.75 }}>({n})</span>}
                </button>
              );
            })}

            {selecionados.size > 0 && (
              <button
                onClick={confirmarSelecionados}
                disabled={confirmando}
                style={{
                  marginLeft: 'auto', padding: '6px 15px', borderRadius: 999, border: 'none',
                  background: P.primary, color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                  cursor: confirmando ? 'progress' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {confirmando ? 'Arquivando…' : `Confirmar ${selecionados.size} selecionado(s)`}
              </button>
            )}
          </div>

          {/* Atalho que ninguém descobre é atalho que não existe. Uma linha
              discreta basta — e some quando não há fila para percorrer. */}
          {documentos.length > 0 && (
            <p style={{
              margin: '0 0 10px', fontSize: '0.73rem', color: P.muted2,
              display: 'flex', gap: 14, flexWrap: 'wrap',
            }}>
              <span><strong style={{ fontWeight: 600 }}>↑↓</strong> navegar</span>
              <span><strong style={{ fontWeight: 600 }}>enter</strong> abrir</span>
              <span><strong style={{ fontWeight: 600 }}>espaço</strong> selecionar</span>
              <span><strong style={{ fontWeight: 600 }}>esc</strong> limpar</span>
            </p>
          )}

          <div style={{
            border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
            overflow: 'hidden', boxShadow: P.shadow,
          }}>
            {documentos.length === 0 ? (
              // O vazio de cada aba quer dizer uma coisa diferente. Repetir
              // "envie arquivos acima" na aba Erro sugeriria que nada chegou,
              // quando o que houve foi que nada falhou — que é notícia boa e
              // merece ser dita como tal.
              <div style={{ padding: '30px 24px' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{VAZIO[aba ?? 'tudo'].titulo}</p>
                <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.87rem', maxWidth: '58ch' }}>
                  {VAZIO[aba ?? 'tudo'].detalhe}
                </p>
              </div>
            ) : (
              <DocumentTable
                documentos={documentos}
                onAbrir={setEmRevisao}
                selecionados={selecionados}
                onAlternar={alternarSelecao}
                focadoId={docFocado?.id}
              />
            )}
          </div>

          <RodapeSync conexao={conexao} sincronizando={enviando} P={P} />
        </>
      )}

      {emRevisao && (
        <ReviewDrawer
          // O status entra na key de propósito: os campos do formulário
          // (cliente, competência, categoria) só são lidos do documento UMA
          // vez, na primeira renderização. Um documento aberto ainda
          // 'processando' — antes de a reclassificação com o texto do PDF
          // terminar, no servidor — mostraria os campos vazios para sempre
          // sem isto, mesmo depois de recarregar() trazer os dados certos:
          // só a troca de key força o formulário a nascer de novo com o
          // valor final.
          key={`${emRevisao.id}:${emRevisao.status}`}
          documento={emRevisao}
          clients={cadastro.clients}
          categories={cadastro.categories}
          tenantId={tenantId}
          salvando={confirmando}
          onConfirmar={confirmar}
          onDescartar={descartar}
          onReprocessar={reprocessar}
          onFechar={() => setEmRevisao(null)}
        />
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
