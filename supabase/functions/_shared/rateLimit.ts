// Rate limiting compartilhado das Edge Functions.
//
// A contagem mora no Postgres (RPC `check_rate_limit`), não em memória: cada
// invocação de Edge Function pode cair num isolate diferente, e um contador
// em memória zeraria a cada frio — quem quisesse furar o limite só precisaria
// esperar o isolate reciclar. No banco o número é um só para todas as réplicas.
//
// Ver supabase/migration_20260823_rate_limit.sql para o porquê da janela fixa
// e da contagem atômica.

export type RateLimitRule = {
  /** Nome do balde. Separa contadores de recursos diferentes. */
  bucket: string;
  /** Quantas chamadas cabem na janela. */
  limit: number;
  /** Tamanho da janela, em segundos. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  hits: number;
  limit: number;
  retryAfter: number;
};

/**
 * Registra uma chamada e diz se ela cabe no limite.
 *
 * Falha ABERTA de propósito: se o banco não responder, a chamada passa e o
 * erro vai para o log. O limitador é uma segunda linha de defesa (a primeira
 * é a autenticação); derrubar um recurso legítimo porque o contador piscou
 * troca um problema de custo por um de disponibilidade. O log é o que faz a
 * falha não passar despercebida.
 *
 * @param admin cliente Supabase com service_role — a RPC não é exposta a mais ninguém
 */
export async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  admin: any,
  rule: RateLimitRule,
  key: string,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket: rule.bucket,
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw error;

    return {
      allowed: Boolean(data?.allowed),
      hits: Number(data?.hits ?? 0),
      limit: Number(data?.limit ?? rule.limit),
      retryAfter: Number(data?.retry_after ?? rule.windowSeconds),
    };
  } catch (err) {
    console.error('[rateLimit] falhou, liberando a chamada', rule.bucket, key, err);
    return { allowed: true, hits: 0, limit: rule.limit, retryAfter: 0 };
  }
}

/**
 * Resposta 429 pronta, com `Retry-After` para o cliente saber quando voltar.
 *
 * A mensagem não diz o limite exato nem quantas chamadas restam: num endpoint
 * sensível isso entrega ao atacante o mapa de quanto dá para tentar por
 * janela. Para quem é legítimo, "espere N segundos" é a informação que importa.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  mensagem = 'Muitas tentativas. Aguarde um pouco e tente de novo.',
) {
  return new Response(
    JSON.stringify({ error: mensagem, retryAfter: result.retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
      },
    },
  );
}

/**
 * IP de quem chamou, para limitar o que ainda não tem usuário autenticado.
 *
 * Só serve atrás de um proxy confiável (é o caso: o gateway do Supabase
 * preenche estes cabeçalhos). Sem o proxy, qualquer um forjaria o valor.
 * Quando não dá para saber, cai em 'desconhecido' — todos os anônimos passam
 * a dividir o mesmo balde, que é restritivo demais mas nunca permissivo demais.
 */
export function callerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // O primeiro da lista é o cliente original; o resto são os proxies.
    const primeiro = forwarded.split(',')[0]?.trim();
    if (primeiro) return primeiro;
  }
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'desconhecido';
}
