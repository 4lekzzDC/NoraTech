-- Dados de contato pessoais (telefone e endereço) do usuário.
--
-- Ficam FORA de `profiles` de propósito: `profiles` tem a policy
-- `profiles_read_authenticated` (USING true), então qualquer usuário
-- autenticado lê o profile de todos os outros — o que é aceitável para
-- nome/foto/empresa, mas não para telefone e endereço residencial.
-- Aqui o acesso é restrito ao próprio dono (e a admins).
create table if not exists public.profile_contacts (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_contacts enable row level security;

drop policy if exists profile_contacts_select_own on public.profile_contacts;
create policy profile_contacts_select_own on public.profile_contacts
  for select using (auth.uid() = id);

drop policy if exists profile_contacts_insert_own on public.profile_contacts;
create policy profile_contacts_insert_own on public.profile_contacts
  for insert with check (auth.uid() = id);

drop policy if exists profile_contacts_update_own on public.profile_contacts;
create policy profile_contacts_update_own on public.profile_contacts
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profile_contacts_admin_all on public.profile_contacts;
create policy profile_contacts_admin_all on public.profile_contacts
  for all using (public.is_admin()) with check (public.is_admin());
