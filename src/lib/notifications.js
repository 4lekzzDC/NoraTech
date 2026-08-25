import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Caixa de avisos do usuário.
//
// Ler e marcar como lida é tudo que o cliente pode fazer — quem CRIA
// notificação são os gatilhos no banco. Não existe função de "criar" aqui de
// propósito: se o navegador pudesse inserir, qualquer usuário forjaria aviso
// na caixa de outro (ver migration_20260825_notificacoes.sql).

const LIMITE = 30;

export async function listarNotificacoes({ limite = LIMITE } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, metadata, read_at, created_at, company_id')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

export async function contarNaoLidas() {
  // head + count: não traz linha nenhuma, só o número. O contador roda a cada
  // abertura de tela e não precisa do conteúdo.
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function marcarComoLida(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);   // não reescreve a data de quem já estava lida
  if (error) throw error;
}

export async function marcarTodasComoLidas() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/**
 * Estado das notificações para a UI.
 *
 * `marcarComoLida` e `marcarTodas` atualizam a tela ANTES da ida ao servidor e
 * desfazem se ela falhar. Clicar num aviso e esperar a rede para o contador
 * baixar faz a interface parecer travada num gesto que deveria ser instantâneo
 * — e o custo de errar é mínimo: no pior caso o aviso volta a aparecer.
 */
export function useNotificacoes({ ativo = true } = {}) {
  const [notificacoes, setNotificacoes] = useState([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const montado = useRef(true);

  // Precisa marcar `true` na montagem, e não só `false` na limpeza. Com o
  // StrictMode do React o efeito roda monta -> desmonta -> monta: sem a linha
  // de cima o ref ficava `false` para sempre depois do primeiro ciclo, todos
  // os guardas abaixo abortavam, e a tela travava em "Carregando…" sem erro
  // nenhum no console.
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const recarregar = useCallback(async () => {
    if (!ativo) return;
    setCarregando(true);
    try {
      const [lista, total] = await Promise.all([listarNotificacoes(), contarNaoLidas()]);
      if (!montado.current) return;
      setNotificacoes(lista);
      setNaoLidas(total);
      setErro(null);
    } catch (err) {
      if (!montado.current) return;
      // Nunca joga para cima: o sino é acessório, e uma falha aqui não pode
      // derrubar a tela em que a pessoa está trabalhando.
      console.warn('[notificações] não foi possível carregar:', err?.message);
      setErro(err?.message || 'Falha ao carregar');
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, [ativo]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const lerUma = useCallback(async (id) => {
    const antes = notificacoes;
    const antesNaoLidas = naoLidas;
    const alvo = antes.find((n) => n.id === id);
    if (!alvo || alvo.read_at) return;

    const agora = new Date().toISOString();
    setNotificacoes(antes.map((n) => (n.id === id ? { ...n, read_at: agora } : n)));
    setNaoLidas(Math.max(0, antesNaoLidas - 1));

    try {
      await marcarComoLida(id);
    } catch (err) {
      console.warn('[notificações] falha ao marcar como lida:', err?.message);
      if (!montado.current) return;
      setNotificacoes(antes);
      setNaoLidas(antesNaoLidas);
    }
  }, [notificacoes, naoLidas]);

  const lerTodas = useCallback(async () => {
    const antes = notificacoes;
    const antesNaoLidas = naoLidas;
    if (antesNaoLidas === 0) return;

    const agora = new Date().toISOString();
    setNotificacoes(antes.map((n) => (n.read_at ? n : { ...n, read_at: agora })));
    setNaoLidas(0);

    try {
      await marcarTodasComoLidas();
    } catch (err) {
      console.warn('[notificações] falha ao marcar todas:', err?.message);
      if (!montado.current) return;
      setNotificacoes(antes);
      setNaoLidas(antesNaoLidas);
    }
  }, [notificacoes, naoLidas]);

  return { notificacoes, naoLidas, carregando, erro, recarregar, lerUma, lerTodas };
}

// Quanto tempo faz, em português e curto o suficiente para caber na linha do
// aviso. Sem biblioteca: é uma escada de seis faixas, e trazer uma dependência
// de datas para isto custaria mais que o código.
export function tempoRelativo(iso) {
  if (!iso) return '';
  const segundos = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(segundos)) return '';
  if (segundos < 60) return 'agora';
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `${dias} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
