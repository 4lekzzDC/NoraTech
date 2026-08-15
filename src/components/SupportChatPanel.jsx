import { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, fetchOpenChat, fetchChatMessages } from '../lib/supportChat';

const FONT_INTER = "'Inter', sans-serif";
// 0.85rem * 1.5 de line-height ≈ 20.4px por linha; 6 linhas + os 20px de
// padding vertical do campo (10px em cima e embaixo) dá a altura máxima.
const INPUT_LINE_HEIGHT = 20.4;
const INPUT_MAX_LINES = 6;
const INPUT_MAX_HEIGHT = Math.round(INPUT_LINE_HEIGHT * INPUT_MAX_LINES + 20);

function Bubble({ role, text, C }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isSystem) {
    return (
      <div style={{ alignSelf: 'center', maxWidth: '90%', padding: '7px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center' }}>
        {text}
      </div>
    );
  }

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '82%',
      padding: '10px 13px',
      borderRadius: 14,
      borderBottomRightRadius: isUser ? 4 : 14,
      borderBottomLeftRadius: isUser ? 14 : 4,
      background: isUser ? 'rgba(99,102,241,0.16)' : C.cardBg,
      border: `1px solid ${isUser ? 'rgba(99,102,241,0.3)' : C.cardBd}`,
      color: C.text,
      fontSize: '0.85rem',
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {text}
    </div>
  );
}

export default function SupportChatPanel({ C, isDark, onBack }) {
  const [ticketId, setTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Retoma a conversa aberta, se houver — sair e voltar ao modal não deve
  // perder o histórico.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const open = await fetchOpenChat();
        if (!active) return;
        if (open) {
          setTicketId(open.id);
          setEscalated(Boolean(open.escalated_at));
          const msgs = await fetchChatMessages(open.id);
          if (active) setMessages(msgs.map((m) => ({ role: m.sender_type, text: m.message })));
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  // Cresce junto com o texto até 6 linhas; depois disso rola dentro do campo.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [draft]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft('');
    setError(null);
    // Mostra a mensagem do usuário na hora; a resposta vem depois.
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await sendChatMessage({ ticketId, message: text });
      setTicketId(res.ticket_id);
      if (res.escalated) setEscalated(true);
      setMessages((m) => [
        ...m,
        ...(res.escalated ? [{ role: 'system', text: 'Conversa encaminhada para a equipe.' }] : []),
        { role: 'ai', text: res.reply },
      ]);
    } catch (err) {
      setError(err.message);
      // Devolve o texto para o campo — perder o que foi digitado por causa de
      // uma falha de rede é pior do que o erro em si.
      setDraft(text);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }, [draft, sending, ticketId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'min(560px, 70vh)', fontFamily: FONT_INTER }}>
      <style>{`
        @keyframes sc-blink { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        .sc-dot { width:6px; height:6px; border-radius:50%; background:${C.muted}; animation:sc-blink 1.4s infinite; }
        .sc-dot:nth-child(2){ animation-delay:.2s } .sc-dot:nth-child(3){ animation-delay:.4s }
        .sc-send:disabled { opacity:.45; cursor:not-allowed; }
        .sc-input::placeholder { color:${C.muted}; }
        /* rola normalmente ao passar de 6 linhas, só a barra visível some */
        .sc-input { scrollbar-width:none; -ms-overflow-style:none; }
        .sc-input::-webkit-scrollbar { display:none; width:0; height:0; }
      `}</style>

      <div style={{ padding: '22px 24px 12px', flexShrink: 0 }}>
        <button type="button" onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: FONT_INTER, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Voltar
        </button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, marginBottom: 4 }}>Chat no sistema</h2>
        <p style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.45 }}>
          {escalated
            ? 'Sua conversa foi encaminhada — a equipe responde por aqui.'
            : 'Atendimento por IA. Ele conhece sua conta e encaminha para a equipe quando precisar.'}
        </p>
      </div>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {loading ? (
          <div style={{ margin: 'auto', color: C.muted, fontSize: '0.82rem' }}>Carregando...</div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 320, color: C.muted, fontSize: '0.82rem', lineHeight: 1.6 }}>
            Pergunte o que quiser sobre sua conta, suas faturas ou os sistemas da NoraTech.
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} C={C} />)
        )}

        {sending && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, padding: '11px 14px', borderRadius: 14, borderBottomLeftRadius: 4, background: C.cardBg, border: `1px solid ${C.cardBd}` }}>
            <span className="sc-dot" /><span className="sc-dot" /><span className="sc-dot" />
          </div>
        )}
      </div>

      {error && (
        <div style={{ margin: '10px 24px 0', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.26)', color: '#ff9ab4', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ padding: '12px 24px 20px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea
          ref={inputRef}
          className="sc-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter envia, Shift+Enter quebra linha — convenção de chat.
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Escreva sua mensagem..."
          rows={1}
          maxLength={4000}
          style={{ flex: 1, resize: 'none', overflowY: 'auto', maxHeight: INPUT_MAX_HEIGHT, padding: '10px 13px', borderRadius: 12, border: `1px solid ${C.cardBd}`, background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', color: C.text, outline: 'none', fontFamily: FONT_INTER, fontSize: '0.85rem', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
        <button type="button" className="sc-send" onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Enviar mensagem"
          style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: '1px solid rgba(99,102,241,0.32)', background: 'rgba(99,102,241,0.18)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  );
}
