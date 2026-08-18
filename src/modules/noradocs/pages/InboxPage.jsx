import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToastHost } from '../../../components/Toast';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import DocumentTable from '../components/DocumentTable';
import NoraDocsLayout from '../components/NoraDocsLayout';
import UploadDropzone from '../components/UploadDropzone';
import { noradocsRoute } from '../constants';
import {
  countByStatus, fetchContextoDeClassificacao, fetchSettingsCompletas, listDocuments,
} from '../services/documents.service';
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
      setSettings(await fetchSettingsCompletas(id));
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
              <DocumentTable documentos={documentos} />
            )}
          </div>
        </>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
