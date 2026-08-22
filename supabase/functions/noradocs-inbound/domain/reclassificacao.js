// Junta duas passadas de classificação — a primeira com pouca evidência
// (metadados do e-mail), a segunda com o texto real do PDF — sem nunca
// perder o que a primeira já tinha certeza. Módulo puro.
//
// Existe porque o caminho do e-mail classifica em dois momentos, por uma
// razão de arquitetura: os bytes do anexo vão direto do complemento do
// Gmail para o Drive, nunca passam por este servidor. Em `preparar`, antes
// do upload, o único texto disponível é assunto + corpo do e-mail — o PDF
// em si ainda não existe em lugar nenhum que o servidor possa ler. Só depois
// do upload, em `concluir`, o arquivo passa a existir no Drive do
// escritório, e o mesmo grant `drive.file` que o criou permite lê-lo de
// volta. É aí que o texto de verdade aparece.
//
// A regra de ouro: o texto do PDF só pode ADICIONAR evidência, nunca tirar.

/**
 * @param {{clientId: string|null, categoryId: string|null, competencia: string|null}} atual
 *        o que já estava gravado, da primeira passada
 * @param {{clientId: string|null, categoryId: string|null, competencia: string|null, suposicoes: string[]}} novo
 *        o que `classificar()` devolveu com o texto do PDF somado
 * @param {boolean} clienteAtualEhProvisorio
 * @returns {{clientId: string|null, categoryId: string|null, competencia: string|null, mudou: boolean}}
 */
export function mesclarReclassificacao(atual, novo, clienteAtualEhProvisorio) {
  // Só troca cliente quando o atual está em aberto: nenhum, ou um palpite de
  // remetente que ninguém confirmou ainda. Um cliente já identificado por
  // CNPJ ou apelido não é substituído por outro achado no PDF — dois CNPJs
  // válidos discordando é ambiguidade rara demais para decidir sozinho, e
  // aqui o produto erra para o lado de manter o que já foi decidido, não de
  // arriscar uma segunda opinião automática.
  const podeTrocarCliente = atual.clientId == null || clienteAtualEhProvisorio;
  const clientId = podeTrocarCliente && novo.clientId ? novo.clientId : atual.clientId;

  // Categoria não tem essa ambiguidade — o motor já escolhe a palavra-chave
  // mais específica quando duas competem (ver rules.js), então uma segunda
  // leitura com mais texto só tem para onde melhorar.
  const categoryId = novo.categoryId ?? atual.categoryId;

  // Suposição é sempre pior que qualquer leitura real — inclusive a que já
  // estava gravada. Nunca deveria acontecer de a segunda passada supor
  // quando a primeira tinha achado de verdade (mais texto não perde
  // informação), mas a checagem custa nada e evita um regressão silenciosa
  // se o motor de regras mudar no futuro.
  const competencia = novo.suposicoes?.includes('competencia')
    ? atual.competencia
    : novo.competencia;

  const mudou = clientId !== atual.clientId
    || categoryId !== atual.categoryId
    || competencia !== atual.competencia;

  return { clientId, categoryId, competencia, mudou };
}
