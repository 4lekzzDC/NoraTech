import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin, formatBRL } from '../lib/admin';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import UserProfileMenu from '../components/UserProfileMenu';
import { supabase } from '../lib/supabase';
import { fetchMyCompany } from '../lib/companies';
import { getSystem } from '../lib/systems';
import { fetchPaymentMethod, createSetupIntent, createInvoicePaymentIntent } from '../lib/payments';
import { getStripe } from '../lib/stripe';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getPalette, FONT_INTER, FONT_MONO } from '../modules/solucoes-contabeis/theme';

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function fmtDate(iso) {
  if (!iso) return '—';
  // Colunas `date` chegam como 'YYYY-MM-DD'. new Date() lê isso como UTC e,
  // no fuso do Brasil, exibiria o dia anterior — por isso ancoramos no local.
  const dateOnly = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

const INVOICE_STATUS = {
  pending:  { label: 'Pendente',  color: '#f59e0b' },
  paid:     { label: 'Paga',      color: '#22c55e' },
  overdue:  { label: 'Vencida',   color: '#f87171' },
  canceled: { label: 'Cancelada', color: '#9ca3af' },
  refunded: { label: 'Reembolso', color: '#a78bfa' },
};

function fmtMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

const SUB_STATUS = {
  active:   { label: 'Ativa',     color: '#22c55e' },
  trialing: { label: 'Trial',     color: '#60a5fa' },
  canceled: { label: 'Cancelada', color: '#f87171' },
  past_due: { label: 'Vencida',   color: '#f59e0b' },
};

// ─── SupportModal ─────────────────────────────────────────────────────────────

function SupportModal({ onClose, P, theme }) {
  const isDark = theme !== 'light';
  const [view, setView] = useState('main'); // 'main' | 'ticket'
  const [ticketForm, setTicketForm] = useState({ assunto: '', categoria: 'Cobrança', descricao: '' });
  const [ticketSent, setTicketSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [whatsappClicked, setWhatsappClicked] = useState(false);
  const [emailClicked, setEmailClicked] = useState(false);

  const modalBg  = isDark ? '#18181f' : '#ffffff';
  const overlay  = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.48)';
  const borderClr = isDark ? 'rgba(255,255,255,0.12)' : '#e2e4e9';
  const textClr  = isDark ? '#eeede9' : '#0f1115';
  const mutedClr = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(15,17,21,0.52)';
  const sepClr   = isDark ? 'rgba(255,255,255,0.08)' : '#eceef2';
  const iconBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f8';
  const cardBg   = isDark ? 'rgba(255,255,255,0.02)' : '#f8f8fc';
  const inputBg  = isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f8';

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (view === 'ticket') { setView('main'); setTicketSent(false); }
        else onClose();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, view]);

  const handleWhatsApp = () => {
    window.open(
      'https://wa.me/5511932227752?text=Ol%C3%A1%2C+preciso+de+suporte+financeiro+%E2%80%94+Noratech.',
      '_blank', 'noopener,noreferrer'
    );
    setWhatsappClicked(true);
    setTimeout(() => setWhatsappClicked(false), 3000);
  };

  const handleEmail = () => {
    window.location.href = 'mailto:contato@noratech.com.br?subject=Suporte%20financeiro%20-%20Noratech';
    setEmailClicked(true);
    setTimeout(() => setEmailClicked(false), 3000);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 1300));
    setTicketSent(true);
    setSending(false);
  };

  const resetTicket = () => {
    setView('main');
    setTicketSent(false);
    setTicketForm({ assunto: '', categoria: 'Cobrança', descricao: '' });
  };

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`
        @keyframes fin-supp-in   { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes fin-supp-spin { to { transform:rotate(360deg); } }
        .fin-supp-box { animation: fin-supp-in 0.2s ease; }
        .fin-supp-card { border-radius:14px;border:1px solid ${borderClr};background:${cardBg};padding:18px 20px;transition:background 0.15s,border-color 0.15s; }
        .fin-supp-card:hover { background:${isDark ? 'rgba(139,61,255,0.06)' : 'rgba(139,61,255,0.03)'};border-color:${P.primaryBorder}; }
        .fin-supp-close { position:absolute;top:16px;right:18px;width:30px;height:30px;border-radius:50%;border:1px solid ${borderClr};background:${iconBg};color:${mutedClr};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.05rem;line-height:1;font-family:inherit; }
        .fin-supp-close:hover { border-color:${P.primaryBorder};color:${P.primary}; }
        .fin-supp-btn { display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:9px;border:none;font-size:0.79rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity 0.15s; }
        .fin-supp-btn:hover { opacity:0.85; }
        .fin-supp-ghost { display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px solid ${borderClr};background:transparent;color:${mutedClr};font-size:0.79rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .fin-supp-ghost:hover { border-color:${P.primaryBorder};color:${P.primary}; }
        .fin-supp-input { width:100%;padding:9px 12px;border-radius:9px;border:1px solid ${borderClr};background:${inputBg};color:${textClr};font-size:0.82rem;font-family:inherit;outline:none;transition:border-color 0.15s; }
        .fin-supp-input:focus { border-color:${P.primaryBorder}; }
        .fin-supp-textarea { width:100%;padding:9px 12px;border-radius:9px;border:1px solid ${borderClr};background:${inputBg};color:${textClr};font-size:0.82rem;font-family:inherit;outline:none;transition:border-color 0.15s;resize:vertical;min-height:90px; }
        .fin-supp-textarea:focus { border-color:${P.primaryBorder}; }
        .fin-supp-label { font-size:0.7rem;font-weight:700;letter-spacing:0.4px;color:${mutedClr}; }
        .fin-supp-back { display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;border:1px solid ${borderClr};background:${iconBg};color:${mutedClr};font-size:0.71rem;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px;transition:all 0.15s; }
        .fin-supp-back:hover { border-color:${P.primaryBorder};color:${P.primary}; }
      `}</style>

      <section
        role="dialog" aria-modal="true" aria-label="Suporte financeiro"
        className="fin-supp-box"
        style={{ width: 'min(500px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: modalBg, border: `1px solid ${borderClr}`, borderRadius: 20, boxShadow: '0 28px 80px rgba(0,0,0,0.55)', color: textClr, fontFamily: FONT_INTER, position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${sepClr}` }}>
          {view === 'ticket' && (
            <button type="button" className="fin-supp-back" onClick={resetTicket}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Voltar
            </button>
          )}
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.4, color: textClr, marginBottom: 4 }}>
            {view === 'ticket' ? 'Abrir ticket interno' : 'Suporte financeiro'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: mutedClr, lineHeight: 1.55 }}>
            {view === 'ticket'
              ? 'Descreva sua solicitação. Nossa equipe responderá em até 1 dia útil.'
              : 'Escolha como deseja falar com nossa equipe sobre cobranças, pagamentos ou planos.'}
          </p>
          <button type="button" className="fin-supp-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px' }}>

          {view === 'main' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* WhatsApp */}
              <div className="fin-supp-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#25D36618', border: '1px solid #25D36635', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: textClr, marginBottom: 3 }}>WhatsApp</div>
                    <div style={{ fontSize: '0.75rem', color: mutedClr, lineHeight: 1.5, marginBottom: 12 }}>
                      Fale rapidamente com nossa equipe financeira pelo WhatsApp.
                    </div>
                    <button type="button" onClick={handleWhatsApp} className="fin-supp-btn"
                      style={{ background: whatsappClicked ? '#16a34a' : '#25D366', color: '#fff' }}>
                      {whatsappClicked ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          WhatsApp aberto
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>
                          Enviar mensagem no WhatsApp
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* E-mail */}
              <div className="fin-supp-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: textClr, marginBottom: 3 }}>E-mail</div>
                    <div style={{ fontSize: '0.75rem', color: mutedClr, lineHeight: 1.5, marginBottom: 12 }}>
                      Envie um e-mail para <strong style={{ color: P.primary, fontWeight: 600 }}>contato@noratech.com.br</strong> com sua dúvida financeira.
                    </div>
                    <button type="button" onClick={handleEmail} className="fin-supp-btn"
                      style={{ background: emailClicked ? P.primary : P.primarySoft, color: emailClicked ? '#fff' : P.primary, border: `1px solid ${P.primaryBorder}` }}>
                      {emailClicked ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          Cliente de e-mail aberto
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                          Enviar e-mail
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ticket interno */}
              <div className="fin-supp-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: textClr, marginBottom: 3 }}>Ticket interno</div>
                    <div style={{ fontSize: '0.75rem', color: mutedClr, lineHeight: 1.5, marginBottom: 12 }}>
                      Abra um chamado interno para acompanhamento da solicitação.
                    </div>
                    <button type="button" onClick={() => setView('ticket')} className="fin-supp-btn"
                      style={{ background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.28)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      Abrir ticket interno
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'ticket' && !ticketSent && (
            <form onSubmit={handleTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="fin-supp-label" style={{ display: 'block', marginBottom: 6 }}>Assunto</label>
                <input
                  className="fin-supp-input"
                  type="text"
                  required
                  placeholder="Descreva brevemente o assunto"
                  value={ticketForm.assunto}
                  onChange={(e) => setTicketForm((f) => ({ ...f, assunto: e.target.value }))}
                />
              </div>
              <div>
                <label className="fin-supp-label" style={{ display: 'block', marginBottom: 6 }}>Categoria</label>
                <select
                  className="fin-supp-input"
                  value={ticketForm.categoria}
                  onChange={(e) => setTicketForm((f) => ({ ...f, categoria: e.target.value }))}
                  style={{ cursor: 'pointer' }}>
                  {['Cobrança', 'Pagamento', 'Plano / assinatura', 'Nota fiscal', 'Outro'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fin-supp-label" style={{ display: 'block', marginBottom: 6 }}>Descrição</label>
                <textarea
                  className="fin-supp-textarea"
                  required
                  placeholder="Detalhe sua solicitação..."
                  value={ticketForm.descricao}
                  onChange={(e) => setTicketForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" className="fin-supp-ghost" onClick={resetTicket}>Cancelar</button>
                <button type="submit" disabled={sending} className="fin-supp-btn"
                  style={{ background: P.primary, color: '#fff', opacity: sending ? 0.72 : 1, cursor: sending ? 'default' : 'pointer' }}>
                  {sending ? (
                    <>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'fin-supp-spin 0.7s linear infinite' }} />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Abrir ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {view === 'ticket' && ticketSent && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0 8px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#22c55e14', border: '1px solid #22c55e35', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: textClr, marginBottom: 6, letterSpacing: -0.3 }}>Ticket aberto com sucesso!</div>
                <div style={{ fontSize: '0.78rem', color: mutedClr, lineHeight: 1.6, maxWidth: 300 }}>
                  Nossa equipe recebeu sua solicitação e entrará em contato em até 1 dia útil.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" className="fin-supp-ghost" onClick={resetTicket}>Novo ticket</button>
                <button type="button" className="fin-supp-btn" onClick={onClose} style={{ background: P.primary, color: '#fff' }}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────

function SetupCardForm({ onClose, onSaved, mutedClr, borderClr }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    if (confirmError) {
      setSubmitting(false);
      setError(confirmError.message || 'Não foi possível salvar o cartão.');
      return;
    }
    setSubmitting(false);
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '24px 28px' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
        {error && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)', color: '#ff9ab4', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 28px 20px', borderTop: `1px solid ${borderClr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: mutedClr, fontSize: '0.7rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          Processado com segurança pelo Stripe. Não guardamos o número do cartão.
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" className="fin-pm-close" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="fin-pm-contact" disabled={!stripe || submitting} style={{ opacity: !stripe || submitting ? 0.6 : 1, cursor: !stripe || submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Salvando...' : 'Salvar cartão'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PaymentModal({ companyId, onClose, onSaved, P, theme }) {
  const isDark   = theme !== 'light';
  const modalBg  = isDark ? '#18181f' : '#ffffff';
  const overlay  = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.48)';
  const borderClr = isDark ? 'rgba(255,255,255,0.12)' : '#e2e4e9';
  const textClr  = isDark ? '#eeede9' : '#0f1115';
  const mutedClr = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(15,17,21,0.52)';
  const sepClr   = isDark ? 'rgba(255,255,255,0.08)' : '#eceef2';
  const iconBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f8';

  const [clientSecret, setClientSecret] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const stripePromise = useMemo(() => getStripe(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!companyId) { setLoadError('Nenhuma empresa vinculada à sua conta.'); return; }
      try {
        const secret = await createSetupIntent(companyId);
        if (active) setClientSecret(secret);
      } catch (err) {
        if (active) setLoadError(err.message || 'Não foi possível iniciar o cadastro do cartão.');
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  // Close on ESC
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const elementsOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: isDark ? 'night' : 'stripe',
      variables: {
        colorPrimary: P.primary,
        colorBackground: modalBg,
        colorText: textClr,
        colorDanger: '#ff6b6b',
        fontFamily: FONT_INTER,
        borderRadius: '10px',
      },
    },
  } : undefined;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`
        @keyframes fin-modal-in { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        .fin-modal-box { animation: fin-modal-in 0.2s ease; }
        .fin-close-btn { position:absolute;top:16px;right:18px;width:30px;height:30px;border-radius:50%;border:1px solid ${borderClr};background:${iconBg};color:${mutedClr};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;line-height:1; }
        .fin-close-btn:hover { border-color:${P.primaryBorder};color:${P.primary}; }
        .fin-pm-contact { display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;border:none;background:${P.primary};color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;transition:opacity 0.15s; }
        .fin-pm-contact:hover { opacity:0.87; }
        .fin-pm-close { display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;border:1px solid ${borderClr};background:transparent;color:${mutedClr};font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .fin-pm-close:hover { border-color:${P.primaryBorder};color:${P.primary}; }
      `}</style>

      <section
        role="dialog" aria-modal="true" aria-label="Forma de pagamento"
        className="fin-modal-box"
        style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: modalBg, border: `1px solid ${borderClr}`, borderRadius: 20, boxShadow: '0 28px 80px rgba(0,0,0,0.55)', color: textClr, fontFamily: FONT_INTER, position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${sepClr}` }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: -0.4, color: textClr, marginBottom: 4 }}>Cadastrar cartão</h2>
          <p style={{ fontSize: '0.82rem', color: mutedClr, lineHeight: 1.5 }}>Esse cartão será usado para cobrar suas próximas faturas.</p>
          <button type="button" className="fin-close-btn" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {loadError ? (
          <div style={{ padding: '24px 28px' }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)', color: '#ff9ab4', fontSize: '0.85rem', fontWeight: 600 }}>
              {loadError}
            </div>
          </div>
        ) : !clientSecret ? (
          <div style={{ padding: '48px 28px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${P.primaryBorder}`, borderTopColor: P.primary, borderRadius: '50%', animation: 'admin-spin 0.8s linear infinite' }} />
            <style>{`@keyframes admin-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <SetupCardForm onClose={onClose} onSaved={onSaved} mutedClr={mutedClr} borderClr={sepClr} />
          </Elements>
        )}
      </section>
    </div>,
    document.body
  );
}

// ─── PayInvoiceModal ──────────────────────────────────────────────────────────
// Pagamento avulso de UMA fatura — cartão, PIX ou boleto (o Payment Element
// decide dinamicamente quais métodos mostrar, conforme habilitados no
// painel do Stripe). Diferente do PaymentModal acima: aqui não se salva
// nada, é só o pagamento desta fatura específica, agora.

function PayInvoiceForm({ onClose, onPaid, mutedClr, borderClr }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message || 'Não foi possível processar o pagamento.');
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      onPaid();
      onClose();
      return;
    }
    // PIX/boleto: o QR ou o código de barras já apareceu dentro do formulário
    // acima — mantemos o formulário montado e só avisamos que estamos
    // aguardando a confirmação (o webhook marca como paga quando compensar).
    setWaiting(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '24px 28px' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
        {waiting && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.28)', color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
            Aguardando confirmação do pagamento. Assim que compensar, a fatura muda para "Paga" automaticamente — pode fechar esta janela.
          </div>
        )}
        {error && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)', color: '#ff9ab4', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 28px 20px', borderTop: `1px solid ${borderClr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: mutedClr, fontSize: '0.7rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          Processado com segurança pelo Stripe.
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" className="fin-pm-close" onClick={onClose} disabled={submitting}>{waiting ? 'Fechar' : 'Cancelar'}</button>
          {!waiting && (
            <button type="submit" className="fin-pm-contact" disabled={!stripe || submitting} style={{ opacity: !stripe || submitting ? 0.6 : 1, cursor: !stripe || submitting ? 'wait' : 'pointer' }}>
              {submitting ? 'Processando...' : 'Pagar'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function PayInvoiceModal({ invoice, onClose, onPaid, P, theme }) {
  const isDark   = theme !== 'light';
  const modalBg  = isDark ? '#18181f' : '#ffffff';
  const overlay  = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.48)';
  const borderClr = isDark ? 'rgba(255,255,255,0.12)' : '#e2e4e9';
  const textClr  = isDark ? '#eeede9' : '#0f1115';
  const mutedClr = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(15,17,21,0.52)';
  const sepClr   = isDark ? 'rgba(255,255,255,0.08)' : '#eceef2';
  const iconBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f8';

  const [clientSecret, setClientSecret] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const stripePromise = useMemo(() => getStripe(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const secret = await createInvoicePaymentIntent(invoice.id);
        if (active) setClientSecret(secret);
      } catch (err) {
        if (active) setLoadError(err.message || 'Não foi possível iniciar o pagamento.');
      }
    })();
    return () => { active = false; };
  }, [invoice.id]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const elementsOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: isDark ? 'night' : 'stripe',
      variables: {
        colorPrimary: P.primary,
        colorBackground: modalBg,
        colorText: textClr,
        colorDanger: '#ff6b6b',
        fontFamily: FONT_INTER,
        borderRadius: '10px',
      },
    },
  } : undefined;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`
        @keyframes fin-modal-in { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        .fin-modal-box { animation: fin-modal-in 0.2s ease; }
        .fin-close-btn { position:absolute;top:16px;right:18px;width:30px;height:30px;border-radius:50%;border:1px solid ${borderClr};background:${iconBg};color:${mutedClr};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;line-height:1; }
        .fin-close-btn:hover { border-color:${P.primaryBorder};color:${P.primary}; }
        .fin-pm-contact { display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;border:none;background:${P.primary};color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;transition:opacity 0.15s; }
        .fin-pm-contact:hover { opacity:0.87; }
        .fin-pm-close { display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;border:1px solid ${borderClr};background:transparent;color:${mutedClr};font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .fin-pm-close:hover { border-color:${P.primaryBorder};color:${P.primary}; }
      `}</style>

      <section
        role="dialog" aria-modal="true" aria-label="Pagar fatura"
        className="fin-modal-box"
        style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: modalBg, border: `1px solid ${borderClr}`, borderRadius: 20, boxShadow: '0 28px 80px rgba(0,0,0,0.55)', color: textClr, fontFamily: FONT_INTER, position: 'relative' }}>

        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${sepClr}` }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: -0.4, color: textClr, marginBottom: 4 }}>Pagar fatura</h2>
          <p style={{ fontSize: '0.82rem', color: mutedClr, lineHeight: 1.5 }}>
            {invoice.description} · <strong style={{ color: textClr }}>{formatBRL(invoice.amount)}</strong>
          </p>
          <button type="button" className="fin-close-btn" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {loadError ? (
          <div style={{ padding: '24px 28px' }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)', color: '#ff9ab4', fontSize: '0.85rem', fontWeight: 600 }}>
              {loadError}
            </div>
          </div>
        ) : !clientSecret ? (
          <div style={{ padding: '48px 28px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${P.primaryBorder}`, borderTopColor: P.primary, borderRadius: '50%', animation: 'admin-spin 0.8s linear infinite' }} />
            <style>{`@keyframes admin-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PayInvoiceForm onClose={onClose} onPaid={onPaid} mutedClr={mutedClr} borderClr={sepClr} />
          </Elements>
        )}
      </section>
    </div>,
    document.body
  );
}

// ─── Header (sempre dark) ─────────────────────────────────────────────────────

function FinanceiroHeader({ isAdmin }) {
  return (
    <>
      <style>{`
        .fin-header { position:sticky;top:0;z-index:100;background:#08080A;border-bottom:1px solid rgba(139,61,255,0.25);box-shadow:0 8px 30px rgba(0,0,0,0.28); }
        .fin-back { display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;transition:background 0.17s,border-color 0.17s; }
        .fin-back:hover { background:rgba(139,61,255,0.14);border-color:#8B3DFF; }
        .fin-crumb { display:inline-flex;align-items:center;height:26px;padding:0 7px;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;color:rgba(255,255,255,0.68);text-decoration:none;transition:color 0.15s,background 0.15s; }
        .fin-crumb-link:hover { color:#fff;background:rgba(139,61,255,0.14); }
        .fin-crumb-current { color:#fff;font-weight:600; }
        .fin-crumb-sep { display:inline-flex;align-items:center;padding:0 5px;font-size:13px;color:rgba(139,61,255,0.75);user-select:none; }
        .fin-toggle-slot button.theme-toggle,.fin-toggle-slot [class*="theme-toggle"] { width:34px!important;height:34px!important;border-radius:10px!important;background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.14)!important;color:#fff!important;transition:background 0.17s,border-color 0.17s!important; }
        .fin-toggle-slot button.theme-toggle:hover,.fin-toggle-slot [class*="theme-toggle"]:hover { background:rgba(139,61,255,0.14)!important;border-color:#8B3DFF!important; }
        .fin-admin-btn { display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid rgba(124,58,237,0.4);background:rgba(124,58,237,0.1);color:#a78bfa;font-size:0.75rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;transition:background 0.15s,border-color 0.15s; }
        .fin-admin-btn:hover { background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.6); }
        .fin-header-inner { max-width:1240px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
        @media (max-width:640px) { .fin-header-inner { padding:0 14px!important; } .fin-crumb-link,.fin-crumb-sep { display:none!important; } .fin-admin-btn { display:none!important; } }
      `}</style>
      <header className="fin-header">
        <div className="fin-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Link to="/area-do-cliente" aria-label="Voltar à Central de Controle" className="fin-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
              <Link to="/" className="fin-crumb fin-crumb-link" style={{ fontFamily: FONT_MONO, letterSpacing: -0.2 }}>Noratech</Link>
              <span className="fin-crumb-sep">/</span>
              <Link to="/area-do-cliente" className="fin-crumb fin-crumb-link">Central de Controle</Link>
              <span className="fin-crumb-sep">/</span>
              <span className="fin-crumb fin-crumb-current">Financeiro</span>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isAdmin && (
              <Link to="/admin" className="fin-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Admin
              </Link>
            )}
            <span className="fin-toggle-slot" style={{ display: 'inline-flex' }}><ThemeToggle /></span>
            <UserProfileMenu />
          </div>
        </div>
      </header>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [companyInfo, setCompanyInfo] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [itemsByInvoice, setItemsByInvoice] = useState({});
  const [preview, setPreview] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const loadPaymentMethod = async (companyId) => {
    if (!companyId) return;
    try {
      setPaymentMethod(await fetchPaymentMethod(companyId));
    } catch { /* keep previous */ }
  };

  const loadAll = useCallback(async () => {
    let companyId;
    try {
      const my = await fetchMyCompany();
      setCompanyInfo(my);
      companyId = my?.company?.id;
      if (companyId) {
        const [subsRes, invRes, previewRes, pmData] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('id, system_slug, plan, status, amount, started_at, created_at')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false }),
          supabase
            .from('invoices')
            .select('*')
            .eq('company_id', companyId)
            .order('due_date', { ascending: false }),
          supabase.rpc('preview_company_invoice', { p_company_id: companyId }),
          fetchPaymentMethod(companyId).catch(() => null),
        ]);

        const seen = new Set();
        const list = [];
        (subsRes.data || []).forEach((s) => {
          if (seen.has(s.system_slug)) return;
          seen.add(s.system_slug);
          list.push({ ...s, system: getSystem(s.system_slug) });
        });
        setSubscriptions(list);

        const invoiceRows = invRes.data || [];
        setInvoices(invoiceRows);
        setPreview(previewRes.data || []);
        setPaymentMethod(pmData);

        // Composição de cada fatura (um sistema por linha).
        if (invoiceRows.length > 0) {
          const { data: itemRows } = await supabase
            .from('invoice_items')
            .select('*')
            .in('invoice_id', invoiceRows.map((i) => i.id));
          setItemsByInvoice((itemRows || []).reduce((acc, it) => {
            (acc[it.invoice_id] ||= []).push(it);
            return acc;
          }, {}));
        }
      }
    } catch { /* keep empty */ }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadAll();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id, loadAll]);

  const companyName = companyInfo?.company?.name || user?.company || null;
  const memberSince = useMemo(() => fmtMonth(user?.createdAt), [user]);

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing'),
    [subscriptions]
  );

  // Faturas em aberto = pendentes + vencidas (o que o cliente ainda deve).
  const openInvoices = useMemo(
    () => invoices.filter((i) => i.status === 'pending' || i.status === 'overdue'),
    [invoices]
  );
  const openTotal = useMemo(
    () => openInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [openInvoices]
  );
  const paidCount = useMemo(() => invoices.filter((i) => i.status === 'paid').length, [invoices]);

  // Próximo fechamento vem da prévia consolidada (dia de vencimento da empresa).
  const nextDueDate = preview[0]?.period_end || null;
  const nextDueTotal = useMemo(
    () => preview.reduce((sum, l) => sum + Number(l.amount || 0), 0),
    [preview]
  );

  const cssVars = {
    '--p-bg': P.bg, '--p-surface': P.surface, '--p-surface2': P.surface2,
    '--p-text': P.text, '--p-muted': P.muted, '--p-muted2': P.muted2,
    '--p-border': P.border, '--p-border2': P.border2,
    '--p-primary': P.primary, '--p-primary-soft': P.primarySoft, '--p-primary-border': P.primaryBorder,
    '--p-input-bg': P.inputBg, '--p-shadow': P.shadow, '--p-row-hover': P.rowHover,
  };

  const isDark = theme !== 'light';
  const CARD = {
    background: 'var(--p-surface)',
    border: '1px solid var(--p-border)',
    boxShadow: 'var(--p-shadow)',
    borderRadius: 16,
    padding: '22px 24px',
  };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: FONT_INTER, ...cssVars }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }

        .fin-row-hover { border-radius: 10px; transition: background 0.13s; }
        .fin-row-hover:hover { background: var(--p-row-hover); }

        .fin-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: 10px; border: none;
          background: var(--p-primary); color: #fff;
          font-size: 0.82rem; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: opacity 0.15s; text-decoration: none;
        }
        .fin-btn-primary:hover { opacity: 0.86; }

        .fin-btn-soft {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 9px;
          border: 1px solid var(--p-primary-border);
          background: var(--p-primary-soft); color: var(--p-primary);
          font-size: 0.78rem; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: all 0.15s; text-decoration: none;
        }
        .fin-btn-soft:hover { background: var(--p-primary); color: #fff; border-color: var(--p-primary); }

        .fin-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          border: 1px solid var(--p-border2); background: transparent;
          color: var(--p-muted); font-size: 0.75rem; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all 0.15s; text-decoration: none;
        }
        .fin-btn-ghost:hover { border-color: var(--p-primary-border); color: var(--p-primary); background: var(--p-primary-soft); }

        .fin-btn-disabled {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 9px;
          border: 1px solid var(--p-border); background: transparent;
          color: var(--p-muted2); font-size: 0.78rem; font-weight: 600;
          cursor: default; font-family: inherit;
        }

        .fin-th { font-size: 0.59rem; font-weight: 700; letter-spacing: 1.3px; color: var(--p-muted); text-transform: uppercase; }
        .fin-td { font-size: 0.82rem; color: var(--p-text); }
        .fin-td-muted { font-size: 0.78rem; color: var(--p-muted); }

        /* Single 4-col grid — stat cards each span 1, main spans 3, sidebar spans 1 */
        .fin-page-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; align-items: start; }
        .fin-main-col  { grid-column: 1 / 4; display: flex; flex-direction: column; gap: 16px; }
        .fin-side-col  { grid-column: 4 / 5; display: flex; flex-direction: column; gap: 14px; }
        @media (max-width: 960px) {
          .fin-page-grid { grid-template-columns: 1fr 1fr !important; }
          .fin-main-col  { grid-column: 1 / -1 !important; order: 2; }
          .fin-side-col  { grid-column: 1 / -1 !important; order: 1; }
        }
        @media (max-width: 560px) {
          .fin-main { padding: 16px 16px 64px !important; }
          .fin-page-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <FinanceiroHeader isAdmin={isAdmin} />

      <main className="fin-main" style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Page heading ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, color: P.text }}>Financeiro</h1>
            <p style={{ marginTop: 5, fontSize: '0.875rem', color: P.muted, lineHeight: 1.5 }}>
              Gerencie faturas, pagamentos e assinaturas{companyName ? ` de ${companyName}` : ' da sua organização'}.
            </p>
          </div>
        </div>

        {/* ── Single 4-col grid: stat cards + body (main×3 + sidebar×1) ── */}
        <div className="fin-page-grid">
          {[
            {
              label: 'Faturas em aberto',
              value: loading ? '...' : openInvoices.length,
              sub: openInvoices.length > 0 ? `${formatBRL(openTotal)} a pagar` : 'nada em aberto',
              accentColor: '#f59e0b',
              icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ),
            },
            {
              label: 'Faturas pagas',
              value: loading ? '...' : paidCount,
              sub: paidCount === 1 ? '1 fatura quitada' : `${paidCount} faturas quitadas`,
              accentColor: '#22c55e',
              icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ),
            },
            {
              label: 'Próximo vencimento',
              value: loading ? '...' : (nextDueDate ? fmtDate(nextDueDate) : '—'),
              sub: nextDueDate
                ? `${formatBRL(nextDueTotal)} previstos`
                : (activeSubs.length > 0 ? 'vencimento não configurado' : 'sem assinaturas ativas'),
              accentColor: P.primary,
              icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              label: 'Sistemas contratados',
              value: loading ? '...' : activeSubs.length,
              sub: activeSubs.length === 1 ? '1 sistema ativo' : `${activeSubs.length} sistemas ativos`,
              accentColor: P.primary,
              icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              ),
            },
          ].map(({ label, value, sub, accentColor, icon }) => {
            const isPrimary = accentColor === P.primary;
            return (
              <div key={label} style={{ ...CARD, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.3, color: P.muted, textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPrimary ? P.primarySoft : `${accentColor}18`,
                    border: `1px solid ${isPrimary ? P.primaryBorder : accentColor + '35'}`,
                    color: accentColor, flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: -1, color: accentColor, lineHeight: 1, fontFamily: FONT_MONO }}>{value}</div>
                  <div style={{ fontSize: '0.65rem', color: P.muted, marginTop: 5, lineHeight: 1.3 }}>{sub}</div>
                </div>
              </div>
            );
          })}

          {/* ════ Main column (spans 3) ════ */}
          <div className="fin-main-col">

            {/* ── Faturas ── */}
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase' }}>Cobranças</div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, color: P.text, marginTop: 1 }}>Faturas</h2>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: P.muted, fontStyle: 'italic' }}>Acompanhe suas faturas e pagamentos.</span>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px 85px 110px 100px', gap: 8, padding: '0 12px 10px', borderBottom: `1px solid ${P.border}` }}>
                {['Descrição', 'Sistemas', 'Vencimento', 'Valor', 'Status', ''].map((h) => (
                  <span key={h} className="fin-th">{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: P.muted, fontSize: '0.85rem' }}>Carregando...</div>
              ) : invoices.length === 0 ? (
                /* Empty state */
                <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: P.surface2, border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: P.text, marginBottom: 4 }}>Nenhuma fatura encontrada</div>
                    <div style={{ fontSize: '0.78rem', color: P.muted, maxWidth: 340, lineHeight: 1.55 }}>
                      {nextDueDate
                        ? `Sua próxima fatura será emitida em ${fmtDate(nextDueDate)}.`
                        : 'As faturas geradas pela Noratech aparecerão aqui. Em caso de dúvidas, acione o suporte financeiro.'}
                    </div>
                  </div>
                  <button type="button" className="fin-btn-soft" style={{ marginTop: 4 }} onClick={() => setSupportModalOpen(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    Solicitar suporte financeiro
                  </button>
                </div>
              ) : (
                <div>
                  {invoices.map((inv, i) => {
                    const st = INVOICE_STATUS[inv.status] || { label: inv.status, color: P.muted };
                    const items = itemsByInvoice[inv.id] || [];
                    return (
                      <div key={inv.id} className="fin-row-hover" style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px 85px 110px 100px', gap: 8, alignItems: 'center', padding: '12px', borderBottom: i < invoices.length - 1 ? `1px solid ${P.border}` : 'none' }}>

                        {/* Descrição */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: P.text }}>{inv.description}</div>
                          {items.length > 0 && (
                            <div style={{ fontSize: '0.66rem', color: P.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {items.map((it) => it.description).join(' · ')}
                            </div>
                          )}
                          {inv.paid_at && (
                            <div style={{ fontSize: '0.63rem', color: '#22c55e', marginTop: 2 }}>Pago em {fmtDate(inv.paid_at)}</div>
                          )}
                        </div>

                        {/* Sistemas */}
                        <span style={{ fontSize: '0.78rem', color: P.primary, fontWeight: 600 }}>
                          {items.length > 0
                            ? `${items.length} sistema${items.length !== 1 ? 's' : ''}`
                            : '—'}
                        </span>

                        {/* Vencimento */}
                        <span style={{ fontSize: '0.78rem', color: P.muted, fontFamily: FONT_MONO }}>{fmtDate(inv.due_date)}</span>

                        {/* Valor */}
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: P.text, fontFamily: FONT_MONO }}>{formatBRL(inv.amount)}</span>

                        {/* Status */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, justifySelf: 'start',
                          fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.6,
                          textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999,
                          background: `${st.color}18`, border: `1px solid ${st.color}35`, color: st.color,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.color }} />
                          {st.label}
                        </span>

                        {/* Ação */}
                        <div style={{ justifySelf: 'end' }}>
                          {inv.status !== 'paid' && (
                            <button type="button" className="fin-btn-soft" style={{ padding: '5px 12px', fontSize: '0.74rem' }} onClick={() => setPayingInvoice(inv)}>
                              Pagar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Assinaturas ── */}
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase' }}>Contratos</div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: -0.3, color: P.text, marginTop: 1 }}>Assinaturas</h2>
                  </div>
                </div>
                {!loading && subscriptions.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: P.muted, fontFamily: FONT_MONO }}>
                    {subscriptions.length} registro{subscriptions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 90px 80px', gap: 8, padding: '0 10px 10px', borderBottom: `1px solid ${P.border}` }}>
                {['Sistema', 'Plano', 'Adquirido em', 'Status', 'Ação'].map((h) => (
                  <span key={h} className="fin-th">{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: P.muted, fontSize: '0.85rem' }}>Carregando...</div>
              ) : subscriptions.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: P.text, marginBottom: 6 }}>Nenhuma assinatura encontrada</div>
                  <div style={{ fontSize: '0.78rem', color: P.muted, marginBottom: 16 }}>Entre em contato com a Noratech para contratar um sistema.</div>
                  <Link to="/#contato" className="fin-btn-soft">Falar com a Noratech</Link>
                </div>
              ) : (
                <div>
                  {subscriptions.map((s, i) => {
                    const st = SUB_STATUS[s.status] || { label: s.status, color: P.muted };
                    const sysUrl = s.system?.url;
                    const isInternal = s.system?.internal;
                    return (
                      <div key={s.id} className="fin-row-hover" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 90px 80px', gap: 8, alignItems: 'center', padding: '12px 10px', borderBottom: i < subscriptions.length - 1 ? `1px solid ${P.border}` : 'none' }}>

                        {/* Sistema */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                            {s.system ? s.system.icon : '?'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.system?.name || s.system_slug}
                            </div>
                            {fmtMonth(s.created_at) && (
                              <div style={{ fontSize: '0.63rem', color: P.muted, marginTop: 1 }}>desde {fmtMonth(s.created_at)}</div>
                            )}
                          </div>
                        </div>

                        {/* Plano */}
                        <span style={{ fontSize: '0.8rem', color: P.primary, fontWeight: 600 }}>{s.plan || '—'}</span>

                        {/* Adquirido em */}
                        <span style={{ fontSize: '0.78rem', color: P.muted, fontFamily: FONT_MONO }}>{fmtDate(s.started_at)}</span>

                        {/* Status */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.6,
                          textTransform: 'uppercase', padding: '3px 10px',
                          borderRadius: 999,
                          background: `${st.color}18`, border: `1px solid ${st.color}35`, color: st.color,
                          width: 'fit-content',
                        }}>
                          {st.label}
                        </span>

                        {/* Ação */}
                        {sysUrl ? (
                          isInternal
                            ? <Link to={sysUrl} className="fin-btn-ghost">Abrir</Link>
                            : <a href={sysUrl} target="_blank" rel="noopener noreferrer" className="fin-btn-ghost">Abrir ↗</a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: P.muted2 }}>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {companyName && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.muted2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                  <span style={{ fontSize: '0.7rem', color: P.muted }}>
                    Empresa vinculada: <strong style={{ color: P.text, fontWeight: 600 }}>{companyName}</strong>
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* ════ Sidebar (spans 1) ════ */}
          <div className="fin-side-col">

            {/* Forma de pagamento */}
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase' }}>Pagamentos</div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: -0.2, color: P.text, marginTop: 1 }}>Forma de pagamento</h2>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: P.muted, lineHeight: 1.55, marginBottom: 14 }}>
                Gerencie seus métodos de pagamento.
              </p>
              {paymentMethod ? (
                <div style={{ padding: '12px 14px', background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: P.text, textTransform: 'capitalize' }}>
                      {paymentMethod.brand || 'Cartão'} •••• {paymentMethod.last4}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: P.muted, marginTop: 2 }}>
                      Válido até {String(paymentMethod.exp_month).padStart(2, '0')}/{paymentMethod.exp_year}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 14px', background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: P.text, marginBottom: 3 }}>Nenhuma forma cadastrada</div>
                  <div style={{ fontSize: '0.7rem', color: P.muted, lineHeight: 1.5 }}>Cadastre um método para facilitar seus pagamentos.</div>
                </div>
              )}
              <button type="button" className="fin-btn-soft" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setPaymentModalOpen(true)}>
                {paymentMethod ? 'Trocar cartão' : 'Cadastrar forma de pagamento'}
              </button>
            </div>

            {/* Suporte financeiro */}
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase' }}>Atendimento</div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: -0.2, color: P.text, marginTop: 1 }}>Suporte financeiro</h2>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: P.muted, lineHeight: 1.55, marginBottom: 14 }}>
                Precisa de ajuda com cobranças, pagamentos ou planos? Nossa equipe está pronta para ajudar.
              </p>
              <button type="button" className="fin-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setSupportModalOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Solicitar suporte financeiro
              </button>
            </div>

            {/* Resumo da conta */}
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1.4, color: P.primary, textTransform: 'uppercase' }}>Conta</div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: -0.2, color: P.text, marginTop: 1 }}>Resumo da conta</h2>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'Empresa',      value: companyName || '—' },
                  { label: 'Membro desde', value: memberSince || '—' },
                  { label: 'Sistemas',     value: loading ? '...' : `${activeSubs.length} ativo${activeSubs.length !== 1 ? 's' : ''}` },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '9px 0', borderBottom: i < arr.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: P.muted }}>{label}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: P.text, textAlign: 'right', wordBreak: 'break-word', maxWidth: '58%' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {paymentModalOpen && (
        <PaymentModal
          companyId={companyInfo?.company?.id}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={() => loadPaymentMethod(companyInfo?.company?.id)}
          P={P}
          theme={theme}
        />
      )}

      {payingInvoice && (
        <PayInvoiceModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onPaid={loadAll}
          P={P}
          theme={theme}
        />
      )}

      {supportModalOpen && (
        <SupportModal
          onClose={() => setSupportModalOpen(false)}
          P={P}
          theme={theme}
        />
      )}
    </div>
  );
}
