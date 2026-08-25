import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../contexts/AuthContext';

// Área de DEV: quem entra, os logs do sistema e a identidade do site.
//
// A marca `is_developer` é separada de `role = 'admin'` de propósito. Hoje as
// duas coincidem porque só existe um admin — mas no dia em que alguém for
// promovido a admin para cuidar de faturas e suporte, essa pessoa não deve
// herdar uma tela que mostra stack trace e log de todos os escritórios.
//
// O gate de verdade está no banco: `logs_do_sistema()` levanta exceção sem
// `is_developer()`, e `app_errors` tem RLS. O hook abaixo só decide o que
// desenhar — esconder o menu não é proteção.

export function useIsDeveloper() {
  const { user, loading: authLoading } = useAuth();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return undefined;
    let ativo = true;

    (async () => {
      if (!user) {
        if (ativo) { setIsDeveloper(false); setLoading(false); }
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('is_developer')
        .eq('id', user.id)
        .maybeSingle();
      if (!ativo) return;
      if (error) console.warn('[dev] falha ao checar is_developer:', error.message);
      setIsDeveloper(Boolean(data?.is_developer));
      setLoading(false);
    })();

    return () => { ativo = false; };
  }, [user, authLoading]);

  return { isDeveloper, loading: authLoading || loading };
}

// ── Logs ────────────────────────────────────────────────────────────────

export const CATEGORIAS = [
  { id: null,             label: 'Tudo' },
  { id: 'erro',           label: 'Erros' },
  { id: 'autenticacao',   label: 'Acessos' },
  { id: 'admin',          label: 'Administração' },
  { id: 'documento',      label: 'Documentos' },
  { id: 'classificacao',  label: 'Classificação' },
  { id: 'cobranca',       label: 'Cobrança' },
  { id: 'notificacao',    label: 'Notificações' },
];

