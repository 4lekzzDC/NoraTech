import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { getPalette, FONT_INTER } from '../lib/palette';
import { useNotificacoes, tempoRelativo } from '../lib/notifications';

// Sino de notificações. Um componente para os dois lugares onde ele aparece
// (Área do Cliente e NoraDocs) porque os dois usam a MESMA paleta —
// `src/lib/palette.js` — e duplicar renderia duas versões que divergem no
// primeiro ajuste.

// Um ícone por família de evento. Não é enfeite: numa lista de dez avisos, a
// forma à esquerda é o que deixa distinguir "pagamento recusado" de "resposta
// no chamado" antes de ler qualquer palavra.
const ICONES = {
  equipe: (
    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
  ),
  cobranca: (
    <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>
  ),
  suporte: (
    <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>
  ),
  alerta: (
    <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
  ),
};

function familiaDoTipo(tipo) {
  if (tipo === 'fatura_recusada') return 'alerta';
  if (tipo?.startsWith('equipe')) return 'equipe';
  if (tipo?.startsWith('fatura')) return 'cobranca';
  if (tipo?.startsWith('suporte')) return 'suporte';
  return 'alerta';
}

export default function NotificationBell() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef(null);
  const botaoRef = useRef(null);

  const { notificacoes, naoLidas, carregando, erro, recarregar, lerUma, lerTodas } =
    useNotificacoes();

  // Recarrega ao abrir: entre uma abertura e outra pode ter chegado coisa, e
  // buscar só nesse momento evita ficar consultando o banco de fundo à toa.
  useEffect(() => { if (aberto) recarregar(); }, [aberto, recarregar]);

  // Fecha ao clicar fora ou apertar Esc — o mesmo par de saídas que qualquer
  // menu suspenso da plataforma oferece.
  useEffect(() => {
    if (!aberto) return undefined;
    const foraDaCaixa = (e) => {
      if (caixaRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    const noEscape = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', foraDaCaixa);
    document.addEventListener('keydown', noEscape);
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa);
      document.removeEventListener('keydown', noEscape);
    };
  }, [aberto]);

  const abrir = (n) => {
    lerUma(n.id);
    setAberto(false);
    if (n.link) navigate(n.link);
  };

  const rotulo = naoLidas > 0
    ? `Notificações, ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
    : 'Notificações';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <style>{`
        @keyframes sino-pulso {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.25); opacity: .75; }
        }
        .sino-badge { animation: sino-pulso 2.4s ease-in-out infinite; }
        .sino-item:hover { background: ${P.rowHover}; }
        @media (prefers-reduced-motion: reduce) {
          .sino-badge { animation: none; }
        }
      `}</style>

      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="true"
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 9,
          background: aberto ? P.primarySoft : 'transparent',
          border: `1px solid ${aberto ? P.primaryBorder : P.border}`,
          color: aberto ? P.primary : P.muted,
          cursor: 'pointer', transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>

        {naoLidas > 0 && (
          <span
            className="sino-badge"
            style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 17, height: 17, padding: '0 4px',
              borderRadius: 9, background: P.primary, color: '#fff',
              fontSize: '0.62rem', fontWeight: 800, lineHeight: '17px',
              textAlign: 'center', fontFamily: FONT_INTER,
            }}
          >
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          ref={caixaRef}
          role="dialog"
          aria-label="Notificações"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 440, display: 'flex', flexDirection: 'column',
            background: P.surfaceSolid, border: `1px solid ${P.border}`,
            borderRadius: 14, boxShadow: P.shadow, zIndex: 60,
            fontFamily: FONT_INTER, overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: `1px solid ${P.border}`,
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: P.text }}>
              Notificações
            </span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={lerTodas}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '0.74rem', fontWeight: 600, color: P.primary,
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto' }}>
            {carregando && notificacoes.length === 0 && (
              <p style={{ padding: '26px 16px', textAlign: 'center', fontSize: '0.8rem', color: P.muted, margin: 0 }}>
                Carregando…
              </p>
            )}

            {!carregando && erro && (
              <p style={{ padding: '22px 16px', textAlign: 'center', fontSize: '0.78rem', color: P.muted, margin: 0, lineHeight: 1.5 }}>
                Não foi possível carregar as notificações.
                <br />{erro}
              </p>
            )}

            {!carregando && !erro && notificacoes.length === 0 && (
              <p style={{ padding: '26px 18px', textAlign: 'center', fontSize: '0.79rem', color: P.muted, margin: 0, lineHeight: 1.55 }}>
                Nada por aqui. Avisamos quando alguém pedir acesso, quando houver
                novidade na cobrança ou resposta no suporte.
              </p>
            )}

            {notificacoes.map((n) => {
              const naoLida = !n.read_at;
              const familia = familiaDoTipo(n.type);
              return (
                <button
                  key={n.id}
                  type="button"
                  className="sino-item"
                  onClick={() => abrir(n)}
                  style={{
                    width: '100%', display: 'flex', gap: 11, alignItems: 'flex-start',
                    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    background: naoLida ? P.primarySoft : 'transparent',
                    border: 'none', borderBottom: `1px solid ${P.border}`,
                    transition: 'background 0.15s ease', fontFamily: FONT_INTER,
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: P.surface2,
                    // Vermelho só para o que exige ação corretiva — hoje,
                    // pagamento recusado. Se tudo fosse vermelho, nada seria.
                    color: familia === 'alerta' ? P.red : P.primary,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      {ICONES[familia]}
                    </svg>
                  </span>

                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontSize: '0.81rem', color: P.text,
                      fontWeight: naoLida ? 700 : 500, lineHeight: 1.35,
                    }}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span style={{
                        fontSize: '0.75rem', color: P.muted,
                        lineHeight: 1.45, marginTop: 2, overflow: 'hidden',
                        // Corta em duas linhas: a prévia serve para decidir se
                        // vale abrir, não para ler a mensagem inteira aqui.
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {n.body}
                      </span>
                    )}
                    <span style={{ display: 'block', fontSize: '0.68rem', color: P.muted2, marginTop: 4 }}>
                      {tempoRelativo(n.created_at)}
                    </span>
                  </span>

                  {naoLida && (
                    <span style={{
                      flexShrink: 0, width: 7, height: 7, borderRadius: '50%',
                      background: P.primary, marginTop: 6,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
