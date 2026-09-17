-- Fecha a escrita direta na tabela de salas do Nora Screen.
--
-- Por que existe uma migração separada: ao validar a anterior em produção
-- descobri que o Supabase concede ALL em tabelas novas de `public` para
-- `anon` e `authenticated`. Para INSERT/UPDATE/DELETE a RLS ainda segurava
-- (não há policy de escrita), mas TRUNCATE não passa por RLS — ela filtra
-- linhas, e TRUNCATE não olha linha nenhuma. Com o grant no lugar, o papel
-- anon esvaziava a tabela inteira. Confirmei o buraco antes de fechá-lo.
--
-- O `grant select` da migração anterior era, portanto, redundante; o que
-- faltava era tirar o resto.
--
-- SELECT fica: todo participante precisa ler as regras para obedecê-las, e
-- a entrega do Realtime passa pelas mesmas checagens de permissão.
--
-- As três RPCs não dependem destes grants: são security definer e rodam com
-- o privilégio da dona (postgres). Conferido antes de aplicar, junto com
-- triggers, views e chaves estrangeiras — nada dependia deles.
--
-- Escopo: somente public.nora_screen_salas. As demais tabelas do projeto
-- mantêm os grants padrão do Supabase, de propósito: mexer nelas é decisão
-- separada, com risco de quebrar fluxos que escrevem direto pela REST.

revoke insert, update, delete, truncate, references, trigger
  on public.nora_screen_salas
  from anon, authenticated;
