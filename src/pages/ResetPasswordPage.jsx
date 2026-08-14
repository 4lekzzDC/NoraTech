import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

const DARK = { pageBg: '#08080a', text: '#eeede9', cardBg: '#0c0c10', cardBorder: '#ffffff14', inputBg: 'rgba(0,0,0,0.28)', inputBorder: '#ffffff1f', label: '#ffffffb2', subtitle: '#ffffffb2', backLink: '#ffffffa6', toggleColor: '#ffffff66' };
const LIGHT = { pageBg: '#eef0f4', text: '#0f1115', cardBg: '#ffffff', cardBorder: 'rgba(15,17,21,0.10)', inputBg: '#f6f7fa', inputBorder: 'rgba(15,17,21,0.14)', label: 'rgba(15,17,21,0.7)', subtitle: 'rgba(15,17,21,0.62)', backLink: 'rgba(15,17,21,0.55)', toggleColor: 'rgba(15,17,21,0.4)' };

function passwordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LEVELS = [
  { label: 'Muito fraca', color: '#ff5c5c' },
  { label: 'Fraca', color: '#ff8c42' },
  { label: 'Razoável', color: '#f0b429' },
  { label: 'Forte', color: '#34d399' },
  { label: 'Muito forte', color: '#22c55e' },
];

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 4.22-5.06M9.9 4.24A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PasswordField({ value, onChange, autoFocus, inputBg, inputBorder, text }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        autoFocus={autoFocus}
        style={{
          width: '100%', height: 50, padding: '0 42px 0 16px', borderRadius: 12,
          background: inputBg, border: `1px solid ${inputBorder}`, color: text,
          fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer',
        }}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

function PasswordStrengthMeter({ password }) {
  const score = passwordStrength(password);
  const level = STRENGTH_LEVELS[score];
  if (!password) return null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? level.color : 'rgba(128,128,128,0.25)', transition: 'background 0.15s' }} />
        ))}
      </div>
      <div style={{ fontSize: '0.72rem', color: level.color, fontWeight: 600 }}>{level.label}</div>
    </div>
  );
}

// Destino do link enviado por ForgotPasswordPage. O Supabase, ao processar
// o link, já estabelece uma sessão de recovery no client antes desta página
// montar — por isso o efeito abaixo só confirma que ela existe (PASSWORD_
// RECOVERY ou uma sessão já presente) antes de liberar o formulário.
export default function ResetPasswordPage() {
  const { completePasswordRecovery } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const P = theme === 'light' ? LIGHT : DARK;

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) setReady(true);
    });

    // O link do e-mail chega com ?code=... (fluxo PKCE) — o @supabase/ssr
    // não troca isso por uma sessão sozinho, precisa dessa chamada explícita
    // (diferente do cliente padrão @supabase/supabase-js, que faz isso
    // automaticamente). Sem isso, a página nunca via a sessão de recovery.
    const code = new URL(window.location.href).searchParams.get('code');

    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) { setInvalid(true); return; }
        window.history.replaceState({}, '', window.location.pathname);
        setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) setReady(true);
      else setInvalid(true);
    })();

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres');
    if (newPassword !== confirmPassword) return setError('As senhas não coincidem');

    setLoading(true);
    try {
      await completePasswordRecovery(newPassword);
      setDone(true);
      setTimeout(() => navigate('/area-do-cliente'), 1800);
    } catch (err) {
      setError(err.message || 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: P.pageBg, color: P.text, fontFamily: "'Inter', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, position: 'relative',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <div style={{ position: 'fixed', top: 22, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: '1rem', color: '#7C3AED', letterSpacing: 0.5, textDecoration: 'none' }}>
          NORA<span style={{ color: P.backLink, fontWeight: 600 }}>TECH</span>
        </Link>
        <ThemeToggle />
      </div>

      <div style={{
        width: '100%', maxWidth: 420, background: P.cardBg, border: `1px solid ${P.cardBorder}`,
        borderRadius: 18, padding: '36px 34px', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.35)',
      }}>
        {invalid ? (
          <>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 10 }}>Link inválido ou expirado</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 24 }}>
              Esse link de recuperação já foi usado ou não é mais válido. Solicite um novo.
            </p>
            <Link to="/recuperar-senha" style={{ color: '#7C3AED', fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none' }}>Solicitar novo link →</Link>
          </>
        ) : done ? (
          <>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 10 }}>Senha redefinida ✓</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', lineHeight: 1.6 }}>Redirecionando…</p>
          </>
        ) : !ready ? (
          <p style={{ color: P.subtitle, fontSize: '0.9rem' }}>Verificando o link…</p>
        ) : (
          <>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>Defina uma nova senha</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', marginBottom: 24 }}>Escolha uma senha forte para sua conta.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: P.label, marginBottom: 8 }}>Nova senha</label>
                <PasswordField value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus inputBg={P.inputBg} inputBorder={P.inputBorder} text={P.text} />
                <div style={{ marginTop: 8 }}><PasswordStrengthMeter password={newPassword} /></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: P.label, marginBottom: 8 }}>Confirmar nova senha</label>
                <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} inputBg={P.inputBg} inputBorder={P.inputBorder} text={P.text} />
              </div>

              {error && (
                <div role="alert" style={{ padding: '12px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.24)', borderRadius: 10, fontSize: '0.85rem', color: '#ff8585', lineHeight: 1.4 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', height: 50, background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 12,
                fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1,
              }}>
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
