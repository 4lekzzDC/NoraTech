// Regras de estado dos documentos. Módulo puro.
//
// A arquitetura previa este arquivo desde o começo como fonte única das
// transições válidas; ele nasce aqui, com a primeira regra que a UI e o
// serviço precisam compartilhar.

// Um documento só entra na confirmação em lote quando os três campos já estão
// resolvidos. O lote é atalho para o que precisa apenas de um aval — tipicamente
// o documento que caiu em revisão só porque a competência foi suposta. O que
// ainda tem campo em aberto exige decisão, e decisão é individual.
export function podeConfirmarEmLote(doc) {
  return Boolean(doc.client?.id && doc.category?.id && doc.competencia);
}
