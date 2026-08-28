// Base de regras do DIFAL — tabela "De-Para" de NCM x alíquota interna.
//
// Este arquivo é DADO, não lógica. A busca hierárquica vive em `ncmBusca.js`
// e o cálculo em `difalEngine.js`. A separação é de propósito: a legislação
// muda toda hora (decreto novo, convênio, fim de benefício) e quem atualiza
// a alíquota do desodorante não pode precisar mexer no motor de cálculo.
//
// ── Modelo de dados ────────────────────────────────────────────────────────
//
// Uma TABELA é o conjunto de regras de UMA UF de destino:
//
//   {
//     uf: 'SP',
//     versao: '2026-01',          // muda a cada revisão publicada
//     metodoBase: 'base_simples', // ou 'base_dupla' — ver difalEngine.js
//     regraGeral: { aliquota, fcp, fundamento },
//     regras: [ <REGRA>, ... ],
//   }
//
// Uma REGRA é uma faixa de NCM com alíquota própria:
//
//   ncm            string de 2, 4, 6 ou 8 dígitos (pontos são ignorados).
//                  O comprimento define o nível: capítulo (2), posição (4),
//                  subposição (6) ou item/subitem (8).
//   aliquota       alíquota interna em % (número). Exclusivo com `seguirGeral`.
//   seguirGeral    true quando a faixa é exceção que CAI NA REGRA GERAL.
//                  Existe para que a exceção fique escrita como exceção, em
//                  vez de repetir o 18% e ninguém saber depois se aquele 18
//                  é a regra geral ou uma coincidência.
//   fcp            % do Fundo de Combate à Pobreza sobre a mesma base.
//                  Ausente → herda o `fcp` da regra geral.
//   tipo           'capitulo' | 'posicao' | 'subposicao' | 'item' | 'excecao'
//                  Só documenta a intenção; a busca usa o comprimento do NCM.
//   excecaoDe      NCM-pai que esta regra excepciona. Obrigatório em 'excecao'.
//   fundamento     dispositivo legal. Aparece no relatório — o contador
//                  precisa saber POR QUE aquele item deu 25%.
//   vigenciaInicio 'AAAA-MM-DD' inclusivo. Ausente → vale desde sempre.
//   vigenciaFim    'AAAA-MM-DD' inclusivo. Ausente → vale até revogação.
//
// A vigência é comparada com a DATA DE EMISSÃO da nota, não com a data do
// processamento: reprocessar em 2027 uma nota de 2026 tem que dar o mesmo
// número que deu na época.
//
// ── Equivalente relacional (quando isto sair do arquivo e for para o banco)
//
//   create table difal_regra_ncm (
//     id              uuid primary key default gen_random_uuid(),
//     uf              char(2)      not null,
//     ncm_prefixo     varchar(8)   not null,   -- só dígitos
//     nivel           smallint     not null generated always as (length(ncm_prefixo)) stored,
//     aliquota        numeric(5,2),            -- null quando segue a regra geral
//     segue_geral     boolean      not null default false,
//     fcp             numeric(5,2),
//     tipo            text         not null,
//     excecao_de      varchar(8),
//     fundamento      text         not null,
//     vigencia_inicio date,
//     vigencia_fim    date,
//     constraint difal_regra_ncm_valor check (segue_geral <> (aliquota is not null)),
//     constraint difal_regra_ncm_nivel check (length(ncm_prefixo) in (2,4,6,8))
//   );
//   -- Duas regras para o mesmo prefixo só podem coexistir em vigências
//   -- disjuntas; sem isso a busca vira sorteio.
//   create unique index difal_regra_ncm_faixa
//     on difal_regra_ncm (uf, ncm_prefixo, coalesce(vigencia_inicio, '-infinity'::date));
//
// A busca hierárquica no banco é o mesmo algoritmo de `ncmBusca.js`:
//   where uf = $1 and ncm_prefixo in ($2::text[])  -- as 4 fatias
//   order by nivel desc limit 1
//
// ── Aviso ─────────────────────────────────────────────────────────────────
// As regras abaixo são uma SEMENTE de demonstração, montada para exercitar a
// hierarquia (posição, exceção de subposição, exceção de item, FCP, vigência).
// Antes de rodar em produção, a equipe fiscal precisa conferir alíquota e
// fundamento de cada linha contra o RICMS vigente da UF.

export const TIPOS_REGRA = ['capitulo', 'posicao', 'subposicao', 'item', 'excecao'];

export const NIVEIS_VALIDOS = [2, 4, 6, 8];

// Tira pontuação e espaço do NCM. '3307.20' → '330720'.
export function digitosNcm(valor) {
  return String(valor ?? '').replace(/\D+/g, '');
}

