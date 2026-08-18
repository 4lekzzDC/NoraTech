import { supabase } from '../../../lib/supabase';
import { onlyDigits } from '../domain/cnpj';

// Acesso à tabela `noradocs_clients` — as empresas atendidas pelo escritório.
// O isolamento entre escritórios é responsabilidade do RLS, não daqui: toda
// consulta abaixo já sai filtrada pelo banco. O `tenant_company_id` aparece só
// na escrita, porque o INSERT precisa dizer de quem é a linha.

const SELECT = `
  id, nome, cnpj, cpf, email, telefone, regime, aliases, ativo,
  drive_folder_id, folder_name_override, accounting_company_id,
  created_at, updated_at
`;

// Normaliza o que veio do formulário: string vazia vira null (para o índice
// único parcial de CNPJ não tratar "" como valor), documentos perdem a
// máscara, apelidos viram array limpo.
function toRow(input) {
  const aliases = Array.isArray(input.aliases)
    ? input.aliases
    : String(input.aliases || '').split(',');

  const blankToNull = (v) => {
    const trimmed = String(v ?? '').trim();
    return trimmed === '' ? null : trimmed;
  };

  return {
    nome: String(input.nome || '').trim(),
    cnpj: onlyDigits(input.cnpj) || null,
    cpf: onlyDigits(input.cpf) || null,
    email: blankToNull(input.email),
    telefone: blankToNull(input.telefone),
    regime: blankToNull(input.regime),
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    ativo: input.ativo !== false,
  };
}

// O índice único é (tenant, cnpj). Traduzir o 23505 aqui evita que a tela
// mostre "duplicate key value violates unique constraint" para um contador.
function translateError(error) {
  if (error?.code === '23505') {
    return new Error('Já existe um cliente com este CNPJ neste escritório.');
  }
  return new Error(error?.message || 'Não foi possível salvar o cliente.');
}

export async function listClients({ search = '', apenasAtivos = false } = {}) {
  let query = supabase
    .from('noradocs_clients')
    .select(SELECT)
    .order('ativo', { ascending: false })
    .order('nome', { ascending: true });

  if (apenasAtivos) query = query.eq('ativo', true);

  // Vírgula e parênteses são separadores na sintaxe de `or()` do PostgREST —
  // buscar por "Silva, ME" montaria um filtro quebrado. Como são pontuação sem
  // valor de busca, saem do termo antes de virar filtro.
  const term = search.trim().replace(/[,()]/g, ' ').trim();
  if (term) {
    // Busca por nome ou por CNPJ digitado com ou sem máscara.
    const digits = onlyDigits(term);
    const filters = [`nome.ilike.%${term}%`];
    if (digits) filters.push(`cnpj.ilike.%${digits}%`);
    query = query.or(filters.join(','));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createClient(tenantId, input) {
  const { data, error } = await supabase
    .from('noradocs_clients')
    .insert({ ...toRow(input), tenant_company_id: tenantId })
    .select(SELECT)
    .single();
  if (error) throw translateError(error);
  return data;
}

export async function updateClient(id, input) {
  const { data, error } = await supabase
    .from('noradocs_clients')
    .update(toRow(input))
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw translateError(error);
  return data;
}

// Inativar é a ação de rotina: o cliente sai da classificação sem levar junto
// o histórico dos documentos que já foram arquivados no nome dele.
export async function setClientAtivo(id, ativo) {
  const { data, error } = await supabase
    .from('noradocs_clients')
    .update({ ativo })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw translateError(error);
  return data;
}

export async function deleteClient(id) {
  const { error } = await supabase.from('noradocs_clients').delete().eq('id', id);
  if (error) throw translateError(error);
}

// ── Importação do hub Soluções Contábeis ─────────────────────────────────
//
// O escritório que já usa o outro produto tem os clientes cadastrados lá. O
// RLS de `accounting_companies` exige assinatura ativa daquele sistema, então
// quem não assina simplesmente recebe lista vazia — não é erro.
//
// Só vem nome e regime: `accounting_companies` não guarda CNPJ. É uma
// importação que adianta a digitação, não que completa o cadastro — e a tela
// diz isso, para o CNPJ não ficar faltando sem ninguém perceber.

export async function fetchImportaveis(tenantId) {
  const [{ data: origem, error }, { data: jaImportados }] = await Promise.all([
    supabase
      .from('accounting_companies')
      .select('id, nome, regime')
      .eq('tenant_company_id', tenantId)
      .order('nome'),
    supabase
      .from('noradocs_clients')
      .select('accounting_company_id')
      .not('accounting_company_id', 'is', null),
  ]);

  if (error) return [];
  const vinculados = new Set((jaImportados || []).map((c) => c.accounting_company_id));
  return (origem || []).filter((c) => !vinculados.has(c.id));
}

export async function importarDoContabil(tenantId, candidatos) {
  if (!candidatos.length) return [];
  const rows = candidatos.map((c) => ({
    tenant_company_id: tenantId,
    nome: c.nome,
    regime: c.regime || null,
    accounting_company_id: c.id,
    aliases: [],
  }));

  const { data, error } = await supabase
    .from('noradocs_clients')
    .insert(rows)
    .select(SELECT);
  if (error) throw translateError(error);
  return data || [];
}
