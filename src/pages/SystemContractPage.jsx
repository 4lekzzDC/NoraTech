import { useState, useEffect } from 'react';
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

function translateSubscribeError(error) {
  const msg = error?.message || '';
  if (/já possui este sistema/i.test(msg)) return 'Sua empresa já possui este sistema.';
  if (/dono ou administrador/i.test(msg)) return 'Apenas o dono ou administrador da equipe pode contratar sistemas.';
  if (/não autenticado/i.test(msg)) return 'Sessão expirada. Recarregue a página e tente novamente.';
  return msg || 'Não foi possível concluir a contratação. Tente novamente.';
}

function SystemContractHeader({ isAdmin, systemName }) {
  return (
    <>
      <style>{`
        .scp-header { position:sticky;top:0;z-index:100;background:#08080A;border-bottom:1px solid rgba(139,61,255,0.25);box-shadow:0 8px 30px rgba(0,0,0,0.28); }
        .scp-back { display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;transition:background 0.17s,border-color 0.17s; }
        .scp-back:hover { background:rgba(139,61,255,0.14);border-color:#8B3DFF; }
        .scp-crumb { display:inline-flex;align-items:center;height:26px;padding:0 7px;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;color:rgba(255,255,255,0.68);text-decoration:none;transition:color 0.15s,background 0.15s; }
        .scp-crumb-link:hover { color:#fff;background:rgba(139,61,255,0.14); }
        .scp-crumb-current { color:#fff;font-weight:600; }
        .scp-crumb-sep { display:inline-flex;align-items:center;padding:0 5px;font-size:13px;color:rgba(139,61,255,0.75);user-select:none; }
        .scp-toggle-slot button.theme-toggle,.scp-toggle-slot [class*="theme-toggle"] { width:34px!important;height:34px!important;border-radius:10px!important;background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.14)!important;color:#fff!important;transition:background 0.17s,border-color 0.17s!important; }
        .scp-toggle-slot button.theme-toggle:hover,.scp-toggle-slot [class*="theme-toggle"]:hover { background:rgba(139,61,255,0.14)!important;border-color:#8B3DFF!important; }
        .scp-admin-btn { display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid rgba(124,58,237,0.4);background:rgba(124,58,237,0.1);color:#a78bfa;font-size:0.75rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;transition:background 0.15s,border-color 0.15s; }
        .scp-admin-btn:hover { background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.6); }
        .scp-header-inner { max-width:1240px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
        @media (max-width:640px) { .scp-header-inner { padding:0 14px!important; } .scp-crumb-link,.scp-crumb-sep { display:none!important; } .scp-admin-btn { display:none!important; } }
      `}</style>
      <header className="scp-header">
        <div className="scp-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Link to={systemName ? `/area-do-cliente` : '/area-do-cliente'} aria-label="Voltar" className="scp-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
              <Link to="/" className="scp-crumb scp-crumb-link" style={{ fontFamily: FONT_MONO, letterSpacing: -0.2 }}>Noratech</Link>
              <span className="scp-crumb-sep">/</span>
              <Link to="/area-do-cliente" className="scp-crumb scp-crumb-link">Área do Cliente</Link>
              <span className="scp-crumb-sep">/</span>
              <span className="scp-crumb scp-crumb-current">Contrato{systemName ? ` — ${systemName}` : ''}</span>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isAdmin && (
              <Link to="/admin" className="scp-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Admin
              </Link>
            )}
            <span className="scp-toggle-slot" style={{ display: 'inline-flex' }}><ThemeToggle /></span>
            <UserProfileMenu />
          </div>
        </div>
      </header>
    </>
  );
}

