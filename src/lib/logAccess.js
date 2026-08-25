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

/**
 * Registra entrada/saída da própria sessão, via RPC em vez de INSERT direto.
 *
 * A diferença importa. Um INSERT do navegador deixa o próprio usuário escolher
 * o `user_id` que vai na linha — a policy limita ao `auth.uid()` dele, mas é o
 * cliente que monta a linha. A RPC `register_access_log` é SECURITY DEFINER e
 * preenche `user_id` com `auth.uid()` do lado do servidor: quem chama não tem
 * como dizer que a entrada foi de outra pessoa. Ela também atualiza
 * `profiles.last_sign_in_at` na mesma transação.
 *
 * O IP fica nulo de propósito. O navegador não conhece o próprio IP público, e
 * aceitar um valor que ele informe seria pior que não ter campo nenhum: um
 * dado forjável numa trilha de auditoria engana quem for lê-la depois. IP de
 * verdade só o servidor vê.
 *
 * Só funciona com sessão ativa — a RPC não é executável por `anon`. Tentativa
 * de login que FALHA, portanto, não passa por aqui: sem sessão não há
 * `auth.uid()`, e atribuir a tentativa a um e-mail digitado seria confiar no
 * que o cliente falou. Registrar login malsucedido exige o servidor.
 */
export async function registrarAcesso(action) {
  try {
    const { error } = await supabase.rpc('register_access_log', {
      p_action: action,
      p_device: (navigator?.userAgent ?? '').slice(0, 300),
      p_status: 'success',
    });
    if (error) {
      console.warn('[access_logs] não foi possível registrar "%s": %s', action, error.message);
    }
  } catch (err) {
    console.warn('[access_logs] falha ao registrar "%s":', action, err?.message);
  }
}
