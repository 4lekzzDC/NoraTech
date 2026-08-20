// Onde o documento vai parar, e em que estado ele fica. Módulo puro.
//
// Esta decisão nasceu dentro da Edge Function de entrada por e-mail, e era o
// pedaço mais importante dela justamente onde nenhum teste alcançava: para
// exercitá-la seria preciso um token, uma conta Google conectada e uma
// chamada de rede. Aqui ela é uma função de três entradas e uma saída.
//
// São três destinos, e a diferença entre eles é o que falta:
//
//   raiz         nada falta — cliente cadastrado e todos os campos fechados
//   verificação  falta CADASTRO — sabemos de que empresa é, ela não é cliente
//   triagem      falta INFORMAÇÃO — não sabemos de quem é
//
// A distinção entre as duas últimas é o que impede a árvore de clientes de
// receber palpite, e ao mesmo tempo evita que tudo o que não é reconhecido
// caia num monte único.

export const DESTINOS = ['raiz', 'triagem', 'verificacao'];

/**
 * @param {object} entrada
 * @param {{decisao: 'organizar'|'revisar', motivoRevisao: string|null}} entrada.resultado
 *        o que `classificar()` devolveu
 * @param {{id: string, nome: string, status?: string}|null} entrada.cliente
 *        o cliente identificado, ou null
 * @param {boolean} [entrada.autoOrganize] false = escritório quer conferir tudo
 * @returns {{base: string, status: string, motivo: string|null}}
 */
export function decidirDestino({ resultado, cliente, autoOrganize = true }) {
  // Sem dono não há caminho a montar: o destino definitivo só é conhecido
  // depois que alguém disser de quem é.
  if (!cliente) {
    return {
      base: 'triagem',
      status: 'revisar',
      motivo: resultado?.motivoRevisao || 'Cliente não identificado.',
    };
  }

  // Provisório vai para verificação mesmo com todos os campos fechados. Não é
  // rigor excessivo: a empresa foi identificada por um palpite sobre o
  // remetente, e promovê-la à árvore oficial sem ninguém olhar é exatamente o
  // que produz pastas duplicadas com três grafias do mesmo nome.
  if (cliente.status === 'provisorio') {
    return {
      base: 'verificacao',
      status: 'revisar',
      motivo: `Empresa "${cliente.nome}" ainda não é cliente cadastrado. `
        + 'Confirme ou funda com um cliente existente em Clientes.',
    };
  }

  // Cliente de verdade, mas faltou competência ou categoria: vai para triagem
  // como qualquer documento duvidoso do upload manual. Mesma regra, mesma
  // fila — a origem do arquivo não muda o que significa "está incompleto".
  if (resultado?.decisao !== 'organizar') {
    return { base: 'triagem', status: 'revisar', motivo: resultado?.motivoRevisao || null };
  }

  // Escritório que desligou o arquivamento automático quer conferir tudo,
  // inclusive o que o motor fechou sozinho.
  if (!autoOrganize) {
    return {
      base: 'triagem',
      status: 'revisar',
      motivo: 'Arquivamento automático desligado nas configurações do escritório.',
    };
  }

  return { base: 'raiz', status: 'organizado', motivo: null };
}