export default function SystemContractPage() {
  useAuth();
  const { isAdmin } = useIsAdmin();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const bySlug = indexSystems(await fetchSystems());
        if (active) setSystem(bySlug[slug] || null);
        const my = await fetchMyCompany();
        if (active) setCompanyInfo(my);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const companyId = companyInfo?.company?.id || null;

  const handleConfirm = async () => {
    if (!companyId || !system) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('subscribe_to_system', { p_company_id: companyId, p_system_slug: system.slug });
      if (rpcError) throw rpcError;
      setDone(true);
    } catch (err) {
      setError(translateSubscribeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER }}>
      <SystemContractHeader isAdmin={isAdmin} systemName={system?.name} />

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 32px 80px' }}>
        {loading ? (
          <p style={{ color: P.muted, fontSize: '0.9rem', textAlign: 'center', padding: '60px 0' }}>Carregando...</p>
        ) : !system ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: P.text }}>Sistema não encontrado</h1>
            <Link to="/area-do-cliente" style={{ color: P.primary, fontWeight: 700, fontSize: '0.88rem' }}>Voltar à Área do Cliente</Link>
          </div>
        ) : done ? (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, boxShadow: P.shadow, borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: P.text }}>Contratação concluída!</h1>
            <p style={{ fontSize: '0.88rem', color: P.muted, lineHeight: 1.6, marginBottom: 24 }}>
              {system.name} já está ativo para a sua equipe. O valor proporcional entra automaticamente no seu próximo fechamento.
            </p>
            <button type="button" onClick={() => navigate('/area-do-cliente')}
              style={{ padding: '11px 22px', borderRadius: 12, background: P.primary, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: FONT_INTER }}>
              Ir para a Área do Cliente
            </button>
          </div>
        ) : (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, boxShadow: P.shadow, borderRadius: 20, padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              {system.logo_url ? (
                <img src={system.logo_url} alt="" style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover', background: P.primarySoft, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 50, height: 50, borderRadius: 12, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                  {system.icon}
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase', marginBottom: 2 }}>Contrato de contratação</div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: P.text }}>{system.name}</h1>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 22 }}>
              <div style={{ padding: 14, borderRadius: 12, background: P.surface2, border: `1px solid ${P.border}` }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: P.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Empresa</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: P.text }}>{companyInfo?.company?.name || '—'}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: P.surface2, border: `1px solid ${P.border}` }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: P.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Valor mensal</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: P.text }}>{system.default_amount > 0 ? `${formatBRL(system.default_amount)}/mês` : 'Sob consulta'}</div>
              </div>
            </div>

            <div style={{ background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px', maxHeight: 240, overflowY: 'auto', fontSize: '0.82rem', color: P.muted, lineHeight: 1.7, marginBottom: 20 }}>
              <p style={{ fontWeight: 700, color: P.text, marginBottom: 8 }}>Termos de contratação</p>
              <p style={{ marginBottom: 8 }}>1. Ao confirmar, a Noratech libera o acesso ao sistema <strong style={{ color: P.text }}>{system.name}</strong> para a empresa {companyInfo?.company?.name || 'sua empresa'} imediatamente após a confirmação.</p>
              <p style={{ marginBottom: 8 }}>2. O valor de {system.default_amount > 0 ? formatBRL(system.default_amount) : 'referência'} por mês é cobrado de forma proporcional (pro-rata) já no próximo fechamento da fatura consolidada da empresa, e integralmente nos ciclos seguintes.</p>
              <p style={{ marginBottom: 8 }}>3. O pagamento pode ser feito por cartão, PIX ou boleto na área Financeiro, conforme disponibilidade.</p>
              <p style={{ marginBottom: 8 }}>4. O cancelamento pode ser solicitado a qualquer momento junto à equipe Noratech, encerrando a cobrança a partir do próximo ciclo.</p>
              <p>5. O uso do sistema segue os <Link to="/termos" target="_blank" style={{ color: P.primary }}>Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" style={{ color: P.primary }}>Política de Privacidade</Link> da Noratech.</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: P.primary, cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: '0.84rem', color: P.text, lineHeight: 1.5 }}>Li e aceito os termos de contratação acima.</span>
            </label>

            {error && (
              <p style={{ fontSize: '0.82rem', color: '#ff6b6b', marginBottom: 16 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => navigate(-1)} disabled={submitting}
                style={{ padding: '11px 20px', borderRadius: 12, background: 'transparent', border: `1px solid ${P.border2}`, color: P.muted, fontWeight: 600, fontSize: '0.86rem', cursor: submitting ? 'default' : 'pointer', fontFamily: FONT_INTER }}>
                Voltar
              </button>
              <button type="button" onClick={handleConfirm} disabled={!accepted || submitting || !companyId}
                style={{ padding: '11px 24px', borderRadius: 12, background: P.primary, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.86rem', cursor: (!accepted || submitting) ? 'default' : 'pointer', fontFamily: FONT_INTER, opacity: (!accepted || submitting) ? 0.55 : 1 }}>
                {submitting ? 'Confirmando...' : 'Confirmar contratação'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
