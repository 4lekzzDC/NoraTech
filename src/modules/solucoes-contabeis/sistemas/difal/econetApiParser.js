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

function dataIsoOuIndefinida(valor) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(valor || '')) ? String(valor).slice(0, 10) : undefined;
}

/**
 * Converte registros já extraídos para a forma de "linha" que
 * `regrasNcm.service.js#importarRegras` espera (a mesma da importação por
 * planilha) — para gravar em lote em vez de um "Usar esta linha" por vez.
 * Só entram registros com NCM próprio: os sem NCM são categoria de texto
 * legal, cujo prefixo cabe a quem está importando decidir — não são
 * chutados aqui. Devolve também `semNcm`, a contagem do que ficou de fora,
 * para a tela avisar quantos precisam de decisão manual.
 */
export function linhasParaImportar(registros, uf) {
  const ufMaiuscula = String(uf || '').toUpperCase();
  const linhas = [];
  let semNcm = 0;
  for (const r of registros) {
    const ncm = String(r.ncm || '').replace(/\D+/g, '');
    if (![2, 4, 6, 8].includes(ncm.length)) { semNcm += 1; continue; }
    const nivel = ncm.length;
    const tipo = nivel === 2 ? 'capitulo' : nivel === 6 ? 'subposicao' : nivel === 8 ? 'item' : 'posicao';
    const base = r.baseLegal[0];
    const fundamento = [base?.texto, base?.url].filter(Boolean).join(' — ') || r.descricao || `NCM ${ncm}`;
    linhas.push({
      uf: ufMaiuscula,
      ncm,
      tipo,
      ...(r.aliquota == null ? { seguirGeral: true } : { aliquota: r.aliquota }),
      fcp: r.fecp,
      fundamento,
      vigenciaInicio: dataIsoOuIndefinida(r.vigenciaInicio),
      vigenciaFim: dataIsoOuIndefinida(r.vigenciaFim),
      fonte: 'econet',
    });
  }
  return { linhas, semNcm };
}
