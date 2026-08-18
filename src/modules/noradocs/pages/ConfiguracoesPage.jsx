import { useEffect, useState } from 'react';
import { ToastHost } from '../../../components/Toast';
import { getCurrentMembership } from '../../../lib/subscriptions';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import EtapaPendente from '../components/EtapaPendente';
import GoogleConnectionCard from '../components/GoogleConnectionCard';
import NoraDocsLayout from '../components/NoraDocsLayout';
import { resolveTenant } from '../services/tenant';
import { getPalette } from '../theme';

export default function ConfiguracoesPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const { toasts, showToast, dismissToast } = useToasts();

  const [tenantId, setTenantId] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ tenantId: id }, membership] = await Promise.all([resolveTenant(), getCurrentMembership()]);
      if (!ativo) return;
      setTenantId(id);
      setIsManager(membership?.role === 'owner' || membership?.role === 'admin');
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, []);

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
        <div style={{ display: 'grid', gap: 22, maxWidth: 640 }}>
          <GoogleConnectionCard tenantId={tenantId} isManager={isManager} showToast={showToast} />

          <EtapaPendente
            etapa="Etapa 4"
            entrega="Estrutura de pastas e categorias."
            itens={[
              'Modelo de pastas com tokens e pré-visualização do caminho antes de salvar',
              'Categorias do escritório: ordem, nome e palavras-chave',
            ]}
          />
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
