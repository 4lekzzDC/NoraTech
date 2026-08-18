import { useEffect, useState } from 'react';
import { ToastHost } from '../../../components/Toast';
import { getCurrentMembership } from '../../../lib/subscriptions';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import CategoriesCard from '../components/CategoriesCard';
import FolderTemplateCard from '../components/FolderTemplateCard';
import GoogleConnectionCard from '../components/GoogleConnectionCard';
import NoraDocsLayout from '../components/NoraDocsLayout';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categories.service';
import { fetchFolderSettings } from '../services/settings.service';
import { resolveTenant } from '../services/tenant';
import { getPalette } from '../theme';

export default function ConfiguracoesPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const { toasts, showToast, dismissToast } = useToasts();

  const [tenantId, setTenantId] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [template, setTemplate] = useState('');
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ tenantId: id }, membership] = await Promise.all([resolveTenant(), getCurrentMembership()]);
      if (!ativo || !id) { setCarregando(false); return; }

      const [settings, cats] = await Promise.all([fetchFolderSettings(id), listCategories(id)]);
      if (!ativo) return;

      setTenantId(id);
      setIsManager(membership?.role === 'owner' || membership?.role === 'admin');
      setTemplate(settings?.folder_template || '');
      setCategorias(cats);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, []);

  async function recarregarCategorias() {
    setCategorias(await listCategories(tenantId));
  }

  async function alterarCategoria(id, patch) {
    try {
      await updateCategory(id, patch);
      await recarregarCategorias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function adicionarCategoria(nome) {
    try {
      await createCategory(tenantId, nome);
      await recarregarCategorias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function excluirCategoria(categoria) {
    const ok = window.confirm(
      `Excluir a categoria "${categoria.nome}"?\n\nDocumentos já arquivados nela continuam no Drive e no ` +
      'histórico, mas deixam de apontar para uma categoria. Para só parar de usá-la, desmarque "Ativa".'
    );
    if (!ok) return;
    try {
      await deleteCategory(categoria.id);
      await recarregarCategorias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <NoraDocsLayout
      title="Configurações"
      subtitle="Conexão com o Google Drive, estrutura de pastas e categorias do escritório."
    >
      {!carregando && !tenantId && (
        <div style={{
          border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
          padding: '26px 24px', boxShadow: P.shadow,
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhum escritório vinculado a este usuário.</p>
          <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.88rem' }}>
            O NoraDocs organiza os documentos de um escritório, e o seu usuário precisa ser membro
            ativo de um. Crie ou entre em uma empresa na Central de Controle e volte aqui.
          </p>
        </div>
      )}

      {!carregando && tenantId && (
        <div style={{ display: 'grid', gap: 22, maxWidth: 680 }}>
          <GoogleConnectionCard tenantId={tenantId} isManager={isManager} showToast={showToast} />

          <FolderTemplateCard
            tenantId={tenantId}
            template={template}
            isManager={isManager}
            showToast={showToast}
            onSaved={setTemplate}
          />

          <CategoriesCard
            categorias={categorias}
            isManager={isManager}
            onUpdate={alterarCategoria}
            onCreate={adicionarCategoria}
            onDelete={excluirCategoria}
          />
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
