import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyCompany } from '../lib/companies';
import LoadingScreen from './LoadingScreen';

/**
 * Protege rotas que exigem role owner ou admin na organização.
 * Membros comuns (role='member') são redirecionados para /area-do-cliente.
 * Usuários sem empresa passam (podem ter assinaturas individuais ou ver tela vazia).
 */
export default function OrgManagerRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    if (!user) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const data = await fetchMyCompany();
        if (!active) return;

        if (!data) {
          // Sem empresa — permite (tela financeira mostra estado vazio)
          setAllowed(true);
          return;
        }

        const role = data.membership?.role;
        const isActive = data.membership?.status === 'active';

        // Bloqueia apenas membro ativo com role comum;
        // owner/admin passam; pendentes também são bloqueados (isActive=false)
        setAllowed(!isActive || role === 'owner' || role === 'admin');
      } catch (err) {
        console.error('[OrgManagerRoute] Erro ao verificar permissão:', err);
        if (!active) return;
        // Em caso de erro, bloqueia por segurança
        setAllowed(false);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => { active = false; };
  }, [user, authLoading]);

  if (authLoading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/area-do-cliente" replace />;
  return children;
}
