import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../lib/admin';
import ThemeToggle from '../components/ThemeToggle';
import CockpitCompany from '../components/CockpitCompany';
import { supabase } from '../lib/supabase';
import { fetchMyCompany } from '../lib/companies';
import { getSystem, SYSTEMS } from '../lib/systems';

const TABS = [
  { id: 'cockpit', num: '01', label: 'Cockpit' },
  { id: 'operacao', num: '02', label: 'Operação' },
  { id: 'financeiro', num: '03', label: 'Financeiro' },
  { id: 'oportunidades', num: '04', label: 'Oportunidades' },
  { id: 'comando', num: '05', label: 'Comando' },
];

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatMemberSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
        {eyebrow}
      </span>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6, marginBottom: description ? 8 : 0 }}>
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', maxWidth: 620 }}>{description}</p>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, accent = '#7C3AED' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: -1, marginTop: 8, color: accent }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function OperacaoTab() {
  return (
    <>
      <SectionHeader
        eyebrow="Operação"
        title="Monitoramento em tempo real"
        description="Acompanhe a saúde dos seus sistemas, eventos e indicadores operacionais assim que sua automação for ativada."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard label="Uptime 30d" value="—" hint="Sem operação ativa" />
        <StatCard label="Execuções hoje" value="0" hint="Nenhum evento processado" />
        <StatCard label="Tempo médio" value="—" hint="Aguardando coleta" />
        <StatCard label="Incidentes" value="0" hint="Nenhum registro" accent="#7dff7d" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Eventos recentes</h3>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Últimas 24h
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '20px 0', textAlign: 'center' }}>
            Nenhum evento registrado.
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Serviços conectados</h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              0 ativos
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '20px 0', textAlign: 'center' }}>
            Nenhuma integração configurada ainda.
          </div>
        </div>
      </div>
    </>
  );
}

