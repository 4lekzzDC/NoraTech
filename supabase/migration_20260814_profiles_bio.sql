-- Texto livre que o usuário escreve sobre si ("Sobre mim" na aba Perfil).
--
-- Fica em `profiles` — e não em `profile_contacts` — de propósito: é
-- informação de apresentação, do mesmo naipe de nome e foto, feita para ser
-- vista pelos colegas de equipe. Diferente de telefone/endereço, que são PII
-- e ficam restritos ao próprio dono.
--
-- Guarda HTML de um subconjunto pequeno (negrito, itálico, sublinhado,
-- riscado, listas, links). O conteúdo é sanitizado no cliente ao salvar E ao
-- renderizar (src/lib/richText.js): confiar no que já está gravado abriria
-- XSS para quem lê o perfil, já que a linha pode ter sido escrita direto pela
-- API, sem passar pelo editor.
alter table public.profiles
  add column if not exists bio text;

-- Teto de tamanho: o editor limita 2000 caracteres de texto visível, e a
-- marcação cabe folgada nos 8000. Evita payload gigante gravado por fora.
alter table public.profiles drop constraint if exists profiles_bio_length_chk;
alter table public.profiles
  add constraint profiles_bio_length_chk check (bio is null or length(bio) <= 8000);
