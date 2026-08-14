import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.70.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// O contexto da conta é montado AQUI, a partir do id do caller autenticado —
// nunca vem no corpo da requisição. Se o cliente pudesse mandar o contexto,
// bastaria forjar "sou dono da empresa X" para a IA falar dos dados de outro.
async function buildAccountContext(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile } = await admin
    .from('profiles')
    .select('name, email, company')
    .eq('id', userId)
    .maybeSingle();

  const { data: membership } = await admin
    .from('company_members')
    .select('role, status, company_id, companies(name, billing_day)')
    .eq('user_id', userId)
    .maybeSingle();

  const companyId = membership?.company_id ?? null;

  const [{ data: subs }, { data: invoices }, { data: systems }] = await Promise.all([
    companyId
      ? admin.from('subscriptions').select('system_slug, status, plan, current_period_end').eq('company_id', companyId)
      : Promise.resolve({ data: [] }),
    companyId
      ? admin.from('invoices').select('description, amount, status, due_date')
          .eq('company_id', companyId).order('due_date', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    admin.from('systems').select('slug, name, description'),
  ]);

  const brl = (v: unknown) =>
    typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(v ?? '—');

  return [
    '<cliente>',
    `nome: ${profile?.name || '—'}`,
    `email: ${profile?.email || '—'}`,
    `empresa: ${membership?.companies?.name || profile?.company || 'sem equipe'}`,
    `papel na empresa: ${membership?.role || '—'} (${membership?.status || '—'})`,
    `dia de vencimento da empresa: ${membership?.companies?.billing_day ?? '—'}`,
    '</cliente>',
    '',
    '<assinaturas>',
    (subs || []).length
      ? (subs || []).map((s: Record<string, unknown>) =>
          `- ${s.system_slug}: ${s.status}${s.plan ? ` (plano ${s.plan})` : ''}, período atual até ${s.current_period_end ?? '—'}`).join('\n')
      : '(nenhuma assinatura ativa)',
    '</assinaturas>',
    '',
    '<faturas_recentes>',
    (invoices || []).length
      ? (invoices || []).map((i: Record<string, unknown>) =>
          `- ${i.description}: ${brl(i.amount)}, ${i.status}, vence ${i.due_date}`).join('\n')
      : '(nenhuma fatura)',
    '</faturas_recentes>',
    '',
    '<catalogo_de_sistemas>',
    (systems || []).map((s: Record<string, unknown>) => `- ${s.name} (${s.slug}): ${s.description ?? ''}`).join('\n'),
    '</catalogo_de_sistemas>',
  ].join('\n');
}

