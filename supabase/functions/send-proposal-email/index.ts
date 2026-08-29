import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Envia a proposta por e-mail de verdade (Resend) e SÓ DEPOIS marca como
// 'enviada' — nunca ao contrário. Se o Resend recusar, a proposta continua
// em rascunho e a falha vai pro histórico via svc_record_proposal_send (evento
// 'envio_falhou'), pra dar pra debugar sem perder o rascunho.
// Ver supabase/migration_20260829_proposal_email.sql.
const LIMITE_ENVIO = { bucket: 'send_proposal_email', limit: 20, windowSeconds: 300 };

const ROXO = '#7C3AED';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function brl(v: unknown) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Item = { name: string; description: string | null; amount: number };

function montarEmailHtml(opts: {
  companyName: string;
  items: Item[];
  subtotal: number;
  discountAmount: number;
  setupFee: number;
  total: number;
  validUntil: string | null;
  link: string;
}) {
  const linhasItens = opts.items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#1a1a1a;">${it.name}</div>
        ${it.description ? `<div style="font-size:13px;color:#777;margin-top:2px;">${it.description}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#1a1a1a;white-space:nowrap;">
        ${brl(it.amount)}
      </td>
    </tr>`).join('');

  const validadeLinha = opts.validUntil
    ? `<p style="font-size:13px;color:#777;margin:16px 0 0;">Válida até ${new Date(`${opts.validUntil}T00:00:00`).toLocaleDateString('pt-BR')}.</p>`
    : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f0eef6;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:${ROXO};padding:24px 32px;">
        <div style="color:#fff;font-size:20px;font-weight:700;">NoraTech</div>
      </div>
      <div style="padding:32px;">
        <h1 style="font-size:20px;margin:0 0 6px;color:#1a1a1a;">Proposta comercial</h1>
        <p style="font-size:14px;color:#555;margin:0 0 24px;">Preparamos esta proposta para <strong>${opts.companyName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">${linhasItens}</table>
        <table style="width:100%;margin-top:16px;font-size:14px;color:#444;">
          <tr><td>Subtotal</td><td style="text-align:right;">${brl(opts.subtotal)}</td></tr>
          ${opts.discountAmount > 0 ? `<tr><td>Desconto</td><td style="text-align:right;">-${brl(opts.discountAmount)}</td></tr>` : ''}
          ${opts.setupFee > 0 ? `<tr><td>Implantação</td><td style="text-align:right;">${brl(opts.setupFee)}</td></tr>` : ''}
          <tr style="font-weight:700;color:#1a1a1a;font-size:16px;"><td style="padding-top:8px;">Total</td><td style="text-align:right;padding-top:8px;">${brl(opts.total)}</td></tr>
        </table>
        ${validadeLinha}
        <div style="text-align:center;margin-top:32px;">
          <a href="${opts.link}" style="display:inline-block;background:${ROXO};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;">Ver proposta e responder</a>
        </div>
        <p style="font-size:12px;color:#999;margin-top:24px;text-align:center;">Se o botão não funcionar, copie e cole este link:<br />${opts.link}</p>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autorizado' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const resendKey   = Deno.env.get('RESEND_API_KEY') ?? '';

    // Admin client — service role, nunca exposto ao navegador
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confere que quem chamou tem sessão válida e é admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Sessão inválida' }, 401);

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'admin') return json({ error: 'Acesso negado' }, 403);

    const limite = await checkRateLimit(adminClient, LIMITE_ENVIO, caller.id);
    if (!limite.allowed) {
      return rateLimitResponse(limite, corsHeaders, 'Muitos envios seguidos. Aguarde um instante.');
    }

    const body = await req.json().catch(() => ({}));
    const proposalId: string | undefined = body?.proposal_id;
    if (!proposalId) return json({ error: 'proposal_id é obrigatório' }, 400);

    const { data: proposta, error: propostaErr } = await adminClient
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .maybeSingle();
    if (propostaErr) throw propostaErr;
    if (!proposta) return json({ error: 'Proposta não encontrada' }, 404);
    if (proposta.status !== 'rascunho') {
      return json({ error: 'Só é possível enviar uma proposta em rascunho.' }, 409);
    }

    const { data: itens, error: itensErr } = await adminClient
      .from('proposal_items')
      .select('name, description, amount')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true });
    if (itensErr) throw itensErr;
    if (!itens?.length) return json({ error: 'A proposta não tem nenhum sistema incluído.' }, 422);

    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, name, owner_id')
      .eq('id', proposta.company_id)
      .maybeSingle();
    if (companyErr) throw companyErr;
    if (!company?.owner_id) {
      return json({ error: 'Empresa sem responsável cadastrado — não há para quem enviar.' }, 422);
    }

    const { data: { user: owner }, error: ownerErr } = await adminClient.auth.admin.getUserById(company.owner_id);
    if (ownerErr || !owner?.email) {
      return json({ error: 'O responsável pela empresa não tem e-mail cadastrado.' }, 422);
    }

    if (!resendKey) {
      console.error('[send-proposal-email] RESEND_API_KEY não configurada');
      return json({ error: 'Envio de e-mail não configurado. Fale com o time técnico.' }, 500);
    }

    const origin = req.headers.get('origin')
      ?? Deno.env.get('SITE_URL')
      ?? 'https://noratech.com.br';
    const link = `${origin}/proposta/${proposta.public_token}`;

    const html = montarEmailHtml({
      companyName: company.name,
      items: itens,
      subtotal: proposta.subtotal,
      discountAmount: proposta.discount_amount,
      setupFee: proposta.setup_fee,
      total: proposta.total,
      validUntil: proposta.valid_until,
      link,
    });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NoraTech Propostas <propostas@noratech.com.br>',
        to: [owner.email],
        subject: `Proposta comercial NoraTech — ${proposta.title}`,
        html,
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      const motivo = resendBody?.message || resendBody?.error || `Resend respondeu ${resendRes.status}`;
      console.error('[send-proposal-email] Resend falhou', resendRes.status, resendBody);
      await adminClient.rpc('svc_record_proposal_send', {
        p_id: proposalId,
        p_actor_id: caller.id,
        p_success: false,
        p_detail: String(motivo).slice(0, 500),
      });
      return json({ error: `Falha ao enviar e-mail: ${motivo}` }, 502);
    }

    const { data: atualizada, error: rpcErr } = await adminClient.rpc('svc_record_proposal_send', {
      p_id: proposalId,
      p_actor_id: caller.id,
      p_success: true,
      p_detail: `Enviado para ${owner.email} (Resend: ${resendBody?.id ?? '—'})`,
    });
    if (rpcErr) throw rpcErr;

    return json({ proposal: atualizada });
  } catch (err) {
    console.error('[send-proposal-email]', err);
    return json({ error: 'Erro interno.' }, 500);
  }
});