function FinanceiroTab() {
  return (
    <>
      <SectionHeader
        eyebrow="Financeiro"
        title="Plano, faturas e pagamentos"
        description="Consulte o seu plano atual, histórico de faturas e método de pagamento em um único lugar."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard label="Plano atual" value="Free" hint="Nenhum serviço contratado" />
        <StatCard label="Mensalidade" value="R$ 0,00" hint="Ativa ao contratar um serviço" />
        <StatCard label="Próxima fatura" value="—" hint="Sem cobrança programada" />
        <StatCard label="Status" value="Em dia" hint="Sem pendências" accent="#7dff7d" />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Histórico de faturas</h3>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
            0 faturas
          </span>
        </div>
        <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', padding: '24px 0', textAlign: 'center' }}>
          Você ainda não possui faturas emitidas.
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Método de pagamento</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              Nenhum cartão ou método cadastrado.
            </p>
          </div>
          <Link
            to="/#contato"
            className="btn-ghost"
            style={{ padding: '10px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
          >
            Configurar
          </Link>
        </div>
      </div>
    </>
  );
}

function OportunidadesTab() {
  const opportunities = [
    {
      tag: 'Automação',
      title: 'Automação de atendimento 24/7',
      description: 'Implante um agente inteligente para responder leads e clientes com tom humano e integração direta ao seu CRM.',
      to: '/servicos/automacao-ia',
    },
    {
      tag: 'Sistemas',
      title: 'Sistema sob medida para a sua operação',
      description: 'Plataforma web exclusiva, desenhada para os fluxos do seu negócio — sem planilhas, sem gambiarras.',
      to: '/servicos/sistemas-sob-medida',
    },
    {
      tag: 'Estratégia',
      title: 'Diagnóstico gratuito de operação',
      description: 'Agende uma conversa de 30 minutos com a Noratech para mapear gargalos e oportunidades de automação.',
      to: '/#contato',
    },
  ];

  return (
    <>
      <SectionHeader
        eyebrow="Oportunidades"
        title="Próximos passos sugeridos"
        description="Uma curadoria de serviços e melhorias que podem acelerar seus resultados."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {opportunities.map((op) => (
          <Link
            key={op.title}
            to={op.to}
            className="system-card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', transition: 'all 0.2s' }}
          >
            <span style={{ alignSelf: 'flex-start', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(124, 58, 237,0.25)', background: 'rgba(124, 58, 237,0.06)', borderRadius: 6 }}>
              {op.tag}
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, marginTop: 4 }}>
              {op.title}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {op.description}
            </p>
            <span style={{ marginTop: 'auto', fontSize: '0.82rem', fontWeight: 700, color: '#b197ff' }}>
              Saiba mais ↗
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

function ComandoTab({ user, onLogout }) {
  const actions = [
    {
      title: 'Editar perfil',
      description: 'Atualize nome, foto e informações da sua conta.',
      cta: 'Abrir perfil',
      to: '/perfil',
      external: false,
    },
    {
      title: 'Falar com suporte',
      description: 'Tire dúvidas, abra chamados ou peça ajustes na operação.',
      cta: 'Enviar mensagem',
      to: '/#contato',
      external: false,
    },
    {
      title: 'Solicitar novo projeto',
      description: 'Conte o que você precisa construir e receba uma proposta.',
      cta: 'Iniciar briefing',
      to: '/#contato',
      external: false,
    },
  ];

  return (
    <>
      <SectionHeader
        eyebrow="Comando"
        title="Ações rápidas e configurações"
        description="Centralize os comandos da sua conta e fale com a Noratech em poucos cliques."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        {actions.map((a) => (
          <div
            key={a.title}
            className="system-card"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}
          >
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: -0.3 }}>
              {a.title}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {a.description}
            </p>
            <Link
              to={a.to}
              style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: '9px 16px', background: '#7C3AED', borderRadius: 10, color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}
            >
              {a.cta}
            </Link>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Resumo da conta</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Nome</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{user?.name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, wordBreak: 'break-all' }}>{user?.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Empresa</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{user?.company || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'rgba(255,0,80,0.04)', border: '1px solid rgba(255,0,80,0.18)', borderRadius: 14, padding: '18px 22px' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Encerrar sessão</h3>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
            Você pode entrar novamente a qualquer momento com seu e-mail e senha.
          </p>
        </div>
        <button
          onClick={onLogout}
          style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,0,80,0.35)', borderRadius: 10, color: '#ff9ab4', fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Sair ↗
        </button>
      </div>
    </>
  );
}

const BASE_CARD_STYLE = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px', transition: 'all 0.2s', cursor: 'pointer', display: 'block' };

function SystemCard({ s }) {
  const isTrial = s.subscription?.status === 'trialing';
  const statusColor = isTrial ? '#60a5fa' : '#7dff7d';
  const statusLabel = isTrial ? 'Trial' : 'Ativa';
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{s.icon}</span> {s.name}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{s.description}</p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#7C3AED' }}>
        {s.url ? 'Abrir sistema ↗' : s.subscription?.plan || ''}
      </p>
    </>
  );
  if (!s.url) return <div className="system-card" style={BASE_CARD_STYLE}>{inner}</div>;
  if (s.internal) return <Link to={s.url} className="system-card" style={BASE_CARD_STYLE}>{inner}</Link>;
  return <a href={s.url} target="_blank" rel="noopener noreferrer" className="system-card" style={BASE_CARD_STYLE}>{inner}</a>;
}

function SystemsGrid({ systems, isAdmin }) {
  // Admin tem bypass: vê todos os sistemas internos do catálogo, mesmo sem assinatura.
  const adminInternals = isAdmin
    ? SYSTEMS
        .filter((s) => s.internal && !systems.some((sub) => sub.slug === s.slug))
        .map((s) => ({ ...s, subscription: { status: 'active' } }))
    : [];
  const all = [...systems, ...adminInternals];

  if (all.length === 0) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
          Nenhum sistema contratado
        </span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 10 }}>
          Você ainda não tem sistemas ativos
        </h3>
        <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto 22px' }}>
          Explore nossos serviços ou fale com a Noratech para começar sua operação.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/servicos/sistemas-sob-medida" className="btn-ghost" style={{ padding: '10px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Ver serviços
          </Link>
          <Link to="/#contato" style={{ padding: '10px 18px', background: '#7C3AED', borderRadius: 10, color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
            Falar com a Noratech
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
      {all.map((s) => <SystemCard key={s.slug} s={s} />)}
    </div>
  );
}

function StatusGauge({ count = 0 }) {
  const size = 96;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const active = count > 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={active ? 'rgba(0,212,138,0.3)' : 'rgba(255,255,255,0.08)'} strokeWidth={stroke} strokeDasharray={active ? '0' : '4 8'} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: active ? '1.7rem' : '1.5rem', fontWeight: 800, color: active ? '#00d48a' : 'rgba(255,255,255,0.25)', letterSpacing: -1, lineHeight: 1 }}>
          {active ? count : '—'}
        </div>
        <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: 1.2, color: active ? 'rgba(0,212,138,0.65)' : 'rgba(255,255,255,0.3)', marginTop: 4, textTransform: 'uppercase' }}>
          {active ? (count === 1 ? 'sistema' : 'sistemas') : 'nenhum'}
        </div>
      </div>
    </div>
  );
}

