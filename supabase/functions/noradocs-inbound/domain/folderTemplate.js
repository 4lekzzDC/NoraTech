// Resolve o template de pastas configurado pelo escritório em um caminho
// real, e normaliza cada segmento para ser seguro como nome de pasta no
// Drive. Módulo puro — sem React, sem DOM, sem rede.
//
// Usado tanto na pré-visualização da tela de Configurações quanto, mais
// tarde (Etapa 6), para resolver o destino de um documento antes do upload.
// As duas pontas usam exatamente esta função, para que a pré-visualização
// nunca minta sobre onde o arquivo vai parar.

export const FOLDER_TEMPLATE_TOKENS = ['cliente', 'cnpj', 'ano', 'mes', 'competencia', 'categoria', 'tipo'];

export const DEFAULT_FOLDER_TEMPLATE = '{cliente}/{ano}/{competencia}/{categoria}';

// Normalização estrutural, não cosmética: tira barra (que criaria uma
// subpasta sem querer) e colapsa espaços. NÃO tira acento — o nome da pasta
// no Drive é o que o contador vai ler todo dia, e "Contábil" não deveria
// virar "Contabil" só porque um motor de busca interno prefere isso em outro
// lugar (essa forma ASCII-only já existe, para comparação, em domain/texto.js).
export function normalizarSegmento(valor) {
  return String(valor ?? '')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function competenciaAnoMes(competencia) {
  const [ano, mes] = String(competencia || '').split('-');
  return { ano: ano || '', mes: mes || '' };
}

// context: { clienteNome, cnpj, competencia, categoriaNome, tipo }
// Devolve os segmentos já normalizados, sem os vazios — se um token conhecido
// não tiver valor (ex.: sem competência ainda), o segmento correspondente
// desaparece do caminho em vez de virar uma pasta com nome em branco.
export function resolveFolderPath(template, context = {}) {
  const { ano, mes } = competenciaAnoMes(context.competencia);
  const valores = {
    cliente: context.clienteNome || '',
    cnpj: context.cnpj || '',
    ano,
    mes,
    competencia: context.competencia || '',
    categoria: context.categoriaNome || '',
    tipo: context.tipo || '',
  };

  return String(template || '')
    .split('/')
    // Token desconhecido (erro de digitação) fica literal — {typo} — em vez
    // de sumir, para o erro ficar visível na pré-visualização.
    .map((parte) => parte.replace(/\{(\w+)\}/g, (match, token) => (token in valores ? valores[token] : match)))
    .map(normalizarSegmento)
    .filter(Boolean);
}

export function formatFolderPath(template, context) {
  return resolveFolderPath(template, context).join('/');
}

// Tokens usados no template que não existem na lista conhecida. A tela avisa
// com isso antes de salvar um modelo com erro de digitação.
export function tokensDesconhecidos(template) {
  const usados = [...String(template || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(usados)].filter((t) => !FOLDER_TEMPLATE_TOKENS.includes(t));
}
