let tokens = [
  { id: 't1', label: 'Gmail da Ana', created_at: '2026-08-14T10:00:00Z', last_used_at: '2026-08-19T14:22:00Z', revoked_at: null },
  { id: 't2', label: null, created_at: '2026-08-18T09:10:00Z', last_used_at: null, revoked_at: null },
];
export const listarTokens = async () => tokens;
export const gerarToken = async (_t, label) => {
  tokens = [...tokens, { id: 't' + (tokens.length + 1), label: label || null, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null }];
  return 'ndin_b415e2eb7f51a36ac4c1369b1632c00cd56e307d73df5fbb1354ad77756a2c57';
};
export const revogarToken = async (id) => { tokens = tokens.map((t) => (t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t)); };
