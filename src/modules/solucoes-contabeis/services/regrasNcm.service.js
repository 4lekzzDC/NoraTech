// Persistência das regras de NCM do DIFAL — base global (mantida pelo admin
// da plataforma) e ajustes por escritório.
//
// A conversão de linha de banco para o objeto que o motor consome mora em
// `sistemas/difal/regrasNcmMerge.js`, que é pura e testada. Aqui fica só o
// que precisa de rede: buscar as linhas certas e gravar.
//
// `escopo` aparece em toda função pública, no mesmo formato:
// `{ tenantCompanyId: null }` para mexer na base global (exige ser admin da
// plataforma — a RLS barra o resto) e `{ tenantCompanyId: 'uuid' }` para
// mexer no ajuste de um escritório (exige owner/admin daquele escritório).

import { supabase } from '../../../lib/supabase';
import { montarTabelaUf } from '../sistemas/difal/regrasNcmMerge';
import { validarTabela } from '../sistemas/difal/ncmRegras';

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  if (/duplicate key|unique constraint/i.test(msg)) return 'Já existe uma regra para esse NCM, UF e vigência.';
  if (/row-level security/i.test(msg)) return 'Sem permissão para alterar esta regra.';
  return msg;
}

function whereEscopo(query, coluna, tenantCompanyId) {
  return tenantCompanyId ? query.eq(coluna, tenantCompanyId) : query.is(coluna, null);
}

/**
 * Monta a tabela de uma UF pronta para o motor — base global mais o ajuste
 * do escritório, se houver. `null` quando a UF não tem config nenhuma.
 */
export async function carregarTabelaUf(uf, tenantCompanyId) {
  const [configs, regras] = await Promise.all([
    supabase.from('difal_uf_config').select('*').eq('uf', uf)
      .or(tenantCompanyId ? `tenant_company_id.is.null,tenant_company_id.eq.${tenantCompanyId}` : 'tenant_company_id.is.null'),
    supabase.from('difal_regras_ncm').select('*').eq('uf', uf)
      .or(tenantCompanyId ? `tenant_company_id.is.null,tenant_company_id.eq.${tenantCompanyId}` : 'tenant_company_id.is.null'),
  ]);
  if (configs.error) throw new Error(translate(configs.error));
  if (regras.error) throw new Error(translate(regras.error));

  const configGlobal = (configs.data || []).find((c) => !c.tenant_company_id) || null;
  const configTenant = (configs.data || []).find((c) => c.tenant_company_id === tenantCompanyId) || null;
  const regrasGlobais = (regras.data || []).filter((r) => !r.tenant_company_id);
  const regrasTenant = (regras.data || []).filter((r) => r.tenant_company_id === tenantCompanyId);

  return montarTabelaUf({ uf, configGlobal, configTenant, regrasGlobais, regrasTenant });
}

// ── Config da UF ────────────────────────────────────────────────────────

export async function listarConfigsUf(escopo = {}) {
  let query = supabase.from('difal_uf_config').select('*').order('uf', { ascending: true });
  query = whereEscopo(query, 'tenant_company_id', escopo.tenantCompanyId);
  const { data, error } = await query;
  if (error) throw new Error(translate(error));
  return data || [];
}

// Uma config por UF/escopo — cria na primeira vez, atualiza depois. Feito
// como select-então-decide (não `.upsert()`) porque o índice único é uma
// expressão (`coalesce(tenant_company_id, sentinela)`), e o upsert do
// PostgREST só casa contra constraint nomeada, não contra índice de
// expressão.
export async function salvarConfigUf(config, escopo = {}) {
  const uf = String(config.uf || '').toUpperCase();
  const payload = {
    uf,
    versao: config.versao || null,
    metodo_base: config.metodoBase || 'base_simples',
    politica_revenda: config.politicaRevenda || 'nao_incide',
    regra_geral_aliquota: config.regraGeralAliquota,
    regra_geral_fcp: config.regraGeralFcp || 0,
    regra_geral_fundamento: config.regraGeralFundamento,
    tenant_company_id: escopo.tenantCompanyId || null,
  };

  let query = supabase.from('difal_uf_config').select('id').eq('uf', uf);
  query = whereEscopo(query, 'tenant_company_id', escopo.tenantCompanyId);
  const { data: existente, error: erroBusca } = await query.maybeSingle();
  if (erroBusca) throw new Error(translate(erroBusca));

  const { data, error } = existente
    ? await supabase.from('difal_uf_config').update(payload).eq('id', existente.id).select('*').single()
    : await supabase.from('difal_uf_config').insert(payload).select('*').single();
  if (error) throw new Error(translate(error));
  return data;
}

export async function excluirConfigUf(id) {
  const { error } = await supabase.from('difal_uf_config').delete().eq('id', id);
  if (error) throw new Error(translate(error));
}

// ── Regras por NCM ─────────────────────────────────────────────────────

