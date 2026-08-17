// Calculadora de IRPJ e CSLL — dados de referência.
//
// Este arquivo guarda apenas o que é ESTATUTÁRIO (percentuais de presunção,
// alíquotas, limites legais) e a forma dos formulários. A lógica de apuração
// em si ainda não está definida: o layout foi construído primeiro para que as
// decisões de cálculo (regime de caixa x competência, tratamento de
// retenções, compensações) sejam discutidas antes de virar código.

// ── Percentuais de presunção (Lucro Presumido) ────────────────────────────
// Chaveados pelo `ramo_atividade` do cadastro do cliente. Fonte: Lei
// 9.249/1995, arts. 15 e 20.
export const PRESUNCAO_POR_RAMO = {
  comercio_industria:     { irpj: 8,   csll: 12 },
  servicos_gerais:        { irpj: 32,  csll: 32 },
  servicos_hospitalares:  { irpj: 8,   csll: 12 },
  transporte_cargas:      { irpj: 8,   csll: 12 },
  transporte_passageiros: { irpj: 16,  csll: 12 },
  revenda_combustiveis:   { irpj: 1.6, csll: 12 },
  intermediacao_imoveis:  { irpj: 32,  csll: 32 },
};

// ── Alíquotas e limites ───────────────────────────────────────────────────
export const ALIQUOTAS = {
  irpj: 15,           // %
  irpjAdicional: 10,  // % sobre o que exceder o limite
  csll: 9,            // %
};

// Adicional de IRPJ incide sobre a base que exceder R$ 20.000,00 por mês do
// período de apuração — R$ 60.000,00 no trimestre.
export const LIMITE_ADICIONAL_MENSAL = 20000;

// Compensação de prejuízo fiscal / base negativa limitada a 30% do lucro
// do período (trava dos 30%).
export const LIMITE_COMPENSACAO_PREJUIZO = 30; // %

// ── Períodos ──────────────────────────────────────────────────────────────
export const TRIMESTRES = [
  { id: 1, label: '1º trimestre', meses: 'jan–mar' },
  { id: 2, label: '2º trimestre', meses: 'abr–jun' },
  { id: 3, label: '3º trimestre', meses: 'jul–set' },
  { id: 4, label: '4º trimestre', meses: 'out–dez' },
];

export const REGIMES_SUPORTADOS = ['Lucro Presumido', 'Lucro Real'];

// ── Campos do formulário manual ───────────────────────────────────────────
// Declarados como dados para que o formulário e (depois) o parser de arquivo
// leiam a mesma estrutura — evita os dois caminhos divergirem.

export const CAMPOS_PRESUMIDO = [
  {
    grupo: 'Receitas do trimestre',
    campos: [
      { id: 'receita_atividade',   label: 'Receita bruta da atividade principal', hint: 'Base do percentual de presunção do ramo' },
      { id: 'receita_outras',      label: 'Receitas de outras atividades',        hint: 'Sujeitas a percentual de presunção distinto' },
      { id: 'devolucoes',          label: 'Devoluções, descontos e cancelamentos', hint: 'Reduzem a receita bruta', negativo: true },
    ],
  },
  {
    grupo: 'Acréscimos à base',
    campos: [
      { id: 'ganhos_capital',      label: 'Ganhos de capital',            hint: 'Entram integralmente na base, sem presunção' },
      { id: 'receitas_financeiras',label: 'Receitas financeiras',          hint: 'Entram integralmente na base, sem presunção' },
      { id: 'demais_receitas',     label: 'Demais receitas e resultados positivos' },
    ],
  },
  {
    grupo: 'Deduções do imposto',
    campos: [
      { id: 'irrf_retido',         label: 'IRRF retido na fonte',          hint: 'Deduz do IRPJ devido', negativo: true },
      { id: 'csll_retida',         label: 'CSLL retida na fonte',          hint: 'Deduz da CSLL devida', negativo: true },
    ],
  },
];

