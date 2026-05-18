import { supabase } from './supabase';

/**
 * Inserts a row into access_logs.
 *
 * @param {string} action  - Event name, e.g. 'open_admin_user', 'update_user_permissions'
 * @param {object} [opts]
 * @param {string}  [opts.targetUserId] - ID of the user being acted upon (admin actions).
 *                                         Falls back to the current user's own ID.
 * @param {'success'|'failure'} [opts.status='success']
 */
export async function logAccess(action, { targetUserId, status = 'success' } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('access_logs').insert({
      user_id: targetUserId ?? user.id,
      action,
      status,
      device: (navigator?.userAgent ?? '').slice(0, 300),
    });
  } catch {
    // Logging must never throw or block the main action.
  }
}
