// Stub: o preview não fala com banco nenhum.
const vazio = { data: null, error: null };
const chain = new Proxy(() => chain, {
  get: (_, k) => (k === 'then' ? undefined : chain),
  apply: () => chain,
});
export const supabase = {
  from: () => chain,
  rpc: async () => vazio,
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => vazio },
};
export default supabase;
export const AVATARS_BUCKET = 'avatars';
export function purgeLocalSession() {}
