-- =========================================================================
-- Renomeio do módulo: "Acompanhamento Contábil" -> "Soluções Contábeis"
-- =========================================================================
-- O slug canônico passa a ser `solucoes-contabeis`. Para não derrubar
-- assinaturas em produção criadas antes do renomeio, a função RLS
-- `has_accounting_access` passa a aceitar AMBOS os slugs.
--
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
-- =========================================================================

create or replace function public.has_accounting_access(p_company_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    public.is_admin()
    or (
      p_company_id is not null
      and public.is_company_member(p_company_id)
      and exists (
        select 1
        from public.subscriptions s
        where s.company_id = p_company_id
          and s.system_slug in ('solucoes-contabeis', 'acompanhamento-contabil')
          and s.status in ('active', 'trialing')
      )
    );
$$;

-- Observação: o backfill de subscriptions.system_slug para o novo valor é
-- opcional, já que a função acima aceita os dois. Caso queira normalizar
-- depois (recomendado em uma segunda janela de manutenção), basta rodar:
--
--   update public.subscriptions
--      set system_slug = 'solucoes-contabeis'
--    where system_slug = 'acompanhamento-contabil';
