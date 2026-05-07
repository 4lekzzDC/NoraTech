import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import { hasActiveSubscription } from '../lib/accounting';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(124, 58, 237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SubscriptionRoute({ systemSlug, children }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    if (authLoading || adminLoading) return;
    if (!user) { setChecking(false); return; }
    if (isAdmin) { setAllowed(true); setChecking(false); return; }
    (async () => {
      try {
        const { hasAccess } = await hasActiveSubscription(systemSlug);
        if (!active) return;
        setAllowed(hasAccess);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, [user, isAdmin, authLoading, adminLoading, systemSlug]);

  if (authLoading || adminLoading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/area-do-cliente" replace />;
  return children;
}
