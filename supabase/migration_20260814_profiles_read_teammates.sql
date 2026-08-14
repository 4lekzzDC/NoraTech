-- Restringe a leitura de `profiles`.
--
-- A policy anterior, `profiles_read_authenticated`, era USING (true): qualquer
-- usuário autenticado lia o profile de TODOS os outros clientes (nome, foto,
-- empresa, cargo). Auditando o código, a única leitura legítima de profile
-- alheio fora do admin é `fetchCompanyMembers` (src/lib/companies.js), que
-- monta a lista de membros da equipe. As telas de admin já são cobertas por
-- `profiles_admin_read_all`, e as Edge Functions usam service role (ignoram
-- RLS). Esta policy passa a permitir exatamente o caso legítimo e nada mais.
--
-- SECURITY DEFINER para não recursar: a função consulta company_members, cuja
-- própria policy poderia voltar a consultar profiles.
create or replace function public.shares_company_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.company_members target
    where target.user_id = p_user_id
      and (
        -- sou dono da empresa do alvo — inclui ver quem está pendente,
        -- necessário para aprovar solicitações de entrada
        public.is_company_owner(target.company_id)
        -- ou sou membro ativo da mesma empresa
        or exists (
          select 1 from public.company_members me
          where me.company_id = target.company_id
            and me.user_id = auth.uid()
            and me.status = 'active'
        )
      )
  );
$$;

drop policy if exists profiles_read_authenticated on public.profiles;

drop policy if exists profiles_read_teammates on public.profiles;
create policy profiles_read_teammates on public.profiles
  for select using (public.shares_company_with(id));

-- Continuam valendo, sem alteração:
--   profiles_select_own      -> auth.uid() = id
--   profiles_admin_read_all  -> is_admin()
