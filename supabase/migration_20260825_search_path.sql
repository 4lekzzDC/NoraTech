-- Fixa o search_path de todas as funções do schema public, com pg_temp por último.
--
-- Duas correções, e a segunda é a que importa.
--
-- 1) Seis funções não tinham search_path nenhum (touch_updated_at,
--    set_updated_at, touch_whatsapp_connections_updated_at, due_date_for,
--    next_due_date, company_invoice_lines). São as que o linter aponta. Todas
--    são SECURITY INVOKER — rodam com o privilégio de quem chamou —, então
--    ali não há escalada de privilégio possível. É higiene, não buraco.
--
-- 2) As outras 31 são SECURITY DEFINER e já tinham `search_path = public` —
--    e é justamente aí que mora o problema real, que o linter não mostra:
--
--    o PostgreSQL procura o schema temporário ANTES do search_path quando
--    pg_temp não está listado nele. Uma função SECURITY DEFINER roda com os
--    privilégios da dona (postgres). Se um usuário conseguir criar uma tabela
--    temporária chamada, digamos, `profiles`, as referências não qualificadas
--    dentro dessas funções passam a resolver para a tabela DELE — e a função
--    lê e escreve nessa tabela com privilégio de postgres.
--
--    Listar `pg_temp` explicitamente no fim resolve: o schema temporário
--    passa a ser o último lugar procurado, em vez do primeiro. É a
--    recomendação da própria documentação do PostgreSQL para escrever
--    SECURITY DEFINER com segurança.
--
-- `public` continua primeiro, então nenhuma resolução de nome que funciona
-- hoje muda. A alteração só torna a busca mais restrita, nunca mais ampla.

do $$
declare
  f record;
  alteradas int := 0;
begin
  for f in
    select p.oid,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- extensões trazem funções próprias; não são nossas para mexer
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('alter function public.%s set search_path = public, pg_temp', f.assinatura);
    alteradas := alteradas + 1;
  end loop;

  raise notice 'search_path fixado em % funções', alteradas;
end $$;
