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

// Um documento em erro se divide em dois casos, e a diferença decide o que dá
// para fazer:
//
//   com drive_file_id  → os bytes chegaram ao Drive; a falha foi depois
//                        (organizar, gravar). Dá para tentar de novo.
//   sem drive_file_id  → o arquivo não chegou a lugar nenhum. Nenhum retry do
//                        servidor resolve: é preciso reenviar o arquivo, e
//                        para isso a linha precisa sair do caminho da
//                        deduplicação — o que descartar faz.
export function podeReprocessar(doc) {
  return Boolean(doc.drive_file_id);
}
