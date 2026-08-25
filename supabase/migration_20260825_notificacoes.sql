-- Sistema de notificações: tabela, gatilhos e permissões.
--
-- POR QUE GATILHO, e não uma chamada no código do app: os eventos que
-- interessam nascem em lugares diferentes — o navegador aprova um membro, uma
-- Edge Function marca a fatura como paga, o `pg_cron` gera cobrança, o chat de
-- suporte grava resposta pela função de IA. Notificar a partir do app
-- significaria lembrar de chamar em cada um desses caminhos, e o dia em que
-- alguém esquecer não dá erro: o aviso simplesmente não chega, e ninguém
-- descobre. No gatilho, a notificação nasce da MUDANÇA no banco, venha ela de
-- onde vier.
--
-- UMA LINHA POR PESSOA. Um evento de empresa que interessa a três admins vira
-- três linhas. Parece desperdício e não é: "lida" é estado de cada um. Uma
-- linha compartilhada faria o primeiro que lesse apagar o aviso dos outros.

begin;

-- ── Quem recebe o quê ───────────────────────────────────────────────────

-- Insere uma notificação. Existe para os gatilhos não repetirem o INSERT e,
-- principalmente, para o dia em que a forma da tabela mudar: muda aqui, não em
-- seis lugares.
create or replace function public.notificar(
  p_user_id uuid,
  p_company_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then return; end if;

  insert into public.notifications (user_id, company_id, type, title, body, link, metadata)
  values (p_user_id, p_company_id, p_type, p_title, p_body, p_link, p_metadata);
end;
$$;

-- Quem responde pelo escritório: dono e admins ativos. É para essas pessoas
-- que vão pedido de entrada e cobrança.
create or replace function public.responsaveis_da_empresa(p_company_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cm.user_id
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.status = 'active'
    and cm.role in ('owner', 'admin');
$$;

-- ── Equipe e acessos ────────────────────────────────────────────────────

create or replace function public.notificar_membro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
  v_empresa text;
  v_destino uuid;
begin
  select coalesce(nullif(trim(p.name), ''), 'Alguém') into v_nome
  from public.profiles p where p.id = new.user_id;
  select c.name into v_empresa from public.companies c where c.id = new.company_id;

  -- Pedido de entrada novo: avisa quem pode aprovar.
  if tg_op = 'INSERT' and new.status = 'pending' then
    for v_destino in select r.user_id from public.responsaveis_da_empresa(new.company_id) r loop
      -- Não avisa quem fez a própria solicitação, no caso raro de um
      -- responsável pedir entrada de novo.
      if v_destino <> new.user_id then
        perform public.notificar(
          v_destino, new.company_id, 'equipe_pedido',
          v_nome || ' pediu para entrar',
          'Aguardando sua aprovação em ' || coalesce(v_empresa, 'sua empresa') || '.',
          '/area-do-cliente?tab=equipe',
          jsonb_build_object('member_id', new.id, 'solicitante', new.user_id)
        );
      end if;
    end loop;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    -- Aprovado: avisa a pessoa que estava esperando. É o aviso mais útil da
    -- lista — sem ele, ela fica recarregando a tela sem saber se já pode entrar.
    if new.status = 'active' and old.status = 'pending' then
      perform public.notificar(
        new.user_id, new.company_id, 'equipe_aprovado',
        'Seu acesso foi aprovado',
        'Você já faz parte de ' || coalesce(v_empresa, 'sua empresa') || '.',
        '/area-do-cliente',
        jsonb_build_object('member_id', new.id)
      );
    elsif new.status = 'rejected' then
      perform public.notificar(
        new.user_id, new.company_id, 'equipe_recusado',
        'Seu pedido de acesso não foi aprovado',
        'O responsável por ' || coalesce(v_empresa, 'essa empresa') || ' recusou a solicitação.',
        '/area-do-cliente',
        jsonb_build_object('member_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notificar_membro on public.company_members;
create trigger trg_notificar_membro
  after insert or update on public.company_members
  for each row execute function public.notificar_membro();

-- ── Cobrança ────────────────────────────────────────────────────────────

create or replace function public.notificar_fatura()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destino uuid;
  v_valor text;
  v_venc text;
begin
  -- O locale do banco é en_US, então to_char devolve "1,234.50". O translate
  -- troca ponto e vírgula de lugar e entrega "1.234,50" — que é como o valor
  -- aparece na fatura e é o que o contador espera ler no aviso.
  v_valor := 'R$ ' || translate(to_char(coalesce(new.amount, 0), 'FM999G999G990D00'), '.,', ',.');
  v_venc := case when new.due_date is not null
                 then ' Vence em ' || to_char(new.due_date, 'DD/MM/YYYY') || '.'
                 else '' end;

  -- Fatura nova. Só avisa se já nasce cobrável: rascunho ou fatura zerada não
  -- é notícia para ninguém.
  if tg_op = 'INSERT' and coalesce(new.status, '') <> 'paid' and coalesce(new.amount, 0) > 0 then
    for v_destino in
      select r.user_id from public.responsaveis_da_empresa(new.company_id) r
      union
      select new.user_id where new.user_id is not null
    loop
      perform public.notificar(
        v_destino, new.company_id, 'fatura_gerada',
        'Nova fatura de ' || v_valor,
        coalesce(new.description, 'Fatura disponível.') || v_venc,
        '/area-do-cliente?tab=cobranca',
        jsonb_build_object('invoice_id', new.id)
      );
    end loop;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Pagamento confirmado.
    if new.status = 'paid' and old.status is distinct from 'paid' then
      for v_destino in
        select r.user_id from public.responsaveis_da_empresa(new.company_id) r
        union
        select new.user_id where new.user_id is not null
      loop
        perform public.notificar(
          v_destino, new.company_id, 'fatura_paga',
          'Pagamento confirmado',
          'Recebemos ' || v_valor || '. Obrigado!',
          '/area-do-cliente?tab=cobranca',
          jsonb_build_object('invoice_id', new.id)
        );
      end loop;

    -- Pagamento recusado. É o aviso de maior consequência da lista: cartão
    -- recusado que passa despercebido vira serviço suspenso semanas depois.
    elsif new.payment_error is not null
      and new.payment_error is distinct from old.payment_error then
      for v_destino in
        select r.user_id from public.responsaveis_da_empresa(new.company_id) r
        union
        select new.user_id where new.user_id is not null
      loop
        perform public.notificar(
          v_destino, new.company_id, 'fatura_recusada',
          'Pagamento recusado',
          'Não foi possível cobrar ' || v_valor || '. Verifique o cartão cadastrado.',
          '/area-do-cliente?tab=cobranca',
          jsonb_build_object('invoice_id', new.id, 'erro', new.payment_error)
        );
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notificar_fatura on public.invoices;
create trigger trg_notificar_fatura
  after insert or update on public.invoices
  for each row execute function public.notificar_fatura();

-- ── Suporte ─────────────────────────────────────────────────────────────

create or replace function public.notificar_suporte()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t record;
  v_destino uuid;
  v_previa text;
begin
  select id, subject, user_id, company_id, ticket_number
    into t
  from public.support_tickets where id = new.ticket_id;
  if t.id is null then return new; end if;

  -- Prévia curta: o suficiente para decidir se abre agora, sem despejar a
  -- mensagem inteira dentro de um dropdown.
  v_previa := left(regexp_replace(coalesce(new.message, ''), '\s+', ' ', 'g'), 120);

  -- Resposta do suporte (humano ou IA) vai para quem abriu o chamado.
  if new.sender_type in ('admin', 'ai') then
    perform public.notificar(
      t.user_id, t.company_id, 'suporte_resposta',
      'Resposta no chamado #' || coalesce(t.ticket_number::text, '—'),
      v_previa,
      '/area-do-cliente?tab=suporte&ticket=' || t.id::text,
      jsonb_build_object('ticket_id', t.id, 'message_id', new.id)
    );

  -- Mensagem do cliente vai para os admins do produto. Não é o mesmo conjunto
  -- de "responsáveis da empresa": quem atende suporte é a NoraTech.
  elsif new.sender_type = 'user' then
    for v_destino in
      select p.id from public.profiles p
      where (p.role = 'admin' or p.can_access_admin = true)
        and p.id is distinct from new.sender_id
    loop
      perform public.notificar(
        v_destino, t.company_id, 'suporte_mensagem',
        'Nova mensagem no chamado #' || coalesce(t.ticket_number::text, '—'),
        coalesce(t.subject || ' — ', '') || v_previa,
        '/admin?tab=suporte&ticket=' || t.id::text,
        jsonb_build_object('ticket_id', t.id, 'message_id', new.id)
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notificar_suporte on public.support_messages;
create trigger trg_notificar_suporte
  after insert on public.support_messages
  for each row execute function public.notificar_suporte();

-- ── Permissões ──────────────────────────────────────────────────────────
-- Nomeando os três papéis, e não só `public`: este projeto tem default
-- privileges que concedem EXECUTE a anon e authenticated em toda função nova,
-- e um `revoke from public` não encosta nesse grant nominal. Já custou caro
-- uma vez nesta base — ver migration_20260825_tranca_rpcs_sensiveis.sql.
--
-- `notificar` cria linha na caixa de qualquer um: se fosse chamável pelo
-- cliente, daria para forjar aviso em nome do sistema. Só os gatilhos usam, e
-- gatilho não consulta EXECUTE de quem disparou a escrita.
revoke execute on function public.notificar(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.responsaveis_da_empresa(uuid) from public, anon, authenticated;
revoke execute on function public.notificar_membro()   from public, anon, authenticated;
revoke execute on function public.notificar_fatura()   from public, anon, authenticated;
revoke execute on function public.notificar_suporte()  from public, anon, authenticated;

commit;
