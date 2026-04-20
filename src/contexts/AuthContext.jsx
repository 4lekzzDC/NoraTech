import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, AVATARS_BUCKET } from '../lib/supabase';

const AuthContext = createContext(null);

function translateAuthError(error) {
  if (!error) return 'Erro desconhecido';
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar';
  if (msg.includes('user already registered')) return 'Este e-mail já está em uso';
  if (msg.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Tente novamente em instantes.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (error.status === 404 || error.status === 503) return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
  return error.message || 'Erro ao processar a solicitação';
}

function mapProfile(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.user_metadata?.name || '',
    photoUrl: profile?.photo_url || null,
    company: profile?.company || null,
    createdAt: authUser.created_at || null,
  };
}

async function fetchProfileRow(authUser) {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, photo_url, company')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.warn('Falha ao carregar perfil:', error);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) { setUser(null); return; }
    const profile = await fetchProfileRow(authUser);
    setUser(mapProfile(authUser, profile));
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      await loadUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      await loadUser(session?.user ?? null);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(translateAuthError(error));
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw new Error(translateAuthError(error));

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: data.user.id, name: name.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (profileError) {
        console.warn('Falha ao criar profile:', profileError);
      }
    }

    if (!data.session) {
      throw new Error('Cadastro criado! Confirme seu e-mail para entrar.');
    }
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async ({ name, email, company }) => {
    if (!user) throw new Error('Usuário não autenticado');

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (company !== undefined) updates.company = company?.trim() || null;

    if (Object.keys(updates).length > 1) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw new Error(error.message);
    }

    let emailChanged = false;
    if (email && email.trim().toLowerCase() !== user.email) {
      const { error } = await supabase.auth.updateUser({
        email: email.trim().toLowerCase(),
      });
      if (error) throw new Error(translateAuthError(error));
      emailChanged = true;
    }

    setUser((prev) => ({
      ...prev,
      name: updates.name ?? prev.name,
      company: updates.company ?? prev.company,
    }));

    return { emailChanged };
  }, [user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) throw new Error('Usuário não autenticado');
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Senha atual incorreta');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateAuthError(error));
  }, [user]);

  const uploadPhoto = useCallback(async (file) => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!file.type.startsWith('image/')) throw new Error('Arquivo deve ser uma imagem');
    if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo acima de 5MB');

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (updateError) throw new Error(updateError.message);

    setUser((prev) => ({ ...prev, photoUrl: publicUrl }));
    return publicUrl;
  }, [user]);

  const removePhoto = useCallback(async () => {
    if (!user) throw new Error('Usuário não autenticado');

    if (user.photoUrl) {
      const marker = `/${AVATARS_BUCKET}/`;
      const idx = user.photoUrl.indexOf(marker);
      if (idx !== -1) {
        const objectPath = user.photoUrl.slice(idx + marker.length).split('?')[0];
        await supabase.storage.from(AVATARS_BUCKET).remove([objectPath]);
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ photo_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new Error(error.message);

    setUser((prev) => ({ ...prev, photoUrl: null }));
  }, [user]);

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    uploadPhoto,
    removePhoto,
    updateUser,
  }), [user, loading, login, register, logout, updateProfile, changePassword, uploadPhoto, removePhoto, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