export default function AreaDoClientePage() {
  const { user, logout } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');

  const firstName = useMemo(() => (user?.name || '').split(' ')[0] || 'você', [user]);
  const initials = useMemo(
    () => (user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?'),
    [user]
  );
  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user]);

  const [systems, setSystems] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const my = await fetchMyCompany();
        const companyId = my?.company?.id;
        const list = [];
        if (companyId) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('id, system_slug, plan, status, current_period_end')
            .eq('company_id', companyId)
            .in('status', ['active', 'trialing']);
          if (active && !error) {
            const seen = new Set();
            (data || []).forEach((s) => {
              const sys = getSystem(s.system_slug);
              if (!sys || seen.has(sys.slug)) return;
              seen.add(sys.slug);
              list.push({ ...sys, subscription: s });
            });
          }
        }
        if (active) setSystems(list);
      } catch {
        if (active) setSystems([]);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef(null);
  const profileMenuRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (
        avatarRef.current && !avatarRef.current.contains(e.target) &&
        profileMenuRef.current && !profileMenuRef.current.contains(e.target)
      ) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 14px 4px; position: relative; transition: color 0.2s; }
        .tab-btn:hover { color: rgba(255,255,255,0.9); }
        .btn-ghost:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.2) !important; }
        .btn-primary:hover { background: #d4ff33 !important; transform: translateY(-1px); }
        .system-card:hover { border-color: rgba(124, 58, 237,0.25) !important; background: rgba(255,255,255,0.03) !important; }
        .tabs-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .tabs-nav::-webkit-scrollbar { display: none; width: 0; height: 0; }
        @keyframes pulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.4; } }
        .live-dot { animation: pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
            <Link to="/" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: '#7C3AED', letterSpacing: -0.5, flexShrink: 0 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Central de Controle
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isAdmin && (
              <Link
                to="/admin"
                className="btn-ghost"
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(124, 58, 237,0.35)', background: 'rgba(124, 58, 237,0.08)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s' }}
              >
                ⚙ Admin
              </Link>
            )}
            <ThemeToggle />
            {/* Avatar button — click reveals name/email/logout */}
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              title={user?.name || 'Usuário'}
              aria-label="Menu do usuário"
              style={{ padding: 0, background: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', transition: 'border-color 0.2s' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: profileOpen ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, border: `2px solid ${profileOpen ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s' }}>
                  {initials}
                </div>
              )}
            </button>
            {profileOpen && createPortal(
              (() => {
                const rect = avatarRef.current?.getBoundingClientRect();
                const top = rect ? rect.bottom + 8 : 80;
                const right = rect ? window.innerWidth - rect.right : 32;
                return (
                  <div ref={profileMenuRef} style={{ position: 'fixed', top, right, zIndex: 9999, minWidth: 220, background: '#18181f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {user?.photoUrl ? (
                          <img src={user.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                            {initials}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eeede9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Usuário'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sair
                    </button>
                  </div>
                );
              })(),
              document.body
            )}
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '28px 32px 96px' }}>
        {/* Tabs */}
        <nav className="tabs-nav" style={{ display: 'flex', gap: 36, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 56, overflowX: 'auto', overflowY: 'hidden' }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                className="tab-btn"
                onClick={() => setActiveTab(t.id)}
                style={{ color: active ? '#7C3AED' : 'rgba(255,255,255,0.45)', fontSize: '0.92rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: active ? 'rgba(124, 58, 237,0.6)' : 'rgba(255,255,255,0.25)' }}>
                  {t.num}
                </span>
                {t.label}
                {active && (
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: '#7C3AED', borderRadius: 2 }} />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === 'cockpit' && (
          <>
            {/* Hero banner */}
            <section style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 28px', marginBottom: 36, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
              <StatusGauge count={systems.length} />

              {/* Divider */}
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

              {/* Greeting + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15, marginBottom: 4 }}>
                  Olá, <span style={{ color: '#7C3AED' }}>{firstName}</span>
                </h1>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, marginBottom: 14 }}>
                  {systems.length > 0
                    ? 'Sua central está ativa. Acompanhe seus sistemas, membros e operações em tempo real.'
                    : 'Sua Central de Controle ainda não tem sistemas ativos. Quando você contratar um serviço, a operação aparece aqui.'}
                </p>
                {/* Pills row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: systems.length > 0 ? 'rgba(0,212,138,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${systems.length > 0 ? 'rgba(0,212,138,0.25)' : 'rgba(255,255,255,0.1)'}`, fontSize: '0.71rem', fontWeight: 700, letterSpacing: 0.8, color: systems.length > 0 ? '#00d48a' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: systems.length > 0 ? '#00d48a' : 'rgba(255,255,255,0.25)', boxShadow: systems.length > 0 ? '0 0 8px rgba(0,212,138,0.55)' : 'none' }} className={systems.length > 0 ? 'live-dot' : ''} />
                    {systems.length > 0 ? 'Operação ativa' : 'Aguardando ativação'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', fontSize: '0.71rem', fontWeight: 700, letterSpacing: 0.8, color: '#a78bfa', textTransform: 'uppercase' }}>
                    {systems.length} {systems.length === 1 ? 'sistema ativo' : 'sistemas ativos'}
                  </span>
                  {memberSince && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                      Membro desde {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Empresa */}
            <section style={{ marginBottom: 48 }}>
              <div style={{ marginBottom: 22 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
                  Empresa
                </span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                  Sua organização
                </h2>
              </div>
              <CockpitCompany user={user} />
            </section>

            {/* Systems */}
            <section>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: '#7C3AED', textTransform: 'uppercase' }}>
                    Operação
                  </span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>
                    Seus sistemas em tempo real
                  </h2>
                </div>
              </div>

              {SystemsGrid({ systems, isAdmin })}
            </section>
          </>
        )}

        {activeTab === 'operacao' && <OperacaoTab />}
        {activeTab === 'financeiro' && <FinanceiroTab />}
        {activeTab === 'oportunidades' && <OportunidadesTab />}
        {activeTab === 'comando' && <ComandoTab user={user} onLogout={handleLogout} />}
      </main>
    </div>
  );
}