export const CAMPOS_REAL = [
  {
    grupo: 'Resultado do período',
    campos: [
      { id: 'lucro_antes_tributos', label: 'Lucro líquido antes do IRPJ e da CSLL', hint: 'LAIR — resultado apurado na DRE' },
    ],
  },
  {
    grupo: 'Adições',
    campos: [
      { id: 'adicoes_permanentes',  label: 'Despesas indedutíveis',        hint: 'Multas, brindes, doações fora do limite' },
      { id: 'adicoes_temporarias',  label: 'Adições temporárias',           hint: 'Provisões não dedutíveis no período' },
      { id: 'adicoes_outras',       label: 'Demais adições' },
    ],
  },
  {
    grupo: 'Exclusões',
    campos: [
      { id: 'exclusoes_permanentes',label: 'Receitas não tributáveis',      hint: 'Dividendos recebidos, subvenções', negativo: true },
      { id: 'exclusoes_temporarias',label: 'Exclusões temporárias',          hint: 'Reversões de provisões já adicionadas', negativo: true },
      { id: 'exclusoes_outras',     label: 'Demais exclusões', negativo: true },
    ],
  },
  {
    grupo: 'Compensações e deduções',
    campos: [
      { id: 'prejuizo_fiscal',      label: 'Prejuízo fiscal acumulado',     hint: 'Compensação limitada a 30% do lucro do período', negativo: true },
      { id: 'base_negativa_csll',   label: 'Base negativa de CSLL acumulada', hint: 'Mesma trava de 30%', negativo: true },
      { id: 'irrf_retido',          label: 'IRRF retido na fonte', negativo: true },
      { id: 'csll_retida',          label: 'CSLL retida na fonte', negativo: true },
    ],
  },
];

// ── Linhas do demonstrativo de resultado ──────────────────────────────────
// A estrutura do resultado já fica definida aqui; os valores serão
// preenchidos quando a lógica de apuração for fechada.
export const LINHAS_RESULTADO_PRESUMIDO = [
  { id: 'base_irpj',        label: 'Base de cálculo do IRPJ',        destaque: false },
  { id: 'irpj_normal',      label: 'IRPJ (15%)',                     destaque: false },
  { id: 'irpj_adicional',   label: 'Adicional de IRPJ (10%)',        destaque: false },
  { id: 'irpj_devido',      label: 'IRPJ devido',                    destaque: true },
  { id: 'base_csll',        label: 'Base de cálculo da CSLL',        destaque: false },
  { id: 'csll_devida',      label: 'CSLL devida (9%)',               destaque: true },
  { id: 'total',            label: 'Total a recolher',               destaque: true, total: true },
];

export const LINHAS_RESULTADO_REAL = [
  { id: 'lucro_real',       label: 'Lucro real (após adições e exclusões)', destaque: false },
  { id: 'compensacao',      label: 'Compensação de prejuízo (limite 30%)',  destaque: false },
  { id: 'base_irpj',        label: 'Base de cálculo do IRPJ',               destaque: false },
  { id: 'irpj_normal',      label: 'IRPJ (15%)',                            destaque: false },
  { id: 'irpj_adicional',   label: 'Adicional de IRPJ (10%)',               destaque: false },
  { id: 'irpj_devido',      label: 'IRPJ devido',                           destaque: true },
  { id: 'base_csll',        label: 'Base de cálculo da CSLL',               destaque: false },
  { id: 'csll_devida',      label: 'CSLL devida (9%)',                      destaque: true },
  { id: 'total',            label: 'Total a recolher',                      destaque: true, total: true },
];

// ── Formatação ────────────────────────────────────────────────────────────
export function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Aceita "1.234,56" e "1234.56" — contador cola valor de planilha, que vem
// no formato brasileiro, mas também digita direto com ponto.
export function parseValor(texto) {
  if (typeof texto === 'number') return texto;
  const s = String(texto ?? '').trim();
  if (!s) return 0;
  const limpo = s.replace(/[R$\s]/g, '');
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
