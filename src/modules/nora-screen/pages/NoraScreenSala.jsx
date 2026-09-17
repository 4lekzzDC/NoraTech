import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  NICKNAME_MIN,
  NORA_SCREEN_ROUTE,
  codigoValido,
  iniciaisDe,
  normalizarCodigo,
} from '../constants.js';
import { ACOES, acoesDisponiveis } from '../domain/moderacao.js';
import { MOTIVOS, podeCompartilhar } from '../domain/regrasDaSala.js';
import { STATUS } from '../services/sinalizacao.js';
import { useSalaAoVivo } from '../hooks/useSalaAoVivo.js';

// ═══════════════════════════════════════════════════════════════
// Nora Screen — a sala.
//
// Topo com identidade e estado, barra lateral com o convite e quem está
// na sala, palco no meio para a tela transmitida e uma barra flutuante
// com os controles. A transmissão é real: WebRTC com sinalização pelo
// Realtime do Supabase (ver hooks/useSalaAoVivo.js).
// ═══════════════════════════════════════════════════════════════

const ESTADO_CONEXAO = {
  [STATUS.CONECTANDO]: { rotulo: 'Conectando', tom: 'espera', dica: 'Entrando na sala…' },
  [STATUS.CONECTADO]: { rotulo: 'Conectado', tom: 'ok', dica: 'Sinalização ativa — a sala está sincronizada' },
  [STATUS.RECONECTANDO]: { rotulo: 'Reconectando', tom: 'espera', dica: 'A conexão caiu; tentando restabelecer' },
  [STATUS.ERRO]: { rotulo: 'Sem conexão', tom: 'ruim', dica: 'Não foi possível falar com a sala' },
};

function Icone({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const ICONES = {
  tela: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /></>,
  parar: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M9.5 9.5h5v5h-5z" /><path d="M8.5 21h7" /></>,
  copiar: <><rect x="9" y="9" width="11.5" height="11.5" rx="2.5" /><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" /></>,
  ok: <path d="M20 6 9 17l-5-5" />,
  tela_cheia: <path d="M8 3.5H4.5A1 1 0 0 0 3.5 4.5V8M16 3.5h3.5a1 1 0 0 1 1 1V8M8 20.5H4.5a1 1 0 0 1-1-1V16M16 20.5h3.5a1 1 0 0 0 1-1V16" />,
  sair: <><path d="M15 17l5-5-5-5M20 12H9" /><path d="M12 3.5H5.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5H12" /></>,
  pessoas: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6s6.2 2.5 6.2 5.6" /><path d="M16.4 5.4a3.2 3.2 0 0 1 0 5.2M21.2 19c0-2-.7-3.7-2-4.9" /></>,
  coroa: <path d="M3.5 17.5 5 7l4.5 4L12 5.5 14.5 11 19 7l1.5 10.5z" />,
  som: <><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>,
  mudo: <><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  convite: <><path d="M4 6.5h16v11H4z" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  mais: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  bloqueado: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 6.9-2.8" /></>,
  remover: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6 1 0 2 .2 2.8.6" /><path d="m16 15 5 5M21 15l-5 5" /></>,
};

const ICONES_ACAO = {
  [ACOES.BLOQUEAR]: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></>,
  [ACOES.LIBERAR]: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 6.9-2.8" /></>,
  [ACOES.PARAR]: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M9.5 9.5h5v5h-5z" /><path d="M8.5 21h7" /></>,
  [ACOES.REMOVER]: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c0-3.1 2.8-5.6 6.2-5.6 1 0 2 .2 2.8.6" /><path d="m16 15 5 5M21 15l-5 5" /></>,
};

const AVISO_ACAO = {
  [ACOES.BLOQUEAR]: (nome) => `${nome} não pode mais compartilhar`,
  [ACOES.LIBERAR]: (nome) => `${nome} pode compartilhar de novo`,
  [ACOES.PARAR]: (nome) => `Transmissão de ${nome} encerrada`,
  [ACOES.REMOVER]: (nome) => `${nome} foi removido da sala`,
};

// Avisos curtos no canto — copiar convite, alguém entrando, transmissão
// começando. Somem sozinhos; nenhum deles exige ação.
function useAvisos() {
  const [avisos, setAvisos] = useState([]);
  const proximoId = useRef(0);
  const avisar = useCallback((texto, tom = 'neutro') => {
    proximoId.current += 1;
    const id = proximoId.current;
    setAvisos((atuais) => [...atuais.slice(-2), { id, texto, tom }]);
    setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), 3600);
  }, []);
  return { avisos, avisar };
}

