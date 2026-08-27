// Dublê do serviço de apurações de DIFAL — store em memória, sem banco.
//
// Usa as funções REAIS de conversão (`linhasParaGravar`/`resultadoDeLinhas`),
// não uma versão simplificada: o que a preview exercita é o mesmo caminho de
// ida e volta que roda em produção, só que com um array no lugar do Postgres.
// Um erro de mapeamento aparece aqui, na tela, e não só no teste.

import {
  linhasParaGravar, resultadoDeLinhas,
} from '../src/modules/solucoes-contabeis/sistemas/difal/difalPersistencia';

export const getCurrentTenantCompanyId = async () => 't1';

let sequencia = 0;
const apuracoes = new Map(); // id → { apuracao, notas }

export async function salvarApuracao(resultado, contexto, xmls = {}) {
  const { apuracao, notas } = linhasParaGravar(
    resultado, { ...contexto, tenantCompanyId: 't1', createdBy: 'u1' }, xmls,
  );
  const id = contexto.apuracaoId || `ap${++sequencia}`;
  const anterior = apuracoes.get(id);
  apuracoes.set(id, {
    apuracao: {
      ...apuracao, id,
      status: anterior?.apuracao.status || apuracao.status,
      created_at: anterior?.apuracao.created_at || new Date().toISOString(),
      cliente: contexto.accountingCompanyId
        ? { id: contexto.accountingCompanyId, nome: 'Comercio Beta ME', cnpj: '98765432000110' }
        : null,
    },
    notas: notas.map(({ nota, itens }, i) => ({ ...nota, id: `${id}-n${i}`, itens })),
  });
  return id;
}

export async function listarApuracoes() {
  return [...apuracoes.values()]
    .map((a) => a.apuracao)
    .sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
}

export async function carregarApuracao(id) {
  const guardada = apuracoes.get(id);
  if (!guardada) throw new Error('Apuração não encontrada.');
  const xmls = guardada.notas.reduce((acc, n) => {
    if (n.arquivo && n.xml) acc[n.arquivo] = n.xml;
    return acc;
  }, {});
  return {
    apuracao: guardada.apuracao,
    resultado: resultadoDeLinhas(guardada.apuracao, guardada.notas),
    xmls,
  };
}

export async function fecharApuracao(id, fechada = true) {
  const guardada = apuracoes.get(id);
  if (guardada) {
    guardada.apuracao.status = fechada ? 'fechada' : 'aberta';
    guardada.apuracao.fechada_em = fechada ? new Date().toISOString() : null;
  }
}

export async function excluirApuracao(id) {
  apuracoes.delete(id);
}

export async function notasJaApuradas(_tenant, chaves, { exceto = null } = {}) {
  const achadas = {};
  for (const [id, { apuracao, notas }] of apuracoes) {
    if (id === exceto) continue;
    for (const nota of notas) {
      if (nota.chave && chaves.includes(nota.chave) && !achadas[nota.chave]) {
        achadas[nota.chave] = {
          apuracaoId: id, competencia: apuracao.competencia, status: apuracao.status,
        };
      }
    }
  }
  return achadas;
}
