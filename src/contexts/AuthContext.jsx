import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, AVATARS_BUCKET, purgeLocalSession } from '../lib/supabase';

const AuthContext = createContext(null);

function translateAuthError(error) {
  if (!error) return 'Erro desconhecido';
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar';
  if (msg.includes('user already registered')) return 'Este e-mail já está em uso';
  if (msg.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres';
  if (msg.includes('new password should be different from the old password')) return 'A nova senha deve ser diferente da senha atual.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Tente novamente em instantes.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (error.status === 404 || error.status === 503) return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
  return error.message || 'Erro ao processar a solicitação';
}

// Cache local do nome (fora do supabase, só localStorage) usado como palpite
// no primeiro render após reload, enquanto o profile real ainda não chegou —
// evita o "Olá, você!" piscando antes de virar "Olá, Alexandre!" (profiles.name
// só existe depois de buscar a tabela `profiles`, e user_metadata.name nem
// sempre está preenchido).
const NAME_CACHE_PREFIX = 'nt-cached-name:';

function getCachedName(userId) {
  try { return localStorage.getItem(NAME_CACHE_PREFIX + userId) || ''; } catch { return ''; }
}

function setCachedName(userId, name) {
  try {
    if (name) localStorage.setItem(NAME_CACHE_PREFIX + userId, name);
    else localStorage.removeItem(NAME_CACHE_PREFIX + userId);
  } catch { /* noop */ }
}

function mapProfile(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.user_metadata?.name || getCachedName(authUser.id),
    photoUrl: profile?.photo_url || null,
    bannerUrl: profile?.banner_url || null,
    statusMessage: profile?.status_message || null,
    statusExpiresAt: profile?.status_expires_at || null,
    company: profile?.company || null,
    createdAt: authUser.created_at || null,
    emailVerified: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
    forcePasswordReset: Boolean(profile?.force_password_reset),
  };
}

