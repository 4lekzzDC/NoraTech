import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsDeveloper } from '../lib/dev';
import LoadingScreen from './LoadingScreen';

// Guarda da área de DEV.
//
// Manda para /admin, e não para /login, quem está autenticado mas não é
// developer: a pessoa TEM acesso ao painel, só não a esta parte dele. Jogar
// para o login faria parecer que a sessão caiu.
//
// Isto é decoração de rota, não proteção. Quem proteje são o RLS de
// `app_errors` e `site_settings` e o `raise` dentro de `logs_do_sistema()` —
// chamar a API direto sem ser developer não devolve nada, com ou sem esta tela.
export default function DevRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { isDeveloper, loading } = useIsDeveloper();

  if (authLoading || loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isDeveloper) return <Navigate to="/admin" replace />;
  return children;
}
