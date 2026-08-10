import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin, formatBRL } from '../lib/admin';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import UserProfileMenu from '../components/UserProfileMenu';
import { supabase } from '../lib/supabase';
import { fetchMyCompany } from '../lib/companies';
import { fetchSystems, indexSystems } from '../lib/systems';
import { getPalette, FONT_INTER, FONT_MONO } from '../modules/solucoes-contabeis/theme';

const WHATSAPP_NUMBER = '5511932227752';
const CONTACT_EMAIL = 'contato@noratech.com.br';

function TrialModal({ system, onClose, P }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Olá! Tenho interesse no teste grátis de 3 dias do sistema "${system.name}".`
  )}`;
  const emailHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Teste grátis — ${system.name}`)}&body=${encodeURIComponent(
    `Olá! Tenho interesse no teste grátis de 3 dias do sistema "${system.name}".`
  )}`;

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label="Teste grátis"
        style={{ width: 'min(440px, 100%)', background: P.surfaceSolid || P.surface, border: `1px solid ${P.border}`, borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.55)', color: P.text, fontFamily: FONT_INTER, position: 'relative', padding: '28px 24px 24px' }}>

        <button type="button" onClick={onClose} aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${P.border2}`, background: P.surface2, color: P.muted, cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

        <div style={{ width: 48, height: 48, borderRadius: '50%', background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        </div>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: -0.3, marginBottom: 6, color: P.text }}>Teste grátis por 3 dias</h2>
        <p style={{ fontSize: '0.86rem', color: P.muted, lineHeight: 1.6, marginBottom: 22 }}>
          Experimente o <strong style={{ color: P.text }}>{system.name}</strong> por 3 dias, sem compromisso. Tem interesse? Fale com a gente por WhatsApp ou e-mail para ativarmos seu teste.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-6.99A9.82 9.82 0 0 0 12.04 2z" /></svg>
            Falar no WhatsApp
          </a>
          <a href={emailHref}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: 'transparent', border: `1px solid ${P.border2}`, color: P.text, fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            Enviar e-mail
          </a>
        </div>
      </section>
    </div>,
    document.body
  );
}

function getVideoEmbedSrc(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function SystemDetailsHeader({ isAdmin, systemName }) {
  return (
    <>
      <style>{`
        .sdp-header { position:sticky;top:0;z-index:100;background:#08080A;border-bottom:1px solid rgba(139,61,255,0.25);box-shadow:0 8px 30px rgba(0,0,0,0.28); }
        .sdp-back { display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;transition:background 0.17s,border-color 0.17s; }
        .sdp-back:hover { background:rgba(139,61,255,0.14);border-color:#8B3DFF; }
        .sdp-crumb { display:inline-flex;align-items:center;height:26px;padding:0 7px;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;color:rgba(255,255,255,0.68);text-decoration:none;transition:color 0.15s,background 0.15s; }
        .sdp-crumb-link:hover { color:#fff;background:rgba(139,61,255,0.14); }
        .sdp-crumb-current { color:#fff;font-weight:600; }
        .sdp-crumb-sep { display:inline-flex;align-items:center;padding:0 5px;font-size:13px;color:rgba(139,61,255,0.75);user-select:none; }
        .sdp-toggle-slot button.theme-toggle,.sdp-toggle-slot [class*="theme-toggle"] { width:34px!important;height:34px!important;border-radius:10px!important;background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.14)!important;color:#fff!important;transition:background 0.17s,border-color 0.17s!important; }
        .sdp-toggle-slot button.theme-toggle:hover,.sdp-toggle-slot [class*="theme-toggle"]:hover { background:rgba(139,61,255,0.14)!important;border-color:#8B3DFF!important; }
        .sdp-admin-btn { display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid rgba(124,58,237,0.4);background:rgba(124,58,237,0.1);color:#a78bfa;font-size:0.75rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;transition:background 0.15s,border-color 0.15s; }
        .sdp-admin-btn:hover { background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.6); }
        .sdp-header-inner { max-width:1240px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
        @media (max-width:640px) { .sdp-header-inner { padding:0 14px!important; } .sdp-crumb-link,.sdp-crumb-sep { display:none!important; } .sdp-admin-btn { display:none!important; } }
      `}</style>
      <header className="sdp-header">
        <div className="sdp-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Link to="/area-do-cliente" aria-label="Voltar à Área do Cliente" className="sdp-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
              <Link to="/" className="sdp-crumb sdp-crumb-link" style={{ fontFamily: FONT_MONO, letterSpacing: -0.2 }}>Noratech</Link>
              <span className="sdp-crumb-sep">/</span>
              <Link to="/area-do-cliente" className="sdp-crumb sdp-crumb-link">Área do Cliente</Link>
              <span className="sdp-crumb-sep">/</span>
              <span className="sdp-crumb sdp-crumb-current">{systemName || 'Sistema'}</span>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isAdmin && (
              <Link to="/admin" className="sdp-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Admin
              </Link>
            )}
            <span className="sdp-toggle-slot" style={{ display: 'inline-flex' }}><ThemeToggle /></span>
            <UserProfileMenu />
          </div>
        </div>
      </header>
    </>
  );
}

export default function SystemDetailsPage() {
  useAuth();
  const { isAdmin } = useIsAdmin();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [trialModalOpen, setTrialModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const bySlug = indexSystems(await fetchSystems());
        const sys = bySlug[slug] || null;
        if (active) setSystem(sys);

        const my = await fetchMyCompany();
        if (active) setCompanyInfo(my);
        const companyId = my?.company?.id;
        if (companyId && sys) {
          const { data } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('company_id', companyId)
            .eq('system_slug', sys.slug)
            .in('status', ['active', 'trialing'])
            .maybeSingle();
          if (active) setAlreadyActive(Boolean(data));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const hasCompany = Boolean(companyInfo?.company?.id);
  const companyRole = companyInfo?.membership?.role || null;
  const isOrgManager = companyRole === 'owner' || companyRole === 'admin';
  const embedSrc = system ? getVideoEmbedSrc(system.video_url) : null;

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <SystemDetailsHeader isAdmin={isAdmin} systemName={system?.name} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 80px' }}>
        {loading ? (
          <p style={{ color: P.muted, fontSize: '0.9rem', textAlign: 'center', padding: '60px 0' }}>Carregando...</p>
        ) : !system ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: P.text }}>Sistema não encontrado</h1>
            <p style={{ color: P.muted, fontSize: '0.88rem', marginBottom: 20 }}>Este sistema não está mais disponível no catálogo.</p>
            <Link to="/area-do-cliente" style={{ color: P.primary, fontWeight: 700, fontSize: '0.88rem' }}>Voltar à Área do Cliente</Link>
          </div>
        ) : (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, boxShadow: P.shadow, borderRadius: 20, padding: '32px', overflow: 'hidden' }}>
            <style>{`
              .sdp-hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 32px; align-items: center; }
              @media (max-width: 820px) { .sdp-hero { grid-template-columns: 1fr !important; } }
            `}</style>

            <div className="sdp-hero">
              <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: P.surface2, border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {embedSrc ? (
                  <iframe
                    src={embedSrc}
                    title={`Vídeo de demonstração — ${system.name}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : system.video_url ? (
                  <video src={system.video_url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={P.primary}><path d="M8 5v14l11-7z" /></svg>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: P.muted, fontWeight: 600 }}>Vídeo de demonstração em breve</span>
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  {system.logo_url ? (
                    <img src={system.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', background: P.primarySoft, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                      {system.icon}
                    </div>
                  )}
                  <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: -0.4, color: P.text, marginBottom: 2 }}>{system.name}</h1>
                    {system.default_amount > 0 && (
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: P.primary }}>{formatBRL(system.default_amount)}/mês</div>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '0.92rem', color: P.muted, lineHeight: 1.7, marginBottom: 22 }}>{system.description}</p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: alreadyActive || !hasCompany || !isOrgManager ? 16 : 0 }}>
                  <button type="button" onClick={() => setTrialModalOpen(true)}
                    style={{ padding: '12px 22px', borderRadius: 12, background: 'transparent', border: `1px solid ${P.border2}`, color: P.text, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: FONT_INTER }}>
                    Testar solução
                  </button>
                  {!alreadyActive && hasCompany && isOrgManager && (
                    <button type="button" onClick={() => navigate(`/area-do-cliente/sistemas/${system.slug}/contrato`)}
                      style={{ padding: '12px 22px', borderRadius: 12, background: P.primary, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: FONT_INTER }}>
                      Contratar
                    </button>
                  )}
                </div>

                {alreadyActive ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#22c55e' }}>Sua empresa já possui este sistema.</span>
                  </div>
                ) : !hasCompany ? (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: P.surface2, border: `1px dashed ${P.border2}` }}>
                    <p style={{ fontSize: '0.84rem', color: P.muted, marginBottom: 10 }}>Crie uma equipe para poder contratar sistemas.</p>
                    <Link to="/area-do-cliente" style={{ color: P.primary, fontWeight: 700, fontSize: '0.84rem' }}>Voltar à Área do Cliente</Link>
                  </div>
                ) : !isOrgManager ? (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: P.surface2, border: `1px dashed ${P.border2}` }}>
                    <p style={{ fontSize: '0.84rem', color: P.muted }}>Apenas o dono ou administrador da equipe pode contratar este sistema.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>

      {trialModalOpen && system && (
        <TrialModal system={system} onClose={() => setTrialModalOpen(false)} P={P} />
      )}
    </div>
  );
}
