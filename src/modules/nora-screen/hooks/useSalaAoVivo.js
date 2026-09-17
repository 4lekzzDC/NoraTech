import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTOS, PRESENCA_ZERADA, STATUS, entrarNaSala } from '../services/sinalizacao.js';
import { ACOES, podeModerar } from '../domain/moderacao.js';
import { papelDe } from '../domain/papeis.js';
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
  baterPonto,
  definirAdmin as gravarAdmin,
  definirRegras as gravarRegras,
  encerrarSala as gravarEncerramento,
  largarVaga,
  tokenDoHost,
} from '../services/salaPersistida.js';

// ═══════════════════════════════════════════════════════════════
// Motor da sala — WebRTC sobre a sinalização do Realtime.
//
// Topologia: malha completa. Cada par de participantes mantém UMA
// conexão, e por ela passa o que cada lado estiver mandando — tela,
// áudio da tela, microfone. Para uma sala de trabalho é o suficiente e
// não exige servidor de mídia; o custo é a banda de subida de quem
// transmite, que cresce com o número de pessoas na sala.
//
// A parte delicada é que agora os DOIS lados podem começar a negociar ao
// mesmo tempo: ligar o microfone enquanto o outro compartilha a tela faz
// as duas pontas quererem ofertar juntas. Isso é a colisão clássica do
// WebRTC, e a saída é a "negociação perfeita": um dos lados é o polido e
// desiste da própria oferta quando as duas se cruzam. Quem é o polido sai
// da comparação dos ids, que os dois lados calculam igual sem combinar
// nada.
//
// Sobre o áudio e o eco: ninguém toca o próprio som. O que sai do meu
// microfone e do meu compartilhamento eu não escuto — o navegador só me
// entrega as faixas dos OUTROS, e o meu vídeo local vai mudo na tela.
// ═══════════════════════════════════════════════════════════════

const SERVIDORES_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

// De quanto em quanto tempo eu renovo minha vaga no Postgres. Bem abaixo
// dos 90s em que a presença caduca, para uma batida perdida não me
// derrubar da contagem.
const INTERVALO_PONTO = 25000;

function novoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// A descrição de sessão vai como objeto simples, e não como o
// RTCSessionDescription que o navegador devolve: esse é um objeto da API
// do WebRTC, e transporte nenhum é obrigado a saber copiá-lo. Dois
// campos é tudo o que a outra ponta precisa.
function sdpSimples(descricao) {
  return descricao ? { type: descricao.type, sdp: descricao.sdp } : null;
}

// Uma faixa de vídeo identifica o compartilhamento de tela; o áudio da
// tela viaja no mesmo stream. Microfone chega sozinho, só com áudio.
function tipoDoStream(stream) {
  return stream.getVideoTracks().length > 0 ? 'tela' : 'microfone';
}

