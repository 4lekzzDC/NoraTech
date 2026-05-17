# Noratech — Documentação do Site

Site institucional da **Noratech** — engenharia de software, automação e
integrações para empresas. Construído em React + Vite, com roteamento por
React Router, estilos inline e animações baseadas em `IntersectionObserver`.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Stack e dependências](#stack-e-dependências)
3. [Estrutura de pastas](#estrutura-de-pastas)
4. [Scripts disponíveis](#scripts-disponíveis)
5. [Como rodar localmente](#como-rodar-localmente)
6. [Rotas do site](#rotas-do-site)
7. [Arquitetura da aplicação](#arquitetura-da-aplicação)
8. [Dados e conteúdo](#dados-e-conteúdo)
9. [Componentes utilitários](#componentes-utilitários)
10. [Convenções de estilo](#convenções-de-estilo)
11. [Build e deploy](#build-e-deploy)
12. [Qualidade de código](#qualidade-de-código)
13. [Como contribuir](#como-contribuir)

---

## Visão geral

A Noratech oferece quatro frentes principais:

| Código | Serviço                                    |
| ------ | ------------------------------------------ |
| S.01   | Desenvolvimento de sistemas personalizados |
| S.02   | Automação de processos                     |
| S.03   | Dashboards e indicadores                   |
| S.04   | Integração entre sistemas                  |

O site expõe esses serviços, apresenta os produtos próprios
(**Finzo App**, **WhatsApp Bot**, **Sites para Empresas**),
depoimentos, FAQ segmentado por produto e um agendador de reuniões.

---

## Stack e dependências

- **React 19** (`react`, `react-dom`)
- **React Router 7** (`react-router-dom`) — roteamento client-side
- **Vite 8** (`@vitejs/plugin-react`) — bundler e dev server
- **ESLint 9** — com plugins `react-hooks` e `react-refresh`

Sem frameworks de CSS ou bibliotecas de UI: os estilos são escritos
diretamente em JSX (inline styles) e em `src/index.css` / `src/App.css`.
As fontes (`Manrope`, `Cormorant Garamond`, `JetBrains Mono`) são carregadas
por `@import` do Google Fonts dentro do componente `App`.

---

## Estrutura de pastas

```
portfolio/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── components/
│   │   └── MeetingScheduler.jsx    # Modal de agendamento de reunião
│   ├── pages/
│   │   ├── AutomacaoPage.jsx       # /servicos/automacao-de-processos
│   │   ├── PrivacyPage.jsx         # /privacidade
│   │   ├── SistemasPage.jsx        # /servicos/sistemas-sob-medida
│   │   └── TermsPage.jsx           # /termos
│   ├── App.jsx                     # Home institucional (rota "/")
│   ├── App.css
│   ├── index.css
│   └── main.jsx                    # Ponto de entrada + rotas
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
└── DOCS.md                         # Este arquivo
```

---

## Scripts disponíveis

Definidos em `package.json`:

| Script             | O que faz                                                |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Sobe o servidor de desenvolvimento (HMR) via Vite        |
| `npm run build`    | Gera o bundle de produção em `dist/`                     |
| `npm run preview`  | Serve o conteúdo de `dist/` para validação local         |
| `npm run lint`     | Executa o ESLint em todo o projeto                       |

---

## Como rodar localmente

Pré-requisitos: **Node.js 18+**, **npm** e um projeto Supabase (veja
[Supabase — setup](#supabase--setup)).

```bash
# 1. Instalar dependências
npm install

# 2. Copiar .env.example e preencher com as credenciais do Supabase
cp .env.example .env.local
# edite .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 3. Rodar em modo desenvolvimento
npm run dev

# 4. Acessar no navegador
# http://localhost:5173
```

> **Produção (Vercel):** configure `VITE_SUPABASE_URL` e
> `VITE_SUPABASE_ANON_KEY` em *Project Settings → Environment Variables*
> e redeploy.

---

## Supabase — setup

Autenticação, perfis e avatares ficam no Supabase. Toda a comunicação é
feita pelo cliente `@supabase/supabase-js` (ver `src/lib/supabase.js`) —
não existe backend próprio em produção.

### 1. Tabela `profiles`

```sql
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  photo_url text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário só vê / edita o próprio perfil
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
```

(Opcional) criar o profile automaticamente no signup via trigger:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 2. Bucket `avatars` (Storage)

No painel do Supabase → **Storage → New bucket**:

- Nome: `avatars`
- **Public bucket**: ✅ (para que `photo_url` seja acessível direto)

Policies sugeridas (Storage → `avatars` → Policies):

```sql
-- Leitura pública (se o bucket já é público, basta isso)
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Cada usuário pode escrever apenas em pastas com o próprio uid
create policy "avatars_write_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
```

As fotos são salvas em `avatars/<user_id>/avatar-<timestamp>.<ext>`.

### 3. Auth settings

Em **Authentication → Providers → Email**, decida:

- Deixar **Confirm email** ligado (usuário precisa clicar em link no e-mail
  para ativar a conta) — o `register()` retorna mensagem pedindo
  confirmação.
- Desligar para ambiente de testes — login imediato pós-signup.

Para troca de e-mail funcionar, configure o **Site URL** em
**Authentication → URL Configuration** (ex.: `https://noratech.com.br`).

Para checagem de lint antes de commitar:

```bash
npm run lint
```

---

## Rotas do site

Registradas em `src/main.jsx`:

| Caminho                                 | Componente        | Descrição                                      |
| --------------------------------------- | ----------------- | ---------------------------------------------- |
| `/`                                     | `App`             | Página institucional (home completa)           |
| `/servicos/sistemas-sob-medida`         | `SistemasPage`    | Landing de serviço — sistemas personalizados   |
| `/servicos/automacao-de-processos`      | `AutomacaoPage`   | Landing de serviço — automação de processos    |
| `/privacidade`                          | `PrivacyPage`     | Política de Privacidade                        |
| `/termos`                               | `TermsPage`       | Termos de Uso                                  |

> Todas as rotas são renderizadas client-side via `BrowserRouter`. Em deploy
> estático, configure o servidor para devolver `index.html` em qualquer rota
> não encontrada (fallback SPA).

---

## Arquitetura da aplicação

### Entrada (`src/main.jsx`)

Monta o React root em `#root`, envolvido por `StrictMode` e `BrowserRouter`,
e declara as `Routes` de cada página.

### Home (`src/App.jsx`)

Arquivo principal (~1.3k linhas) que contém:

- **Constantes de conteúdo** no topo do arquivo:
  - `SERVICES` — 4 serviços (S.01 a S.04)
  - `DIFFERENTIALS` — 6 diferenciais da empresa
  - `PRODUCTS` — produtos próprios (Finzo, WhatsApp Bot, Sites)
  - `TESTIMONIALS` — depoimentos de clientes
  - `FAQS` — perguntas por produto (chaveado por nome)
- **Hooks utilitários**:
  - `useInView()` — wrapper sobre `IntersectionObserver` para disparar
    animações quando o elemento entra na viewport
- **Componentes locais**:
  - `Reveal` — wrapper de animação de entrada (variações `up`, `left`,
    `right`, `scale`, `rotateL`, `rotateR`)
  - `Star`, `Diamond` — elementos decorativos (SVG/div)
  - `WinBar` — "janela" estilo macOS (três bolinhas)
  - `StatusBadge` — badge de status (`live`, `dev`, `soon`)
- **Estado de UI** dentro de `App`:
  - `scrollY`, `mousePos`, `navScrolled` — efeitos de parallax e header
  - `activeFaqTab`, `openFaq` — abas e acordeão do FAQ
  - `formStep`, `hoveredProduct`, `menuOpen`, `schedulerOpen` — UI diversa

### Agendador (`src/components/MeetingScheduler.jsx`)

Modal reutilizável para marcação de reunião, acionado pelo botão do
hero/CTA (`schedulerOpen`).

### Páginas de serviço

`SistemasPage` e `AutomacaoPage` são landing pages independentes,
focadas em conversão para cada frente de serviço. Compartilham a mesma
linguagem visual da home.

### Páginas legais

`PrivacyPage` e `TermsPage` concentram os textos de Privacidade e Termos,
referenciados nos links do rodapé.

---

## Dados e conteúdo

Todo o conteúdo da home vive como constantes no topo de `src/App.jsx`.
Para editar textos, ajuste diretamente os objetos:

- **Adicionar/editar serviço** → `SERVICES` (campos: `num`, `icon`,
  `title`, `desc`, `tags`).
- **Adicionar/editar diferencial** → `DIFFERENTIALS` (`num`, `title`,
  `desc`).
- **Adicionar/editar produto** → `PRODUCTS` (`id`, `icon`, `name`,
  `desc`, `tags`, `color`, `featured`, `features`).
- **Adicionar/editar depoimento** → `TESTIMONIALS` (`name`, `role`,
  `text`, `initials`).
- **Adicionar/editar FAQ** → `FAQS` — objeto chaveado pelo nome da aba
  (`"Finzo App"`, `"WhatsApp Bot"`, `"Sites"`), com lista de `{ q, a }`.

> Ao adicionar uma nova aba de FAQ, inclua também a cor correspondente
> em `faqTabColors` dentro de `App`.

---

## Componentes utilitários

| Componente    | Para que serve                                                           |
| ------------- | ------------------------------------------------------------------------ |
| `Reveal`      | Anima filhos na entrada da viewport (`opacity` + `transform`)            |
| `Star`        | Ícone SVG decorativo em forma de estrela                                 |
| `Diamond`     | Quadrado rotacionado para detalhes visuais                               |
| `WinBar`      | Barra superior estilo macOS (uso decorativo em "janelas")                |
| `StatusBadge` | Selo de status — aceita `live`, `dev` ou `soon`                          |

---

## Convenções de estilo

- **Estilos inline em JSX** são o padrão — cada componente carrega seus
  próprios estilos via `style={{ ... }}`.
- **Paleta principal**:
  - Fundo: `#08080a`
  - Texto: `#eeede9`
  - Acento (lime): `#c8ff00`
  - Verde WhatsApp: `#25D366`
  - Azul dev: `#4d9fff`
  - Rosa/magenta: `#ff6b9d`
  - Laranja "em breve": `#ff8a3d`
  - Verde "operacional": `#00d48a`
- **Fontes**:
  - Corpo e UI: `Manrope`
  - Display serif (destaques): `Cormorant Garamond`
  - Monoespaçada (códigos/labels): `JetBrains Mono`
- **Animações**: `transition: all 1s cubic-bezier(0.16, 1, 0.3, 1)` —
  aplicada via `Reveal`. Evite animar propriedades caras
  (`width`, `height`); prefira `opacity` e `transform`.

---

## Build e deploy

```bash
npm run build      # gera dist/
npm run preview    # valida o build localmente
```

O diretório `dist/` é um site estático e pode ser publicado em qualquer
host que sirva arquivos (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront,
Nginx etc.).

**Importante para SPAs**: configure um fallback para `index.html` em
qualquer rota não encontrada, senão `/privacidade`, `/termos`, etc. vão
retornar 404 ao recarregar a página.

- Netlify: `_redirects` → `/* /index.html 200`
- Vercel: funciona out-of-the-box com framework detection
- Nginx: `try_files $uri $uri/ /index.html;`

---

## Qualidade de código

- **ESLint** (`eslint.config.js`) com regras para React Hooks e
  React Refresh.
- Rode `npm run lint` antes de commitar.
- Não há testes automatizados configurados.

---

## Como contribuir

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. Rode `npm run dev` e valide as mudanças no navegador.
3. Rode `npm run lint` e corrija pendências.
4. Faça commits claros e em português quando possível.
5. Abra um Pull Request descrevendo o que mudou e por quê.

Para dúvidas sobre conteúdo (serviços, produtos, textos legais),
alinhe previamente com o responsável editorial antes de abrir PR.
