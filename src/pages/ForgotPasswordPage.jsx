import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const DARK = { pageBg: '#08080a', text: '#eeede9', cardBg: '#0c0c10', cardBorder: '#ffffff14', inputBg: 'rgba(0,0,0,0.28)', inputBorder: '#ffffff1f', placeholder: '#ffffff52', label: '#ffffffb2', subtitle: '#ffffffb2', backLink: '#ffffffa6' };
const LIGHT = { pageBg: '#eef0f4', text: '#0f1115', cardBg: '#ffffff', cardBorder: 'rgba(15,17,21,0.10)', inputBg: '#f6f7fa', inputBorder: 'rgba(15,17,21,0.14)', placeholder: 'rgba(15,17,21,0.35)', label: 'rgba(15,17,21,0.7)', subtitle: 'rgba(15,17,21,0.62)', backLink: 'rgba(15,17,21,0.55)' };

// "Esqueci minha senha" — o link "Esqueci minha senha" em AuthPage.jsx
// sempre apontou pra cá, mas essa página nunca existiu (nem a rota, nem o
// método de reset em AuthContext). Sem ela o usuário ficava sem saída
// quando esquecia a senha e não tinha ninguém pra forçar a troca por ele.
export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'light' ? LIGHT : DARK;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o e-mail de recuperação.');
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
        {sent ? (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 22,
            }}>✉️</div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 10 }}>Verifique seu e-mail</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 26 }}>
              Se houver uma conta cadastrada com <strong style={{ color: P.text }}>{email}</strong>, enviamos um link para redefinir a senha. Confira também a caixa de spam.
            </p>
            <Link to="/login" style={{ color: '#7C3AED', fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none' }}>← Voltar para o login</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>Esqueceu sua senha?</h1>
            <p style={{ color: P.subtitle, fontSize: '0.9rem', marginBottom: 26 }}>
              Informe o e-mail da sua conta e enviaremos um link para você redefinir a senha.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label htmlFor="fp-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: P.label, marginBottom: 8 }}>E-mail</label>
                <input
                  id="fp-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  style={{
                    width: '100%', height: 50, background: P.inputBg, border: `1px solid ${P.inputBorder}`,
                    borderRadius: 12, padding: '0 16px', color: P.text, fontFamily: "'Inter', sans-serif",
                    fontSize: '0.95rem', outline: 'none',
                  }}
                />
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
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <Link to="/login" style={{ color: P.backLink, fontSize: '0.85rem', textDecoration: 'none' }}>← Voltar para o login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
