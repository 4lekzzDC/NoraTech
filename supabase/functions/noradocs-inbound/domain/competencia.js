// Competência no formato 'YYYY-MM'. Módulo puro.
//
// É o campo mais escorregadio dos três: a mesma data aparece como 08/2026,
// 2026-08, ago/26, "agosto de 2026" e dentro de uma data completa
// 18/08/2026 — tudo no mesmo lote de arquivos.

const MESES = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
};

const NOMES_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

export function formatCompetencia(ano, mes) {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

export function isCompetencia(valor) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor ?? ''));
}

export function competenciaLegivel(competencia) {
  if (!isCompetencia(competencia)) return '—';
  const [ano, mes] = competencia.split('-');
  return `${mes}/${ano}`;
}

// Mês anterior ao da data informada. É o palpite do escritório quando nada no
// arquivo diz a competência: documento que chega em setembro costuma ser da
// escrituração de agosto.
export function competenciaAnterior(data = new Date()) {
  const d = new Date(data.getFullYear(), data.getMonth() - 1, 1);
  return formatCompetencia(d.getFullYear(), d.getMonth() + 1);
}

// CNPJ e CPF carregam sequências que se parecem com data ("/0001-81"). Tirar
// os documentos do texto antes de procurar datas evita esse falso positivo na
// raiz, em vez de tentar desfazê-lo depois.
function semDocumentos(texto) {
  return String(texto ?? '')
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, ' ');
}

// Ano sempre 20xx: descarta "/0001" de CNPJ, número de nota e código de banco.
const ANO = '(20\\d{2})';
const MES = '(0?[1-9]|1[0-2])';

const PADROES = [
  // Data completa: 18/08/2026, 18-08-2026, 18.08.2026
  { re: new RegExp(`\\b(?:0?[1-9]|[12]\\d|3[01])[/\\-.]${MES}[/\\-.]${ANO}\\b`), mes: 1, ano: 2,
    rotulo: 'data completa' },
  // 08/2026, 08-2026
  { re: new RegExp(`\\b${MES}[/\\-]${ANO}\\b`), mes: 1, ano: 2, rotulo: 'mês/ano' },
  // 2026-08, 2026/08
  { re: new RegExp(`\\b${ANO}[/\\-]${MES}\\b`), mes: 2, ano: 1, rotulo: 'ano-mês' },
  // 202608
  { re: new RegExp(`\\b${ANO}(0[1-9]|1[0-2])\\b`), mes: 2, ano: 1, rotulo: 'AAAAMM' },
  // agosto de 2026, ago/2026, ago 2026
  { re: new RegExp(`\\b(${NOMES_MES})\\b[^\\d]{0,6}${ANO}\\b`), mesNome: 1, ano: 2, rotulo: 'mês por extenso' },
  // ago/26, agosto-26  (ano de dois dígitos vira 20xx)
  { re: new RegExp(`\\b(${NOMES_MES})\\b[/\\- ](\\d{2})\\b`), mesNome: 1, ano2: 2, rotulo: 'mês por extenso' },
];

// Devolve { competencia, rotulo } ou null. Percorre os padrões em ordem de
// confiança — data completa antes de AAAAMM, que é o mais sujeito a acaso.
export function extrairCompetencia(texto) {
  const alvo = normalizarParaData(texto);
  if (!alvo) return null;

  for (const padrao of PADROES) {
    const m = alvo.match(padrao.re);
    if (!m) continue;

    const mes = padrao.mesNome ? MESES[m[padrao.mesNome]] : Number(m[padrao.mes]);
    const ano = padrao.ano2 ? 2000 + Number(m[padrao.ano2]) : Number(m[padrao.ano]);
    if (!mes || mes < 1 || mes > 12) continue;

    return { competencia: formatCompetencia(ano, mes), rotulo: padrao.rotulo };
  }
  return null;
}

function normalizarParaData(texto) {
  return semDocumentos(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Underscore é caractere de palavra em regex, então `\b` NÃO casa entre
    // "_" e "0" — sem esta troca, "extrato_08/2026.pdf" não daria competência
    // nenhuma. E nome de arquivo com underscore é a regra, não a exceção.
    .replace(/_/g, ' ');
}
