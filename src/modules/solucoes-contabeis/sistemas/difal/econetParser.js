// Extrai, de forma determinística (sem IA generativa interpretando o texto),
// os dados estruturados de um resultado de consulta de alíquota da Econet
// (ferramenta "Alíquotas Internas e Benefícios Fiscais"), colado como HTML
// pelo usuário. Não faz nenhuma requisição de rede.

function decodificarEntidades(texto) {
  return texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª');
}

export function stripTags(html) {
  return decodificarEntidades(String(html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function extrairLinks(html) {
  const links = [];
  const re = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    links.push({ url: m[1], texto: stripTags(m[2]) });
  }
  return links;
}

function extrairTabelas(html) {
  const tabelas = [];
  const re = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(html))) tabelas.push(m[1]);
  return tabelas;
}

function extrairLinhasTabela(html) {
  const linhas = [];
  const reTr = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = reTr.exec(html))) {
    const trHtml = m[1];
    const ehCabecalho = /<th[\s>]/i.test(trHtml);
    const celReg = ehCabecalho ? /<th[^>]*>([\s\S]*?)<\/th>/gi : /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const celulasHtml = [];
    let cm;
    while ((cm = celReg.exec(trHtml))) celulasHtml.push(cm[1]);
    if (celulasHtml.length > 0) linhas.push({ cabecalho: ehCabecalho, celulasHtml });
  }
  return linhas;
}

function normalizarCabecalho(textoOriginal) {
  const t = textoOriginal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (t.includes('aliquota efetiva')) return 'aliquotaEfetiva';
  if (t.includes('fecop') || t.includes('fecoep') || t.includes('fecp') || t.includes('fundo')) return 'fecp';
  if (t.includes('aliquota')) return 'aliquota';
  if (t === 'ncm') return 'ncm';
  if (t === 'ex') return 'ex';
  if (t.includes('descri')) return 'descricao';
  return null;
}

function interpretarPercentual(texto) {
  if (!texto || texto.trim() === '-') return null;
  const m = texto.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function interpretarValor(chave, celHtml) {
  const texto = stripTags(celHtml);
  if (chave === 'aliquota' || chave === 'aliquotaEfetiva' || chave === 'fecp') {
    return interpretarPercentual(texto);
  }
  if (chave === 'ncm' || chave === 'ex') {
    return texto === '-' || texto === '' ? null : texto;
  }
  return texto;
}

function chaveDaSecao(tituloOriginal) {
  const t = tituloOriginal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (t.includes('base legal')) return 'baseLegal';
  if (t.includes('observa')) return 'observacoes';
  return null;
}

function extrairSecoesNotas(tabelaHtml) {
  const linhas = extrairLinhasTabela(tabelaHtml);
  const secoes = {};
  let chaveAtual = null;
  for (const linha of linhas) {
    if (linha.cabecalho) {
      chaveAtual = chaveDaSecao(stripTags(linha.celulasHtml[0] || ''));
      if (chaveAtual && !secoes[chaveAtual]) secoes[chaveAtual] = [];
      continue;
    }
    if (!chaveAtual) continue;
    const celHtml = linha.celulasHtml[0] || '';
    const texto = stripTags(celHtml);
    if (!texto) continue;
    secoes[chaveAtual].push({ texto, links: extrairLinks(celHtml) });
  }
  return secoes;
}

function parseBloco(tabela1Html, tabela2Html) {
  if (!tabela1Html) return null;
  const linhasTabela1 = extrairLinhasTabela(tabela1Html);
  const cabecalho = linhasTabela1.find((l) => l.cabecalho);
  const dados = linhasTabela1.filter((l) => !l.cabecalho);
  if (!cabecalho || dados.length === 0) return null;

  const mapaColuna = cabecalho.celulasHtml.map((h) => normalizarCabecalho(stripTags(h)));
  // Toda tabela de dados de verdade tem uma coluna NCM — sem isso, não é uma
  // tabela de resultado (pode ser a de "Base Legal"/"Observações" caindo,
  // por acidente de pareamento, na posição de tabela de dados).
  if (!mapaColuna.includes('ncm')) return null;

  const registros = dados.map((linha) => {
    const registro = { aliquota: null, aliquotaEfetiva: null, fecp: null, ncm: null, ex: null, descricao: '' };
    linha.celulasHtml.forEach((celHtml, i) => {
      const chave = mapaColuna[i];
      if (!chave) return;
      registro[chave] = interpretarValor(chave, celHtml);
    });
    return registro;
  });

  const secoes = tabela2Html ? extrairSecoesNotas(tabela2Html) : {};
  const baseLegalLinha = secoes.baseLegal ? secoes.baseLegal[0] : null;

  return {
    registros,
    baseLegal: baseLegalLinha
      ? { texto: baseLegalLinha.texto, url: baseLegalLinha.links[0]?.url || null }
      : null,
    observacoes: secoes.observacoes || [],
  };
}

/**
 * Recebe o HTML de uma tela de resultado de consulta de alíquota da Econet
 * (uma linha de dados por NCM/EX consultado + tabela de base legal/observações)
 * e devolve uma estrutura simples e previsível, sem interpretar o texto livre.
 * Retorna null se o HTML não tiver o formato esperado (tabela de dados ausente).
 */
export function parseResultadoAliquota(html) {
  if (!html || typeof html !== 'string') return null;
  const tabelas = extrairTabelas(html);
  if (tabelas.length === 0) return null;
  return parseBloco(tabelas[0], tabelas[1]);
}

/**
 * Igual a `parseResultadoAliquota`, mas aceita várias consultas coladas em
 * sequência (cada "Copiar conteúdo" clicado na Econet gera um par de
 * tabelas — dados + base legal/observações). Cada par é interpretado como
 * um resultado independente; um par malformado é descartado sem derrubar
 * os demais. Devolve uma lista, vazia se nada reconhecível for encontrado.
 */
export function parseResultadosAliquota(html) {
  if (!html || typeof html !== 'string') return [];
  const tabelas = extrairTabelas(html);
  const blocos = [];
  for (let i = 0; i < tabelas.length; i += 2) {
    const bloco = parseBloco(tabelas[i], tabelas[i + 1]);
    if (bloco) blocos.push(bloco);
  }
  return blocos;
}
