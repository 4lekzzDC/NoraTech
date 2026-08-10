-- =========================================================================
-- Migração 09/08/2026 — catálogo de sistemas gerenciável pelo admin
--   1. Tabela `systems` (nome, logo, valor padrão, destino)
--   2. Seed com o catálogo que vivia hardcoded em src/lib/systems.js
--   3. Bucket `system-logos` + policies
--
-- Observação: `slug`, `internal` e `url` de sistemas internos continuam
-- amarrados ao código (rotas e gate de assinatura dependem do slug).
-- A tabela é a fonte de verdade para nome, logo, descrição e valor padrão.
-- =========================================================================

create table if not exists public.systems (
  slug           text primary key,
  name           text not null,
  description    text,
  icon           text,
  logo_url       text,
  color          text,
  default_amount numeric(12,2) not null default 0,
  url            text,
  internal       boolean not null default false,
  aliases        text[] not null default '{}',
  active         boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

insert into public.systems (slug, name, description, icon, color, url, internal, aliases, sort_order)
values
  (
    'whatsapp-bot',
    'WhatsApp Bot',
    'Atendimento automatizado, triagem por intenção e transferência fluida para humanos.',
    '💬',
    '#25D366',
    'https://falahub.noratech.com.br',
    false,
    '{}',
    1
  ),
  (
    'solucoes-contabeis',
    'Soluções Contábeis',
    'Gestão operacional do fechamento mensal — status de tarefas, alertas de pendências e visão gerencial por empresa.',
    '📊',
    '#7C3AED',
    '/solucoes-contabeis',
    true,
    '{acompanhamento-contabil}',
    2
  )
on conflict (slug) do nothing;

drop trigger if exists systems_touch on public.systems;
create trigger systems_touch before update on public.systems
  for each row execute function public.touch_updated_at();

alter table public.systems enable row level security;

-- Leitura: qualquer usuário autenticado (o cockpit precisa dos metadados).
drop policy if exists "systems_select_authenticated" on public.systems;
create policy "systems_select_authenticated"
  on public.systems for select
  to authenticated
  using (true);

-- Escrita: apenas admin global.
drop policy if exists "systems_admin_write" on public.systems;
create policy "systems_admin_write"
  on public.systems for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── Storage: logos dos sistemas ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('system-logos', 'system-logos', true)
on conflict (id) do nothing;

drop policy if exists "system logos public read" on storage.objects;
create policy "system logos public read"
  on storage.objects for select
  using (bucket_id = 'system-logos');

drop policy if exists "system logos authenticated insert" on storage.objects;
create policy "system logos authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'system-logos');

drop policy if exists "system logos authenticated update" on storage.objects;
create policy "system logos authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'system-logos')
  with check (bucket_id = 'system-logos');

drop policy if exists "system logos authenticated delete" on storage.objects;
create policy "system logos authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'system-logos');