export const TABELA_SP = {
  uf: 'SP',
  versao: '2026-01',
  metodoBase: 'base_simples',
  regraGeral: {
    aliquota: 18,
    fcp: 0,
    fundamento: 'RICMS/SP art. 52, I — alíquota interna geral',
  },
  regras: [
    // ── Perfumaria e cosméticos ──────────────────────────────────────────
    // O caso que motivou a hierarquia: a posição inteira é 25%, mas duas
    // faixas dentro dela não são.
    {
      ncm: '3307',
      aliquota: 25,
      tipo: 'posicao',
      fundamento: 'RICMS/SP art. 55, XI — perfumaria e cosméticos',
    },
    {
      ncm: '3307.20',
      seguirGeral: true,
      tipo: 'excecao',
      excecaoDe: '3307',
      fundamento: 'Desodorantes corporais e antiperspirantes — fora do rol do art. 55',
    },
    {
      ncm: '3307.90.00',
      aliquota: 18,
      tipo: 'excecao',
      excecaoDe: '3307',
      fundamento: 'Demais produtos de perfumaria não arrolados no art. 55',
    },

    // ── Bebidas e fumo (exercitam o FCP) ─────────────────────────────────
    {
      ncm: '2203',
      aliquota: 25,
      fcp: 2,
      tipo: 'posicao',
      fundamento: 'RICMS/SP art. 55 — cervejas e chopes; FCP conforme Lei 16.006/2015',
    },
    {
      ncm: '2402',
      aliquota: 25,
      fcp: 2,
      tipo: 'posicao',
      fundamento: 'RICMS/SP art. 55 — cigarros e produtos de tabacaria',
    },

    // ── Alíquota reduzida com vigência declarada ─────────────────────────
    {
      ncm: '1006',
      aliquota: 7,
      tipo: 'posicao',
      vigenciaInicio: '2024-01-01',
      fundamento: 'RICMS/SP art. 53-A — cesta básica (arroz)',
    },

    // ── Informática ──────────────────────────────────────────────────────
    // Existe para deixar explícito que 8471 é 18% por regra própria, e não
    // por cair na regra geral — a diferença aparece no relatório.
    {
      ncm: '8471',
      aliquota: 18,
      tipo: 'posicao',
      fundamento: 'RICMS/SP art. 52, I — máquinas de processamento de dados',
    },
  ],
};

export const TABELAS_POR_UF = {
  SP: TABELA_SP,
};

export function getTabela(uf) {
  return TABELAS_POR_UF[String(uf ?? '').toUpperCase()] || null;
}

// ── Validação da tabela ────────────────────────────────────────────────────
// Roda no carregamento da tabela (e no teste). Tabela de imposto com erro de
// cadastro não pode falhar silenciosamente lá na frente, no meio de um lote
// de 2.000 notas: falha aqui, com o dedo na linha errada.
export function validarTabela(tabela) {
  const erros = [];
  if (!tabela || typeof tabela !== 'object') return ['Tabela ausente.'];

  if (!/^[A-Z]{2}$/.test(String(tabela.uf ?? ''))) {
    erros.push('UF da tabela ausente ou inválida.');
  }
  const geral = tabela.regraGeral;
  if (!geral || typeof geral.aliquota !== 'number') {
    erros.push('Regra geral sem alíquota numérica.');
  }

  const vistos = new Map();
  for (const regra of tabela.regras || []) {
    const ncm = digitosNcm(regra.ncm);
    const rotulo = `NCM ${regra.ncm}`;

    if (!NIVEIS_VALIDOS.includes(ncm.length)) {
      erros.push(`${rotulo}: prefixo precisa ter 2, 4, 6 ou 8 dígitos.`);
      continue;
    }
    const temAliquota = typeof regra.aliquota === 'number';
    if (temAliquota === Boolean(regra.seguirGeral)) {
      erros.push(`${rotulo}: informe 'aliquota' OU 'seguirGeral', nunca os dois nem nenhum.`);
    }
    if (temAliquota && (regra.aliquota < 0 || regra.aliquota > 40)) {
      erros.push(`${rotulo}: alíquota ${regra.aliquota}% fora da faixa plausível (0 a 40).`);
    }
    if (regra.fcp != null && (typeof regra.fcp !== 'number' || regra.fcp < 0 || regra.fcp > 10)) {
      erros.push(`${rotulo}: FCP fora da faixa plausível (0 a 10).`);
    }
    if (regra.tipo && !TIPOS_REGRA.includes(regra.tipo)) {
      erros.push(`${rotulo}: tipo '${regra.tipo}' desconhecido.`);
    }
    if (regra.tipo === 'excecao') {
      const pai = digitosNcm(regra.excecaoDe);
      if (!pai) {
        erros.push(`${rotulo}: exceção precisa declarar 'excecaoDe'.`);
      } else if (!ncm.startsWith(pai) || pai.length >= ncm.length) {
        erros.push(`${rotulo}: 'excecaoDe' ${regra.excecaoDe} não é faixa mais genérica deste NCM.`);
      }
    }
    if (!regra.fundamento) {
      erros.push(`${rotulo}: sem fundamento legal.`);
    }
    for (const campo of ['vigenciaInicio', 'vigenciaFim']) {
      const data = regra[campo];
      if (data != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) {
        erros.push(`${rotulo}: ${campo} '${data}' não está em AAAA-MM-DD.`);
      }
    }
    if (regra.vigenciaInicio && regra.vigenciaFim && regra.vigenciaInicio > regra.vigenciaFim) {
      erros.push(`${rotulo}: vigência início (${regra.vigenciaInicio}) é depois do fim (${regra.vigenciaFim}).`);
    }

    const anteriores = vistos.get(ncm) || [];
    for (const anterior of anteriores) {
      if (vigenciasSobrepoem(anterior, regra)) {
        erros.push(`${rotulo}: duplicado com vigência sobreposta.`);
      }
    }
    anteriores.push(regra);
    vistos.set(ncm, anteriores);
  }

  return erros;
}

function vigenciasSobrepoem(a, b) {
  const iniA = a.vigenciaInicio || '0000-01-01';
  const fimA = a.vigenciaFim || '9999-12-31';
  const iniB = b.vigenciaInicio || '0000-01-01';
  const fimB = b.vigenciaFim || '9999-12-31';
  return iniA <= fimB && iniB <= fimA;
}
