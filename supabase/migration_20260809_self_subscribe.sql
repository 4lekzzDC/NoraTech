-- Autoatendimento: dono/admin da empresa contrata um sistema do catálogo
-- diretamente pelo Cockpit, sem passar pelo atendimento humano. A assinatura
-- criada aqui concede acesso imediato e entra automaticamente no próximo
-- fechamento pro-rata (generate_company_invoices / preview_company_invoice
-- já leem subscriptions ativas em tempo real, sem precisar de passo extra).
create or replace function public.subscribe_to_system(p_company_id uuid, p_system_slug text)
returns public.subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_system public.systems;
  v_sub    public.subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Apenas o dono ou administrador da equipe pode contratar sistemas' using errcode = '42501';
  end if;

  select * into v_system from public.systems where slug = p_system_slug and active = true;
  if v_system.slug is null then
    raise exception 'Sistema não encontrado ou indisponível' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.subscriptions
    where company_id = p_company_id
      and system_slug = v_system.slug
      and status in ('active', 'trialing')
  ) then
    raise exception 'Sua empresa já possui este sistema' using errcode = '23505';
  end if;

  insert into public.subscriptions (company_id, system_slug, plan, status, amount, currency, billing_cycle, started_at)
  values (p_company_id, v_system.slug, coalesce(v_system.name, 'Padrão'), 'active', coalesce(v_system.default_amount, 0), 'BRL', 'monthly', now())
  returning * into v_sub;

  return v_sub;
end;
$$;
