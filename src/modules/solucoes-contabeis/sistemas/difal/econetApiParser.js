// Extrai, de forma determinística, os dados estruturados da resposta JSON da
// API da Econet (o que a ferramenta "Alíquotas Internas e Benefícios
// Fiscais" busca por trás da tela) — capturada pelo usuário na aba Network
// do navegador, ao consultar a tela normalmente. Não faz nenhuma requisição
// de rede: só lê o texto que já chegou até o usuário. Muito mais completo
// que o HTML renderizado (traz NCM, vigência e base legal já estruturados,
// e cada resposta cobre até 100 linhas de uma vez, não uma por consulta).

import { stripTags, extrairLinks } from './econetParser.js';

function numeroOuNull(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recebe o texto de UMA resposta JSON paginada da API da Econet (a que o
 * usuário vê na aba Network → Response de uma consulta) e devolve os
 * registros dessa página, mais os metadados de paginação (para o usuário
 * saber quantas páginas faltam). Devolve null se o texto não tiver o
 * formato esperado.
 */
export function parseApiAliquotasEconet(texto) {
  if (!texto || typeof texto !== 'string') return null;
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    return null;
  }

  const pagina = dados?.aliquotas?.aliquota_especifica;
  if (!pagina || !Array.isArray(pagina.data)) return null;

  const registros = pagina.data.map((r) => ({
    ncm: r.nbm_ncm || '',
    aliquota: numeroOuNull(r.aliquota),
    aliquotaEfetiva: numeroOuNull(r.aliquota_efetiva),
    fecp: r.fundo ? numeroOuNull(r.fundo) : null,
    descricao: r.descricao || '',
    tipo: r.tipo || '',
    ncmVigente: r.ncm_vigente !== false,
    vigenciaInicio: r.inicio_vigencia || null,
    vigenciaFim: r.fim_vigencia || null,
    baseLegal: (r.base_legal || []).map((b) => ({ texto: b.base_legal || '', url: b.link || null })),
    observacoes: (r.observacoes || []).map((texto2) => ({ texto: stripTags(texto2), links: extrairLinks(texto2) })),
  }));

  return {
    registros,
    paginacao: {
      atual: pagina.current_page ?? null,
      ultima: pagina.last_page ?? null,
      total: pagina.total ?? null,
      porPagina: pagina.per_page ?? null,
    },
  };
}

/**
 * Recebe o texto de várias respostas (uma por página que o usuário copiou)
 * e junta os registros de todas em uma lista só, ignorando qualquer texto
 * que não seja uma página reconhecível dessa API.
 */
export function parseApiAliquotasEconetEmLote(textos) {
  const registros = [];
  const paginas = [];
  for (const texto of textos) {
    const resultado = parseApiAliquotasEconet(texto);
    if (!resultado) continue;
    registros.push(...resultado.registros);
    paginas.push(resultado.paginacao);
  }
  return { registros, paginas };
}