export function useSalaAoVivo({ codigo, nickname, criador = false, ativo = true }) {
  const [status, setStatus] = useState(STATUS.CONECTANDO);
  const [participantes, setParticipantes] = useState([]);
  const [transmitindo, setTransmitindo] = useState(false);
  const [comAudio, setComAudio] = useState(false);
  // Microfone: `ativo` é ter a faixa; `mudo` é tê-la desligada. Separar os
  // dois evita pedir permissão de novo a cada clique no mudo.
  const [microfoneAtivo, setMicrofoneAtivo] = useState(false);
  const [mudo, setMudo] = useState(true);
  // Mídia dos outros: [{ peerId, stream, tipo }]. Uma lista e não um
  // stream só, porque agora várias pessoas transmitem ao mesmo tempo.
  const [midiaRemota, setMidiaRemota] = useState([]);
  const [falando, setFalando] = useState([]);
  const [erro, setErro] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  const [entrada, setEntrada] = useState(ENTRADA.VERIFICANDO);
  const [barrado, setBarrado] = useState(null);
  const tokenRef = useRef(null);
  const [souDono, setSouDono] = useState(false);

  const euRef = useRef(null);
  const [eu, setEu] = useState(null);
  useEffect(() => {
    if (euRef.current) return;
    euRef.current = { id: novoId(), nickname, entrouEm: Date.now() };
    setEu(euRef.current);
  }, [nickname]);

  const salaRef = useRef(null);
  const telaRef = useRef(null);
  const microfoneRef = useRef(null);
  // id do par → { pc, polido, fazendoOferta, ignorando }
  const conexoesRef = useRef(new Map());
  const icePendenteRef = useRef(new Map());
  // `${peerId}|${streamId}` → { peerId, stream, tipo }
  const remotosRef = useRef(new Map());
  const participantesRef = useRef([]);
  const bloqueadoRef = useRef(false);
  const regrasRef = useRef(REGRAS_PADRAO);
  const souDonoRef = useRef(false);
  const estadoPresencaRef = useRef({ ...PRESENCA_ZERADA });

  useEffect(() => { participantesRef.current = participantes; }, [participantes]);
  useEffect(() => { bloqueadoRef.current = bloqueado; }, [bloqueado]);
  useEffect(() => { regrasRef.current = regras; }, [regras]);
  useEffect(() => { souDonoRef.current = souDono; }, [souDono]);

  // Anuncia o estado inteiro, sempre. Entrar no canal zera a presença, e
  // mandar só um pedaço apagaria o resto do que eu já tinha dito.
  const anunciar = useCallback((patch) => {
    estadoPresencaRef.current = { ...estadoPresencaRef.current, ...patch };
    salaRef.current?.anunciar(estadoPresencaRef.current);
  }, []);

  // ── Mídia dos outros ──
  const publicarRemotos = useCallback(() => {
    setMidiaRemota([...remotosRef.current.values()]);
  }, []);

  const registrarRemoto = useCallback((peerId, stream) => {
    remotosRef.current.set(`${peerId}|${stream.id}`, {
      peerId,
      stream,
      tipo: tipoDoStream(stream),
    });
    publicarRemotos();
  }, [publicarRemotos]);

  const esquecerRemotosDe = useCallback((peerId) => {
    let mudou = false;
    remotosRef.current.forEach((v, chave) => {
      if (v.peerId === peerId) { remotosRef.current.delete(chave); mudou = true; }
    });
    if (mudou) publicarRemotos();
  }, [publicarRemotos]);

  // ── Conexões ──
  const fecharConexao = useCallback((id) => {
    const est = conexoesRef.current.get(id);
    if (est) {
      const { pc } = est;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch { /* já fechada */ }
      conexoesRef.current.delete(id);
    }
    icePendenteRef.current.delete(id);
    esquecerRemotosDe(id);
  }, [esquecerRemotosDe]);

  const fecharTudo = useCallback(() => {
    [...conexoesRef.current.keys()].forEach((id) => fecharConexao(id));
    conexoesRef.current.clear();
  }, [fecharConexao]);

  // Minhas faixas, na conexão com um par. Chamado ao criar a conexão e
  // sempre que eu ligo tela ou microfone.
  const enviarMinhasFaixas = useCallback((pc) => {
    const jaEnviadas = new Set(pc.getSenders().map((s) => s.track).filter(Boolean));
    [telaRef.current, microfoneRef.current].forEach((stream) => {
      stream?.getTracks().forEach((faixa) => {
        if (!jaEnviadas.has(faixa)) pc.addTrack(faixa, stream);
      });
    });
  }, []);

  const assegurarConexao = useCallback((id) => {
    const existente = conexoesRef.current.get(id);
    if (existente) return existente;

    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_ICE });
    // Quem é o polido sai da comparação dos ids: os dois lados chegam à
    // mesma conclusão sem trocar mensagem sobre isso.
    const est = { pc, polido: String(euRef.current?.id) > String(id), fazendoOferta: false, ignorando: false };
    conexoesRef.current.set(id, est);

    pc.onicecandidate = (e) => {
      if (e.candidate) salaRef.current?.enviar(EVENTOS.ICE, { para: id, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      registrarRemoto(id, stream);
      // Uma faixa nova pode mudar o que o stream é: o áudio da tela chega
      // separado do vídeo, e o stream só vira "tela" quando o vídeo entra.
      stream.addEventListener('addtrack', () => registrarRemoto(id, stream));
      stream.addEventListener('removetrack', () => {
        if (stream.getTracks().length === 0) {
          remotosRef.current.delete(`${id}|${stream.id}`);
          publicarRemotos();
        } else {
          registrarRemoto(id, stream);
        }
      });
      e.track.addEventListener('ended', () => {
        if (stream.getTracks().every((t) => t.readyState === 'ended')) {
          remotosRef.current.delete(`${id}|${stream.id}`);
          publicarRemotos();
        }
      });
    };
    pc.onnegotiationneeded = async () => {
      try {
        est.fazendoOferta = true;
        await pc.setLocalDescription();
        salaRef.current?.enviar(EVENTOS.SDP, { para: id, sdp: sdpSimples(pc.localDescription) });
      } catch {
        // Negociação atropelada por outra; a próxima acerta.
      } finally {
        est.fazendoOferta = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // Reinicia o ICE em vez de desistir: a rota pode ter mudado.
        try { pc.restartIce(); } catch { /* navegador antigo */ }
      }
    };

    enviarMinhasFaixas(pc);
    return est;
  }, [enviarMinhasFaixas, publicarRemotos, registrarRemoto]);

  // Renegocia com todo mundo — usado ao ligar/desligar tela e microfone.
  const reofertarParaTodos = useCallback(() => {
    participantesRef.current
      .filter((p) => p.id !== euRef.current?.id)
      .forEach((p) => {
        const { pc } = assegurarConexao(p.id);
        enviarMinhasFaixas(pc);
      });
  }, [assegurarConexao, enviarMinhasFaixas]);

  const retirarStream = useCallback((stream) => {
    if (!stream) return;
    const faixas = new Set(stream.getTracks());
    conexoesRef.current.forEach(({ pc }) => {
      pc.getSenders()
        .filter((s) => s.track && faixas.has(s.track))
        .forEach((s) => { try { pc.removeTrack(s); } catch { /* conexão já fechada */ } });
    });
    stream.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Compartilhar tela ──
  const pararDeTransmitir = useCallback(() => {
    retirarStream(telaRef.current);
    telaRef.current = null;
    setTransmitindo(false);
    setComAudio(false);
    anunciar({ transmitindo: false, comAudio: false });
  }, [anunciar, retirarStream]);

  const pararRef = useRef(null);
  useEffect(() => { pararRef.current = pararDeTransmitir; }, [pararDeTransmitir]);

  const compartilharTela = useCallback(async () => {
    setErro('');
    if (telaRef.current) return;
    // Segunda barreira: o botão já vem desabilitado, mas quem chamar isto
    // por outro caminho também não passa.
    const permissao = podeCompartilhar({
      regras: regrasRef.current,
      souHost: souDonoRef.current || regrasRef.current.admins?.includes(euRef.current?.id),
      bloqueadoIndividualmente: bloqueadoRef.current,
    });
    if (!permissao.pode) {
      setErro(permissao.motivo === 'somente-host'
        ? 'Só o dono e os admins podem compartilhar nesta sala.'
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
    telaRef.current = stream;
    setTransmitindo(true);
    setComAudio(temAudio);
    anunciar({ transmitindo: true, comAudio: temAudio });

    // "Parar de compartilhar" do próprio navegador encerra a faixa sem
    // passar pela nossa interface — aqui isso vira o mesmo fim de tudo.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => pararRef.current?.());
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      setComAudio(false);
      anunciar({ comAudio: false });
    });

    reofertarParaTodos();
  }, [anunciar, reofertarParaTodos]);

  // ── Microfone ──
  //
  // Ligar pede permissão e acrescenta a faixa; o mudo só desliga a faixa
  // que já está lá. Separar os dois evita renegociar a conexão a cada
  // clique e evita pedir permissão de novo a quem só quer voltar a falar.
  const alternarMicrofone = useCallback(async () => {
    setErro('');
    if (microfoneRef.current) {
      const faixa = microfoneRef.current.getAudioTracks()[0];
      if (!faixa) return;
      const novoMudo = faixa.enabled;
      faixa.enabled = !faixa.enabled;
      setMudo(novoMudo);
      anunciar({ microfoneAtivo: true, mudo: novoMudo });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não dá acesso ao microfone.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      microfoneRef.current = stream;
      setMicrofoneAtivo(true);
      setMudo(false);
      anunciar({ microfoneAtivo: true, mudo: false });
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        microfoneRef.current = null;
        setMicrofoneAtivo(false);
        setMudo(true);
        anunciar({ microfoneAtivo: false, mudo: true });
      });
      reofertarParaTodos();
    } catch (e) {
      // Permissão negada não tira ninguém da sala: continua assistindo,
      // compartilhando e conversando pelo áudio da tela.
      setErro(e?.name === 'NotAllowedError'
        ? 'Sem permissão para o microfone. Você continua na sala normalmente.'
        : 'Não foi possível acessar o microfone. Você continua na sala normalmente.');
    }
  }, [anunciar, reofertarParaTodos]);

  const desligarMicrofone = useCallback(() => {
    retirarStream(microfoneRef.current);
    microfoneRef.current = null;
    setMicrofoneAtivo(false);
    setMudo(true);
    anunciar({ microfoneAtivo: false, mudo: true });
  }, [anunciar, retirarStream]);

  // ── Recebimento de sinalização ──
  const aoReceber = useCallback(async (evento, payload) => {
    const de = payload?.de;
    if (!de) return;

    if (evento === EVENTOS.SDP) {
      const est = assegurarConexao(de);
      const { pc } = est;
      const descricao = payload.sdp;
      // Negociação perfeita: se as duas ofertas se cruzarem, o impolido
      // ignora a do outro e o polido abre mão da sua.
      const colisao = descricao.type === 'offer'
        && (est.fazendoOferta || pc.signalingState !== 'stable');
      est.ignorando = !est.polido && colisao;
      if (est.ignorando) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(descricao));
        const fila = icePendenteRef.current.get(de);
        if (fila?.length) {
          icePendenteRef.current.delete(de);
          for (const c of fila) {
            try { await pc.addIceCandidate(c); } catch { /* candidato obsoleto */ }
          }
        }
        if (descricao.type === 'offer') {
          await pc.setLocalDescription();
          salaRef.current?.enviar(EVENTOS.SDP, { para: de, sdp: sdpSimples(pc.localDescription) });
        }
      } catch {
        // Descrição fora de ordem; a renegociação seguinte acerta.
      }
      return;
    }

    if (evento === EVENTOS.ICE) {
      const est = conexoesRef.current.get(de);
      const candidato = new RTCIceCandidate(payload.candidate);
      if (!est || !est.pc.remoteDescription) {
        const fila = icePendenteRef.current.get(de) || [];
        fila.push(candidato);
        icePendenteRef.current.set(de, fila);
        return;
      }
      try { await est.pc.addIceCandidate(candidato); } catch {
        if (!est.ignorando) { /* candidato obsoleto */ }
      }
      return;
    }

    if (evento === EVENTOS.MODERACAO) {
      // A interface do outro lado já filtrou, mas quem obedece confere: a
      // ordem só vale se vier de quem o BANCO reconhece como dono ou
      // admin — não de quem se diz uma coisa ou outra.
      const autorizado = podeModerar({
        donoId: regrasRef.current.donoId,
        admins: regrasRef.current.admins,
        autorId: de,
        alvoId: euRef.current?.id,
        acao: payload.acao,
      });
      if (!autorizado) return;

      if (payload.acao === ACOES.BLOQUEAR) {
        setBloqueado(true);
        if (telaRef.current) pararRef.current?.();
        anunciar({ bloqueado: true });
        return;
      }
      if (payload.acao === ACOES.LIBERAR) {
        setBloqueado(false);
        anunciar({ bloqueado: false });
        return;
      }
      if (payload.acao === ACOES.PARAR) {
        if (telaRef.current) pararRef.current?.();
        return;
      }
      if (payload.acao === ACOES.REMOVER) {
        // Sai do canal e derruba tudo aqui mesmo: a tela de aviso e o
        // redirect são da página, mas a sala já deixou de existir.
        retirarStream(telaRef.current);
        retirarStream(microfoneRef.current);
        telaRef.current = null;
        microfoneRef.current = null;
        fecharTudo();
        setTransmitindo(false);
        setComAudio(false);
        setMicrofoneAtivo(false);
        setMudo(true);
        if (euRef.current?.id) largarVaga(codigo, euRef.current.id).catch(() => {});
        salaRef.current?.sair();
        salaRef.current = null;
        setRemovido(true);
      }
    }
  }, [anunciar, assegurarConexao, codigo, fecharTudo, retirarStream]);

  // ── Regras da sala (estado autoritativo no Supabase) ──
  useEffect(() => {
    if (!ativo || !codigo || !eu) return undefined;
    let vivo = true;

    // Só quem acabou de criar a sala cria token. Quem chega por link não
    // pode "abrir" a sala de outra pessoa e virar dono dela.
    const token = tokenDoHost(codigo, { criarSeFaltar: criador });
    tokenRef.current = token;

    (async () => {
      try {
        if (token && criador) await abrirSala(codigo, token);
        // Mesmo quem acabou de criar passa pela autorização: é ela que
        // registra a vaga na contagem e grava quem é o dono.
        const decisao = decisaoDaEntrada(await autorizarEntrada(codigo, token, eu.id));
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
      // "Só o dono e os admins compartilham" tira do ar quem já estava
      // transmitindo sem ser um deles. Reagir aqui, no aviso do servidor,
      // e não num efeito sobre o estado: é o servidor que manda.
      //
      // "Bloquear novas entradas" de propósito não faz nada aqui: é uma
      // porta, não uma expulsão — quem já está na sala continua.
      const meuId = euRef.current?.id;
      const privilegiado = souDonoRef.current || novas.admins?.includes(meuId);
      if (novas.somenteHostCompartilha && !privilegiado && telaRef.current) {
        pararRef.current?.();
      }
    });
    return () => { vivo = false; desassinar(); };
  }, [ativo, codigo, criador, eu]);

  // ── Ciclo de vida da sala ──
  useEffect(() => {
    if (!ativo || !codigo || !nickname || !eu) return undefined;
    // Sem o "pode entrar" do servidor não se entra: nada de presence,
    // nada de WebRTC, nada de sinalização.
    if (entrada !== ENTRADA.AUTORIZADA) return undefined;
    euRef.current.nickname = nickname;

    const sala = entrarNaSala({
      codigo,
      eu: euRef.current,
      aoMudarParticipantes: (lista) => {
        const anteriores = participantesRef.current;
        setParticipantes(lista);

        // Quem saiu leva junto a conexão e a mídia que vinha dele.
        anteriores
          .filter((a) => !lista.some((p) => p.id === a.id))
          .forEach((a) => fecharConexao(a.id));

        // Quem chegou ganha conexão na hora, já com as minhas faixas: é
        // isso que faz um recém-chegado ver quem já estava transmitindo
        // sem ninguém precisar pedir.
        lista
          .filter((p) => p.id !== euRef.current?.id && !conexoesRef.current.has(p.id))
          .forEach((p) => assegurarConexao(p.id));
      },
      aoReceber,
      aoMudarStatus: setStatus,
    });
    salaRef.current = sala;

    const aoFechar = () => sala.sair();
    window.addEventListener('pagehide', aoFechar);

    return () => {
      window.removeEventListener('pagehide', aoFechar);
      telaRef.current?.getTracks().forEach((t) => t.stop());
      microfoneRef.current?.getTracks().forEach((t) => t.stop());
      telaRef.current = null;
      microfoneRef.current = null;
      fecharTudo();
      sala.sair();
      salaRef.current = null;
    };
    // `aoReceber` e os fechadores são estáveis por useCallback; o efeito
    // só deve rodar de novo quando muda a sala, a identidade ou a
    // autorização.
  }, [ativo, codigo, nickname, eu, entrada, aoReceber, assegurarConexao, fecharConexao, fecharTudo]);

  // ── A vaga na contagem do limite ──
  //
  // A autorização registrou a vaga; aqui ela é renovada enquanto a aba
  // vive e largada quando ela morre. Sem isso a sala lotaria de fantasmas.
  useEffect(() => {
    if (entrada !== ENTRADA.AUTORIZADA || !codigo || !eu) return undefined;
    const bater = () => { baterPonto(codigo, eu.id).catch(() => {}); };
    const timer = setInterval(bater, INTERVALO_PONTO);
    const aoFechar = () => { largarVaga(codigo, eu.id).catch(() => {}); };
    window.addEventListener('pagehide', aoFechar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', aoFechar);
      aoFechar();
    };
  }, [entrada, codigo, eu]);

  // Reconectar zera a presença do canal: preciso dizer de novo o que
  // estava dizendo, senão apareço mudo e sem transmitir para quem chegou.
  useEffect(() => {
    if (status !== STATUS.CONECTADO || !salaRef.current) return;
    salaRef.current.anunciar(estadoPresencaRef.current);
  }, [status]);

  // ── Quem está falando ──
  //
  // Medido do sinal, não anunciado: quem fala não sabe que está falando,
  // e mandar isso pelo canal encheria a sala de mensagens. Cada ponta
  // mede o que recebe.
  useEffect(() => {
    const micsRemotos = midiaRemota.filter((m) => m.tipo === 'microfone');
    if (!micsRemotos.length) {
      setFalando([]);
      return undefined;
    }
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return undefined;
    const ctx = new Contexto();
    const medidores = micsRemotos.map(({ peerId, stream }) => {
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analisador);
      return { peerId, analisador, dados: new Uint8Array(analisador.frequencyBinCount) };
    });

    let rodando = true;
    let anterior = '';
    const medir = () => {
      if (!rodando) return;
      const ativos = medidores.filter(({ analisador, dados }) => {
        analisador.getByteTimeDomainData(dados);
        let soma = 0;
        for (let i = 0; i < dados.length; i += 1) {
          const v = (dados[i] - 128) / 128;
          soma += v * v;
        }
        return Math.sqrt(soma / dados.length) > 0.045;
      }).map((m) => m.peerId);
      const assinatura = ativos.join(',');
      if (assinatura !== anterior) {
        anterior = assinatura;
        setFalando(ativos);
      }
      setTimeout(medir, 180);
    };
    medir();

    return () => {
      rodando = false;
      ctx.close().catch(() => {});
    };
  }, [midiaRemota]);

  // ── Comandos do dono ──
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

  const definirAdmin = useCallback(async (participanteId, admin) => {
    if (!tokenRef.current) return false;
    try {
      setRegras(await gravarAdmin(codigo, tokenRef.current, participanteId, admin));
      return true;
    } catch (e) {
      setErro(e.message || 'Não foi possível mudar os admins da sala.');
      return false;
    }
  }, [codigo]);

  // ── Derivados ──
  const donoId = regras.donoId;
  const admins = useMemo(() => regras.admins || [], [regras.admins]);
  const meuPapel = papelDe({ id: eu?.id, donoId, admins });

  // O que o palco mostra: a minha tela e a de cada um que está
  // transmitindo. A minha entra pelo stream local — não recebo de volta o
  // que eu mesmo mando, e é isso que impede o eco.
  const transmissoes = useMemo(() => {
    const lista = [];
    if (transmitindo && telaRef.current) {
      lista.push({
        id: eu?.id,
        eu: true,
        nickname: eu?.nickname || 'Você',
        stream: telaRef.current,
        comAudio,
      });
    }
    midiaRemota
      .filter((m) => m.tipo === 'tela')
      .forEach((m) => {
        const dono = participantes.find((p) => p.id === m.peerId);
        lista.push({
          id: m.peerId,
          eu: false,
          nickname: dono?.nickname || 'Participante',
          stream: m.stream,
          comAudio: m.stream.getAudioTracks().length > 0,
        });
      });
    return lista;
  }, [transmitindo, comAudio, midiaRemota, participantes, eu]);

  // Só os microfones dos OUTROS: tocar o meu seria eco garantido.
  const microfonesRemotos = useMemo(
    () => midiaRemota.filter((m) => m.tipo === 'microfone'),
    [midiaRemota],
  );

  const host = participantes.find((p) => p.id === donoId) || participantes[0] || null;
  const souHost = souDono;

  // Ação sobre outro participante. A mesma regra que o outro lado usa
  // para decidir se obedece é conferida aqui antes de mandar.
  const moderar = useCallback((alvoId, acao) => {
    const autorizado = podeModerar({
      donoId: regrasRef.current.donoId,
      admins: regrasRef.current.admins,
      autorId: euRef.current?.id,
      alvoId,
      acao,
    });
    if (!autorizado) return false;
    // Promover e rebaixar são estado da sala, não ordem entre pares: vão
    // ao banco, e chegam a todos por postgres_changes.
    if (acao === ACOES.PROMOVER) return definirAdmin(alvoId, true);
    if (acao === ACOES.REBAIXAR) return definirAdmin(alvoId, false);
    salaRef.current?.enviar(EVENTOS.MODERACAO, { para: alvoId, acao });
    return true;
  }, [definirAdmin]);

  return {
    eu,
    status,
    participantes,
    host,
    souHost,
    souDono,
    donoId,
    admins,
    meuPapel,
    transmitindo,
    comAudio,
    microfoneAtivo,
    mudo,
    falando,
    transmissoes,
    microfonesRemotos,
    bloqueado,
    removido,
    moderar,
    regras,
    entrada,
    barrado,
    definirRegrasDaSala,
    definirAdmin,
    encerrarParaTodos,
    streamLocal: telaRef,
    erro,
    compartilharTela,
    pararDeTransmitir,
    alternarMicrofone,
    desligarMicrofone,
  };
}
