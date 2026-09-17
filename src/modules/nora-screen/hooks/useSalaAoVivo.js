import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTOS, STATUS, entrarNaSala } from '../services/sinalizacao.js';
import { ACOES, podeModerar } from '../domain/moderacao.js';
import {
  ENTRADA,
  REGRAS_PADRAO,
  decisaoDaEntrada,
  podeCompartilhar,
} from '../domain/regrasDaSala.js';
import {
  abrirSala,
  assinarRegras,
  autorizarEntrada,
  definirRegras as gravarRegras,
  encerrarSala as gravarEncerramento,
  tokenDoHost,
} from '../services/salaPersistida.js';

// ═══════════════════════════════════════════════════════════════
// Motor da sala — WebRTC sobre a sinalização do Realtime.
//
// Topologia: quem transmite abre uma conexão para CADA espectador
// (mesh a partir de um só ponto). Para uma sala de trabalho é o
// suficiente e não exige servidor de mídia; o custo é a banda de subida
// de quem compartilha, que cresce com o número de espectadores.
//
// Só uma pessoa transmite por vez. Isso simplifica a negociação — quem
// transmite sempre oferece, quem assiste sempre responde — e evita o
// caso em que dois lados oferecem ao mesmo tempo e a negociação colide.
// ═══════════════════════════════════════════════════════════════

const SERVIDORES_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export const PAPEL = { HOST: 'host', CONVIDADO: 'convidado' };

function novoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function useSalaAoVivo({ codigo, nickname, criador = false, ativo = true }) {
  const [status, setStatus] = useState(STATUS.CONECTANDO);
  const [participantes, setParticipantes] = useState([]);
  const [transmitindo, setTransmitindo] = useState(false);
  const [comAudio, setComAudio] = useState(false);
  const [streamRemoto, setStreamRemoto] = useState(null);
  const [erro, setErro] = useState('');
  // Moderação: quem está impedido de transmitir e quem foi removido.
  const [bloqueado, setBloqueado] = useState(false);
  const [removido, setRemovido] = useState(false);
  // Regras gerais da sala: vêm do banco, não daqui.
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  // A entrada é decidida UMA vez, pelo servidor, antes de qualquer
  // presença ou WebRTC. Depois de autorizada não se reavalia: mudar as
  // regras fecha a porta para quem chega, não expulsa quem já está.
  const [entrada, setEntrada] = useState(ENTRADA.VERIFICANDO);
  const [barrado, setBarrado] = useState(null);
  // "Dono" é quem tem o token da sala — quem a abriu. É diferente do host
  // por presença (o primeiro a chegar), que continua mandando na moderação
  // individual: só o token autoriza mudar as regras no banco.
  const tokenRef = useRef(null);
  const [souDono, setSouDono] = useState(false);

  // Identidade desta aba: chave de presence e endereço das mensagens de
  // sinalização. Nasce num efeito, não no render — `novoId` e `Date.now`
  // são impuros, e o carimbo de chegada precisa ser o mesmo para sempre
  // (é ele que decide quem é host).
  const euRef = useRef(null);
  const [eu, setEu] = useState(null);
  useEffect(() => {
    if (euRef.current) return;
    euRef.current = { id: novoId(), nickname, entrouEm: Date.now() };
    setEu(euRef.current);
  }, [nickname]);

  const salaRef = useRef(null);
  const streamLocalRef = useRef(null);
  // Uma conexão por espectador quando eu transmito; uma só (do transmissor)
  // quando eu assisto.
  const conexoesRef = useRef(new Map());
  // ICE que chega antes da descrição remota não pode ser aplicado ainda:
  // fica aqui até haver com o que casar.
  const icePendenteRef = useRef(new Map());
  const participantesRef = useRef([]);
  const transmitindoRef = useRef(false);
  // O host precisa ser lido dentro do tratador de mensagens sem entrar nas
  // dependências dele: se entrasse, cada mudança de participante recriaria
  // o tratador e reassinaria o canal inteiro.
  const hostRef = useRef(null);
  const bloqueadoRef = useRef(false);
  const regrasRef = useRef(REGRAS_PADRAO);
  const souDonoRef = useRef(false);
  const comAudioRef = useRef(false);

  useEffect(() => { participantesRef.current = participantes; }, [participantes]);
  useEffect(() => { transmitindoRef.current = transmitindo; }, [transmitindo]);
  useEffect(() => { comAudioRef.current = comAudio; }, [comAudio]);
  useEffect(() => { bloqueadoRef.current = bloqueado; }, [bloqueado]);
  useEffect(() => { regrasRef.current = regras; }, [regras]);
  useEffect(() => { souDonoRef.current = souDono; }, [souDono]);
  // Guardado em ref para o efeito das regras não depender da identidade
  // desta função: uma dependência a mais ali refaria a assinatura e
  // repetiria a consulta de entrada a cada render.
  const pararRef = useRef(null);

  const fecharConexao = useCallback((id) => {
    const pc = conexoesRef.current.get(id);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch { /* já fechada */ }
      conexoesRef.current.delete(id);
    }
    icePendenteRef.current.delete(id);
  }, []);

  const fecharTudo = useCallback(() => {
    conexoesRef.current.forEach((_, id) => fecharConexao(id));
    conexoesRef.current.clear();
  }, [fecharConexao]);

  const aplicarIcePendente = useCallback(async (id, pc) => {
    const fila = icePendenteRef.current.get(id);
    if (!fila?.length) return;
    icePendenteRef.current.delete(id);
    for (const candidate of fila) {
      try { await pc.addIceCandidate(candidate); } catch { /* candidato obsoleto */ }
    }
  }, []);

  const novaConexao = useCallback((id) => {
    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_ICE });
    pc.onicecandidate = (e) => {
      if (e.candidate) salaRef.current?.enviar(EVENTOS.ICE, { para: id, candidate: e.candidate.toJSON() });
    };
    conexoesRef.current.set(id, pc);
    return pc;
  }, []);

  // ── Eu transmito: abre conexão e oferta para um espectador ──
  const ofertarPara = useCallback(async (id) => {
    const stream = streamLocalRef.current;
    if (!stream) return;
    fecharConexao(id);
    const pc = novaConexao(id);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    try {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      salaRef.current?.enviar(EVENTOS.OFERTA, { para: id, sdp: pc.localDescription });
    } catch {
      setErro('Não foi possível iniciar a conexão com um dos participantes.');
    }
  }, [fecharConexao, novaConexao]);

  const pararDeTransmitir = useCallback(({ avisar = true } = {}) => {
    streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    streamLocalRef.current = null;
    fecharTudo();
    setTransmitindo(false);
    setComAudio(false);
    salaRef.current?.anunciar({ transmitindo: false, comAudio: false });
    if (avisar) salaRef.current?.enviar(EVENTOS.PAROU, {});
  }, [fecharTudo]);

  useEffect(() => { pararRef.current = pararDeTransmitir; }, [pararDeTransmitir]);

  const compartilharTela = useCallback(async () => {
    setErro('');
    // Segunda barreira: o botão já vem desabilitado, mas quem chamar isto
    // por outro caminho também não passa.
    const permissao = podeCompartilhar({
      regras: regrasRef.current,
      souHost: souDonoRef.current,
      bloqueadoIndividualmente: bloqueadoRef.current,
    });
    if (!permissao.pode) {
      setErro(permissao.motivo === 'somente-host'
        ? 'Só o host pode compartilhar nesta sala.'
        : 'Você não pode compartilhar a tela nesta sala agora.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErro('Este navegador não permite compartilhar a tela. Tente pelo Chrome, Edge ou Firefox no computador.');
      return;
    }
    const video = { frameRate: { ideal: 15, max: 30 } };
    let stream;
    try {
      // Pede o áudio junto. Quem decide se ele existe é o navegador e a
      // pessoa na hora de escolher a fonte: o Chrome oferece o áudio da aba
      // ou do sistema, o Firefox e o Safari costumam não oferecer nada.
      stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: true });
    } catch (e) {
      // Cancelar no seletor do navegador não é erro — é uma decisão.
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return;
      // Navegador que recusa a restrição de áudio não pode impedir a
      // transmissão: tenta de novo só com vídeo.
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
      } catch (e2) {
        if (e2?.name !== 'NotAllowedError' && e2?.name !== 'AbortError') {
          setErro('Não foi possível capturar a tela.');
        }
        return;
      }
    }

    const temAudio = stream.getAudioTracks().length > 0;
    streamLocalRef.current = stream;
    setTransmitindo(true);
    setComAudio(temAudio);
    setStreamRemoto(null);
    salaRef.current?.anunciar({ transmitindo: true, comAudio: temAudio });

    // "Parar de compartilhar" do próprio navegador encerra a faixa sem
    // passar pela nossa interface — aqui isso vira o mesmo fim de tudo.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => pararDeTransmitir());
    // O áudio pode acabar antes do vídeo (a aba de origem foi fechada, por
    // exemplo). O indicador tem de acompanhar, não ficar aceso à toa.
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      setComAudio(false);
      salaRef.current?.anunciar({ transmitindo: true, comAudio: false });
    });

    participantesRef.current
      .filter((p) => p.id !== euRef.current?.id)
      .forEach((p) => ofertarPara(p.id));
  }, [ofertarPara, pararDeTransmitir]);

  // ── Recebimento de sinalização ──
  const aoReceber = useCallback(async (evento, payload) => {
    const de = payload?.de;
    if (!de) return;

    if (evento === EVENTOS.QUERO_VER) {
      if (transmitindoRef.current) ofertarPara(de);
      return;
    }

    if (evento === EVENTOS.OFERTA) {
      // Eu assisto: uma oferta chegando substitui qualquer conexão anterior.
      fecharConexao(de);
      const pc = novaConexao(de);
      pc.ontrack = (e) => setStreamRemoto(e.streams[0]);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setErro('A conexão com quem está transmitindo caiu. Peça para recompartilhar.');
        }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await aplicarIcePendente(de, pc);
        const resposta = await pc.createAnswer();
        await pc.setLocalDescription(resposta);
        salaRef.current?.enviar(EVENTOS.RESPOSTA, { para: de, sdp: pc.localDescription });
      } catch {
        setErro('Não foi possível conectar à transmissão.');
      }
      return;
    }

    if (evento === EVENTOS.RESPOSTA) {
      const pc = conexoesRef.current.get(de);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await aplicarIcePendente(de, pc);
      } catch { /* resposta fora de ordem */ }
      return;
    }

    if (evento === EVENTOS.ICE) {
      const pc = conexoesRef.current.get(de);
      const candidate = new RTCIceCandidate(payload.candidate);
      if (!pc || !pc.remoteDescription) {
        const fila = icePendenteRef.current.get(de) || [];
        fila.push(candidate);
        icePendenteRef.current.set(de, fila);
        return;
      }
      try { await pc.addIceCandidate(candidate); } catch { /* candidato obsoleto */ }
      return;
    }

    if (evento === EVENTOS.PAROU) {
      fecharConexao(de);
      setStreamRemoto(null);
      return;
    }

    if (evento === EVENTOS.MODERACAO) {
      // A interface do outro lado já filtrou, mas quem obedece confere:
      // a ordem só vale se vier de quem a sala inteira reconhece como host.
      const autorizado = podeModerar({
        hostId: hostRef.current?.id,
        autorId: de,
        alvoId: euRef.current?.id,
        acao: payload.acao,
      });
      if (!autorizado) return;

      if (payload.acao === ACOES.BLOQUEAR) {
        setBloqueado(true);
        salaRef.current?.anunciar({ bloqueado: true, transmitindo: false, comAudio: false });
        // Bloquear quem já está no ar corta a transmissão na hora.
        if (transmitindoRef.current) pararDeTransmitir();
        return;
      }
      if (payload.acao === ACOES.LIBERAR) {
        setBloqueado(false);
        salaRef.current?.anunciar({ bloqueado: false });
        return;
      }
      if (payload.acao === ACOES.PARAR) {
        if (transmitindoRef.current) pararDeTransmitir();
        return;
      }
      if (payload.acao === ACOES.REMOVER) {
        // Sai do canal e derruba tudo aqui mesmo: a tela de aviso e o
        // redirect são da página, mas a sala já deixou de existir.
        streamLocalRef.current?.getTracks().forEach((t) => t.stop());
        streamLocalRef.current = null;
        fecharTudo();
        setStreamRemoto(null);
        setTransmitindo(false);
        setComAudio(false);
        salaRef.current?.sair();
        salaRef.current = null;
        setRemovido(true);
      }
    }
  }, [aplicarIcePendente, fecharConexao, fecharTudo, novaConexao, ofertarPara, pararDeTransmitir]);

  // ── Regras da sala (estado autoritativo no Supabase) ──
  useEffect(() => {
    if (!ativo || !codigo) return undefined;
    let vivo = true;

    // Só quem acabou de criar a sala cria token. Quem chega por link não
    // pode "abrir" a sala de outra pessoa e virar dono dela.
    const token = tokenDoHost(codigo, { criarSeFaltar: criador });
    tokenRef.current = token;

    (async () => {
      try {
        if (token && criador) {
          // Abrir a própria sala já é a autorização: quem cria, entra.
          const atual = await abrirSala(codigo, token);
          if (!vivo) return;
          setRegras(atual);
          setSouDono(true);
          setEntrada(ENTRADA.AUTORIZADA);
          return;
        }
        // Todo o resto pergunta ao servidor. O token vai junto quando
        // existe (host que recarregou a página) para ele atravessar o
        // próprio bloqueio de entradas.
        const decisao = decisaoDaEntrada(await autorizarEntrada(codigo, token));
        if (!vivo) return;
        setRegras(decisao.regras);
        // Dono é quem o SERVIDOR reconheceu pelo token, não quem tem
        // qualquer coisa guardada no navegador.
        setSouDono(decisao.eHost);
        if (decisao.estado === ENTRADA.AUTORIZADA) {
          setEntrada(ENTRADA.AUTORIZADA);
        } else {
          setBarrado(decisao.motivo);
          setEntrada(ENTRADA.RECUSADA);
        }
      } catch {
        // Falha fechada, de propósito. Antes, não conseguir falar com o
        // banco liberava a entrada — e era por aí que alguém entrava
        // numa sala com as entradas bloqueadas.
        if (!vivo) return;
        setBarrado('indisponivel');
        setEntrada(ENTRADA.RECUSADA);
      }
    })();

    const desassinar = assinarRegras(codigo, (novas) => {
      if (!vivo) return;
      setRegras(novas);
      // "Só o host compartilha" tira do ar quem já estava transmitindo
      // sem ser ele. Reagir aqui, no aviso do servidor, e não num efeito
      // sobre o estado: é o servidor que manda, e é dele que a ordem vem.
      //
      // "Bloquear novas entradas" de propósito não faz nada aqui: é uma
      // porta, não uma expulsão — quem já está na sala continua.
      if (novas.somenteHostCompartilha && !souDonoRef.current && transmitindoRef.current) {
        pararRef.current?.();
      }
    });
    return () => { vivo = false; desassinar(); };
  }, [ativo, codigo, criador]);

  // ── Ciclo de vida da sala ──
  useEffect(() => {
    if (!ativo || !codigo || !nickname || !eu) return undefined;
    // Sem o "pode entrar" do servidor não se entra: nada de presence,
    // nada de WebRTC, nada de sinalização. Enquanto a resposta não vem o
    // estado é VERIFICANDO, que também não entra.
    if (entrada !== ENTRADA.AUTORIZADA) return undefined;
    euRef.current.nickname = nickname;

    const sala = entrarNaSala({
      codigo,
      eu: euRef.current,
      aoMudarParticipantes: (lista) => {
        const anteriores = participantesRef.current;
        setParticipantes(lista);

        // Alguém saiu: derruba a conexão que existia com essa pessoa.
        anteriores
          .filter((a) => !lista.some((p) => p.id === a.id))
          .forEach((a) => {
            fecharConexao(a.id);
            if (a.transmitindo) setStreamRemoto(null);
          });

        // Parou de transmitir sem o aviso chegar (aba fechada no meio, rede
        // engasgada): a presença é a fonte de verdade e limpa o palco.
        anteriores
          .filter((a) => a.transmitindo && lista.some((p) => p.id === a.id && !p.transmitindo))
          .forEach((a) => {
            fecharConexao(a.id);
            setStreamRemoto(null);
          });

        // Alguém entrou enquanto eu transmito: oferta para o recém-chegado.
        if (transmitindoRef.current) {
          lista
            .filter((p) => p.id !== euRef.current.id && !anteriores.some((a) => a.id === p.id))
            .forEach((p) => ofertarPara(p.id));
        }
      },
      aoReceber,
      aoMudarStatus: setStatus,
    });
    salaRef.current = sala;

    const aoFechar = () => sala.sair();
    window.addEventListener('pagehide', aoFechar);

    return () => {
      window.removeEventListener('pagehide', aoFechar);
      streamLocalRef.current?.getTracks().forEach((t) => t.stop());
      streamLocalRef.current = null;
      fecharTudo();
      sala.sair();
      salaRef.current = null;
    };
    // `aoReceber` e os fechadores são estáveis por useCallback; o efeito
    // só deve rodar de novo quando muda a sala, a identidade ou a
    // autorização. `regras` ficou fora porque não é mais consultada
    // aqui: mudança de regra não derruba nem refaz o canal de quem já
    // está dentro — quem reage a ela é o efeito de baixo.
  }, [ativo, codigo, nickname, eu, entrada, aoReceber, fecharConexao, fecharTudo, ofertarPara]);

  // O que fazer ao (re)conectar mora num efeito, não no callback de status:
  // o callback pode disparar antes de `salaRef` receber o handle do canal,
  // e aí o aviso se perderia em silêncio.
  useEffect(() => {
    if (status !== STATUS.CONECTADO || !salaRef.current) return;
    // "Cheguei": quem estiver transmitindo abre a conexão para mim.
    salaRef.current.enviar(EVENTOS.QUERO_VER, {});
    // Entrar no canal re-anuncia a presença zerada; se eu já estava
    // transmitindo, preciso dizer de novo que estou.
    if (transmitindoRef.current) {
      salaRef.current.anunciar({ transmitindo: true, comAudio: comAudioRef.current });
    }
  }, [status]);

  const definirRegrasDaSala = useCallback(async (patch) => {
    if (!tokenRef.current) return false;
    try {
      setRegras(await gravarRegras(codigo, tokenRef.current, patch));
      return true;
    } catch (e) {
      setErro(e.message || 'Não foi possível mudar as regras da sala.');
      return false;
    }
  }, [codigo]);

  const encerrarParaTodos = useCallback(async () => {
    if (!tokenRef.current) return false;
    try {
      // Basta gravar: o encerramento chega a todos por postgres_changes, e
      // cada cliente reage sozinho — inclusive quem entrar depois.
      setRegras(await gravarEncerramento(codigo, tokenRef.current));
      return true;
    } catch (e) {
      setErro(e.message || 'Não foi possível encerrar a sala.');
      return false;
    }
  }, [codigo]);

  const quemTransmite = useMemo(
    () => participantes.find((p) => p.transmitindo) || null,
    [participantes],
  );
  const host = participantes[0] || null;
  const souHost = Boolean(host && eu && host.id === eu.id);
  useEffect(() => { hostRef.current = host; }, [host]);

  // Ação do host sobre outro participante. A mesma regra que o outro lado
  // usa para decidir se obedece é conferida aqui antes de mandar.
  const moderar = useCallback((alvoId, acao) => {
    const autorizado = podeModerar({
      hostId: hostRef.current?.id,
      autorId: euRef.current?.id,
      alvoId,
      acao,
    });
    if (!autorizado) return false;
    salaRef.current?.enviar(EVENTOS.MODERACAO, { para: alvoId, acao });
    return true;
  }, []);
  const outroTransmitindo = Boolean(quemTransmite && eu && quemTransmite.id !== eu.id);

  return {
    eu,
    status,
    participantes,
    host,
    souHost,
    transmitindo,
    comAudio,
    bloqueado,
    removido,
    moderar,
    regras,
    souDono,
    entrada,
    barrado,
    definirRegrasDaSala,
    encerrarParaTodos,
    quemTransmite,
    outroTransmitindo,
    streamRemoto,
    streamLocal: streamLocalRef,
    erro,
    limparErro: () => setErro(''),
    compartilharTela,
    pararDeTransmitir,
  };
}
