// Identidade e rotas do Nora Screen — compartilhamento de tela ao vivo pelo
// navegador, produto da NoraTech.
//
// Vive em subdomínio próprio (transmissao.noratech.com.br), e por isso a
// rota base é `/transmissao`: apontar o subdomínio para ela é só uma
// reescrita no Vercel, sem mexer em código.
//
// Diferente do NoraDocs e do hub Soluções Contábeis, a entrada não passa por
// login da plataforma: quem entra numa sala se identifica por nickname.

export const NORA_SCREEN_SLUG = 'nora-screen';
export const NORA_SCREEN_NAME = 'Nora Screen';
export const NORA_SCREEN_ROUTE = '/transmissao';

export function noraScreenRoute(path = '') {
  return path ? `${NORA_SCREEN_ROUTE}/${path}` : NORA_SCREEN_ROUTE;
}

// Site institucional — destino do botão "Conhecer NoraTech".
export const SITE_NORATECH = '/';

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
