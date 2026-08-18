# NoraDocs — Análise de produto e arquitetura (MVP)

> Documento de decisão. Escrito **antes** da implementação, para ser revisado e
> aprovado. Nenhum código de produto foi escrito ainda.
>
> Status: proposta revisada (v2) · Alvo: MVP funcional
> Stack: React/Vite + Supabase + Google Drive API (`drive.file`) · **sem IA no MVP**
>
> A investigação que sustenta as decisões de integração com o Google está em
> [`integracao-google.md`](./integracao-google.md).

---

## Sumário

1. [O produto em uma frase](#1-o-produto-em-uma-frase)
2. [Escopo do MVP e não-escopo](#2-escopo-do-mvp-e-não-escopo)
3. [Onde o NoraDocs vive dentro da NoraTech](#3-onde-o-noradocs-vive-dentro-da-noratech)
4. [Arquitetura geral](#4-arquitetura-geral)
5. [Modelo de dados](#5-modelo-de-dados)
6. [O pipeline de classificação](#6-o-pipeline-de-classificação)
7. [Integração com o Google Drive](#7-integração-com-o-google-drive)
8. [Telas e fluxos](#8-telas-e-fluxos)
9. [Decisões técnicas](#9-decisões-técnicas)
10. [Riscos](#10-riscos)
11. [Plano de execução em etapas](#11-plano-de-execução-em-etapas)

---

## 1. O produto em uma frase

**NoraDocs recebe arquivos soltos de clientes de um escritório contábil, descobre
a que cliente / competência / categoria cada um pertence, arquiva no Google Drive
do escritório na estrutura correta e mantém o histórico de tudo.**

O ganho não é "guardar arquivo" — é eliminar o trabalho manual de renomear,
identificar e mover documento por documento, sem abrir mão do controle: quando o
sistema não tem certeza, ele **pergunta** em vez de errar em silêncio.

Isso define a regra de ouro da arquitetura:

> O sistema **arquiva sozinho** apenas quando as regras identificam cliente,
> competência e categoria sem ambiguidade. Na dúvida, ele **pergunta**. Toda
> movimentação fica registrada e é reversível.

---

## 2. Escopo do MVP e não-escopo

### Dentro do MVP

| # | Capacidade | Observação |
|---|-----------|------------|
| 1 | Autenticação e usuários | **Reaproveita** o que já existe (Supabase Auth, `profiles`, `companies`, `company_members`) |
| 2 | Cadastro de empresas/clientes | Tabela própria do NoraDocs, com importação opcional do módulo Soluções Contábeis |
| 3 | Upload manual de arquivos | Drag & drop, múltiplos arquivos, com deduplicação por hash |
| 4 | Caixa de entrada | Tela principal do produto |
| 5 | Análise/classificação | Regras determinísticas, no navegador. Sem IA |
| 6 | Identificação de cliente, competência e categoria | Três campos independentes, com confiança independente |
| 7 | Confirmação manual quando houver dúvida | Status `revisar` + painel de revisão |
| 8 | Organização automática no Drive | Move por metadados (sem re-upload) |
| 9 | Histórico | Log append-only por documento |
| 10 | Status: processando, organizado, revisar, erro | Máquina de estados explícita |
| 11 | Configuração da estrutura de pastas | Template com tokens + pré-visualização |

### Fora do MVP (mas com arquitetura preparada)

- **Caminho do Gmail** — na Etapa 2, como **complemento do Gmail feito em Apps
  Script** (e não extensão Chrome — ver `integracao-google.md` §4). O pipeline já
  recebe um campo `origem` desde o primeiro dia, então o complemento vira apenas
  mais um produtor chamando a mesma função de ingestão.
- **Disparador de documentos** (cobrar arquivos pendentes / enviar arquivos ao
  cliente) — depende de canal (e-mail/WhatsApp) e de contato do cliente, que já
  são modelados agora (`email`, `telefone` em `noradocs_clients`).
- **Portal do cliente** (cliente logando para enviar arquivos).
- **OCR de documentos digitalizados** — no MVP, PDF sem camada de texto é
  classificado só pelo nome do arquivo; não dando, vai para `revisar`.
- **IA de qualquer tipo** — removida do MVP por decisão de privacidade. Se voltar,
  volta como opt-in desligado por padrão.
- Extração de dados fiscais (valores, vencimentos, XML de NF-e).

Essas exclusões são deliberadas: cada uma delas dobraria o tamanho do MVP sem
provar a hipótese central do produto, que é *"a classificação automática acerta o
suficiente para o contador confiar nela"*.

---

## 3. Onde o NoraDocs vive dentro da NoraTech

O NoraDocs é um **produto comercial separado**, não um módulo do Soluções
Contábeis. Um escritório deve poder assinar NoraDocs sem assinar o hub contábil,
e vice-versa.

Portanto:

- Novo slug no catálogo: `noradocs`, registrado em `src/lib/systems.js` e na
  tabela `systems` (fonte de verdade de nome/logo/preço, editável em `/admin/sistemas`).
- Nova rota raiz: `/noradocs`, protegida por `SubscriptionRoute systemSlug="noradocs"`
  — exatamente o mesmo gate já usado pelo hub contábil.
- Novo módulo isolado: `src/modules/noradocs/`, com barrel público em `index.js`,
  seguindo a convenção já estabelecida em `src/modules/solucoes-contabeis/`.

### Tenancy

O **tenant é o escritório**, representado pela tabela `companies` já existente.
Isso é importante e não é redundante:

```
companies              → o ESCRITÓRIO (assina o NoraDocs, conecta o Drive)
noradocs_clients       → os CLIENTES do escritório (as empresas atendidas)
```

Todo dado do NoraDocs carrega `tenant_company_id`, e o isolamento é feito por RLS
com uma função `has_noradocs_access(company_id)` — mesmo desenho de
`has_accounting_access`, já validado em produção.

### Estrutura de pastas do módulo

```
src/modules/noradocs/
├── index.js                     # barrel público (rotas e constantes)
├── constants.js                 # slug, rotas, categorias-semente, status
├── theme.js                     # re-exporta a paleta compartilhada
├── pages/
│   ├── InboxPage.jsx            # caixa de entrada (tela principal)
│   ├── HistoricoPage.jsx
│   ├── ClientesPage.jsx
│   └── ConfiguracoesPage.jsx
├── components/
│   ├── NoraDocsLayout.jsx       # sidebar + header do produto
│   ├── UploadDropzone.jsx
│   ├── DocumentTable.jsx
│   ├── ReviewDrawer.jsx         # painel lateral de revisão
│   └── StatusBadge.jsx
├── domain/
│   ├── status.js                # máquina de estados
│   ├── competencia.js           # parse/format YYYY-MM
│   ├── folderTemplate.js        # resolve template → caminho
│   └── rules.js                 # motor de regras (puro, testável)
└── services/
    ├── documents.service.js     # CRUD + queries da caixa de entrada
    ├── clients.service.js
    ├── settings.service.js
    └── drive.service.js         # chama as Edge Functions
```

> **Refatoração pequena e necessária (Etapa 0):** `src/modules/solucoes-contabeis/theme.js`
> hoje concentra a paleta tema-aware da NoraTech. Ela será promovida para
> `src/lib/palette.js` e o módulo contábil passa a re-exportá-la, sem quebrar nada.
> Assim o NoraDocs herda a identidade visual sem importar de dentro de outro módulo.

---

## 4. Arquitetura geral

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER (React/Vite)  — onde o documento é lido e decidido      │
│  • Caixa de entrada, revisão, cadastros, configurações           │
│  • Hash SHA-256 do arquivo (SubtleCrypto)                        │
│  • Extração de texto (pdfjs-dist) — o texto morre aqui           │
│  • CLASSIFICAÇÃO por regras determinísticas (domain/rules.js)    │
│  • Google Picker (só no setup, para escolher a pasta raiz)       │
│  • PUT dos bytes direto no Google                                │
└───────────┬─────────────────────────────────┬────────────────────┘
            │ supabase-js (RLS)               │ PUT bytes
            │ só metadados                    │
            ▼                                 ▼
┌────────────────────────────┐    ┌──────────────────────────────┐
│  SUPABASE / POSTGRES       │    │  GOOGLE DRIVE (do escritório)│
│  • Tabelas noradocs_*      │    │  • Pasta raiz escolhida      │
│  • RLS por tenant          │    │  • _triagem/ (só duvidosos)  │
│  • Histórico append-only   │    │  • Estrutura final           │
│  • NENHUM byte de doc      │    │  ← armazenamento oficial     │
└────────────┬───────────────┘    └──────────────▲───────────────┘
             │                                   │
             ▼                                   │ Drive API (token do escritório)
┌──────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTIONS (Deno, service_role) — duas, e só duas           │
│  noradocs-google-oauth  → troca code por refresh token, revoga   │
│  noradocs-drive         → upload-session · ensure-folder · move  │
│                           (único lugar que toca o token)         │
└──────────────────────────────────────────────────────────────────┘
```

Sem IA. Sem storage próprio. Sem fila. Duas Edge Functions.

### Os princípios que sustentam o desenho

1. **Nenhum byte de documento passa por servidor da NoraTech.** O navegador lê o
   arquivo, classifica localmente e envia direto ao Google. O Supabase recebe
   apenas metadados. Isso deixou de ser detalhe de implementação e virou posição
   comercial — ver `integracao-google.md` §5.
2. **O refresh token do Google nunca chega ao navegador.** Vive em tabela sem
   nenhuma policy de RLS — inalcançável pela `anon key` por construção — e só é
   lido por Edge Function com `service_role`.
3. **Uma conta Google por escritório, no servidor.** A concessão do `drive.file`
   é por `(app, usuário, arquivo)`; se cada funcionário autenticasse a própria
   conta, um documento enviado pela Ana não poderia ser confirmado pelo Bruno
   dois dias depois. Com uma identidade única do escritório, quem opera a tela é
   irrelevante — e os funcionários **não precisam de conta Google nenhuma**.
4. **A Edge Function deriva o tenant do JWT do chamador**, nunca do corpo da
   requisição. Convenção já aplicada em `support-chat`.
5. **Cada passo é idempotente.** Reprocessar um documento com erro nunca duplica
   arquivo no Drive nem linha no banco.

### Por que a classificação roda no navegador

Porque ela é determinística e os dados de que precisa — clientes, categorias,
regras — já são legíveis por RLS. Sem IA, não há segredo a proteger nem custo a
controlar: mandar os sinais para uma função de borda só para aplicar regex seria
uma viagem de rede sem contrapartida, e obrigaria o texto do documento a sair do
navegador. O motor de regras é um módulo puro (`domain/rules.js`), sem React e
sem DOM — quando a Etapa 2 precisar dele no servidor para o caminho do Gmail, o
mesmo arquivo é importado pela Edge Function.
## 5. Modelo de dados

Todas as tabelas com prefixo `noradocs_`, RLS habilitada, `tenant_company_id`
apontando para `companies`, e trigger `touch_updated_at()` (já existe no banco).

> **Regra que atravessa o modelo inteiro:** o banco guarda *metadados*. Nenhum
> byte de documento, e nenhum texto extraído. A única coisa que sobrevive da
> leitura do arquivo é a **evidência curta** que justificou a decisão — por
> exemplo `"CNPJ 12.345.678/0001-90 no texto"`.

### 5.1 Entidades centrais

**`noradocs_settings`** — uma linha por escritório
```
tenant_company_id      uuid PK → companies
drive_root_folder_id   text          -- pasta raiz escolhida via Google Picker
drive_root_folder_name text
drive_staging_folder_id text         -- subpasta _triagem
folder_template        text          -- default '{cliente}/{ano}/{competencia}/{categoria}'
auto_organize          boolean       -- default true
auto_organize          boolean       -- default true
root_mode              text          -- 'raiz_nova' | 'mapeamento_por_cliente'
keep_original_filename boolean       -- default true
```

**`noradocs_google_accounts`** — credenciais do Drive · **RLS sem nenhuma policy**
```
tenant_company_id  uuid PK → companies
google_email       text
refresh_token      text          -- criptografado (pgsodium/Vault)
scopes             text[]
status             text          -- connected | revoked | error
last_error         text
connected_by       uuid → auth.users
connected_at       timestamptz
```
> Uma **view** `noradocs_google_connection` expõe ao frontend apenas
> `google_email`, `status`, `scopes`, `connected_at`. O token não tem caminho de
> leitura pela API pública.

**`noradocs_clients`** — as empresas atendidas pelo escritório
```
id, tenant_company_id
nome                  text not null
cnpj                  text          -- só dígitos, unique por tenant
cpf                   text
email, telefone       text          -- já prontos para o disparador (etapa 2)
regime                text
aliases               text[]        -- nomes alternativos p/ matching
ativo                 boolean default true
drive_folder_id       text          -- cache da pasta do cliente
folder_name_override  text          -- quando o nome da pasta difere do nome
accounting_company_id uuid null → accounting_companies  -- vínculo opcional
```

**`noradocs_categories`** — semeada por tenant, editável
```
id, tenant_company_id
slug, nome, folder_name, ordem, ativo, is_system
keywords  text[]   -- alimenta o motor de regras
```
Semente: `extratos-bancarios`, `contas-a-pagar`, `contas-a-receber`,
`cartoes-taxas`, `notas-fiscais`, `estoque`, `folha`, `outros`.

**`noradocs_documents`** — a entidade central do produto
```
id, tenant_company_id
origem            text   -- upload_manual | email | portal | whatsapp | api
origem_ref        jsonb  -- id da mensagem do Gmail, etc. (etapa 2)
file_name         text
mime_type         text
size_bytes        bigint
content_hash      text   -- sha-256, para deduplicação
received_at       timestamptz
uploaded_by       uuid → auth.users

status            text   -- processando | revisar | organizado | erro | descartado
client_id         uuid → noradocs_clients
competencia       text   -- 'YYYY-MM', com CHECK de formato
category_id       uuid → noradocs_categories
doc_type          text   -- refinamento livre dentro da categoria

matched           jsonb  -- { client_id, competencia, category_id, evidence[] }
confidence        numeric(3,2)
review_reason     text   -- por que caiu em revisar

drive_file_id     text
drive_folder_id   text
drive_path        text   -- caminho legível, mostrado na coluna "Destino"
drive_web_link    text

error_code, error_message  text
retry_count       int default 0
confirmed_by      uuid, confirmed_at, organized_at  timestamptz
```
Índice único parcial `(tenant_company_id, content_hash)` — o mesmo arquivo enviado
duas vezes é detectado e sinalizado, não duplicado.

### 5.2 Rastreabilidade

**`noradocs_events`** — histórico append-only, nunca sofre update
```
id, tenant_company_id, document_id
type        text  -- recebido | classificado | revisao_solicitada | confirmado
                  -- | organizado | erro | reprocessado | movido_manualmente
actor_type  text  -- user | system | ai
actor_id    uuid
payload     jsonb
created_at
```

**`noradocs_classification_runs`** — auditoria da decisão automática (só regras)
```
id, tenant_company_id, document_id
method        text  -- rules | ai
model         text  -- ex.: gemini-3.1-flash-lite
prompt_version text
input_summary jsonb  -- o que foi enviado (sem o documento inteiro)
output        jsonb
confidences   jsonb
latency_ms    int
```
Sem essa tabela é impossível responder *"por que o sistema mandou isso para o
cliente errado?"* — e essa pergunta **vai** aparecer na primeira semana de uso.

**`noradocs_drive_folders`** — cache caminho → id de pasta
```
id, tenant_company_id, path text, drive_folder_id text
unique (tenant_company_id, path)
```
Evita listar o Drive a cada arquivo e, junto com o `unique`, previne criação de
pastas duplicadas em uploads concorrentes.

**`noradocs_client_rules`** — regras determinísticas, manuais ou aprendidas
```
id, tenant_company_id, client_id, category_id
match_type  text  -- filename | cnpj | email_sender | text
pattern     text
priority    int
source      text  -- manual | learned
```
Quando o contador corrige uma classificação, oferecemos *"criar regra para os
próximos"*. Sem IA no MVP, este **é** o mecanismo de aprendizado do produto — e
tem a vantagem de ser legível e editável, em vez de enterrado em pesos.

### 5.3 Preparado para a etapa 2 (não criado agora)

`noradocs_document_requests` (solicitações do disparador) e
`noradocs_email_accounts` (contas Gmail monitoradas). Ficam desenhadas, não
implementadas — mas `origem`, `origem_ref` e os contatos do cliente já existem
para que a etapa 2 não exija migração destrutiva.

---

## 6. O pipeline de classificação

Todo ele roda no navegador, com regras determinísticas. **Nenhum documento é
enviado para IA no MVP.**

```
      arquivo solto na caixa de entrada
             │
   ┌─────────▼──────────┐
   │ 1. SINAIS          │  nome do arquivo, mime, tamanho, hash SHA-256,
   │                    │  texto extraído com pdfjs quando há camada textual
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 2. REGRAS          │  • CNPJ/CPF no texto ou no nome, com validação
   │    determinísticas │    de dígitos → casa com noradocs_clients
   │    custo zero      │  • apelidos do cliente (aliases) no nome do arquivo
   │    100% local      │  • noradocs_client_rules — padrões do escritório
   │                    │  • competência: MM/AAAA, AAAA-MM, mês por extenso
   │                    │  • categoria: dicionário de palavras-chave
   └─────────┬──────────┘
             ▼
   ┌──────────────────────────────────────┐
   │ 3. PORTÃO DE DECISÃO                 │
   │  cliente + competência + categoria   │
   │  identificados por regra?            │
   └───────┬──────────────────────┬───────┘
          sim                    não
           ▼                      ▼
   upload direto na          upload em _triagem
   PASTA FINAL               status = revisar
   status = organizado       (com o que foi identificado pré-preenchido)
```

### A simplificação que isso permite

Como a classificação acontece **antes** do upload, o documento identificado com
sucesso é criado **já no lugar certo**. Não existe etapa de mover: sem staging,
sem `addParents`/`removeParents`, sem estado intermediário.

Só o documento duvidoso vai para `_triagem`, e só ele é movido — na hora em que o
contador confirma. Na prática, a operação de mover deixa de estar no caminho
principal e passa a ser a exceção.

### O que as regras cobrem

| Campo | Sinais, em ordem de prioridade |
|-------|-------------------------------|
| **Cliente** | CNPJ/CPF validado no texto → CNPJ no nome do arquivo → alias do cliente no nome → regra cadastrada pelo escritório |
| **Competência** | `MM/AAAA` e variantes no nome → data no texto → mês por extenso em português → mês anterior ao de recebimento (fallback explícito, sempre marcado como suposição) |
| **Categoria** | Palavras-chave da categoria no nome → palavras-chave no texto → regra cadastrada → nome de banco conhecido ⇒ extratos |

Qualquer campo sem resposta manda o documento inteiro para `revisar`. Não há
chute: o fallback de competência é a única suposição do sistema, e ela nunca
sozinha aprova o arquivamento automático.

### Cobertura baixa no início é o comportamento esperado

Nas primeiras semanas de cada escritório muita coisa cai em "Revisar". Isso não é
falha — é o mecanismo de descoberta. Cada correção do contador oferece *"criar
regra para os próximos"*, gravando em `noradocs_client_rules`. A fila encolhe
sozinha à medida que o escritório ensina o sistema, e o que foi aprendido fica
legível e editável, não enterrado em pesos de um modelo.

### Máquina de estados

```
                  ┌──────────────┐
   upload ───────▶│ processando  │
                  └──┬────┬───┬──┘
    tudo identificado│    │   │falha
                     ▼    │   ▼
             ┌───────────┐│┌───────┐
             │ organizado│││ erro  │──── retry ──┐
             └───────────┘│└───────┘             │
                    ▲     │algum campo em aberto │
                    │     ▼                      │
                    │  ┌─────────┐               │
                    └──┤ revisar │◀──────────────┘
           confirmação └────┬────┘
              manual        │ descartar
                            ▼
                      ┌────────────┐
                      │ descartado │
                      └────────────┘
```

As transições válidas ficam em `domain/status.js` — fonte de verdade única para a
UI e para as Edge Functions.
## 7. Integração com o Google Drive

> A investigação completa, com fontes e o que ainda precisa de spike, está em
> [`integracao-google.md`](./integracao-google.md). Aqui fica só a decisão.

### Escopo: `drive.file`, nada além disso

`drive.file` é **não sensível**: sem CASA, sem auditoria anual, sem custo
recorrente, apenas a verificação básica de marca. E funciona com toda a REST API
do Drive — criar pasta, criar arquivo, mover, tudo disponível. O acesso é por
arquivo, restrito ao que o app criou e ao que o escritório escolheu no Picker.

O escopo amplo `drive` está **descartado** e não volta à mesa: exigiria auditoria
CASA anual e daria ao NoraDocs visão do Drive inteiro do escritório — o oposto do
princípio de menor privilégio.

### A limitação que muda o setup

**Escolher uma pasta pelo Picker não dá acesso ao que já existe dentro dela.** O
NoraDocs pode criar conteúdo lá, mas não enxerga o conteúdo anterior.

Isso tem uma consequência concreta: se o escritório aponta um `/Clientes` que já
tem `Silva ME` dentro, o NoraDocs não vê essa pasta e cria uma **segunda**
`Silva ME` ao lado. O Drive aceita nomes duplicados — ninguém receberia erro, e a
estrutura se dividiria em silêncio.

Daí dois modos de configuração, ambos no MVP:

| Modo | Como funciona | Para quem |
|------|---------------|-----------|
| **Raiz nova** *(padrão)* | O escritório escolhe ou cria uma pasta vazia; o NoraDocs constrói a árvore inteira a partir dela | Escritório novo, ou disposto a adotar a estrutura do NoraDocs |
| **Mapeamento por cliente** | O escritório aponta pelo Picker a pasta **de cada cliente**, uma vez, gravando em `noradocs_clients.drive_folder_id` | Escritório com estrutura legada a preservar |

O aviso sobre isso vai na **tela de conexão**, no momento da escolha — não no
contrato, onde ninguém lê.

### Fluxo de conexão (uma vez, feito por owner/admin)

```
"Conectar Google Drive"
   → OAuth consent (drive.file, access_type=offline, prompt=consent)
   → Edge Function noradocs-google-oauth troca code por refresh token
   → grava criptografado em noradocs_google_accounts
   → Picker escolhe a pasta raiz  ⚠ mesma conta Google do passo anterior
   → grava drive_root_folder_id + cria a subpasta _triagem
```

A conferência de que a conta do Picker é a mesma do consentimento é obrigatória —
contas diferentes produzem uma concessão que o token do servidor não alcança.

### Upload: os bytes não passam pela NoraTech

```
1. Navegador: hash, extrai texto, aplica regras, resolve a pasta de destino
2. Navegador → noradocs-drive: "sessão de upload para a pasta X"
3. Edge Fn (token do escritório): garante a árvore de pastas e abre a
   sessão resumable → devolve SÓ a URL de sessão
4. Navegador → Google: PUT dos bytes direto
5. Navegador → Supabase: grava os metadados
```

A URL de sessão resumable funciona como credencial: carrega um `upload_id` e
dispensa cabeçalho `Authorization`. É isso que permite o navegador enviar direto
ao Google **sem nunca ver o token do escritório**.

> ⚠️ **Premissa a validar antes de codificar.** Falta confirmar que o endpoint de
> upload do Drive aceita o `PUT` do navegador via CORS. É um spike de vinte
> linhas e é a **primeira tarefa da Etapa 0**. Planos B, em ordem: access token
> efêmero de 1h no navegador; ou proxy dos bytes pela Edge Function sem gravar.

### Template de pastas

```
{cliente}/{ano}/{competencia}/{categoria}

tokens: {cliente} {cnpj} {ano} {mes} {competencia} {categoria} {tipo}
```

Pré-visualização ao vivo na tela de configuração: o contador precisa ver o
caminho antes de salvar, não descobrir depois com 300 arquivos no lugar errado. A
normalização de nomes fica em `domain/folderTemplate.js`, usada tanto na
pré-visualização quanto na criação real, para que nunca divirjam. Todas as
chamadas com `supportsAllDrives: true` desde o início.
## 8. Telas e fluxos

Quatro telas. Nada além disso no MVP.

### 8.1 Caixa de Entrada — `/noradocs` (tela principal)

Densa, tabular, orientada a produtividade. **Sem cards de métrica**: a tela
existe para zerar a fila, não para contemplar números.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ NoraDocs                                    [ Enviar arquivos ]  ◑  👤    │
├───────────────────────────────────────────────────────────────────────────┤
│ Todos (24) · Revisar (7) · Processando (2) · Erro (1)      🔍 buscar  ⚙  │
├───┬──────────────────┬───────────┬──────────┬──────────────┬───────┬──────┤
│ ☐ │ Arquivo          │ Cliente   │ Comp.    │ Categoria    │Status │ Ações│
├───┼──────────────────┼───────────┼──────────┼──────────────┼───────┼──────┤
│ ☐ │ extrato_ago.pdf  │ Silva ME  │ 08/2026  │ Extratos     │  ●    │  ↗   │
│ ☐ │ nf-4471.pdf      │ Costa Ltda│ 08/2026  │ Notas fiscais│  ●    │  ↗   │
│ ☐ │ documento(3).pdf │ Silva ME ?│ 08/2026 ?│ Contas pagar?│  ▲    │Revisar│
├───┴──────────────────┴───────────┴──────────┴──────────────┴───────┴──────┤
│ Destino: /Clientes/Silva ME/2026/08/Extratos bancários                    │
└───────────────────────────────────────────────────────────────────────────┘
```

- Campos que a regra não fechou aparecem com marcação discreta (`?`), não com
  alarde.
- Seleção múltipla → **confirmar em lote** as sugestões de alta confiança. É o
  atalho que faz o produto parecer rápido.
- Coluna "Destino" mostra o caminho final antes de mover — transparência total.

### 8.2 Painel de revisão (drawer lateral, não página nova)

Abre à direita sobre a lista, sem perder o contexto da fila:

- Pré-visualização do documento (iframe do Drive).
- Três campos editáveis: cliente (busca), competência (seletor mês/ano),
  categoria (select).
- Por que caiu em revisão, em uma linha: *"CNPJ não encontrado no texto"*.
- `Confirmar e organizar` · `Confirmar e criar regra` · `Descartar`.
- `⌘↵` confirma e pula para o próximo. Quem revisa 40 documentos por dia precisa
  de teclado, não de mouse.

### 8.3 Histórico — `/noradocs/historico`

Tudo o que já foi processado, com filtros por cliente, competência, categoria,
período e status. Linha expandida mostra a trilha completa de eventos e link
direto para o arquivo no Drive.

### 8.4 Clientes — `/noradocs/clientes`

Lista + formulário lateral. CNPJ, nome, apelidos (para matching), contatos,
pasta no Drive. Botão "Importar do Soluções Contábeis" quando o escritório também
assina o hub contábil.

### 8.5 Configurações — `/noradocs/configuracoes`

Quatro blocos: conexão Google (status, e-mail, pasta raiz, reconectar),
estrutura de pastas (template + pré-visualização), categorias (ordenar, renomear,
palavras-chave), automação (arquivamento automático ligado/desligado).

### 8.6 Linguagem visual

Herda a identidade já usada no hub contábil — roxo `#7C3AED`, paleta tema-aware
clara/escura, `Inter` para UI e `JetBrains Mono` para dados técnicos. Tabelas com
linhas de 44px, bordas sutis, hover discreto. Sem gradientes, sem ilustrações,
sem KPI cards.

---

## 9. Decisões técnicas

| # | Decisão | Escolha | Por quê |
|---|---------|---------|---------|
| D1 | Escopo OAuth | `drive.file` + Picker | Não sensível: sem CASA, sem custo anual, menor privilégio |
| D2 | Escopo amplo `drive` | **Descartado** | Auditoria anual e visão do Drive inteiro — desproporcional |
| D3 | Armazenamento | Zero na NoraTech; Drive do escritório | Requisito de produto; e some o item que domina o custo desse tipo de SaaS |
| D4 | Caminho dos bytes | Navegador → Google, via URL de sessão resumable | Nenhum documento toca nossa infra; token fica no servidor |
| D5 | Identidade no Drive | Uma conta por escritório, token no servidor | Concessão `drive.file` é por usuário: sem isso, a Ana envia e o Bruno não consegue confirmar |
| D6 | Guarda do refresh token | Tabela sem policies + criptografia; só `service_role` | Sem caminho de leitura pela `anon key`, por construção |
| D7 | Classificação | Regras determinísticas, **no navegador** | Sem IA, não há segredo nem custo a proteger — e o texto do documento não sai da máquina |
| D8 | IA | **Fora do MVP**; se voltar, opt-in desligado por padrão | Menor exposição possível; vira argumento comercial de LGPD |
| D9 | Momento da classificação | **Antes** do upload | O arquivo identificado nasce na pasta final: sem staging, sem mover |
| D10 | Extração de texto | `pdfjs-dist` no navegador, resultado descartado | Dependência já existe no projeto; zero infra de OCR |
| D11 | Estrutura legada | Raiz nova por padrão + mapeamento por cliente | O Picker não enxerga o conteúdo anterior da pasta |
| D12 | Caminho do Gmail | Complemento Apps Script, **na Etapa 2** | Escopo sensível (grátis) contra restrito (CASA) da extensão |
| D13 | Extensão Chrome | **Descartada** | Multisseleção não paga o preço: CASA ou dependência de DOM não documentado |
| D14 | Cadastro de clientes | Tabela própria + link opcional | Mantém os dois produtos vendáveis separadamente |
| D15 | Competência | `text` no formato `YYYY-MM` | Consistente com o módulo contábil em produção |
| D16 | Edge Functions | Duas: `google-oauth` e `drive` | Só o que precisa obrigatoriamente do token |
| D17 | Isolamento | RLS em tudo; tenant derivado do JWT | Convenção já validada em `support-chat` |
| D18 | Nome do arquivo | Preserva o original por padrão | Renomear destrói a referência que o cliente usa |
## 10. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **CORS bloquear o `PUT` do navegador** para a sessão resumable | Derruba a premissa central do desenho | **Spike na Etapa 0**, antes de qualquer código. Plano B: access token efêmero de 1h no navegador. Plano C: proxy pela Edge Function sem gravar |
| **Concessão do Picker não valer para o refresh token do servidor** | Setup não funciona | Mesmo spike da Etapa 0 |
| **Estrutura legada duplicada** — o Picker não enxerga o conteúdo existente | Silencioso: duas pastas com o mesmo nome, ninguém recebe erro | Raiz nova como padrão, mapeamento por cliente como alternativa, aviso na própria tela de conexão |
| **Token revogado** (senha trocada, acesso removido) | Uploads param | Detectar `invalid_grant`, marcar `revoked`, banner persistente; documentos ficam em `processando` e retomam após reconectar — nunca marcados como erro definitivo |
| **Revogar o token derruba todos os escopos** do client, não só o da sessão | Confusão no "Desconectar" | Texto explícito no botão |
| **Cobertura baixa das regras** no início | Fila de revisão cheia nas primeiras semanas | Esperado e comunicado. Cada correção vira regra; a fila encolhe sozinha |
| **Limites de API do Drive** — cota somada entre todos os escritórios | Lentidão em lote quando escalar | Cache `noradocs_drive_folders`, backoff exponencial, limite de concorrência por tenant |
| **Pastas duplicadas** em uploads simultâneos | Estrutura suja | `unique(tenant, path)` em `noradocs_drive_folders` |
| **Contador move arquivos à mão no Drive** | `drive_path` passa a mentir | Aceitar no MVP; validar o `drive_file_id` ao abrir o histórico e sinalizar divergência |
| **Escopo do MVP inchar** | Atraso | Gmail e disparador explicitamente fora. A arquitetura os acomoda; o cronograma não |

Comparado à proposta anterior, sumiram três riscos inteiros: verificação CASA,
exposição de documentos a IA de terceiro, e a discussão de LGPD sobre envio de
conteúdo para fora. Não foram mitigados — foram **removidos por construção**.
## 11. Plano de execução em etapas

| Etapa | Entrega | Definição de pronto |
|-------|---------|---------------------|
| **E0 · Spike + fundação** | **Primeiro**: validar CORS do `PUT` na sessão resumable e a concessão do Picker sobre o refresh token. Depois: slug `noradocs` no catálogo e na tabela `systems`, rota com gate de assinatura, esqueleto do módulo, paleta promovida para `src/lib/palette.js`, layout com sidebar | O spike responde sim/não por escrito antes de qualquer outro código. `/noradocs` acessível com assinatura ativa |
| **E1 · Banco** | Migration com as tabelas `noradocs_*`, RLS, `has_noradocs_access`, categorias-semente | Migration aplicada; `get_advisors` sem alerta de segurança |
| **E2 · Clientes** | CRUD de `noradocs_clients` com CNPJ, apelidos e contatos; importação do módulo contábil | Escritório cadastra e edita clientes; CNPJ validado por dígito |
| **E3 · Conexão Google** | OAuth `drive.file`, Picker, `noradocs_google_accounts`, tela de conexão com o aviso de estrutura legada, criação do `_triagem` | Escritório conecta, escolhe a raiz, vê status e e-mail conectado |
| **E4 · Estrutura de pastas** | Template com tokens, pré-visualização ao vivo, `ensureFolderPath` + cache | Salvar template e ver o caminho de exemplo; pastas criadas sob demanda |
| **E5 · Motor de regras** | `domain/rules.js` puro — CNPJ, apelidos, competência, categorias — com testes de mesa sobre nomes de arquivo reais do escritório | Dado um nome e um texto, a função devolve cliente, competência e categoria ou `null` justificado |
| **E6 · Upload + caixa de entrada** | Dropzone, hash, extração de texto, classificação local, sessão resumable, gravação de metadados, tabela da inbox | Arquivo identificado nasce na pasta final; duvidoso vai para `_triagem` e aparece como "Revisar" |
| **E7 · Revisão e histórico** | Drawer de revisão, confirmação individual e em lote, move no Drive, eventos, tela de histórico com filtros, "criar regra para os próximos" | Documento confirmado aparece na pasta final; o histórico conta a trilha completa |
| **E8 · Resiliência** | Erros com causa legível, retry, reconexão do Drive, deduplicação por hash, divergência de `drive_file_id` | Erro é visível, explicado e reprocessável |
| **E9 · Acabamento** | Atalhos de teclado, estados vazios, responsividade, `DOCS.md`, revisão de segurança | Fluxo completo executado ponta a ponta por um contador real |

**Ao fim da E7 o produto está completo para o MVP** — sobe arquivo, classifica,
confirma, arquiva no Drive, registra histórico. E8 e E9 endurecem o que já
funciona.

Comparado ao plano anterior, a etapa de IA deixou de existir e o pipeline ficou
mais curto: onze etapas viraram dez, e nenhuma delas depende de aprovação
externa do Google para começar.

### Etapa 2, depois do MVP

- **Complemento do Gmail (Apps Script)**: painel lateral, botão "Enviar anexos
  para o NoraDocs" na mensagem aberta. Escopos: `gmail.addons.current.message.readonly`
  (sensível, verificação gratuita) e `script.external_request` (não sensível).
  **Nenhum escopo do Drive** — o complemento pede a URL de sessão ao NoraDocs e
  faz o `PUT` direto no Google.
- **Disparador de documentos**: `noradocs_document_requests` cruzando clientes ×
  competência × categoria esperada contra o que já chegou. Os contatos do cliente
  existem desde a E2.
- **IA opcional**: apenas se as regras se mostrarem insuficientes na prática, e
  sempre como opt-in desligado por padrão.

---

## Próximo passo

Aprovado o documento, a **Etapa 0 começa pelo spike** — CORS do `PUT` na sessão
resumable e validade da concessão do Picker sobre o refresh token. São as duas
únicas premissas do desenho que ainda não têm confirmação documental, e ambas se
respondem em algumas dezenas de linhas de código descartável. Só depois disso
vale escrever qualquer coisa que dependa delas.
