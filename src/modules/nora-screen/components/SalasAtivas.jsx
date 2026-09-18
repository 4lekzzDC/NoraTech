import { useCallback, useEffect, useState } from 'react';
import { listarSalasAtivas } from '../services/salaPersistida.js';

// ═══════════════════════════════════════════════════════════════
// Salas ativas — overlay aberto pelo "Ver salas" da entrada.
//
// Uma RPC devolve tudo: as colunas públicas da sala (o hash do token do
// dono nunca sai do banco) e quanta gente há em cada uma. Antes a
// contagem vinha de entrar nos canais do Realtime para espiar a
// presença, o que era lento, às vezes não respondia — a linha ficava em
// "contando…" — e listava salas que já não tinham ninguém.
// ═══════════════════════════════════════════════════════════════

function Icone({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const ICONES = {
  pessoas: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6s6.2 2.5 6.2 5.6" /><path d="M16.4 5.4a3.2 3.2 0 0 1 0 5.2M21.2 19c0-2-.7-3.7-2-4.9" /></>,
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
  seta: <path d="M5 12h13M13 6l6 6-6 6" />,
  cadeado: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></>,
  tela: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /></>,
  livre: <path d="M20 6 9 17l-5-5" />,
  vazio: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /><path d="M9 10.5h6" /></>,
  recarregar: <><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M20.5 4.5V10H15" /></>,
};

// O rótulo de status vem das mesmas regras que valem dentro da sala.
function statusDaSala(sala) {
  if (sala.entradasBloqueadas) {
    return { rotulo: 'Entradas bloqueadas', tom: 'fechada', icone: ICONES.cadeado };
  }
  if (sala.somenteHostCompartilha) {
    return { rotulo: 'Somente host compartilha', tom: 'restrita', icone: ICONES.tela };
  }
  return { rotulo: 'Livre', tom: 'livre', icone: ICONES.livre };
}

export default function SalasAtivas({ aberto, aoFechar, aoEntrar, aoCriarSala }) {
  const [salas, setSalas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setSalas(await listarSalasAtivas());
    } catch {
      setErro('Não foi possível carregar as salas agora.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return undefined;
    let vivo = true;
    (async () => { if (vivo) await carregar(); })();
    return () => { vivo = false; };
  }, [aberto, carregar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const vazio = !carregando && !erro && salas.length === 0;

  return (
    <div className="nsl-fundo" role="dialog" aria-modal="true" aria-label="Salas ativas" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <style>{`
        .nsl-fundo {
          position: fixed; inset: 0; z-index: 60;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background: rgba(4,4,10,0.78);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
          animation: nsl-entra 0.26s ease both;
        }
        @keyframes nsl-entra { from { opacity: 0; } to { opacity: 1; } }
        .nsl-fundo *, .nsl-fundo *::before, .nsl-fundo *::after { box-sizing: border-box; }
        html[data-theme="light"] .nsl-fundo strong { color: #d8ccff !important; }

        .nsl-painel {
          width: min(100%, 680px); max-height: min(86vh, 720px);
          display: flex; flex-direction: column;
          border-radius: 26px; overflow: hidden;
          background: linear-gradient(158deg, rgba(30,26,52,0.72) 0%, rgba(10,10,18,0.9) 100%);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 48px 110px -34px rgba(0,0,0,0.92), 0 0 90px -40px rgba(124,58,237,0.5);
          color: #f4f3f7;
          animation: nsl-sobe 0.42s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nsl-sobe { from { opacity: 0; transform: translateY(16px) scale(0.99); } to { opacity: 1; transform: none; } }

        .nsl-topo {
          display: flex; align-items: center; gap: 14px;
          padding: 22px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .nsl-titulo { font-size: 1.16rem; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .nsl-sub { font-size: 0.84rem; color: rgba(255,255,255,0.48); margin: 3px 0 0; }
        .nsl-topo-acoes { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .nsl-fundo button.nsl-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 12px; cursor: pointer;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7); font-family: inherit;
          transition: background 0.22s ease, color 0.22s ease, border-color 0.22s ease;
        }
        .nsl-fundo button.nsl-icone:hover { background: rgba(255,255,255,0.1); color: #fff; }

        .nsl-lista { overflow-y: auto; padding: 14px; min-height: 0; }
        .nsl-sala {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 16px;
          background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.24s ease, border-color 0.24s ease, transform 0.24s cubic-bezier(0.16,1,0.3,1);
        }
        .nsl-sala + .nsl-sala { margin-top: 9px; }
        .nsl-sala:hover { background: rgba(255,255,255,0.06); border-color: rgba(167,139,250,0.3); transform: translateY(-1px); }
        .nsl-codigo {
          font-family: 'JetBrains Mono', monospace; font-size: 1.02rem; font-weight: 700;
          letter-spacing: 2.6px; color: #ece5ff;
        }
        .nsl-meta { display: flex; align-items: center; gap: 12px; margin-top: 6px; flex-wrap: wrap; }
        .nsl-pessoas {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.8rem; color: rgba(255,255,255,0.54);
        }
        .nsl-pessoas svg { color: rgba(167,139,250,0.8); }
        .nsl-status {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px; border-radius: 100px; font-size: 0.73rem; font-weight: 700;
        }
        .nsl-status.livre { background: rgba(34,197,94,0.13); border: 1px solid rgba(34,197,94,0.3); color: #9ff0b8; }
        .nsl-status.restrita { background: rgba(167,139,250,0.14); border: 1px solid rgba(167,139,250,0.32); color: #d8ccff; }
        .nsl-status.fechada { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #fcd9a0; }

        .nsl-fundo .nsl-entrar {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 8px;
          height: 42px; padding: 0 18px; border-radius: 12px; cursor: pointer;
          border: none; font-family: inherit; font-size: 0.87rem; font-weight: 700; color: #fff;
          background: linear-gradient(100deg, #7C3AED, #3b82f6);
          box-shadow: 0 12px 28px -14px rgba(99,72,246,0.95);
          transition: transform 0.24s cubic-bezier(0.16,1,0.3,1), filter 0.24s ease;
        }
        .nsl-fundo .nsl-entrar:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .nsl-fundo .nsl-entrar svg { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
        .nsl-fundo .nsl-entrar:hover svg { transform: translateX(3px); }

        .nsl-vazio { text-align: center; padding: 52px 28px; }
        .nsl-vazio-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 70px; height: 70px; border-radius: 22px; margin-bottom: 20px;
          background: linear-gradient(150deg, rgba(124,58,237,0.16), rgba(59,130,246,0.1));
          border: 1px solid rgba(167,139,250,0.26); color: #a78bfa;
        }
        .nsl-vazio-texto { font-size: 0.98rem; font-weight: 600; margin: 0 0 6px; }
        .nsl-vazio-apoio { font-size: 0.86rem; color: rgba(255,255,255,0.46); margin: 0 0 24px; }
        .nsl-fundo .nsl-criar {
          display: inline-flex; align-items: center; gap: 9px;
          height: 48px; padding: 0 24px; border-radius: 14px; cursor: pointer;
          border: none; font-family: inherit; font-size: 0.92rem; font-weight: 700; color: #fff;
          background: linear-gradient(100deg, #7C3AED, #3b82f6);
          box-shadow: 0 16px 36px -16px rgba(99,72,246,0.95);
          transition: transform 0.24s cubic-bezier(0.16,1,0.3,1), filter 0.24s ease;
        }
        .nsl-fundo .nsl-criar:hover { transform: translateY(-2px); filter: brightness(1.08); }

        .nsl-esqueleto {
          height: 74px; border-radius: 16px; background: rgba(255,255,255,0.04);
          animation: nsl-pulsa 1.4s ease-in-out infinite;
        }
        .nsl-esqueleto + .nsl-esqueleto { margin-top: 9px; }
        @keyframes nsl-pulsa { 0%,100% { opacity: 0.45; } 50% { opacity: 0.85; } }

        .nsl-erro {
          margin: 14px; padding: 14px 16px; border-radius: 14px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          font-size: 0.86rem; color: #fca5a5; text-align: center;
        }

        @media (max-width: 560px) {
          .nsl-fundo { padding: 14px; }
          .nsl-sala { flex-wrap: wrap; }
          .nsl-fundo .nsl-entrar { width: 100%; justify-content: center; margin-left: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nsl-fundo *, .nsl-fundo *::before, .nsl-fundo *::after {
            animation-duration: 0.001ms !important; transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div className="nsl-painel">
        <header className="nsl-topo">
          <div>
            <h2 className="nsl-titulo">Salas ativas</h2>
            <p className="nsl-sub">
              {carregando ? 'Procurando salas…' : `${salas.length} ${salas.length === 1 ? 'sala aberta' : 'salas abertas'} agora`}
            </p>
          </div>
          <div className="nsl-topo-acoes">
            <button type="button" className="nsl-icone" onClick={carregar} title="Atualizar" aria-label="Atualizar">
              <Icone d={ICONES.recarregar} size={17} />
            </button>
            <button type="button" className="nsl-icone" onClick={aoFechar} title="Fechar" aria-label="Fechar">
              <Icone d={ICONES.fechar} size={17} />
            </button>
          </div>
        </header>

        {erro && <div className="nsl-erro">{erro}</div>}

        {carregando && (
          <div className="nsl-lista">
            <div className="nsl-esqueleto" />
            <div className="nsl-esqueleto" />
            <div className="nsl-esqueleto" />
          </div>
        )}

        {vazio && (
          <div className="nsl-vazio">
            <span className="nsl-vazio-icone"><Icone d={ICONES.vazio} size={30} /></span>
            <p className="nsl-vazio-texto">Nenhuma sala ativa no momento.</p>
            <p className="nsl-vazio-apoio">Crie uma sala e compartilhe o código com quem você quiser.</p>
            <button type="button" className="nsl-criar" onClick={aoCriarSala}>
              Criar uma sala
              <Icone d={ICONES.seta} size={16} />
            </button>
          </div>
        )}

        {!carregando && !vazio && salas.length > 0 && (
          <div className="nsl-lista">
            {salas.map((sala) => {
              const status = statusDaSala(sala);
              const quantos = sala.participantes;
              return (
                <div className="nsl-sala" key={sala.codigo}>
                  <div style={{ minWidth: 0 }}>
                    <div className="nsl-codigo">{sala.codigo}</div>
                    <div className="nsl-meta">
                      <span className="nsl-pessoas">
                        <Icone d={ICONES.pessoas} size={14} />
                        {quantos} {quantos === 1 ? 'pessoa' : 'pessoas'}
                        {sala.maxParticipantes ? ` / ${sala.maxParticipantes}` : ''}
                      </span>
                      <span className={`nsl-status ${status.tom}`}>
                        <Icone d={status.icone} size={12} />
                        {status.rotulo}
                      </span>
                    </div>
                  </div>
                  <button type="button" className="nsl-entrar" onClick={() => aoEntrar(sala.codigo)}>
                    Entrar
                    <Icone d={ICONES.seta} size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
