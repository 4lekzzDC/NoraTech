// Quem mandou o e-mail — e se dá para tirar dali o nome de uma empresa.
//
// Módulo puro, e está aqui e não dentro da Edge Function por um motivo que já
// custou caro: era o pedaço mais importante da entrada por e-mail vivendo no
// único lugar onde nenhum teste alcançava. O primeiro documento real que
// passou por ele criou um cliente chamado "TikTok Shop".

// Domínio de provedor aberto não identifica empresa nenhuma. Sem esta lista,
// um cliente que escreve do Gmail viraria um cliente provisório chamado
// "gmail.com", e a pasta de verificação juntaria empresas sem relação.
export const PROVEDORES_ABERTOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com',
  'outlook.com.br', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com',
  'r7.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me', 'zoho.com',
]);

// Caixa que não aceita resposta é sistema disparando aviso, não empresa
// mandando o documento dela.
//
// A distinção importa mais do que parece. Uma DANFE chegou anexada a um aviso
// de entrega da TikTok Shop: o emitente da nota era Carpei Acessórios, o
// destinatário era uma pessoa física, e a TikTok era só o intermediário que
// disparou o e-mail. Criar "TikTok Shop" como cliente provisório e abrir uma
// pasta com esse nome não aproxima nada do arquivamento certo — atrapalha,
// porque o analista passa a ter uma pasta com nome de plataforma para desfazer.
//
// Quando o remetente é uma caixa automática, o produto não tem palpite a dar:
// o documento vai para _triagem e quem escolhe o destino é a pessoa.
// Escritos com hífen; a normalização abaixo cuida das outras grafias, então
// "no_reply", "no.reply" e "noreply" não precisam entrar um a um.
const CAIXAS_AUTOMATICAS = [
  'no-reply', 'noreply', 'donotreply', 'do-not-reply',
  'nao-responda', 'naoresponda', 'nao-responder',
  'notificacao', 'notificacoes', 'notification', 'notifications',
  'automatico', 'automatica', 'mailer', 'mailer-daemon', 'bounce', 'postmaster',
];

// Ponto, sublinhado e mais viram hífen: as três grafias de "no reply" passam a
// ter a mesma forma, e a comparação vira uma só.
function normalizarLocal(remetente) {
  return String(remetente || '')
    .split('@')[0]
    ?.toLowerCase()
    .trim()
    .replace(/[._+]/g, '-') || '';
}

export function ehCaixaAutomatica(remetente) {
  const local = normalizarLocal(remetente);
  if (!local) return false;

  // Casa a marca como trecho delimitado por hífen, nunca como substring solta:
  // "no-reply-financeiro" é caixa automática, "vendas" não é, e um endereço
  // como "abounce@..." não pode virar "bounce".
  return CAIXAS_AUTOMATICAS.some((marca) => (
    local === marca
    || local.startsWith(`${marca}-`)
    || local.endsWith(`-${marca}`)
    || local.includes(`-${marca}-`)
  ));
}

/**
 * Nome da empresa a partir do remetente, ou null quando não há palpite honesto.
 *
 * Devolve null em três casos, e cada um é uma decisão de não inventar:
 *   - sem domínio
 *   - domínio de provedor aberto (a pessoa, não a empresa dela)
 *   - caixa automática (a plataforma, não o dono do documento)
 *
 * @param {string} remetente     endereço completo
 * @param {string} remetenteNome nome de exibição
 * @returns {{nome: string, dominio: string}|null}
 */
export function empresaDoRemetente(remetente, remetenteNome) {
  const dominio = String(remetente || '').split('@')[1]?.toLowerCase().trim();
  if (!dominio || PROVEDORES_ABERTOS.has(dominio)) return null;
  if (ehCaixaAutomatica(remetente)) return null;

  // Nome de exibição é bem melhor que o domínio como nome de pasta
  // ("Padaria Aurora" e não "padariaaurora.com.br"), mas só vale quando o
  // domínio já provou ser corporativo.
  const exibicao = String(remetenteNome || '').trim();
  const nome = exibicao && !exibicao.includes('@') ? exibicao : dominio;
  return { nome: nome.slice(0, 120), dominio };
}
