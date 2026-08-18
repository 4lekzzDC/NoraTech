import { useCallback, useEffect, useState } from 'react';
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

// Tela principal do produto: os arquivos que ainda exigem alguma ação.
// O que já foi arquivado sai daqui e vive no Histórico.

const ABAS = [
  { id: null, label: 'Tudo' },
  { id: 'revisar', label: 'Revisar' },
  { id: 'erro', label: 'Erro' },
];

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

  async function enviarArquivos(arquivos) {
    setEnviando(true);
    setProgresso(Object.fromEntries(arquivos.map((f) => [f.name, { etapa: null }])));

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
      const marcar = (patch) =>
        setProgresso((p) => ({ ...p, [file.name]: { ...p[file.name], ...patch } }));

      try {
        const doc = await processarArquivo(file, {
          tenantId,
          settings,
          contexto,
          onEtapa: (etapa) => marcar({ etapa }),
        });
        if (doc.status === 'organizado') {
          organizados += 1;
          marcar({ pronto: 'Arquivado', etapa: null });
        } else {
          paraRevisar += 1;
          marcar({ pronto: 'Para revisar', etapa: null });
        }
      } catch (err) {
        falhas += 1;
        marcar({ erro: err.message, etapa: null });
      }
    }

    const partes = [];
    if (organizados) partes.push(`${organizados} arquivado(s)`);
    if (paraRevisar) partes.push(`${paraRevisar} para revisar`);
    if (falhas) partes.push(`${falhas} com problema`);
    showToast(partes.join(' · ') || 'Nada a processar.', falhas && !organizados ? 'error' : 'success');

    await recarregar(aba);
    setEnviando(false);
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
      `Descartar "${doc.file_name}"?\n\nEle sai da fila e o arquivo continua no Drive, na pasta de triagem.`
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

          <UploadDropzone onArquivos={enviarArquivos} progresso={progresso} ocupado={enviando} />

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {ABAS.map((t) => {
              const ativa = aba === t.id;
              const n = t.id ? (contagens[t.id] || 0) : total;
              return (
                <button
                  key={t.label}
                  // Recarrega no clique, não por efeito: trocar de aba é um
                  // evento do usuário, não sincronização de estado externo.
                  onClick={() => { setAba(t.id); recarregar(t.id); }}
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

          <div style={{
            border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
            overflow: 'hidden', boxShadow: P.shadow,
          }}>
            {documentos.length === 0 ? (
              <div style={{ padding: '30px 24px' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Nada aguardando ação.</p>
                <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.87rem', maxWidth: '58ch' }}>
                  Envie arquivos acima. Os que forem identificados sem ambiguidade vão direto para a
                  pasta certa no Drive; os demais aparecem aqui para você confirmar.
                </p>
              </div>
            ) : (
              <DocumentTable
                documentos={documentos}
                onAbrir={setEmRevisao}
                selecionados={selecionados}
                onAlternar={alternarSelecao}
              />
            )}
          </div>
        </>
      )}

      {emRevisao && (
        <ReviewDrawer
          key={emRevisao.id}
          documento={emRevisao}
          clients={cadastro.clients}
          categories={cadastro.categories}
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
