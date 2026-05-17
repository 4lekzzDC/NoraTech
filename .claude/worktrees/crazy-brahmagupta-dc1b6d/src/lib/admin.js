import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@noratech.com.br')
  .trim()
  .toLowerCase();

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [roleIsAdmin, setRoleIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user) {
        if (active) { setRoleIsAdmin(false); setChecking(false); }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      setRoleIsAdmin(data?.role === 'admin');
      setChecking(false);
    };
    run();
    return () => { active = false; };
  }, [user]);

  const emailMatches = !!user && user.email?.toLowerCase() === ADMIN_EMAIL;
  return {
    isAdmin: emailMatches || roleIsAdmin,
    loading: loading || checking,
  };
}

export function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
