import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import { hasActiveSubscription, isModuleEnabled } from '../lib/subscriptions';
import LoadingScreen from './LoadingScreen';

// `moduleSlug` é opcional: quando informado, além de checar se a empresa tem
// assinatura ativa no `systemSlug`, também checa se esse módulo específico
// está entre os liberados na assinatura (`enabled_modules`) — é o gate fino
// usado pelos módulos internos do hub Soluções Contábeis, pra permitir um
// cliente pagar por só uma parte do sistema.
export default function SubscriptionRoute({ systemSlug, legacySlugs, moduleSlug, moduleFallback, children }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [moduleAllowed, setModuleAllowed] = useState(true);
  const legacyKey = (legacySlugs || []).join(',');

  useEffect(() => {
    let active = true;
    if (authLoading || adminLoading) return;
    if (!user) { setChecking(false); return; }
    if (isAdmin) { setAllowed(true); setModuleAllowed(true); setChecking(false); return; }

    console.debug('[SubscriptionRoute] Checking subscription for:', systemSlug, moduleSlug);
    (async () => {
      try {
        const { hasAccess, enabledModules } = await hasActiveSubscription(systemSlug, { legacySlugs });
        if (!active) return;
        console.debug('[SubscriptionRoute] hasAccess:', hasAccess, 'enabledModules:', enabledModules);
        setAllowed(hasAccess);
        setModuleAllowed(isModuleEnabled(enabledModules, moduleSlug));
      } catch (err) {
        console.error('[SubscriptionRoute] hasActiveSubscription threw:', err);
        if (!active) return;
        setAllowed(false);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => { active = false; };
  }, [user, isAdmin, authLoading, adminLoading, systemSlug, legacyKey, moduleSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast-path: admin always allowed, skip loading. Admin vê o sistema
  // inteiro mesmo que a assinatura da empresa restrinja módulos — é quem
  // configura a restrição, não faz sentido ele próprio ficar bloqueado.
  if (isAdmin && !authLoading && !adminLoading) return children;

  if (authLoading || adminLoading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/area-do-cliente" replace />;
  if (moduleSlug && !moduleAllowed) return <Navigate to={moduleFallback || '/area-do-cliente'} replace />;
  return children;
}
