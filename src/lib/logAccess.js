import { supabase } from './supabase';

/**
 * Registra uma linha em access_logs.
 *
 * Nunca lança e nunca bloqueia a ação principal — mas TAMBÉM não engole a
 * falha em silêncio. O cliente do Supabase não lança quando a RLS recusa a
 * escrita: ele devolve `{ error }`. Um `await` sem checar esse retorno faz a
 * recusa desaparecer, e foi exatamente assim que a trilha de auditoria deste
 * painel ficou vazia sem ninguém notar: toda ação de admin sobre OUTRO
 * usuário era recusada pela policy de INSERT, e o painel mostrava
 * "nenhum log" como se nada tivesse acontecido.
 *
 * @param {string} action  - Nome do evento, ex.: 'open_admin_user'
 * @param {object} [opts]
 * @param {string}  [opts.targetUserId] - ID do usuário sobre o qual se age
 *                                        (ações de admin). Padrão: o próprio.
 * @param {'success'|'failure'} [opts.status='success']
 */
export async function logAccess(action, { targetUserId, status = 'success' } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('access_logs').insert({
      user_id: targetUserId ?? user.id,
      action,
      status,
      device: (navigator?.userAgent ?? '').slice(0, 300),
    });

    if (error) {
      console.warn('[access_logs] não foi possível registrar "%s": %s', action, error.message);
    }
  } catch (err) {
    // Registrar log nunca pode derrubar a ação que estava sendo feita.
    console.warn('[access_logs] falha ao registrar "%s":', action, err?.message);
  }
}
