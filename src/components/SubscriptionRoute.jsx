import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import { hasActiveSubscription } from '../lib/subscriptions';
import LoadingScreen from './LoadingScreen';

export default function SubscriptionRoute({ systemSlug, legacySlugs, children }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const legacyKey = (legacySlugs || []).join(',');

  useEffect(() => {
    let active = true;
    if (authLoading || adminLoading) return;
    if (!user) { setChecking(false); return; }
    if (isAdmin) { setAllowed(true); setChecking(false); return; }

    console.debug('[SubscriptionRoute] Checking subscription for:', systemSlug);
    (async () => {
      try {
        const { hasAccess } = await hasActiveSubscription(systemSlug, { legacySlugs });
        if (!active) return;
        console.debug('[SubscriptionRoute] hasAccess:', hasAccess);
        setAllowed(hasAccess);
      } catch (err) {
        console.error('[SubscriptionRoute] hasActiveSubscription threw:', err);
        if (!active) return;
        setAllowed(false);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => { active = false; };
  }, [user, isAdmin, authLoading, adminLoading, systemSlug, legacyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast-path: admin always allowed, skip loading
  if (isAdmin && !authLoading && !adminLoading) return children;

  if (authLoading || adminLoading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/area-do-cliente" replace />;
  return children;
}