async function fetchProfileRow(authUser) {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, photo_url, banner_url, status_message, status_expires_at, company, force_password_reset')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.error('[Auth] fetchProfileRow error:', error);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Enriquece o usuário já setado com os dados da tabela `profiles`.
  // SEMPRE chamado FORA do callback de onAuthStateChange (ver comentário no
  // useEffect abaixo) — nunca mova esta chamada para dentro dele.
  const enrichWithProfile = useCallback(async (authUser) => {
    try {
      const profile = await fetchProfileRow(authUser);
      setCachedName(authUser.id, profile?.name || authUser.user_metadata?.name || '');
      setUser((prev) => (prev && prev.id === authUser.id ? mapProfile(authUser, profile) : prev));
    } catch (err) {
      // Mantém o usuário com os dados de auth — o app não fica bloqueado.
      console.error('[Auth] enrichWithProfile failed, keeping auth data only:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Tracks whether the first auth event has been processed and loading resolved.
    // Prevents double-processing when both INITIAL_SESSION and getSession race.
    let resolved = false;

    const resolve = () => {
      if (!resolved && active) {
        resolved = true;
        setLoading(false);
        console.debug('[Auth] Session resolved, loading cleared.');
      }
    };

    // ⚠️ ESTE CALLBACK É SÍNCRONO DE PROPÓSITO — NÃO O TORNE `async` NEM
    // CHAME OUTRO MÉTODO DO SUPABASE AQUI DENTRO.
    //
    // O supabase-js executa os callbacks de onAuthStateChange DENTRO do seu
    // lock interno de auth (navigator.locks). Qualquer outra chamada ao
    // supabase feita aqui (ex.: supabase.from('profiles')) precisa do access
    // token e tenta adquirir o MESMO lock — que só é liberado quando este
    // callback termina. Deadlock: o callback espera a query, a query espera o
    // lock, o lock espera o callback.
    //
    // O sintoma era exatamente esse: com sessão salva (janela normal), o
    // evento inicial vinha com sessão, a query rodava dentro do lock e travava
    // tudo — login, refresh e troca de senha ficavam presos na fila do lock,
    // sem NENHUMA requisição sair (nada no Network) e sem erro no console.
    // Em janela anônima não havia sessão para recuperar, o callback retornava
    // na hora e por isso "funcionava".
    //
    // Regra: aqui só mexemos em estado local do React. O que depende do
    // supabase vai para fora do lock, via setTimeout(0).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      console.debug('[Auth] onAuthStateChange:', event, session ? 'session present' : 'no session');

      const authUser = session?.user ?? null;
      setUser(authUser ? mapProfile(authUser, null) : null);
      resolve();

      if (authUser) {
        setTimeout(() => { if (active) enrichWithProfile(authUser); }, 0);
      }
    });

    // Rede de segurança: se o evento inicial não vier a tempo, a sessão
    // persistida está inutilizável (lock preso / token corrompido).
    //
    // Só liberar a UI não basta: o cookie ruim continua lá e envenena o
    // próximo carregamento igual, para sempre — era por isso que só janela
    // anônima funcionava. Apagamos a sessão local para que o próximo load
    // comece limpo, do mesmo jeito que a anônima começa.
    const fallback = setTimeout(() => {
      if (!resolved) {
        console.warn('[Auth] Sessão não resolveu em 8s — descartando sessão local corrompida.');
        purgeLocalSession();
        if (active) setUser(null);
        resolve();
      }
    }, 8000);

    return () => {
      active = false;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [enrichWithProfile]);

  const login = useCallback(async (email, password) => {
    // Limpa qualquer sessão local stale antes de autenticar, evitando que
    // cookies/tokens de uma tentativa anterior interrompida bloqueiem o fluxo.
    //
    // ⚠️ NUNCA dê `await` puro aqui. `signOut()` precisa do lock de auth do
    // supabase-js; se esse lock estiver preso (sessão persistida em estado
    // ruim), o await nunca resolve e o login morre ANTES de fazer qualquer
    // requisição — sintoma clássico: "conexão demorou demais" sem nenhuma
    // chamada aparecendo no Network. Damos 2s e seguimos de qualquer forma;
    // o purge direto do cookie não depende de lock nenhum.
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch { /* noop */ }
    purgeLocalSession();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(translateAuthError(error));
    return data.user;
  }, []);

  // "Esqueci minha senha" — dispara o e-mail de recuperação do Supabase. O
  // link leva para /redefinir-senha, onde a sessão de recovery já vem
  // autenticada (o Supabase estabelece isso a partir do próprio link).
  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw new Error(translateAuthError(error));
  }, []);

  // Completa a recuperação: chamado a partir da sessão de recovery já
  // estabelecida pelo link do e-mail (ver ResetPasswordPage.jsx).
  const completePasswordRecovery = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateAuthError(error));
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
        console.warn('[Auth] Falha ao criar profile:', profileError);
      }
    }

    if (!data.session) {
      throw new Error('Cadastro criado! Confirme seu e-mail para entrar.');
    }
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    if (user) setCachedName(user.id, '');
    await supabase.auth.signOut();
    setUser(null);
  }, [user]);

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
      if (name !== undefined) setCachedName(user.id, updates.name);
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

  // ⚠️ Ambas as chamadas abaixo (signInWithPassword e updateUser) rodam dentro
  // do lock interno de auth do supabase-js e já travaram indefinidamente neste
  // projeto — sem resolver nem rejeitar, deixando o botão em "Salvando..." para
  // sempre. Mesmo guard de timeout usado em ForcePasswordResetGate/ResetPasswordPage.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) throw new Error('Usuário não autenticado');

    const withTimeout = (promise, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`${label} demorou demais. Recarregue a página e tente novamente.`)),
        15000,
      )),
    ]);

    const { error: verifyError } = await withTimeout(
      supabase.auth.signInWithPassword({ email: user.email, password: currentPassword }),
      'A verificação da senha atual',
    );
    if (verifyError) throw new Error('Senha atual incorreta');

    const { error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
      'A troca de senha',
    );
    if (error) throw new Error(translateAuthError(error));
  }, [user]);

  // Reenvia o e-mail de confirmação de cadastro para quem ainda não verificou.
  const resendEmailConfirmation = useCallback(async () => {
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/area-do-cliente` },
    });
    if (error) throw new Error(translateAuthError(error));
  }, [user]);

  // Fluxo de "Forçar troca de senha" (admin): o usuário já está autenticado
  // (só precisa da nova senha, sem confirmar a atual) e o flag em `profiles`
  // é limpo para o gate global parar de bloquear a navegação.
  //
  // Ordem importa: `auth.updateUser` roda dentro do lock interno do
  // supabase-js (serializa com refresh/signIn) e, ao suceder, dispara a
  // notificação de sessão (USER_UPDATED) que o AuthContext escuta para
  // recarregar o profile — tudo isso ainda sob o lock. Uma chamada
  // `.from('profiles').update(...)` disparada logo em seguida competia pelo
  // mesmo lock para obter o token da sessão recém-rotacionada e travava
  // (nunca resolvia nem rejeitava). Limpar a flag ANTES evita essa disputa:
  // a chamada usa a sessão ainda estável, sem depender do lock de auth.
  const completeForcedPasswordReset = useCallback(async (newPassword) => {
    if (!user) throw new Error('Usuário não autenticado');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ force_password_reset: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (profileError) throw new Error(profileError.message);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      // Senha não trocou — restaura a flag para o gate continuar bloqueando.
      await supabase.from('profiles').update({ force_password_reset: true }).eq('id', user.id);
      throw new Error(translateAuthError(error));
    }

    setUser((prev) => (prev ? { ...prev, forcePasswordReset: false } : prev));
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
    resendEmailConfirmation,
    completeForcedPasswordReset,
    sendPasswordReset,
    completePasswordRecovery,
    uploadPhoto,
    removePhoto,
    updateUser,
  }), [user, loading, login, register, logout, updateProfile, changePassword, resendEmailConfirmation, completeForcedPasswordReset, sendPasswordReset, completePasswordRecovery, uploadPhoto, removePhoto, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
