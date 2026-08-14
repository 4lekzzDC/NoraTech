import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Heurística simples (0-4): comprimento + variedade de tipos de caractere.
// Não usa lib externa — só orienta visualmente, a regra de fato é o mínimo
// de 8 caracteres validado no submit.
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
  { label: 'Fraca',       color: '#ff8c42' },
  { label: 'Razoável',    color: '#f0b429' },
  { label: 'Forte',       color: '#34d399' },
  { label: 'Muito forte', color: '#22c55e' },
];

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 4.22-5.06M9.9 4.24A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PasswordField({ value, onChange, autoFocus }) {
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
          width: '100%', padding: '10px 42px 10px 12px', borderRadius: 10,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#eeede9', fontSize: '0.88rem', fontFamily: "'Inter', sans-serif",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
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
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < score ? level.color : 'rgba(255,255,255,0.1)',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>
      <div style={{ fontSize: '0.72rem', color: level.color, fontWeight: 600 }}>{level.label}</div>
    </div>
  );
}

// Bloqueia toda a navegação até o usuário definir uma nova senha, quando um
// admin marca `force_password_reset` no perfil dele (AdminUsersPage → "Forçar
// troca de senha"). Sem `onClose`/clique-fora: só some quando a troca é feita.
export default function ForcePasswordResetGate({ children }) {
  const { user, completeForcedPasswordReset, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user?.forcePasswordReset) return children;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres');
    if (newPassword !== confirmPassword) return setError('As senhas não coincidem');

    setLoading(true);
    try {
      // Guarda contra travamento indefinido (ex.: lock de auth preso entre
      // abas) — sem isso, uma requisição pendurada deixa o botão em
      // "Salvando…" para sempre, sem chance do usuário tentar de novo.
      await Promise.race([
        completeForcedPasswordReset(newPassword),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado. Recarregue a página e tente novamente.')), 15000)),
      ]);
    } catch (err) {
      setError(err.message || 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {children}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(4,4,6,0.86)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: "'Inter', sans-serif",
      }}>
        <form onSubmit={handleSubmit} style={{
          width: '100%', maxWidth: 400, background: '#111114', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18, padding: '32px 30px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#1b1b20',
            border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
          }}>🔒</div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eeede9', marginBottom: 6, marginTop: 12, textAlign: 'center' }}>
            Troca de senha obrigatória
          </h2>
          <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 22, textAlign: 'center' }}>
            Um administrador exigiu que você defina uma nova senha antes de continuar usando o sistema.
          </p>

          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nova senha
          </label>
          <div style={{ marginBottom: 8 }}>
            <PasswordField value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
          </div>
          <PasswordStrengthMeter password={newPassword} />

          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Confirmar nova senha
          </label>
          <div style={{ marginBottom: 14 }}>
            <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          {error && (
            <div style={{ fontSize: '0.8rem', color: '#ff6b6b', marginBottom: 14 }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
            background: '#7C3AED', color: '#fff', fontSize: '0.88rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 10,
          }}>
            {loading ? 'Salvando…' : 'Definir nova senha'}
          </button>

          <button type="button" onClick={logout} style={{
            width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Sair
          </button>
        </form>
      </div>
    </>
  );
}
