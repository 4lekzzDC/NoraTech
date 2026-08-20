import { supabase } from '../../../lib/supabase';

// Tokens de entrada — a credencial que o complemento do Gmail usa para provar
// de que escritório ele é.
//
// O token em claro existe UMA vez: no retorno de `gerarToken`. O banco guarda
// só o hash SHA-256, e nem esta camada nem o servidor conseguem recuperá-lo
// depois. Quem perder o token não recupera, gera outro — que é exatamente o
// comportamento que se quer de uma credencial.
//
// Desenho em docs/noradocs/etapa2-gmail.md §2.

export async function listarTokens(tenantId) {
  const { data, error } = await supabase
    .from('noradocs_inbound_tokens')
    // token_hash fica de fora de propósito. Não é reversível e vazá-lo para a
    // tela não abriria porta nenhuma, mas uma credencial não tem por que
    // trafegar até o navegador quando nada ali precisa dela.
    .select('id, label, created_at, last_used_at, revoked_at')
    .eq('tenant_company_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function gerarToken(tenantId, label) {
  const { data, error } = await supabase.rpc('noradocs_create_inbound_token', {
    p_company_id: tenantId,
    p_label: label || null,
  });
  if (error) throw new Error(error.message);
  return data; // o token em claro — mostre uma vez e esqueça
}

export async function revogarToken(id) {
  const { error } = await supabase.rpc('noradocs_revoke_inbound_token', { p_token_id: id });
  if (error) throw new Error(error.message);
}