export default function NoraScreenSala() {
  const { codigo: codigoBruto } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const codigo = normalizarCodigo(codigoBruto);
  const codigoOk = codigoValido(codigo);

  // Quem chega por link colado não trouxe nickname da home: pede aqui,
  // antes de entrar na sala de verdade.
  const [nickname, setNickname] = useState(() => state?.nickname?.trim() || '');
  const [rascunho, setRascunho] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [lateralAberta, setLateralAberta] = useState(false);
  const [mudo, setMudo] = useState(true);
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [posMenu, setPosMenu] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [encerrando, setEncerrando] = useState(false);
  const botaoMenuRef = useRef(null);

  const videoRef = useRef(null);
  const palcoRef = useRef(null);
  const { avisos, avisar } = useAvisos();

  const sala = useSalaAoVivo({
    codigo,
    nickname,
    criador: Boolean(state?.criador),
    ativo: codigoOk && Boolean(nickname),
  });
  const {
    eu, status, participantes, host, souHost,
    transmitindo, comAudio, quemTransmite, outroTransmitindo,
    streamRemoto, streamLocal, erro, compartilharTela, pararDeTransmitir,
    bloqueado, removido, moderar,
    regras, souDono, barrado, definirRegrasDaSala, encerrarParaTodos,
  } = sala;

  const conexao = ESTADO_CONEXAO[status] || ESTADO_CONEXAO[STATUS.CONECTANDO];
  const temImagem = Boolean(transmitindo || streamRemoto);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const anterior = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => { html.style.overflow = anterior[0]; body.style.overflow = anterior[1]; };
  }, []);

  // O vídeo mostra o que estou recebendo ou, se sou eu quem transmite, a
  // minha própria captura — sem isso quem compartilha não vê o que enviou.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const fonte = transmitindo ? streamLocal.current : streamRemoto;
    if (el.srcObject !== fonte) el.srcObject = fonte || null;
  }, [transmitindo, streamRemoto, streamLocal, participantes]);

  // O áudio remoto é estado de fora do React: a faixa pode entrar depois do
  // vídeo, ou sumir sozinha. Lido direto da stream, sem cópia em useState
  // que precisaria ser sincronizada.
  const temFaixaDeAudio = useSyncExternalStore(
    useCallback((avisarMudanca) => {
      if (!streamRemoto) return () => {};
      streamRemoto.addEventListener('addtrack', avisarMudanca);
      streamRemoto.addEventListener('removetrack', avisarMudanca);
      return () => {
        streamRemoto.removeEventListener('addtrack', avisarMudanca);
        streamRemoto.removeEventListener('removetrack', avisarMudanca);
      };
    }, [streamRemoto]),
    () => Boolean(streamRemoto && streamRemoto.getAudioTracks().length > 0),
  );
  // Quem transmite nunca ouve a própria captura — seria eco.
  const remotoTemAudio = temFaixaDeAudio && !transmitindo;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !remotoTemAudio || transmitindo) return;
    let cancelado = false;
    (async () => {
      el.muted = false;
      try {
        await el.play();
        if (!cancelado) setMudo(false);
      } catch {
        // Política de autoplay: só com um gesto da pessoa.
        el.muted = true;
        if (!cancelado) setMudo(true);
      }
    })();
    return () => { cancelado = true; };
  }, [remotoTemAudio, transmitindo]);

  const ativarSom = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    try {
      await el.play();
      setMudo(false);
      avisar('Som ativado', 'ok');
    } catch {
      setMudo(true);
    }
  }, [avisar]);

  // ── Avisos de movimento na sala ──
  const anterioresRef = useRef(null);
  useEffect(() => {
    const anteriores = anterioresRef.current;
    anterioresRef.current = participantes;
    // A primeira sincronização é a chegada de todo mundo que já estava lá:
    // anunciá-la seria uma enxurrada de avisos sobre nada.
    if (anteriores === null) return;
    participantes
      .filter((p) => eu && p.id !== eu.id && !anteriores.some((a) => a.id === p.id))
      .forEach((p) => avisar(`${p.nickname} entrou na sala`));
    anteriores
      .filter((a) => eu && a.id !== eu.id && !participantes.some((p) => p.id === a.id))
      .forEach((a) => avisar(`${a.nickname} saiu da sala`));
  }, [participantes, eu, avisar]);

  const transmissorAnteriorRef = useRef(null);
  useEffect(() => {
    const antes = transmissorAnteriorRef.current;
    const agora = quemTransmite?.id || null;
    transmissorAnteriorRef.current = agora;
    if (antes === agora || !eu) return;
    if (agora && agora !== eu.id) avisar(`${quemTransmite.nickname} começou a compartilhar`, 'ok');
    if (!agora && antes && antes !== eu.id) avisar('A transmissão foi encerrada');
  }, [quemTransmite, eu, avisar]);

  const posicionarMenu = useCallback(() => {
    const el = botaoMenuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Ancorado pela direita, não por translateX: a animação de entrada anima
    // `transform`, e uma keyframe sobrescreve o transform do style inline.
    // Abre para baixo; perto do rodapé, abre para cima.
    setPosMenu({
      direita: window.innerWidth - r.right,
      y: r.bottom + 6,
      deBaixo: window.innerHeight - r.top + 6,
      acima: r.bottom + 270 > window.innerHeight,
    });
  }, []);

  useEffect(() => {
    if (!menuAberto) return undefined;
    // pointerdown, e não click: o React trata o clique de forma síncrona e
    // já re-renderizou quando o evento chega aqui. O alvo clicado pode ter
    // saído do DOM, e aí `closest` não acha mais o menu — o clique dentro
    // era lido como clique fora e fechava tudo.
    const aoApontar = (e) => {
      if (!e.target.closest?.('.nss-menu') && !e.target.closest?.('.nss-mais')) {
        setMenuAberto(null);
        setConfirmando(null);
      }
    };
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      setMenuAberto(null);
      setConfirmando(null);
    };
    // Fixo no viewport, o menu não acompanha sozinho a rolagem da lista:
    // reposiciona em vez de fechar. Fechar era pior do que parece — clicar
    // num item dá foco ao botão, o navegador rola a lista para trazê-lo à
    // vista, e o menu se fechava sozinho no meio da ação.
    const lista = document.querySelector('.nss-lista');
    window.addEventListener('pointerdown', aoApontar);
    window.addEventListener('keydown', aoTeclar);
    window.addEventListener('resize', posicionarMenu);
    lista?.addEventListener('scroll', posicionarMenu);
    return () => {
      window.removeEventListener('pointerdown', aoApontar);
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('resize', posicionarMenu);
      lista?.removeEventListener('scroll', posicionarMenu);
    };
  }, [menuAberto, posicionarMenu]);

  // Removido pelo host: avisa e devolve à entrada.
  useEffect(() => {
    if (!removido && !regras.encerrada) return undefined;
    const t = setTimeout(() => navigate(NORA_SCREEN_ROUTE), 3200);
    return () => clearTimeout(t);
  }, [removido, regras.encerrada, navigate]);

  useEffect(() => {
    const aoTrocar = () => setEmTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', aoTrocar);
    return () => document.removeEventListener('fullscreenchange', aoTrocar);
  }, []);

  const copiarConvite = useCallback(async () => {
    const link = `${window.location.origin}${NORA_SCREEN_ROUTE}/sala/${codigo}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Sem permissão de área de transferência (http, permissão negada):
      // seleciona num campo temporário para a pessoa copiar à mão.
      const campo = document.createElement('textarea');
      campo.value = link;
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      try { document.execCommand('copy'); } catch { /* resta o Ctrl+C */ }
      document.body.removeChild(campo);
    }
    setCopiado(true);
    avisar('Link do convite copiado', 'ok');
    setTimeout(() => setCopiado(false), 2200);
  }, [codigo, avisar]);

  const alternarTelaCheia = useCallback(() => {
    const alvo = palcoRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else alvo.requestFullscreen?.();
  }, []);

  const iniciarTransmissao = useCallback(async () => {
    await compartilharTela();
  }, [compartilharTela]);

  const encerrarTransmissao = useCallback(() => {
    pararDeTransmitir();
    avisar('Você parou de compartilhar');
  }, [pararDeTransmitir, avisar]);

  // Avisa quando a minha própria transmissão entra no ar — inclusive
  // dizendo se o áudio veio junto, que é o que a pessoa quer saber.
  const euTransmitiaRef = useRef(false);
  useEffect(() => {
    if (transmitindo && !euTransmitiaRef.current) {
      avisar(comAudio ? 'Transmitindo com áudio' : 'Transmitindo — sem áudio', 'ok');
    }
    euTransmitiaRef.current = transmitindo;
  }, [transmitindo, comAudio, avisar]);

  const aplicarModeracao = useCallback((alvo, acao) => {
    if (!moderar(alvo.id, acao)) return;
    avisar(AVISO_ACAO[acao](alvo.nickname), acao === ACOES.LIBERAR ? 'ok' : 'neutro');
    setMenuAberto(null);
    setConfirmando(null);
  }, [moderar, avisar]);

  const sair = useCallback(() => {
    if (transmitindo) pararDeTransmitir();
    navigate(NORA_SCREEN_ROUTE);
  }, [navigate, pararDeTransmitir, transmitindo]);

  const audioNoAr = transmitindo ? comAudio : (remotoTemAudio && !mudo);
  const permissao = podeCompartilhar({
    regras,
    souHost: souDono,
    bloqueadoIndividualmente: bloqueado,
    outroTransmitindo,
  });
  const naoPodeCompartilhar = !permissao.pode;
  const motivoSemCompartilhar = permissao.motivo === 'ocupado'
    ? `${quemTransmite?.nickname} está compartilhando agora`
    : (MOTIVOS[permissao.motivo] || null);
  // A sala encerrada e a entrada barrada usam a mesma porta de saída.
  const saidaForcada = regras.encerrada
    ? { titulo: 'A sala foi encerrada pelo host', texto: 'Voltando ao Nora Screen…' }
    : (barrado === 'entradas-bloqueadas'
      ? { titulo: 'Entradas bloqueadas', texto: 'O host bloqueou novas entradas nesta sala. Peça para ele liberar e tente de novo.' }
      : null);

  return (
    <div className="nss-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

        .nss-page {
          --nss-violet: #7C3AED;
          --nss-violet-soft: #a78bfa;
          --nss-azul: #3b82f6;
          --nss-verde: #22c55e;
          --nss-bg: #04040a;
          --nss-fg: #f4f3f7;
          --nss-muted: rgba(255,255,255,0.5);
          --nss-line: rgba(255,255,255,0.09);
          --nss-painel: rgba(13,12,22,0.74);

          position: fixed; inset: 0; overflow: hidden;
          background: var(--nss-bg); color: var(--nss-fg);
          font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
          display: grid; grid-template-rows: auto minmax(0, 1fr);
        }
        .nss-page *, .nss-page *::before, .nss-page *::after { box-sizing: border-box; }
        html[data-theme="light"] .nss-page .nss-input { color: var(--nss-fg); }
        html[data-theme="light"] .nss-page strong { color: var(--nss-violet-soft) !important; }

        .nss-fundo { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .nss-fundo::before, .nss-fundo::after {
          content: ''; position: absolute; border-radius: 50%; filter: blur(90px);
          transition: opacity 0.8s ease;
        }
        .nss-fundo::before {
          width: 55vw; height: 55vw; max-width: 780px; max-height: 780px;
          top: -22%; left: -10%;
          background: radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 68%);
        }
        .nss-fundo::after {
          width: 48vw; height: 48vw; max-width: 700px; max-height: 700px;
          bottom: -26%; right: -8%;
          background: radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%);
        }
        /* Ao vivo, o fundo recua: o palco é que tem de brilhar. */
        .nss-page.aovivo .nss-fundo::before,
        .nss-page.aovivo .nss-fundo::after { opacity: 0.4; }

        /* ══════════ DICAS ══════════ */
        [data-dica] { position: relative; }
        [data-dica]::after {
          content: attr(data-dica);
          position: absolute; bottom: calc(100% + 10px); left: 50%;
          transform: translateX(-50%) translateY(4px);
          padding: 7px 11px; border-radius: 9px; white-space: nowrap;
          background: rgba(16,15,26,0.96); border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
          font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.86);
          opacity: 0; pointer-events: none; z-index: 30;
          transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1);
        }
        [data-dica]:hover::after, [data-dica]:focus-visible::after { opacity: 1; transform: translateX(-50%) translateY(0); }
        [data-dica-baixo]::after { bottom: auto; top: calc(100% + 10px); }

        /* ══════════ TOPO ══════════ */
        .nss-topo {
          position: relative; z-index: 3;
          display: flex; align-items: center; gap: 12px;
          padding: 13px clamp(14px, 2.4vw, 26px);
          border-bottom: 1px solid var(--nss-line);
          background: rgba(8,8,14,0.74);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        }
        .nss-marca { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .nss-marca-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(167,139,250,0.28);
          color: var(--nss-violet-soft);
        }
        .nss-marca-nome { font-weight: 800; font-size: 0.98rem; letter-spacing: -0.3px; white-space: nowrap; }
        .nss-marca-nome span {
          background: linear-gradient(100deg, var(--nss-violet-soft), var(--nss-azul));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        .nss-chip {
          display: inline-flex; align-items: center; gap: 8px;
          height: 34px; padding: 0 13px; border-radius: 100px;
          background: rgba(255,255,255,0.045); border: 1px solid var(--nss-line);
          font-size: 0.82rem; color: rgba(255,255,255,0.74); white-space: nowrap;
          font-family: inherit;
        }
        .nss-page button.nss-chip { cursor: pointer; transition: background 0.25s ease, border-color 0.25s ease; }
        .nss-page button.nss-chip:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); }
        .nss-chip.codigo {
          font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: 1.6px;
          background: rgba(124,58,237,0.1); border-color: rgba(167,139,250,0.22); color: #e2d8ff;
        }
        .nss-chip svg { color: var(--nss-violet-soft); }
        .nss-topo-dir { margin-left: auto; display: flex; align-items: center; gap: 9px; }

        .nss-ponto {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: var(--nss-verde); box-shadow: 0 0 10px rgba(34,197,94,0.9);
        }
        .nss-status .nss-ponto { animation: nss-pulsar 2.6s ease-in-out infinite; }
        .nss-status.espera .nss-ponto { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.9); }
        .nss-status.ruim .nss-ponto { background: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.9); animation: none; }
        .nss-status.espera { color: #fcd9a0; border-color: rgba(245,158,11,0.26); background: rgba(245,158,11,0.09); }
        .nss-status.ruim { color: #fca5a5; border-color: rgba(239,68,68,0.28); background: rgba(239,68,68,0.1); }
        .nss-status.ok { color: #9ff0b8; border-color: rgba(34,197,94,0.26); background: rgba(34,197,94,0.09); }
        @keyframes nss-pulsar { 0%,100% { opacity: 1; } 50% { opacity: 0.32; } }

        /* ══════════ CORPO ══════════ */
        .nss-corpo {
          position: relative; z-index: 2; min-height: 0;
          display: grid; grid-template-columns: 286px minmax(0, 1fr);
          gap: clamp(12px, 1.4vw, 18px);
          padding: clamp(12px, 1.6vw, 20px);
          transition: grid-template-columns 0.5s cubic-bezier(0.16,1,0.3,1);
        }

        /* ── Lateral ── */
        .nss-lateral {
          min-height: 0; display: flex; flex-direction: column; gap: 16px;
          padding: 18px; border-radius: 20px;
          background: var(--nss-painel); border: 1px solid var(--nss-line);
          backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .nss-secao { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .nss-rotulo {
          font-family: 'JetBrains Mono', monospace; font-size: 0.62rem;
          font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }
        .nss-contagem {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 22px; height: 20px; padding: 0 7px; border-radius: 100px;
          background: rgba(167,139,250,0.16); border: 1px solid rgba(167,139,250,0.26);
          font-size: 0.7rem; font-weight: 700; color: #ddd0ff;
        }
        .nss-codigo-grande {
          margin-top: 9px; padding: 13px; border-radius: 14px; text-align: center;
          font-family: 'JetBrains Mono', monospace; font-size: 1.16rem; font-weight: 700; letter-spacing: 3.5px;
          background: linear-gradient(140deg, rgba(124,58,237,0.16), rgba(59,130,246,0.1));
          border: 1px solid rgba(167,139,250,0.26); color: #ece5ff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .nss-page .nss-copiar {
          width: 100%; height: 46px; margin-top: 10px;
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border-radius: 13px; cursor: pointer; font-family: inherit;
          font-size: 0.88rem; font-weight: 600;
          background: rgba(255,255,255,0.05); border: 1px solid var(--nss-line); color: var(--nss-fg);
          transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .nss-page .nss-copiar:hover { background: rgba(124,58,237,0.18); border-color: rgba(167,139,250,0.45); transform: translateY(-1px); }
        .nss-page .nss-copiar.feito {
          background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.42); color: #86efac;
        }
        .nss-copiar svg { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .nss-copiar.feito svg { transform: scale(1.15); }

        .nss-lista {
          min-height: 0; overflow-y: auto; margin: 9px -6px 0; padding: 0 6px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent;
        }
        .nss-lista::-webkit-scrollbar { width: 5px; }
        .nss-lista::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }

        .nss-pessoa {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 10px; border-radius: 13px;
          border: 1px solid transparent;
          animation: nss-entrou 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nss-entrou {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .nss-pessoa + .nss-pessoa { margin-top: 3px; }
        .nss-pessoa.eu { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
        .nss-pessoa.transmitindo { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.24); }
        .nss-avatar {
          position: relative; flex-shrink: 0;
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.78rem; font-weight: 800; color: #fff;
          background: linear-gradient(140deg, #8b5cf6, #4f46e5);
          border: 1px solid rgba(167,139,250,0.42);
        }
        .nss-avatar.transmite {
          background: linear-gradient(140deg, #22c55e, #0ea5e9);
          border-color: rgba(34,197,94,0.55);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.14);
        }
        .nss-avatar::after {
          content: ''; position: absolute; right: -1px; bottom: -1px;
          width: 11px; height: 11px; border-radius: 50%;
          background: var(--nss-verde); border: 2.5px solid #0c0b14;
        }
        .nss-pessoa-nome {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.88rem; font-weight: 600; min-width: 0;
        }
        .nss-pessoa-nome b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        .nss-voce {
          flex-shrink: 0; padding: 1px 6px; border-radius: 5px;
          background: rgba(255,255,255,0.1); font-size: 0.62rem; font-weight: 700;
          letter-spacing: 0.4px; color: rgba(255,255,255,0.6);
        }
        .nss-pessoa-papel {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.73rem; color: rgba(255,255,255,0.42); margin-top: 2px;
        }
        .nss-pessoa-papel.host { color: #e8c98a; }
        .nss-selo-audio {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.32); color: #86efac;
        }
        .nss-onda {
          margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: flex-end; gap: 2.5px; height: 15px;
        }
        .nss-onda i {
          width: 2.5px; border-radius: 2px; background: #86efac;
          animation: nss-oscilar 1.1s ease-in-out infinite;
        }
        .nss-onda i:nth-child(1) { height: 6px; animation-delay: -0.2s; }
        .nss-onda i:nth-child(2) { height: 14px; animation-delay: -0.5s; }
        .nss-onda i:nth-child(3) { height: 9px; }
        @keyframes nss-oscilar { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }

        /* ── Controles gerais da sala ── */
        .nss-controles-sala {
          padding: 14px; border-radius: 15px;
          background: rgba(124,58,237,0.07); border: 1px solid rgba(167,139,250,0.2);
        }
        .nss-regra {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 9px 0; cursor: pointer;
        }
        .nss-regra + .nss-regra { border-top: 1px solid rgba(255,255,255,0.06); }
        .nss-regra span { font-size: 0.83rem; font-weight: 600; color: rgba(255,255,255,0.84); }
        .nss-regra small {
          display: block; font-size: 0.72rem; font-weight: 400;
          color: rgba(255,255,255,0.42); margin-top: 2px;
        }
        /* Chave: um checkbox desenhado, para não depender do visual do SO. */
        .nss-page .nss-chave {
          appearance: none; -webkit-appearance: none;
          position: relative; flex-shrink: 0;
          width: 40px; height: 23px; border-radius: 100px; cursor: pointer;
          background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.14);
          transition: background 0.26s ease, border-color 0.26s ease;
        }
        .nss-page .nss-chave::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 17px; height: 17px; border-radius: 50%;
          background: rgba(255,255,255,0.72);
          transition: transform 0.26s cubic-bezier(0.34,1.56,0.64,1), background 0.26s ease;
        }
        .nss-page .nss-chave:checked {
          background: linear-gradient(100deg, #7C3AED, #3b82f6); border-color: rgba(167,139,250,0.55);
        }
        .nss-page .nss-chave:checked::after { transform: translateX(17px); background: #fff; }
        .nss-page .nss-chave:focus-visible { outline: 2px solid var(--nss-violet-soft); outline-offset: 2px; }

        .nss-page .nss-encerrar {
          width: 100%; height: 42px; margin-top: 12px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 12px; cursor: pointer; font-family: inherit;
          font-size: 0.83rem; font-weight: 600;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5;
          transition: background 0.25s ease, border-color 0.25s ease;
        }
        .nss-page .nss-encerrar:hover { background: rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.5); }
        .nss-encerrar-confirma { margin-top: 12px; }
        .nss-encerrar-confirma p {
          margin: 0 0 10px; font-size: 0.78rem; line-height: 1.45; color: rgba(255,255,255,0.64);
        }
        .nss-encerrar-confirma .nss-menu-botoes { display: flex; gap: 7px; }
        .nss-page .nss-encerrar-confirma .nss-menu-botao {
          flex: 1; height: 34px; border-radius: 9px; cursor: pointer;
          font-family: inherit; font-size: 0.8rem; font-weight: 700;
          border: 1px solid rgba(255,255,255,0.13); background: rgba(255,255,255,0.05); color: var(--nss-fg);
        }
        .nss-page .nss-encerrar-confirma .nss-menu-botao.perigo {
          background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.4); color: #fecaca;
        }

        /* ── Moderação ── */
        .nss-pessoa { position: relative; }
        .nss-pessoa-acoes { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .nss-page .nss-mais {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
          background: transparent; border: 1px solid transparent; cursor: pointer;
          color: rgba(255,255,255,0.42); opacity: 0;
          transition: opacity 0.22s ease, background 0.22s ease, color 0.22s ease;
        }
        .nss-pessoa:hover .nss-mais,
        .nss-page .nss-mais:focus-visible,
        .nss-page .nss-mais[aria-expanded="true"] { opacity: 1; }
        .nss-page .nss-mais:hover,
        .nss-page .nss-mais[aria-expanded="true"] {
          background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.12); color: var(--nss-fg);
        }
        /* Fixo e renderizado em portal no body. Absoluto sairia recortado
           pela lista rolável; e fixo dentro da lateral também não resolve,
           porque o backdrop-filter dela cria bloco de contenção e faz as
           coordenadas do viewport valerem a partir da lateral, não da tela. */
        .nss-menu {
          position: fixed; z-index: 24;
          min-width: 216px; padding: 6px; border-radius: 14px;
          font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
          background: rgba(17,16,28,0.97); border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 22px 54px rgba(0,0,0,0.66);
          animation: nss-menu-entra 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nss-menu-entra { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .nss-menu, .nss-menu * { box-sizing: border-box; }
        /* O menu vive no body, fora de .nss-page: a regra global de tema
           claro do index.css volta a alcançá-lo e pintaria o nome de preto
           sobre o painel escuro. */
        html[data-theme="light"] .nss-menu strong { color: #d8ccff !important; }
        .nss-menu-topo {
          padding: 7px 10px 8px; margin-bottom: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 0.74rem; color: rgba(255,255,255,0.42);
        }
        .nss-menu-topo b { display: block; color: rgba(255,255,255,0.8); font-size: 0.82rem; font-weight: 600; }
        .nss-menu .nss-menu-item {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 9px 10px; border-radius: 10px; border: none; background: none;
          font-family: inherit; font-size: 0.83rem; font-weight: 500; text-align: left;
          color: rgba(255,255,255,0.78); cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .nss-menu .nss-menu-item:hover { background: rgba(255,255,255,0.08); color: var(--nss-fg); }
        .nss-menu .nss-menu-item.destrutiva { color: #fca5a5; }
        .nss-menu .nss-menu-item.destrutiva:hover { background: rgba(239,68,68,0.16); color: #fecaca; }
        .nss-menu-confirma { padding: 9px 10px 5px; }
        .nss-menu-confirma p { margin: 0 0 10px; font-size: 0.79rem; line-height: 1.45; color: rgba(255,255,255,0.64); }
        .nss-menu-botoes { display: flex; gap: 7px; }
        .nss-menu .nss-menu-botao {
          flex: 1; height: 34px; border-radius: 9px; cursor: pointer;
          font-family: inherit; font-size: 0.8rem; font-weight: 700;
          border: 1px solid rgba(255,255,255,0.13); background: rgba(255,255,255,0.05); color: var(--nss-fg);
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .nss-menu .nss-menu-botao:hover { background: rgba(255,255,255,0.1); }
        .nss-menu .nss-menu-botao.perigo {
          background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.4); color: #fecaca;
        }
        .nss-menu .nss-menu-botao.perigo:hover { background: rgba(239,68,68,0.3); }

        .nss-selo-bloqueio {
          flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5;
        }
        .nss-pessoa.bloqueada .nss-avatar { filter: grayscale(0.5) brightness(0.82); }
        .nss-pessoa.bloqueada .nss-pessoa-nome b { color: rgba(255,255,255,0.62); }

        .nss-aviso-bloqueio {
          display: flex; align-items: center; gap: 9px;
          margin-top: 16px; padding: 11px 14px; border-radius: 12px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.28);
          font-size: 0.83rem; line-height: 1.45; color: #fca5a5; text-align: left;
        }
        .nss-aviso-bloqueio svg { flex-shrink: 0; }

        .nss-vazio-lista {
          padding: 14px 10px; font-size: 0.8rem; color: rgba(255,255,255,0.34);
        }

        /* ── Palco ── */
        .nss-palco {
          position: relative; min-height: 0; border-radius: 20px; overflow: hidden;
          background: radial-gradient(ellipse 70% 60% at 50% 40%, rgba(124,58,237,0.09) 0%, rgba(6,6,12,0.9) 70%);
          border: 1px solid var(--nss-line);
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.6s ease, box-shadow 0.6s ease;
        }
        .nss-palco.aovivo {
          border-color: rgba(34,197,94,0.3);
          box-shadow: 0 0 0 1px rgba(34,197,94,0.14), 0 0 70px -20px rgba(34,197,94,0.35), 0 30px 80px -40px rgba(0,0,0,0.9);
          background: #000;
        }
        .nss-palco video {
          width: 100%; height: 100%; object-fit: contain; background: #000; display: block;
          animation: nss-surgir 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nss-surgir { from { opacity: 0; transform: scale(0.99); } to { opacity: 1; transform: scale(1); } }

        /* ── Estado vazio ── */
        .nss-vazio { text-align: center; padding: 30px; max-width: 460px; }
        .nss-vazio-icone {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          width: 76px; height: 76px; border-radius: 24px; margin-bottom: 22px;
          background: linear-gradient(150deg, rgba(124,58,237,0.16), rgba(59,130,246,0.1));
          border: 1px solid rgba(167,139,250,0.28); color: var(--nss-violet-soft);
        }
        .nss-vazio-icone::before {
          content: ''; position: absolute; inset: -10px; border-radius: 30px;
          border: 1px solid rgba(167,139,250,0.16);
          animation: nss-respirar 4.5s ease-in-out infinite;
        }
        @keyframes nss-respirar {
          0%,100% { transform: scale(1); opacity: 0.5; }
          50%     { transform: scale(1.08); opacity: 1; }
        }
        .nss-vazio-titulo { font-size: 1.18rem; font-weight: 700; letter-spacing: -0.4px; margin: 0 0 9px; }
        .nss-vazio-texto { font-size: 0.89rem; line-height: 1.6; color: var(--nss-muted); margin: 0 0 24px; }
        .nss-vazio-acoes { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

        .nss-page .nss-principal {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          height: 50px; padding: 0 26px; border-radius: 14px; cursor: pointer;
          border: none; font-family: inherit; font-size: 0.94rem; font-weight: 700; color: #fff;
          background: linear-gradient(100deg, #7C3AED 0%, #6d5cf6 52%, #3b82f6 100%);
          box-shadow: 0 18px 38px -18px rgba(99,72,246,0.95);
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s ease, filter 0.28s ease;
        }
        .nss-page .nss-principal:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.07); }
        .nss-page .nss-principal:disabled { opacity: 0.5; cursor: not-allowed; }
        .nss-page .nss-fantasma {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          height: 50px; padding: 0 22px; border-radius: 14px; cursor: pointer;
          font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--nss-fg);
          background: rgba(255,255,255,0.045); border: 1px solid var(--nss-line);
          transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .nss-page .nss-fantasma:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
        .nss-page .nss-fantasma.feito { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.4); color: #86efac; }

        /* ── Distintivos no palco ── */
        .nss-palco-topo {
          position: absolute; top: 14px; left: 14px; right: 14px; z-index: 2;
          display: flex; align-items: flex-start; gap: 9px; pointer-events: none;
        }
        .nss-palco-topo > * { pointer-events: auto; }
        .nss-aovivo {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 8px 14px; border-radius: 100px;
          background: rgba(8,8,14,0.74); border: 1px solid rgba(34,197,94,0.4);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          font-size: 0.78rem; font-weight: 700; color: #9ff0b8;
        }
        .nss-aovivo .nss-ponto { animation: nss-pulsar 1.8s ease-in-out infinite; }
        .nss-selo-palco {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 13px; border-radius: 100px;
          background: rgba(8,8,14,0.74); border: 1px solid var(--nss-line);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          font-size: 0.76rem; font-weight: 600; color: rgba(255,255,255,0.74);
        }
        .nss-selo-palco.audio { border-color: rgba(34,197,94,0.36); color: #9ff0b8; }
        .nss-page .nss-ativar-som {
          margin-left: auto; cursor: pointer; font-family: inherit;
          background: rgba(124,58,237,0.24); border-color: rgba(167,139,250,0.5); color: #eee7ff;
          transition: background 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
          animation: nss-chamar 2.4s ease-in-out infinite;
        }
        .nss-page .nss-ativar-som:hover { background: rgba(124,58,237,0.4); transform: translateY(-1px); }
        @keyframes nss-chamar {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
          50%     { box-shadow: 0 0 0 6px rgba(124,58,237,0.16); }
        }

        /* ── Barra de controles ── */
        .nss-controles {
          position: absolute; left: 50%; bottom: clamp(16px, 3vh, 26px);
          transform: translateX(-50%); z-index: 6;
          display: flex; align-items: center; gap: 7px;
          padding: 8px; border-radius: 100px;
          background: rgba(10,10,18,0.86); border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: blur(24px) saturate(1.4);
          box-shadow: 0 20px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .nss-divisor { width: 1px; height: 26px; background: rgba(255,255,255,0.1); margin: 0 3px; flex-shrink: 0; }
        .nss-page .nss-controle {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          height: 46px; min-width: 46px; padding: 0 16px; border-radius: 100px;
          border: 1px solid transparent; background: rgba(255,255,255,0.05);
          color: var(--nss-fg); font-family: inherit; font-size: 0.86rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .nss-page .nss-controle:hover:not(:disabled) { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
        .nss-page .nss-controle:disabled { opacity: 0.4; cursor: not-allowed; }
        .nss-page .nss-controle.primario {
          background: linear-gradient(100deg, #7C3AED, #3b82f6); color: #fff;
          box-shadow: 0 12px 28px -12px rgba(99,72,246,0.95);
        }
        .nss-page .nss-controle.encerrar {
          background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.4); color: #9ff0b8;
        }
        .nss-page .nss-controle.encerrar:hover { background: rgba(34,197,94,0.26); }
        .nss-page .nss-controle.ativo { background: rgba(167,139,250,0.2); border-color: rgba(167,139,250,0.42); color: #e5dcff; }
        .nss-page .nss-controle.perigo {
          background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.32); color: #fca5a5;
        }
        .nss-page .nss-controle.perigo:hover { background: rgba(239,68,68,0.26); }
        .nss-controle-rotulo { display: inline; }
        .nss-controle .nss-onda i { background: currentColor; }

        /* ── Avisos ── */
        .nss-avisos {
          position: absolute; right: clamp(14px, 2vw, 24px); bottom: clamp(88px, 12vh, 104px);
          z-index: 8; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
          pointer-events: none;
        }
        .nss-aviso {
          display: flex; align-items: center; gap: 9px;
          padding: 11px 15px; border-radius: 13px; max-width: min(84vw, 340px);
          background: rgba(14,13,24,0.94); border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 44px rgba(0,0,0,0.6);
          font-size: 0.84rem; font-weight: 500; color: rgba(255,255,255,0.88);
          animation: nss-aviso-entra 0.36s cubic-bezier(0.16,1,0.3,1) both;
        }
        .nss-aviso.ok { border-color: rgba(34,197,94,0.32); color: #c9f5d8; }
        .nss-aviso-ponto { width: 7px; height: 7px; border-radius: 50%; background: var(--nss-violet-soft); flex-shrink: 0; }
        .nss-aviso.ok .nss-aviso-ponto { background: var(--nss-verde); }
        @keyframes nss-aviso-entra {
          from { opacity: 0; transform: translateX(16px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        .nss-erro {
          position: absolute; left: 50%; transform: translateX(-50%);
          bottom: calc(clamp(16px, 3vh, 26px) + 66px); z-index: 7;
          display: flex; align-items: center; gap: 9px; max-width: min(92vw, 520px);
          padding: 11px 15px; border-radius: 12px;
          background: rgba(30,8,8,0.92); border: 1px solid rgba(239,68,68,0.36);
          font-size: 0.83rem; line-height: 1.45; color: #fca5a5;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        }

        /* ── Portinha ── */
        .nss-porta {
          position: fixed; inset: 0; z-index: 20;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background: rgba(4,4,10,0.88);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        .nss-porta-cartao {
          width: min(100%, 420px); padding: 34px 28px; border-radius: 24px; text-align: center;
          background: linear-gradient(158deg, rgba(30,26,52,0.74) 0%, rgba(10,10,18,0.88) 100%);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 48px 100px -34px rgba(0,0,0,0.92), 0 0 80px -34px rgba(124,58,237,0.45);
          animation: nss-porta-entra 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes nss-porta-entra { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
        .nss-porta-icone {
          display: inline-flex; align-items: center; justify-content: center;
          width: 54px; height: 54px; border-radius: 17px; margin-bottom: 18px;
          background: rgba(124,58,237,0.14); border: 1px solid rgba(167,139,250,0.3);
          color: var(--nss-violet-soft);
        }
        .nss-porta-titulo { font-size: 1.28rem; font-weight: 800; letter-spacing: -0.6px; margin: 0 0 8px; }
        .nss-porta-texto { font-size: 0.9rem; line-height: 1.55; color: var(--nss-muted); margin: 0 0 22px; }
        .nss-page .nss-input {
          width: 100%; height: 50px; padding: 0 16px; border-radius: 14px; text-align: center;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.13);
          color: var(--nss-fg); font-family: inherit; font-size: 0.95rem; outline: none;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .nss-page .nss-input::placeholder { color: rgba(255,255,255,0.3); }
        .nss-page .nss-input:focus {
          border-color: rgba(124,58,237,0.75); background: rgba(124,58,237,0.09);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.16);
        }
        .nss-porta .nss-principal { width: 100%; margin-top: 12px; }
        .nss-page .nss-porta-voltar {
          display: inline-block; margin-top: 16px; font-size: 0.84rem;
          color: rgba(255,255,255,0.46); text-decoration: none; transition: color 0.25s ease;
        }
        .nss-page .nss-porta-voltar:hover { color: var(--nss-violet-soft); }

        .nss-page .nss-lateral-toggle { display: none; }

        /* ══════════ RESPONSIVO ══════════ */
        @media (max-width: 1080px) { .nss-corpo { grid-template-columns: 250px minmax(0, 1fr); } }

        @media (max-width: 860px) {
          .nss-corpo { grid-template-columns: minmax(0, 1fr); }
          /* A lateral vira gaveta: numa tela pequena o palco é o que
             importa, e a lista de participantes vira consulta pontual. */
          .nss-lateral {
            position: fixed; z-index: 12; top: 66px; left: 12px; right: 12px;
            max-height: min(62vh, 460px);
            box-shadow: 0 30px 70px rgba(0,0,0,0.72);
            animation: nss-gaveta 0.32s cubic-bezier(0.16,1,0.3,1) both;
          }
          @keyframes nss-gaveta { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
          .nss-lateral.fechada { display: none; }
          .nss-page .nss-lateral-toggle { display: inline-flex; }
          .nss-chip.participantes { display: none; }
          .nss-controle-rotulo { display: none; }
          .nss-page .nss-controle { padding: 0 14px; }
          .nss-page .nss-controle.primario, .nss-page .nss-controle.encerrar { padding: 0 18px; }
          .nss-page .nss-controle.primario .nss-controle-rotulo,
          .nss-page .nss-controle.encerrar .nss-controle-rotulo { display: inline; }
          .nss-avisos { bottom: calc(clamp(16px, 3vh, 26px) + 74px); left: 12px; right: 12px; align-items: stretch; }
          .nss-aviso { max-width: none; }
          [data-dica]::after { display: none; }
        }

        @media (max-width: 560px) {
          .nss-marca-nome { display: none; }
          .nss-topo { gap: 9px; padding: 11px 13px; }
          .nss-vazio-icone { width: 62px; height: 62px; border-radius: 19px; margin-bottom: 16px; }
          .nss-vazio-titulo { font-size: 1.04rem; }
          .nss-vazio-texto { font-size: 0.85rem; margin-bottom: 18px; }
          .nss-vazio-acoes { flex-direction: column; }
          .nss-page .nss-principal, .nss-page .nss-fantasma { width: 100%; }
          .nss-palco-topo { top: 10px; left: 10px; right: 10px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nss-page *, .nss-page *::before, .nss-page *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div className="nss-fundo" aria-hidden="true" />

      {/* ═══ TOPO ═══ */}
      <header className="nss-topo">
        <div className="nss-marca">
          <span className="nss-marca-icone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2.5" y="5" width="12" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.8" opacity="0.55" />
              <rect x="9" y="9.5" width="12.5" height="9.5" rx="2.5" fill="rgba(124,58,237,0.22)" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="nss-marca-nome">Nora <span>Screen</span></span>
        </div>

        <span className="nss-chip codigo" data-dica="Código desta sala" data-dica-baixo>{codigo}</span>

        <div className="nss-topo-dir">
          {audioNoAr && (
            <span className="nss-chip nss-status ok" data-dica={transmitindo ? 'Você está enviando áudio' : 'Áudio da transmissão ativo'} data-dica-baixo>
              <Icone d={ICONES.som} size={14} />
              Áudio
            </span>
          )}
          <span className="nss-chip participantes" data-dica="Pessoas na sala" data-dica-baixo>
            <Icone d={ICONES.pessoas} size={15} />
            {participantes.length} {participantes.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
          <span className={`nss-chip nss-status ${conexao.tom}`} data-dica={conexao.dica} data-dica-baixo>
            <span className="nss-ponto" />
            {conexao.rotulo}
          </span>
          <button
            type="button"
            className="nss-chip nss-lateral-toggle"
            onClick={() => setLateralAberta((v) => !v)}
            aria-expanded={lateralAberta}
            aria-label="Participantes e convite"
          >
            <Icone d={ICONES.pessoas} size={15} />
            {participantes.length}
          </button>
        </div>
      </header>

      {/* ═══ CORPO ═══ */}
      <div className="nss-corpo">
        <aside className={`nss-lateral ${lateralAberta ? '' : 'fechada'}`}>
          <div>
            <div className="nss-secao">
              <span className="nss-rotulo">Convite</span>
            </div>
            <div className="nss-codigo-grande">{codigo}</div>
            <button
              type="button"
              className={`nss-copiar ${copiado ? 'feito' : ''}`}
              onClick={copiarConvite}
              data-dica="Copia o link para entrar nesta sala"
            >
              <Icone d={copiado ? ICONES.ok : ICONES.copiar} size={16} />
              {copiado ? 'Link copiado' : 'Copiar convite'}
            </button>
          </div>

          {souDono && (
            <div className="nss-controles-sala">
              <div className="nss-secao">
                <span className="nss-rotulo">Controles da sala</span>
              </div>

              <label className="nss-regra">
                <span>
                  Bloquear novas entradas
                  <small>Ninguém mais entra com o código</small>
                </span>
                <input
                  type="checkbox"
                  className="nss-chave"
                  checked={regras.entradasBloqueadas}
                  onChange={async (e) => {
                    const valor = e.target.checked;
                    if (await definirRegrasDaSala({ entradasBloqueadas: valor })) {
                      avisar(valor ? 'Novas entradas bloqueadas' : 'Entradas liberadas', valor ? 'neutro' : 'ok');
                    }
                  }}
                />
              </label>

              <label className="nss-regra">
                <span>
                  Somente host compartilha
                  <small>Só você pode transmitir a tela</small>
                </span>
                <input
                  type="checkbox"
                  className="nss-chave"
                  checked={regras.somenteHostCompartilha}
                  onChange={async (e) => {
                    const valor = e.target.checked;
                    if (await definirRegrasDaSala({ somenteHostCompartilha: valor })) {
                      avisar(valor ? 'Só você pode compartilhar agora' : 'Todos podem compartilhar', valor ? 'neutro' : 'ok');
                    }
                  }}
                />
              </label>

              {encerrando ? (
                <div className="nss-encerrar-confirma">
                  <p>Encerrar a sala para todos? Todo mundo volta ao Nora Screen e o código deixa de valer.</p>
                  <div className="nss-menu-botoes">
                    <button type="button" className="nss-menu-botao" onClick={() => setEncerrando(false)}>Cancelar</button>
                    <button type="button" className="nss-menu-botao perigo" onClick={() => encerrarParaTodos()}>Encerrar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="nss-encerrar" onClick={() => setEncerrando(true)}>
                  <Icone d={ICONES.sair} size={16} />
                  Encerrar sala para todos
                </button>
              )}
            </div>
          )}

          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="nss-secao">
              <span className="nss-rotulo">Na sala</span>
              <span className="nss-contagem">{participantes.length}</span>
            </div>
            <div className="nss-lista">
              {participantes.map((p) => {
                const souEu = eu && p.id === eu.id;
                const ehHost = host && p.id === host.id;
                const acoes = acoesDisponiveis({ alvo: p, souHost, euId: eu?.id });
                return (
                  <div
                    className={`nss-pessoa ${souEu ? 'eu' : ''} ${p.transmitindo ? 'transmitindo' : ''} ${p.bloqueado ? 'bloqueada' : ''}`}
                    key={p.id}
                  >
                    <span className={`nss-avatar ${p.transmitindo ? 'transmite' : ''}`}>
                      {iniciaisDe(p.nickname) || '··'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="nss-pessoa-nome">
                        <b>{p.nickname}</b>
                        {souEu && <span className="nss-voce">você</span>}
                      </div>
                      <div className={`nss-pessoa-papel ${ehHost ? 'host' : ''}`}>
                        {ehHost && <Icone d={ICONES.coroa} size={12} />}
                        {ehHost ? 'Host da sala' : 'Convidado'}
                      </div>
                    </div>
                    <div className="nss-pessoa-acoes">
                      {p.bloqueado && (
                        <span className="nss-selo-bloqueio" data-dica="Impedido de compartilhar">
                          <Icone d={ICONES.bloqueado} size={13} />
                        </span>
                      )}
                      {p.transmitindo && p.comAudio && (
                        <span className="nss-selo-audio" data-dica="Compartilhando com áudio">
                          <Icone d={ICONES.som} size={13} />
                        </span>
                      )}
                      {p.transmitindo && !p.comAudio && (
                        <span className="nss-onda" data-dica="Compartilhando a tela"><i /><i /><i /></span>
                      )}
                      {acoes.length > 0 && (
                        <button
                          type="button"
                          className="nss-mais"
                          aria-label={`Ações para ${p.nickname}`}
                          aria-expanded={menuAberto?.id === p.id}
                          onClick={(e) => {
                            const fechando = menuAberto?.id === p.id;
                            botaoMenuRef.current = fechando ? null : e.currentTarget;
                            setMenuAberto(fechando ? null : { id: p.id });
                            setConfirmando(null);
                            if (!fechando) {
                              const r = e.currentTarget.getBoundingClientRect();
                              setPosMenu({
                                direita: window.innerWidth - r.right,
                                y: r.bottom + 6,
                                deBaixo: window.innerHeight - r.top + 6,
                                acima: r.bottom + 270 > window.innerHeight,
                              });
                            }
                          }}
                        >
                          <Icone d={ICONES.mais} size={16} />
                        </button>
                      )}
                    </div>

                    {menuAberto?.id === p.id && posMenu && createPortal((
                      <div
                        className="nss-menu"
                        role="menu"
                        style={posMenu.acima
                          ? { right: posMenu.direita, bottom: posMenu.deBaixo }
                          : { right: posMenu.direita, top: posMenu.y }}
                      >
                        <div className="nss-menu-topo">
                          <b>{p.nickname}</b>
                          {p.bloqueado ? 'Impedido de compartilhar' : 'Pode compartilhar'}
                        </div>
                        {confirmando === p.id ? (
                          <div className="nss-menu-confirma">
                            <p>Remover <strong>{p.nickname}</strong> da sala? A pessoa volta à entrada e precisa do código para entrar de novo.</p>
                            <div className="nss-menu-botoes">
                              <button type="button" className="nss-menu-botao" onClick={() => setConfirmando(null)}>Cancelar</button>
                              <button type="button" className="nss-menu-botao perigo" onClick={() => aplicarModeracao(p, ACOES.REMOVER)}>Remover</button>
                            </div>
                          </div>
                        ) : (
                          acoes.map((a) => (
                            <button
                              type="button"
                              key={a.acao}
                              className={`nss-menu-item ${a.destrutiva ? 'destrutiva' : ''}`}
                              onClick={() => {
                                // Só o destrutivo pergunta; o resto é reversível.
                                if (a.destrutiva) setConfirmando(p.id);
                                else aplicarModeracao(p, a.acao);
                              }}
                            >
                              <Icone d={ICONES_ACAO[a.acao]} size={15} />
                              {a.rotulo}
                            </button>
                          ))
                        )}
                      </div>
                    ), document.body)}
                  </div>
                );
              })}
              {!participantes.length && (
                <div className="nss-vazio-lista">Entrando na sala…</div>
              )}
            </div>
          </div>
        </aside>

        <section className={`nss-palco ${temImagem ? 'aovivo' : ''}`} ref={palcoRef}>
          {temImagem ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted={transmitindo || mudo} />
              <div className="nss-palco-topo">
                <span className="nss-aovivo">
                  <span className="nss-ponto" />
                  {transmitindo ? 'Você está compartilhando' : `${quemTransmite?.nickname || 'Alguém'} está compartilhando`}
                </span>

                {transmitindo && (
                  <span className={`nss-selo-palco ${comAudio ? 'audio' : ''}`} data-dica={comAudio ? 'O áudio está indo junto' : 'Sua fonte não ofereceu áudio'} data-dica-baixo>
                    <Icone d={comAudio ? ICONES.som : ICONES.mudo} size={14} />
                    {comAudio ? 'Com áudio' : 'Sem áudio'}
                  </span>
                )}
                {!transmitindo && remotoTemAudio && !mudo && (
                  <span className="nss-selo-palco audio" data-dica="Você está ouvindo a transmissão" data-dica-baixo>
                    <Icone d={ICONES.som} size={14} />
                    Com áudio
                  </span>
                )}
                {!transmitindo && remotoTemAudio && mudo && (
                  <button type="button" className="nss-selo-palco nss-ativar-som" onClick={ativarSom}>
                    <Icone d={ICONES.mudo} size={14} />
                    Ativar som
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="nss-vazio">
              <span className="nss-vazio-icone">
                <Icone d={ICONES.tela} size={30} />
              </span>
              <h2 className="nss-vazio-titulo">Ninguém está compartilhando ainda</h2>
              <p className="nss-vazio-texto">
                {participantes.length > 1
                  ? 'Vocês já estão na sala. Comece a compartilhar e a sua tela aparece aqui para todo mundo.'
                  : souHost
                    ? 'Você é o host desta sala. Chame alguém com o convite ou comece a compartilhar agora.'
                    : 'Quando alguém compartilhar a tela, ela aparece aqui. Você também pode começar.'}
              </p>
              <div className="nss-vazio-acoes">
                <button
                  type="button"
                  className="nss-principal"
                  onClick={iniciarTransmissao}
                  disabled={naoPodeCompartilhar}
                  data-dica={motivoSemCompartilhar || undefined}
                >
                  <Icone d={naoPodeCompartilhar && permissao.motivo !== 'ocupado' ? ICONES.bloqueado : ICONES.tela} size={18} />
                  Compartilhar tela
                </button>
                <button type="button" className={`nss-fantasma ${copiado ? 'feito' : ''}`} onClick={copiarConvite}>
                  <Icone d={copiado ? ICONES.ok : ICONES.convite} size={17} />
                  {copiado ? 'Link copiado' : 'Copiar convite'}
                </button>
              </div>

              {(permissao.motivo === 'bloqueado' || permissao.motivo === 'somente-host') && (
                <div className="nss-aviso-bloqueio">
                  <Icone d={ICONES.bloqueado} size={17} />
                  <span>
                    {MOTIVOS[permissao.motivo]}. Você continua vendo o que os outros transmitirem.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ═══ AVISOS ═══ */}
      <div className="nss-avisos" aria-live="polite">
        {avisos.map((a) => (
          <div className={`nss-aviso ${a.tom}`} key={a.id}>
            <span className="nss-aviso-ponto" />
            {a.texto}
          </div>
        ))}
      </div>

      {erro && (
        <div role="alert" className="nss-erro">
          <Icone d={<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>} size={16} />
          <span>{erro}</span>
        </div>
      )}

      {/* ═══ CONTROLES ═══ */}
      <div className="nss-controles">
        {transmitindo ? (
          <button type="button" className="nss-controle encerrar" onClick={encerrarTransmissao} data-dica="Encerra a transmissão para todos">
            <Icone d={ICONES.parar} />
            <span className="nss-controle-rotulo">Parar de compartilhar</span>
          </button>
        ) : (
          <button
            type="button"
            className="nss-controle primario"
            onClick={iniciarTransmissao}
            disabled={naoPodeCompartilhar}
            data-dica={motivoSemCompartilhar || 'Escolha uma tela, janela ou aba'}
          >
            <Icone d={naoPodeCompartilhar && permissao.motivo !== 'ocupado' ? ICONES.bloqueado : ICONES.tela} />
            <span className="nss-controle-rotulo">Compartilhar tela</span>
          </button>
        )}

        {transmitindo && (
          <span className={`nss-controle ${comAudio ? 'ativo' : ''}`} data-dica={comAudio ? 'O áudio da fonte está sendo enviado' : 'A fonte escolhida não tem áudio'} style={{ cursor: 'default' }}>
            {comAudio ? <span className="nss-onda"><i /><i /><i /></span> : <Icone d={ICONES.mudo} />}
            <span className="nss-controle-rotulo">{comAudio ? 'Áudio' : 'Sem áudio'}</span>
          </span>
        )}

        {!transmitindo && remotoTemAudio && (
          <button type="button" className={`nss-controle ${mudo ? '' : 'ativo'}`} onClick={ativarSom} disabled={!mudo} data-dica={mudo ? 'Ouvir o áudio da transmissão' : 'Você está ouvindo'}>
            {mudo ? <Icone d={ICONES.mudo} /> : <span className="nss-onda"><i /><i /><i /></span>}
            <span className="nss-controle-rotulo">{mudo ? 'Ativar som' : 'Áudio'}</span>
          </button>
        )}

        <span className="nss-divisor" />

        <button type="button" className={`nss-controle ${emTelaCheia ? 'ativo' : ''}`} onClick={alternarTelaCheia} data-dica={emTelaCheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}>
          <Icone d={ICONES.tela_cheia} />
          <span className="nss-controle-rotulo">Tela cheia</span>
        </button>

        <button type="button" className="nss-controle perigo" onClick={sair} data-dica="Sair e voltar ao início">
          <Icone d={ICONES.sair} />
          <span className="nss-controle-rotulo">Sair</span>
        </button>
      </div>

      {/* ═══ PORTA ═══ */}
      {!codigoOk && (
        <div className="nss-porta">
          <div className="nss-porta-cartao">
            <span className="nss-porta-icone"><Icone d={<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>} size={24} /></span>
            <h1 className="nss-porta-titulo">Código inválido</h1>
            <p className="nss-porta-texto">
              O código <strong>{codigoBruto}</strong> não tem o formato de uma sala do Nora Screen.
            </p>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar ao Nora Screen</Link>
          </div>
        </div>
      )}

      {saidaForcada && !removido && (
        <div className="nss-porta">
          <div className="nss-porta-cartao">
            <span className="nss-porta-icone" style={{ background: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.32)', color: '#fca5a5' }}>
              <Icone d={regras.encerrada ? ICONES.sair : ICONES.bloqueado} size={24} />
            </span>
            <h1 className="nss-porta-titulo">{saidaForcada.titulo}</h1>
            <p className="nss-porta-texto">{saidaForcada.texto}</p>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar ao Nora Screen</Link>
          </div>
        </div>
      )}

      {removido && (
        <div className="nss-porta">
          <div className="nss-porta-cartao">
            <span className="nss-porta-icone" style={{ background: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.32)', color: '#fca5a5' }}>
              <Icone d={ICONES.remover} size={24} />
            </span>
            <h1 className="nss-porta-titulo">Você foi removido pelo host</h1>
            <p className="nss-porta-texto">
              Sua conexão com a sala <strong>{codigo}</strong> foi encerrada. Voltando ao Nora Screen…
            </p>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar agora</Link>
          </div>
        </div>
      )}

      {codigoOk && !nickname && !removido && !saidaForcada && (
        <div className="nss-porta">
          <form
            className="nss-porta-cartao"
            onSubmit={(e) => {
              e.preventDefault();
              if (rascunho.trim().length >= NICKNAME_MIN) setNickname(rascunho.trim());
            }}
          >
            <span className="nss-porta-icone"><Icone d={ICONES.tela} size={24} /></span>
            <h1 className="nss-porta-titulo">Entrar na sala {codigo}</h1>
            <p className="nss-porta-texto">Escolha um apelido para se identificar para quem já está lá.</p>
            <input
              className="nss-input"
              type="text"
              placeholder="Seu apelido"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value.slice(0, 24))}
              maxLength={24}
              autoFocus
            />
            <button type="submit" className="nss-principal" disabled={rascunho.trim().length < NICKNAME_MIN}>
              Entrar na sala
            </button>
            <Link to={NORA_SCREEN_ROUTE} className="nss-porta-voltar">Voltar ao Nora Screen</Link>
          </form>
        </div>
      )}
    </div>
  );
}