export async function listarRegras(uf, escopo = {}) {
  let query = supabase.from('difal_regras_ncm').select('*').eq('uf', uf)
    .order('ncm_prefixo', { ascending: true });
  query = whereEscopo(query, 'tenant_company_id', escopo.tenantCompanyId);
  const { data, error } = await query;
  if (error) throw new Error(translate(error));
  return data || [];
}

function paraLinha(regra, escopo, criadoPor) {
  return {
    uf: String(regra.uf || '').toUpperCase(),
    ncm_prefixo: String(regra.ncm || '').replace(/\D+/g, ''),
    aliquota: regra.seguirGeral ? null : regra.aliquota,
    segue_geral: Boolean(regra.seguirGeral),
    fcp: regra.fcp ?? null,
    tipo: regra.tipo,
    excecao_de: regra.excecaoDe ? String(regra.excecaoDe).replace(/\D+/g, '') : null,
    fundamento: regra.fundamento,
    vigencia_inicio: regra.vigenciaInicio || null,
    vigencia_fim: regra.vigenciaFim || null,
    fonte: regra.fonte || 'manual',
    tenant_company_id: escopo.tenantCompanyId || null,
    ...(criadoPor ? { created_by: criadoPor } : {}),
  };
}

async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/**
 * Cria ou atualiza uma regra. Antes de gravar, confere o resultado com
 * `validarTabela` — as regras já existentes daquela UF/escopo mais esta,
 * simuladas juntas. É a mesma checagem que protegia o arquivo, só que
 * agora rodando contra o que está de fato cadastrado no banco.
 */
export async function salvarRegra(regra, escopo = {}, id = null) {
  const linha = paraLinha(regra, escopo, id ? null : await usuarioAtual());
  const existentes = await listarRegras(linha.uf, escopo);
  const simulada = { ...linha, ncm: linha.ncm_prefixo, seguirGeral: linha.segue_geral, excecaoDe: linha.excecao_de, vigenciaInicio: linha.vigencia_inicio, vigenciaFim: linha.vigencia_fim };
  const outras = existentes.filter((e) => e.id !== id).map((e) => ({
    ncm: e.ncm_prefixo, tipo: e.tipo, aliquota: e.aliquota, seguirGeral: e.segue_geral,
    fcp: e.fcp, excecaoDe: e.excecao_de, fundamento: e.fundamento,
    vigenciaInicio: e.vigencia_inicio, vigenciaFim: e.vigencia_fim,
  }));
  const erros = validarTabela({
    uf: linha.uf, regraGeral: { aliquota: 18, fcp: 0, fundamento: 'x' },
    regras: [...outras, simulada],
  });
  if (erros.length) throw new Error(erros[0]);

  const query = id
    ? supabase.from('difal_regras_ncm').update(linha).eq('id', id)
    : supabase.from('difal_regras_ncm').insert(linha);
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(translate(error));
  return data;
}

export async function excluirRegra(id) {
  const { error } = await supabase.from('difal_regras_ncm').delete().eq('id', id);
  if (error) throw new Error(translate(error));
}

/**
 * Importa várias regras de uma vez — planilha digitada pela equipe hoje,
 * ou o que um coletor externo (a Econet, quando o acesso de teste chegar)
 * vier a produzir amanhã. As duas fontes passam pelo MESMO contrato: uma
 * lista de `{ uf, ncm, aliquota|seguirGeral, tipo, fundamento, ... }`.
 *
 * Não sobrescreve por padrão: NCM que já existe naquele escopo/UF/vigência
 * entra na lista de conflitos em vez de substituir silenciosamente — um
 * import errado não pode apagar cadastro manual sem avisar.
 *
 * @returns {Promise<{gravadas: number, conflitos: Array, erros: Array}>}
 */
export async function importarRegras(linhas, escopo = {}, { sobrescrever = false } = {}) {
  const uf = String(linhas[0]?.uf || '').toUpperCase();
  const existentes = await listarRegras(uf, escopo);
  const porChave = new Map(existentes.map((e) => [
    `${e.ncm_prefixo}|${e.vigencia_inicio || ''}`, e,
  ]));

  const resultado = { gravadas: 0, conflitos: [], erros: [] };
  for (const linha of linhas) {
    const chave = `${String(linha.ncm || '').replace(/\D+/g, '')}|${linha.vigenciaInicio || ''}`;
    const existente = porChave.get(chave);
    if (existente && !sobrescrever) {
      resultado.conflitos.push({ ncm: linha.ncm, motivo: 'Já cadastrado — marque para sobrescrever.' });
      continue;
    }
    try {
      await salvarRegra({ ...linha, uf, fonte: linha.fonte || 'planilha' }, escopo, existente?.id || null);
      resultado.gravadas += 1;
    } catch (erro) {
      resultado.erros.push({ ncm: linha.ncm, motivo: erro.message });
    }
  }
  return resultado;
}