export async function buscarLogs({ categoria = null, busca = '', desde = null, limite = 100, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('logs_do_sistema', {
    p_categoria: categoria,
    p_busca: busca || null,
    p_desde: desde,
    p_ate: null,
    p_limite: limite,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

export async function contarPorCategoria(desde = null) {
  const { data, error } = await supabase.rpc('logs_por_categoria', { p_desde: desde });
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.categoria, Number(r.total)]));
}

// ── Identidade do site ──────────────────────────────────────────────────

export async function buscarIdentidade() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('site_name, tagline, logo_url, logo_dark_url, favicon_url, maintenance_mode, maintenance_message, updated_at')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function salvarIdentidade(campos) {
  const { error } = await supabase
    .from('site_settings')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw error;
}

const BUCKET_BRANDING = 'site-branding';

/**
 * Sobe um arquivo de identidade e devolve a URL pública.
 *
 * O nome carrega o instante do envio em vez de ser fixo por tipo. Um nome fixo
 * seria sobrescrito, e aí a URL não muda — então o navegador, o CDN e o
 * favicon já em cache continuariam servindo a imagem antiga, e a troca
 * pareceria não ter funcionado. Nome novo a cada envio contorna o cache por
 * construção, sem depender de `?v=` nem de cabeçalho.
 */
export async function enviarArquivoDeMarca(tipo, arquivo) {
  const ext = (arquivo.name.split('.').pop() || 'png').toLowerCase();
  const caminho = `${tipo}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_BRANDING)
    .upload(caminho, arquivo, { cacheControl: '31536000', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_BRANDING).getPublicUrl(caminho);
  return data.publicUrl;
}

/**
 * Aplica favicon e título na aba. Chamado na inicialização do app.
 *
 * O index.html traz `/favicon.svg` e um título fixos; sem isto, trocar a
 * identidade no painel não mudaria nada do que o visitante vê na aba. Falha em
 * silêncio de propósito: identidade é acabamento, e não pode impedir o app de
 * subir se a consulta não responder.
 */
export async function aplicarIdentidadeDoSite() {
  try {
    const identidade = await buscarIdentidade();
    if (!identidade) return;

    if (identidade.site_name) {
      document.title = identidade.tagline
        ? `${identidade.site_name} — ${identidade.tagline}`
        : identidade.site_name;
    }

    if (identidade.favicon_url) {
      // Remove os antigos antes de inserir: navegador que encontra dois
      // <link rel="icon"> escolhe um deles, e nem sempre o último.
      document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = identidade.favicon_url;
      document.head.appendChild(link);
    }
  } catch (err) {
    console.warn('[identidade] não foi possível aplicar:', err?.message);
  }
}

export function useIdentidadeDoSite() {
  const [identidade, setIdentidade] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await buscarIdentidade();
      if (montado.current) setIdentidade(dados);
    } catch (err) {
      console.warn('[identidade] falha ao carregar:', err?.message);
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { identidade, carregando, recarregar, setIdentidade };
}

// ── Modo de manutenção ──────────────────────────────────────────────────
//
// É bloqueio de TELA, não de API. Quem tiver a anon key — que é pública, está
// no bundle — continua alcançando o PostgREST com o modo ligado. Serve para
// impedir que gente use o produto durante uma migração, não para conter quem
// está tentando entrar à força. Bloquear de verdade exigiria derrubar o
// projeto Supabase ou pôr um WAF na frente.

export async function definirManutencao(ligado, mensagem) {
  await salvarIdentidade({
    maintenance_mode: Boolean(ligado),
    maintenance_message: mensagem?.trim() || null,
  });
}

export async function estadoDeManutencao() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('maintenance_mode, maintenance_message')
    .maybeSingle();
  if (error) throw error;
  return data || { maintenance_mode: false, maintenance_message: null };
}

// ── Status do ambiente ──────────────────────────────────────────────────

export async function statusDoAmbiente() {
  const { data, error } = await supabase.rpc('status_do_ambiente');
  if (error) throw error;
  return data;
}

// ── Blocklist de IP ─────────────────────────────────────────────────────

export async function listarBloqueios() {
  const { data, error } = await supabase
    .from('ip_blocklist')
    .select('ip, motivo, bloqueado_em, expira_em, acertos, ultimo_acerto')
    .order('bloqueado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function bloquearIp({ ip, motivo, expiraEm }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('ip_blocklist').upsert({
    ip: ip.trim(),
    motivo: motivo?.trim() || null,
    expira_em: expiraEm || null,
    bloqueado_por: user?.id ?? null,
  }, { onConflict: 'ip' });
  if (error) throw error;
}

export async function desbloquearIp(ip) {
  const { error } = await supabase.from('ip_blocklist').delete().eq('ip', ip);
  if (error) throw error;
}

// ── Teste de envio de e-mail ────────────────────────────────────────────

/**
 * Dispara um e-mail de verdade pelo caminho que o produto usa.
 *
 * Não existe SMTP próprio neste projeto: o único e-mail que sai daqui é o do
 * Supabase Auth (confirmação de cadastro e recuperação de senha). Um "testador
 * de SMTP" testaria credenciais que não existem — então o teste usa o caminho
 * real, `resetPasswordForEmail`.
 *
 * O que isto prova, e o que não prova. Prova que o Supabase ACEITOU o pedido de
 * envio: se as credenciais de e-mail do projeto estiverem quebradas ou a cota
 * estourada, o erro aparece aqui. Não prova entrega — caixa cheia, spam e
 * bloqueio do destinatário acontecem depois e ninguém deste lado fica sabendo.
 * Por isso a tela pede para conferir a caixa, em vez de declarar sucesso.
 *
 * Cuidado de uso: manda um link de recuperação de senha REAL. Use um endereço
 * seu, não o de um cliente.
 */
export async function testarEnvioDeEmail(email) {
  const alvo = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
    throw new Error('Informe um e-mail válido.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) throw error;
  return alvo;
}
