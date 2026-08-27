// Dublê do serviço de regras de NCM — store em memória, sem banco.
//
// Usa as funções REAIS (`montarTabelaUf`, `validarTabela`), não uma versão
// simplificada: a preview exercita o mesmo caminho de merge que roda em
// produção. Semeado com a mesma base de SP que a migration grava no banco,
// para a tela abrir com dado de verdade em vez de vazia.

import { montarTabelaUf } from '../src/modules/solucoes-contabeis/sistemas/difal/regrasNcmMerge';
import { validarTabela } from '../src/modules/solucoes-contabeis/sistemas/difal/ncmRegras';

let seq = 0;
const proximoId = () => `r${++seq}`;

const configs = [
  {
    id: proximoId(), tenant_company_id: null, uf: 'SP', versao: '2026-01',
    metodo_base: 'base_simples', politica_revenda: 'nao_incide',
    regra_geral_aliquota: 18, regra_geral_fcp: 0,
    regra_geral_fundamento: 'RICMS/SP art. 52, I — alíquota interna geral',
  },
];

const regras = [
  { id: proximoId(), tenant_company_id: null, uf: 'SP', ncm_prefixo: '3307', aliquota: 25, segue_geral: false, fcp: null, tipo: 'posicao', excecao_de: null, fundamento: 'RICMS/SP art. 55, XI — perfumaria e cosméticos', vigencia_inicio: null, vigencia_fim: null, fonte: 'seed' },
  { id: proximoId(), tenant_company_id: null, uf: 'SP', ncm_prefixo: '330720', aliquota: null, segue_geral: true, fcp: null, tipo: 'excecao', excecao_de: '3307', fundamento: 'Desodorantes corporais — fora do rol do art. 55', vigencia_inicio: null, vigencia_fim: null, fonte: 'seed' },
  { id: proximoId(), tenant_company_id: null, uf: 'SP', ncm_prefixo: '2402', aliquota: 25, segue_geral: false, fcp: 2, tipo: 'posicao', excecao_de: null, fundamento: 'RICMS/SP art. 55 — cigarros e tabacaria', vigencia_inicio: null, vigencia_fim: null, fonte: 'seed' },
];

function comEscopo(lista, tenantCompanyId) {
  return lista.filter((r) => (tenantCompanyId ? r.tenant_company_id === tenantCompanyId : !r.tenant_company_id));
}

export async function carregarTabelaUf(uf, tenantCompanyId) {
  const configGlobal = configs.find((c) => !c.tenant_company_id && c.uf === uf) || null;
  const configTenant = tenantCompanyId ? configs.find((c) => c.tenant_company_id === tenantCompanyId && c.uf === uf) || null : null;
  const regrasGlobais = regras.filter((r) => !r.tenant_company_id && r.uf === uf);
  const regrasTenant = tenantCompanyId ? regras.filter((r) => r.tenant_company_id === tenantCompanyId && r.uf === uf) : [];
  return montarTabelaUf({ uf, configGlobal, configTenant, regrasGlobais, regrasTenant });
}

export async function listarConfigsUf(escopo = {}) {
  return comEscopo(configs, escopo.tenantCompanyId).sort((a, b) => a.uf.localeCompare(b.uf));
}

export async function salvarConfigUf(config, escopo = {}) {
  const uf = String(config.uf || '').toUpperCase();
  const existente = comEscopo(configs, escopo.tenantCompanyId).find((c) => c.uf === uf);
  const payload = {
    uf, versao: config.versao || null, metodo_base: config.metodoBase || 'base_simples',
    politica_revenda: config.politicaRevenda || 'nao_incide',
    regra_geral_aliquota: config.regraGeralAliquota, regra_geral_fcp: config.regraGeralFcp || 0,
    regra_geral_fundamento: config.regraGeralFundamento, tenant_company_id: escopo.tenantCompanyId || null,
  };
  if (existente) { Object.assign(existente, payload); return existente; }
  const nova = { id: proximoId(), ...payload };
  configs.push(nova);
  return nova;
}

export async function excluirConfigUf(id) {
  const i = configs.findIndex((c) => c.id === id);
  if (i !== -1) configs.splice(i, 1);
}

export async function listarRegras(uf, escopo = {}) {
  return comEscopo(regras, escopo.tenantCompanyId).filter((r) => r.uf === uf).sort((a, b) => a.ncm_prefixo.localeCompare(b.ncm_prefixo));
}

export async function salvarRegra(regra, escopo = {}, id = null) {
  const uf = String(regra.uf || '').toUpperCase();
  const linha = {
    uf, ncm_prefixo: String(regra.ncm || '').replace(/\D+/g, ''),
    aliquota: regra.seguirGeral ? null : regra.aliquota,
    segue_geral: Boolean(regra.seguirGeral), fcp: regra.fcp ?? null, tipo: regra.tipo,
    excecao_de: regra.excecaoDe ? String(regra.excecaoDe).replace(/\D+/g, '') : null,
    fundamento: regra.fundamento, vigencia_inicio: regra.vigenciaInicio || null,
    vigencia_fim: regra.vigenciaFim || null, fonte: regra.fonte || 'manual',
    tenant_company_id: escopo.tenantCompanyId || null,
  };

  const outras = comEscopo(regras, escopo.tenantCompanyId)
    .filter((r) => r.uf === uf && r.id !== id)
    .map((r) => ({ ncm: r.ncm_prefixo, tipo: r.tipo, aliquota: r.aliquota, seguirGeral: r.segue_geral, fcp: r.fcp, excecaoDe: r.excecao_de, fundamento: r.fundamento, vigenciaInicio: r.vigencia_inicio, vigenciaFim: r.vigencia_fim }));
  const simulada = { ncm: linha.ncm_prefixo, tipo: linha.tipo, aliquota: linha.aliquota, seguirGeral: linha.segue_geral, fcp: linha.fcp, excecaoDe: linha.excecao_de, fundamento: linha.fundamento, vigenciaInicio: linha.vigencia_inicio, vigenciaFim: linha.vigencia_fim };
  const erros = validarTabela({ uf, regraGeral: { aliquota: 18, fcp: 0, fundamento: 'x' }, regras: [...outras, simulada] });
  if (erros.length) throw new Error(erros[0]);

  if (id) {
    const existente = regras.find((r) => r.id === id);
    Object.assign(existente, linha);
    return existente;
  }
  const nova = { id: proximoId(), ...linha };
  regras.push(nova);
  return nova;
}

export async function excluirRegra(id) {
  const i = regras.findIndex((r) => r.id === id);
  if (i !== -1) regras.splice(i, 1);
}

export async function importarRegras(linhas, escopo = {}, { sobrescrever = false } = {}) {
  const uf = String(linhas[0]?.uf || '').toUpperCase();
  const existentes = await listarRegras(uf, escopo);
  const porChave = new Map(existentes.map((e) => [`${e.ncm_prefixo}|${e.vigencia_inicio || ''}`, e]));

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
