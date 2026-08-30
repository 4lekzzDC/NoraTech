// Extrai, de forma determinística (sem interpretar o texto da legislação),
// a tabela de alíquotas do Portal da DIFAL (SVRS — Sefaz Virtual do Rio
// Grande do Sul, https://dfe-portal.svrs.rs.gov.br/Difal/Aliquotas), a
// partir da página salva (Ctrl+S ou "ver código-fonte") pelo usuário. Fonte
// pública oficial, cobre as 27 UFs numa página só — nenhuma requisição de
// rede acontece aqui.
//
// A página é uma árvore de acordeões: cada UF tem uma lista de "mercadorias"
// (categorias descritas em texto legal, nem sempre um NCM específico — a
// legislação estadual às vezes é por categoria, não por código), e cada
// mercadoria abre um painel com campos rotulados (NCM/SH, Alíquota interna,
// FECP, Observação, Data da atualização). Não tentamos adivinhar qual linha
// é "a regra geral" da UF nem em qual NCM cada categoria se encaixa — isso
// fica para quem está lendo a tela decidir, informado pelo texto.

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function interpretarPercentual(texto) {
  if (!texto) return null;
  const m = texto.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Recebe o HTML salvo da página de Alíquotas do Portal da DIFAL (SVRS) e
 * devolve uma lista plana de registros: { uf, mercadoria, ncmSh,
 * aliquotaInterna, fecp, observacao, dataAtualizacao }. `aliquotaInterna` e
 * `fecp` já vêm convertidos para número (ou null quando o campo está
 * vazio/"-"); os demais campos são texto, tal como aparecem na página.
 * Devolve lista vazia se o HTML não tiver o formato esperado.
 */
export function parseAliquotasPortalSvrs(html) {
  if (!html || typeof html !== 'string') return [];

  // O texto de UF e de mercadoria às vezes vem puro, às vezes embrulhado em
  // <span> (varia por estado, dependendo de quem digitou o conteúdo do lado
  // da SVRS) — por isso a célula é capturada inteira, tags incluídas, e só
  // depois passa por `stripTags`.
  const ufMarks = [];
  const reUf = /data-target="#(CodUf-\d+)"[^>]*>[\s\S]{0,400}?<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
  let m;
  while ((m = reUf.exec(html))) ufMarks.push({ pos: m.index, estado: stripTags(m[2]) });
  if (ufMarks.length === 0) return [];

  const mercMarks = [];
  const reMerc = /data-toggle="collapse" data-parent="#tabelaExpansiva\d*" data-target="#(\d+)" class="accordion-toggle"[^>]*>[\s\S]{0,900}?<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
  while ((m = reMerc.exec(html))) mercMarks.push({ pos: m.index, id: m[1], mercadoria: stripTags(m[2]) });

  const detalhePorId = new Map();
  const reDet = /<div id="(\d+)" class="collapse">([\s\S]*?)<\/div>/g;
  while ((m = reDet.exec(html))) {
    const campos = {};
    const reCampo = /<td[^>]*><label>([^<]+)<\/label><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
    let c;
    while ((c = reCampo.exec(m[2]))) campos[stripTags(c[1])] = stripTags(c[2]);
    detalhePorId.set(m[1], campos);
  }

  function ufDoPos(pos) {
    let atual = null;
    for (const u of ufMarks) {
      if (u.pos > pos) break;
      atual = u.estado;
    }
    return atual;
  }

  return mercMarks
    .filter((mk) => detalhePorId.has(mk.id))
    .map((mk) => {
      const campos = detalhePorId.get(mk.id);
      return {
        uf: ufDoPos(mk.pos),
        mercadoria: mk.mercadoria,
        ncmSh: campos['NCM/SH (se aplicável)'] || '',
        aliquotaInterna: interpretarPercentual(campos['Alíquota interna']),
        fecp: interpretarPercentual(campos['Fundo de Combate à Pobreza']),
        observacao: campos['Observação'] || '',
        dataAtualizacao: campos['Data da atualização'] || '',
      };
    });
}

/** Lista, em ordem de aparição, as UFs (nome por extenso) presentes no HTML. */
export function ufsDoPortalSvrs(registros) {
  const vistas = new Set();
  const lista = [];
  for (const r of registros) {
    if (r.uf && !vistas.has(r.uf)) { vistas.add(r.uf); lista.push(r.uf); }
  }
  return lista;
}

const SIGLA_POR_NOME = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR',
  pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE',
  tocantins: 'TO',
};

// O portal grafa alguns estados sem acento ("Para", "Piaui") — normaliza
// removendo acentuação antes de bater com o nome, em vez de depender da
// grafia exata.
function semAcento(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Sigla (2 letras) para o nome de UF como aparece no Portal da DIFAL, ou null. */
export function siglaUf(nomeEstado) {
  if (!nomeEstado) return null;
  return SIGLA_POR_NOME[semAcento(nomeEstado)] || null;
}
