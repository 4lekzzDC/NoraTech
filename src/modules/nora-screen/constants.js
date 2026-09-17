// Identidade e rotas do Nora Screen — compartilhamento de tela ao vivo pelo
// navegador, produto da NoraTech.
//
// Endereço público: transmissao.noratech.com.br. O produto continua no
// mesmo projeto, então as duas formas convivem:
//
//   subdomínio          →  /            e  /sala/CODIGO
//   domínio principal   →  /transmissao e  /transmissao/sala/CODIGO
//
// Quem decide qual delas vale é o HOST, e a decisão é do navegador, não
// do Vercel: num app de página única a reescrita do servidor só escolhe
// qual arquivo servir (sempre o index.html), enquanto quem lê o caminho
// e escolhe a tela é o roteador, aqui dentro. Por isso a base de rota é
// calculada a partir do hostname e não de uma configuração de deploy.
//
// Diferente do NoraDocs e do hub Soluções Contábeis, a entrada não passa por
// login da plataforma: quem entra numa sala se identifica por apelido.

export const NORA_SCREEN_SLUG = 'nora-screen';
export const NORA_SCREEN_NAME = 'Nora Screen';

/** Host público do produto. */
export const HOST_NORA_SCREEN = 'transmissao.noratech.com.br';
/** Base das rotas no domínio principal — mantida para compatibilidade. */
export const BASE_NO_DOMINIO_PRINCIPAL = '/transmissao';
/** Site institucional, para quando o Nora Screen está em outro host. */
export const URL_SITE_NORATECH = 'https://noratech.com.br';

/**
 * Se este hostname é o do Nora Screen.
 *
 * Aceita qualquer `transmissao.*` para os ambientes de teste e preview
 * (transmissao.localhost, transmissao.staging…) responderem igual ao de
 * produção — validar num host e publicar noutro esconderia justamente o
 * tipo de erro que só aparece no subdomínio.
 */
export function ehHostDoNoraScreen(hostname) {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  return host === HOST_NORA_SCREEN || host.startsWith('transmissao.');
}

// Resolvido uma vez, na carga do módulo: o host não muda durante a
// navegação, e ler `location` durante o render seria impuro.
export const NO_SUBDOMINIO = typeof window !== 'undefined'
  && ehHostDoNoraScreen(window.location.hostname);

/**
 * Caminho de uma tela do Nora Screen no host atual.
 *
 * `noSubdominio` é parâmetro para os testes poderem checar as duas
 * formas sem simular um navegador.
 */
export function noraScreenRoute(path = '', noSubdominio = NO_SUBDOMINIO) {
  const base = noSubdominio ? '' : BASE_NO_DOMINIO_PRINCIPAL;
  const limpo = String(path || '').replace(/^\/+/, '');
  if (!limpo) return base || '/';
  return `${base}/${limpo}`;
}

export const NORA_SCREEN_ROUTE = noraScreenRoute();

// Site institucional — destino do botão "Conhecer NoraTech". No
// subdomínio, `/` é a home do próprio Nora Screen: o link precisa
// atravessar para o site, e por isso vira absoluto.
export const SITE_NORATECH = NO_SUBDOMINIO ? `${URL_SITE_NORATECH}/` : '/';

export const NICKNAME_MAX = 24;
export const NICKNAME_MIN = 2;

// Código de sala: dois blocos de quatro, sem os caracteres que se confundem
// quando alguém dita o código por voz ou copia de uma tela transmitida
// (0/O, 1/I/L). O que sobra é inequívoco em qualquer fonte.
const ALFABETO_SALA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_BLOCO = 4;
export const PADRAO_CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

export function gerarCodigoDeSala(random = Math.random) {
  const sorteia = () => Array.from(
    { length: TAMANHO_BLOCO },
    () => ALFABETO_SALA[Math.floor(random() * ALFABETO_SALA.length)],
  ).join('');
  return `${sorteia()}-${sorteia()}`;
}

// Normaliza o que a pessoa digitou no campo de código: aceita minúsculas,
// espaços e a ausência do hífen (colar "abcd1234" tem de funcionar), e
// devolve sempre no formato canônico XXXX-XXXX.
export function normalizarCodigo(bruto) {
  const limpo = String(bruto || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, TAMANHO_BLOCO * 2);
  if (limpo.length <= TAMANHO_BLOCO) return limpo;
  return `${limpo.slice(0, TAMANHO_BLOCO)}-${limpo.slice(TAMANHO_BLOCO)}`;
}

export function codigoValido(bruto) {
  return PADRAO_CODIGO.test(normalizarCodigo(bruto));
}

// Iniciais para o avatar do nickname: duas letras quando há duas palavras,
// senão os dois primeiros caracteres. Percorre por code point para um
// nickname com emoji não sair partido no meio de um surrogate pair.
export function iniciaisDe(nickname) {
  const partes = String(nickname || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  if (partes.length === 1) return Array.from(partes[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(partes[0])[0] + Array.from(partes[partes.length - 1])[0]).toUpperCase();
}
