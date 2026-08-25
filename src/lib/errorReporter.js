import { supabase } from './supabase';

// Captura de erros do navegador.
//
// Antes disto, exceção de frontend morria num `console.error` que só quem
// estivesse com o DevTools aberto veria — ou seja, nunca, porque quem usa o
// produto não abre DevTools. O erro acontecia, a tela quebrava, e não sobrava
// registro de que tinha acontecido.
//
// A gravação é por RPC (`registrar_erro`, SECURITY DEFINER), não por INSERT: o
// cliente não escolhe o `user_id` nem o instante da linha, e a RPC é chamável
// por `anon` de propósito — erro na tela de login acontece antes de existir
// sessão, e é justamente um dos que mais interessa ver.

// Dedupe local. Um laço de render dispara a MESMA mensagem centenas de vezes
// por segundo; o teto no banco já contém o volume, mas barrar aqui evita
// gastar rede com o que vai ser descartado do outro lado.
const recentes = new Map();
const JANELA_MS = 10000;

function repetido(chave) {
  const agora = Date.now();
  for (const [k, t] of recentes) if (agora - t > JANELA_MS) recentes.delete(k);
  if (recentes.has(chave)) return true;
  recentes.set(chave, agora);
  return false;
}

export async function reportarErro(mensagem, { stack, severidade = 'error', contexto = {} } = {}) {
  const texto = String(mensagem || '').slice(0, 2000);
  if (!texto) return;
  if (repetido(texto)) return;

  try {
    await supabase.rpc('registrar_erro', {
      p_message: texto,
      p_source: 'frontend',
      p_severity: severidade,
      p_stack: stack ? String(stack).slice(0, 8000) : null,
      p_url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      p_context: contexto,
    });
  } catch {
    // Reportar erro não pode gerar erro. Se a chamada falhar, o problema
    // original já é ruim o bastante sem uma segunda falha em cima.
  }
}

let ligado = false;

/**
 * Liga a captura global. Chamado uma vez, na inicialização.
 *
 * Dois caminhos, e os dois são necessários: `error` pega exceção que escapou,
 * `unhandledrejection` pega promise rejeitada sem catch — que é a forma mais
 * comum de falha em código assíncrono e não dispara `error` nenhum.
 */
export function ligarCapturaDeErros() {
  if (ligado || typeof window === 'undefined') return;
  ligado = true;

  window.addEventListener('error', (ev) => {
    // Erro de carregamento de recurso (img, script) chega aqui sem `error`
    // preenchido e sem stack — não é exceção de código e polui o log.
    if (!ev.error && !ev.message) return;
    reportarErro(ev.message || String(ev.error), {
      stack: ev.error?.stack,
      contexto: { tipo: 'window.error', arquivo: ev.filename, linha: ev.lineno, coluna: ev.colno },
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const motivo = ev.reason;
    reportarErro(motivo?.message || String(motivo), {
      stack: motivo?.stack,
      contexto: { tipo: 'unhandledrejection' },
    });
  });
}

/**
 * Captura falhas de Edge Function embrulhando `supabase.functions.invoke`.
 *
 * Embrulhar UMA vez, e não editar os treze pontos de chamada: um wrapper por
 * chamada exigiria lembrar de usá-lo em toda função nova, e esquecer não daria
 * erro — a falha só deixaria de ser registrada, que é o modo de falha mais
 * difícil de perceber. Aqui, quem chamar `invoke` de qualquer lugar já está
 * coberto.
 *
 * O contrato de retorno não muda: a chamada segue devolvendo `{ data, error }`
 * como antes. Só passa a reportar de passagem.
 *
 * LIMITE, e importante: isto captura o que o NAVEGADOR vê falhar. Erro dentro
 * de `noradocs-inbound`, que é chamada pelo complemento do Gmail e não pelo
 * navegador, continua só no log da plataforma Supabase. Cobrir esse caso exige
 * reportar de dentro das funções e reimplantá-las.
 */
export function ligarCapturaDeFuncoes(supabase) {
  const funcoes = supabase?.functions;
  if (!funcoes || funcoes.__capturaLigada) return;
  funcoes.__capturaLigada = true;

  const original = funcoes.invoke.bind(funcoes);

  funcoes.invoke = async (nome, opcoes) => {
    const resultado = await original(nome, opcoes);
    const erro = resultado?.error;
    if (!erro) return resultado;

    // `invoke` transforma qualquer status fora de 2xx num Error genérico
    // ("non-2xx status code"); a mensagem de verdade está no corpo, dentro de
    // `error.context`. Sem desembrulhar, o log registraria a mesma frase inútil
    // para todo tipo de falha.
    // `.clone()` antes de ler, e isto não é zelo: `context` é um Response, e
    // `.json()` CONSOME o corpo. `payments.js` desembrulha esse mesmo corpo
    // para mostrar ao usuário a mensagem real da Stripe em vez do genérico
    // "non-2xx status code". Ler aqui sem clonar deixaria o corpo vazio para
    // ele, e a tela passaria a mostrar o erro inútil — uma regressão causada
    // justamente pelo código que existe para observar melhor.
    let detalhe = null;
    try { detalhe = await erro.context?.clone?.()?.json?.(); } catch { /* corpo vazio ou não-JSON */ }

    reportarErro(`[${nome}] ${detalhe?.error || erro.message}`, {
      stack: erro.stack,
      contexto: {
        tipo: 'edge_function',
        funcao: nome,
        status: erro.context?.status ?? null,
        corpo: detalhe ?? null,
      },
    });

    return resultado;
  };
}
