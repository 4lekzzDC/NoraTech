// Persistência das apurações de DIFAL.
//
// A conversão de forma (resultado do motor ↔ linhas) mora em
// `sistemas/difal/difalPersistencia.js`, que é puro e testado. Aqui fica só
// o que precisa de rede: gravar, listar, carregar, fechar e apagar.
//
// Os ids das notas são gerados no cliente, com crypto.randomUUID(), em vez de
// vir do RETURNING do insert. Assim os itens já nascem sabendo a que nota
// pertencem, e as duas tabelas entram em lote — sem depender da ordem em que
// o PostgREST devolve as linhas inseridas, que não é contrato de ninguém.

import { supabase } from '../../../lib/supabase';
import { getCurrentTenantCompanyId } from '../../../lib/subscriptions';
import {
  linhasParaGravar, resultadoDeLinhas,
} from '../sistemas/difal/difalPersistencia';

export { getCurrentTenantCompanyId };

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  if (/duplicate key|unique constraint/i.test(msg)) return 'Esta nota já está nesta apuração.';
  return msg;
}

// Lotes grandes viram payloads grandes. 500 linhas por requisição mantém o
// corpo em alguns MB mesmo com o XML junto.
const TAMANHO_LOTE = 500;

async function inserirEmLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const { error } = await supabase.from(tabela).insert(linhas.slice(i, i + TAMANHO_LOTE));
    if (error) throw new Error(translate(error));
  }
}

function novoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/**
 * Grava (ou regrava) uma apuração inteira.
 *
 * Regravar apaga as notas antigas e insere as novas em vez de tentar casar
 * linha a linha: a apuração é o retrato de um processamento, e meio retrato
 * antigo misturado com meio novo não é um estado que alguém queira auditar.
 * O cascade da FK leva os itens junto.
 *
 * @returns {Promise<string>} id da apuração
 */
export async function salvarApuracao(resultado, contexto, xmls = {}) {
  const tenantCompanyId = contexto.tenantCompanyId || await getCurrentTenantCompanyId();
  if (!tenantCompanyId) throw new Error('Sem equipe ativa para gravar a apuração.');

  const { apuracao, notas } = linhasParaGravar(
    resultado,
    { ...contexto, tenantCompanyId, createdBy: contexto.createdBy ?? await usuarioAtual() },
    xmls,
  );

  let apuracaoId = contexto.apuracaoId || null;

  if (apuracaoId) {
    // `created_by` sai do payload (undefined não é serializado): quem criou a
    // apuração continua sendo quem criou, mesmo que outra pessoa da equipe a
    // regrave depois.
    const { error } = await supabase
      .from('difal_apuracoes')
      .update({ ...apuracao, created_by: undefined })
      .eq('id', apuracaoId)
      .eq('tenant_company_id', tenantCompanyId);
    if (error) throw new Error(translate(error));

    const { error: erroLimpeza } = await supabase
      .from('difal_apuracao_notas').delete().eq('apuracao_id', apuracaoId);
    if (erroLimpeza) throw new Error(translate(erroLimpeza));
  } else {
    const { data, error } = await supabase
      .from('difal_apuracoes').insert(apuracao).select('id').single();
    if (error) throw new Error(translate(error));
    apuracaoId = data.id;
  }

  const linhasNotas = [];
  const linhasItens = [];
  for (const { nota, itens } of notas) {
    const notaId = novoId();
    linhasNotas.push({ ...nota, id: notaId, apuracao_id: apuracaoId });
    for (const item of itens) linhasItens.push({ ...item, nota_id: notaId });
  }

  await inserirEmLotes('difal_apuracao_notas', linhasNotas);
  await inserirEmLotes('difal_apuracao_itens', linhasItens);

  return apuracaoId;
}

const COLUNAS_LISTA = `
  id, competencia, uf_destino, status, totais, metodo_base, politica_revenda,
  versao_motor, versao_tabela, created_at, updated_at, fechada_em,
  accounting_company_id,
  cliente:accounting_companies ( id, nome, cnpj )
`;

export async function listarApuracoes(tenantCompanyId, { limite = 50 } = {}) {
  if (!tenantCompanyId) return [];
  const { data, error } = await supabase
    .from('difal_apuracoes')
    .select(COLUNAS_LISTA)
    .eq('tenant_company_id', tenantCompanyId)
    .order('competencia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(translate(error));
  return data || [];
}

/**
 * Carrega uma apuração salva no mesmo formato que `processarLote` devolve —
 * a tela desenha histórico e processamento ao vivo com o mesmo código.
 *
 * @returns {Promise<{apuracao: object, resultado: object, xmls: object}>}
 */
export async function carregarApuracao(id) {
  const { data: apuracao, error } = await supabase
    .from('difal_apuracoes')
    .select(COLUNAS_LISTA)
    .eq('id', id)
    .single();
  if (error) throw new Error(translate(error));

  const { data: notas, error: erroNotas } = await supabase
    .from('difal_apuracao_notas')
    .select('*, itens:difal_apuracao_itens ( * )')
    .eq('apuracao_id', id)
    .order('created_at', { ascending: true });
  if (erroNotas) throw new Error(translate(erroNotas));

  const xmls = (notas || []).reduce((acc, n) => {
    if (n.arquivo && n.xml) acc[n.arquivo] = n.xml;
    return acc;
  }, {});

  return { apuracao, resultado: resultadoDeLinhas(apuracao, notas || []), xmls };
}

export async function fecharApuracao(id, fechada = true) {
  const { error } = await supabase
    .from('difal_apuracoes')
    .update({ status: fechada ? 'fechada' : 'aberta', fechada_em: fechada ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(translate(error));
}

export async function excluirApuracao(id) {
  const { error } = await supabase.from('difal_apuracoes').delete().eq('id', id);
  if (error) throw new Error(translate(error));
}

/**
 * Quais destas chaves já entraram em alguma apuração da equipe.
 *
 * Pagar DIFAL duas vezes pela mesma nota é o erro clássico deste processo —
 * acontece quando o mesmo XML volta num lote de outro mês. O motor não tem
 * como saber disso sozinho (ele só vê o lote da vez); o banco tem.
 *
 * @returns {Promise<Object>} { [chave]: { apuracaoId, competencia, status } }
 */
export async function notasJaApuradas(tenantCompanyId, chaves, { exceto = null } = {}) {
  const alvo = [...new Set((chaves || []).filter(Boolean))];
  if (!tenantCompanyId || !alvo.length) return {};

  let query = supabase
    .from('difal_apuracao_notas')
    .select('chave, apuracao_id, apuracao:difal_apuracoes ( id, competencia, status )')
    .eq('tenant_company_id', tenantCompanyId)
    .in('chave', alvo);
  if (exceto) query = query.neq('apuracao_id', exceto);

  const { data, error } = await query;
  if (error) throw new Error(translate(error));

  return (data || []).reduce((acc, linha) => {
    if (!linha.chave || acc[linha.chave]) return acc;
    acc[linha.chave] = {
      apuracaoId: linha.apuracao_id,
      competencia: linha.apuracao?.competencia || null,
      status: linha.apuracao?.status || null,
    };
    return acc;
  }, {});
}
