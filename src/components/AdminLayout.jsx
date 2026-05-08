import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { to: '/admin', label: 'Visão geral', end: true, icon: '◎' },
  { to: '/admin/usuarios', label: 'Usuários', icon: '◳' },
  { to: '/admin/empresas', label: 'Empresas', icon: '▣' },
  { to: '/admin/assinaturas', label: 'Assinaturas', icon: '◇' },
  { to: '/admin/faturas', label: 'Faturas', icon: '◈' },
];

export default function AdminLayout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif", display: 'flex' }}>
      <style>{`
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        .admin-nav-link {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 14px; border-radius: 10px;
          color: rgba(255,255,255,0.55); text-decoration: none;
          font-size: 0.9rem; font-weight: 500;
          transition: background 0.18s, color 0.18s;
        }
        .admin-nav-link:hover { background: rgba(255,255,255,0.04); color: #eeede9; }
        .admin-nav-link.active {
          background: rgba(124,58,237,0.14);
          color: #eeede9;
          box-shadow: inset 2px 0 0 #7C3AED;
        }
        .admin-nav-link .ico {
          width: 22px; height: 22px; display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 0.95rem; color: #7C3AED;
        }
        .admin-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02); color: #eeede9;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          transition: all 0.18s;
        }
        .admin-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }
        .admin-btn.primary { background: #7C3AED; border-color: #7C3AED; color: #fff; }
        .admin-btn.primary:hover { background: #6d28d9; border-color: #6d28d9; }
        .admin-btn.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.25); }
        .admin-btn.danger:hover { background: rgba(255,107,107,0.08); }
        .admin-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .admin-input, .admin-select {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: #eeede9; font-size: 0.9rem; outline: none; font-family: inherit;
          transition: border-color 0.18s, background 0.18s;
        }
        .admin-input:focus, .admin-select:focus { border-color: #7C3AED; background: rgba(255,255,255,0.05); }
        .admin-input::placeholder { color: rgba(255,255,255,0.3); }
        .admin-select option { background: #15151a; color: #eeede9; }
        .admin-table {
          width: 100%; border-collapse: collapse; font-size: 0.88rem;
        }
        .admin-table th {
          text-align: left; padding: 12px 14px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .admin-table td {
          padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.85);
        }
        .admin-table tr:hover td { background: rgba(255,255,255,0.02); }
        .admin-pill {
          display: inline-block; padding: 3px 10px; border-radius: 999px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          border: 1px solid transparent;
        }
        @media (max-width: 920px) {
          .admin-sidebar { position: fixed; inset: 0 auto 0 0; transform: translateX(-100%); z-index: 50; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-burger { display: inline-flex !important; }
          .admin-overlay { display: ${mobileOpen ? 'block' : 'none'}; }
        }
      `}</style>

      {mobileOpen && (
        <div
          className="admin-overlay"
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
        />
      )}

      <aside
        className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}
        style={{
          width: 248,
          background: 'rgba(10,10,14,0.95)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '22px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'transform 0.25s ease',
        }}
      >
        <div style={{ padding: '4px 10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.4 }}>Noratech</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase', marginTop: 2 }}>
              Admin
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="ico">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
            <div style={{ fontWeight: 600, color: '#eeede9' }}>{user?.name || user?.email}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{user?.email}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <ThemeToggle style={{ flexShrink: 0 }} />
            <button className="admin-btn danger" style={{ flex: 1, justifyContent: 'center' }} onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            gap: 14, flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button
              className="admin-burger admin-btn"
              style={{ display: 'none', padding: '8px 10px' }}
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: -0.6, margin: 0 }}>{title}</h1>
              {subtitle && (
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
        </header>

        <div style={{ padding: '26px 28px 60px', flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    active:    { label: 'Ativa',    bg: 'rgba(0,212,138,0.12)',  fg: '#00d48a', bd: 'rgba(0,212,138,0.25)' },
    trialing:  { label: 'Trial',    bg: 'rgba(37,99,235,0.12)',  fg: '#60a5fa', bd: 'rgba(37,99,235,0.25)' },
    paused:    { label: 'Pausada',  bg: 'rgba(255,255,255,0.05)',fg: '#bbb',    bd: 'rgba(255,255,255,0.12)' },
    past_due:  { label: 'Atrasada', bg: 'rgba(255,138,61,0.12)', fg: '#ff8a3d', bd: 'rgba(255,138,61,0.25)' },
    canceled:  { label: 'Cancelada',bg: 'rgba(255,107,107,0.12)',fg: '#ff6b6b', bd: 'rgba(255,107,107,0.22)' },
    pending:   { label: 'Pendente', bg: 'rgba(255,138,61,0.12)', fg: '#ff8a3d', bd: 'rgba(255,138,61,0.25)' },
    paid:      { label: 'Paga',     bg: 'rgba(0,212,138,0.12)',  fg: '#00d48a', bd: 'rgba(0,212,138,0.25)' },
    overdue:   { label: 'Vencida',  bg: 'rgba(255,107,107,0.12)',fg: '#ff6b6b', bd: 'rgba(255,107,107,0.25)' },
    refunded:  { label: 'Reembolso',bg: 'rgba(124,58,237,0.12)', fg: '#a78bfa', bd: 'rgba(124,58,237,0.25)' },
  };
  const c = map[status] || { label: status || '—', bg: 'rgba(255,255,255,0.05)', fg: '#bbb', bd: 'rgba(255,255,255,0.12)' };
  return (
    <span className="admin-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>
      {c.label}
    </span>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 520 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width,
          background: '#101015', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
          maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'adminSpin 0.8s linear infinite' }} />
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
      {children}
    </div>
  );
}