const SYSTEM_PROMPT = `Você é o atendimento da NoraTech, uma empresa brasileira que vende sistemas de gestão por assinatura. Você conversa com clientes dentro da Área do Cliente da plataforma.

Responda em português do Brasil, em tom direto e cordial — como um colega de suporte competente, não como um chatbot formal.

O contexto abaixo traz os dados reais da conta de quem está falando com você. Use-os para responder com precisão: se perguntarem sobre uma fatura, olhe as faturas listadas; se perguntarem sobre acesso a um sistema, olhe as assinaturas.

Responda de forma curta. Uma ou duas frases resolvem a maioria das perguntas — só se estenda quando a pergunta realmente exigir. Não repita de volta os dados da conta que o cliente já conhece.

Nunca invente informação. Se a resposta depende de um dado que não está no contexto, diga que não tem essa informação e use a ferramenta escalar_para_humano.

Use escalar_para_humano quando: você não souber responder, o cliente pedir para falar com uma pessoa, o assunto exigir uma ação que você não pode executar (cancelar assinatura, emitir reembolso, alterar cobrança, corrigir um bug), ou o cliente demonstrar insatisfação com o atendimento. Ao escalar, explique ao cliente em uma frase que a equipe vai assumir a conversa.

Você não executa ações na conta — não cancela, não cobra, não altera nada. Você orienta e escala.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({ error: 'O chat com IA ainda não foi configurado (ANTHROPIC_API_KEY ausente).' }, 503);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Sessão inválida' }, 401);

    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message ?? '').toString().trim();
    let ticketId: string | null = body?.ticket_id ?? null;
    if (!message) return json({ error: 'Mensagem vazia' }, 400);
    if (message.length > 4000) return json({ error: 'Mensagem muito longa (máx. 4000 caracteres).' }, 400);

    // Ticket existente: confere que é do caller antes de qualquer coisa —
    // o id vem do cliente e não pode ser usado para ler conversa alheia.
    if (ticketId) {
      const { data: owned } = await admin
        .from('support_tickets')
        .select('id, escalated_at')
        .eq('id', ticketId).eq('user_id', caller.id).maybeSingle();
      if (!owned) return json({ error: 'Conversa não encontrada' }, 404);
    }

    const { data: membership } = await admin
      .from('company_members').select('company_id').eq('user_id', caller.id).maybeSingle();

    if (!ticketId) {
      const { data: created, error: createErr } = await admin
        .from('support_tickets')
        .insert({
          subject: message.slice(0, 80),
          user_id: caller.id,
          company_id: membership?.company_id ?? null,
          channel: 'chat',
          category: 'general',
          status: 'open',
        })
        .select('id').single();
      if (createErr) throw new Error(createErr.message);
      ticketId = created.id;
    }

    await admin.from('support_messages').insert({
      ticket_id: ticketId, sender_type: 'user', sender_id: caller.id, message,
    });

    const { data: history } = await admin
      .from('support_messages')
      .select('sender_type, message')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(40);

    // 'admin' e 'system' também entram como assistant: do ponto de vista da
    // conversa são "o lado do atendimento" falando.
    const messages = (history || []).map((m: Record<string, unknown>) => ({
      role: m.sender_type === 'user' ? 'user' as const : 'assistant' as const,
      content: String(m.message),
    }));

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      // Sonnet em vez de Opus: responder pergunta de suporte a partir de um
      // contexto pronto é bem mais barato aqui e a qualidade se mantém.
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      // effort baixo: perguntas de suporte são curtas e a latência é sentida
      // direto no chat. Não desabilitamos o thinking — com ele desligado o
      // modelo às vezes escreve a chamada de ferramenta como texto e a
      // escalação silenciosamente não acontece.
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        // cache_control no ÚLTIMO bloco de system: o cache é por prefixo, então
        // marcar aqui guarda o prompt E o contexto da conta juntos. Marcar só
        // no primeiro deixava o contexto (a parte maior) fora do cache, pago
        // inteiro a cada mensagem da conversa.
        { type: 'text', text: await buildAccountContext(admin, caller.id), cache_control: { type: 'ephemeral' } },
      ],
      tools: [{
        name: 'escalar_para_humano',
        description: 'Encaminha esta conversa para a equipe de suporte humano. Use quando não souber responder, quando o cliente pedir uma pessoa, quando for preciso executar uma ação na conta, ou quando o cliente estiver insatisfeito.',
        input_schema: {
          type: 'object',
          properties: {
            motivo: { type: 'string', description: 'Por que está escalando, em uma frase, para a equipe ler.' },
            prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          },
          required: ['motivo', 'prioridade'],
        },
      }],
      messages,
    });

    let escalated = false;
    let reply = '';

    for (const block of response.content) {
      if (block.type === 'text') reply += block.text;
      if (block.type === 'tool_use' && block.name === 'escalar_para_humano') {
        const input = block.input as { motivo?: string; prioridade?: string };
        escalated = true;
        await admin.from('support_tickets').update({
          escalated_at: new Date().toISOString(),
          priority: ['low', 'medium', 'high', 'urgent'].includes(input.prioridade ?? '') ? input.prioridade : 'medium',
          status: 'open',
          updated_at: new Date().toISOString(),
        }).eq('id', ticketId);
        await admin.from('support_messages').insert({
          ticket_id: ticketId, sender_type: 'system',
          message: `Conversa encaminhada para a equipe. Motivo: ${input.motivo ?? 'não informado'}`,
        });
      }
    }

    if (!reply.trim()) {
      reply = escalated
        ? 'Encaminhei sua conversa para a nossa equipe — em breve alguém assume por aqui.'
        : 'Não consegui formular uma resposta. Pode reformular a pergunta?';
    }

    await admin.from('support_messages').insert({
      ticket_id: ticketId, sender_type: 'ai', message: reply,
    });

    return json({ ticket_id: ticketId, reply, escalated });
  } catch (err) {
    console.error('[support-chat]', err);
    return json({ error: (err as Error).message || 'Erro ao processar a mensagem.' }, 500);
  }
});
