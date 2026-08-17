# NoraDocs — Análise de produto e arquitetura (MVP)

> Documento de decisão. Escrito **antes** da implementação, para ser revisado e
> aprovado. Nenhum código de produto foi escrito ainda.
>
> Status: proposta · Alvo: MVP funcional · Stack: React/Vite + Supabase + Google APIs + Gemini

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

> A IA **sugere**. O sistema **move** apenas quando a confiança passa do limiar
> configurado pelo escritório. Toda movimentação fica registrada e é reversível.

---

## 2. Escopo do MVP e não-escopo

### Dentro do MVP

| # | Capacidade | Observação |
|---|-----------|------------|
| 1 | Autenticação e usuários | **Reaproveita** o que já existe (Supabase Auth, `profiles`, `companies`, `company_members`) |
| 2 | Cadastro de empresas/clientes | Tabela própria do NoraDocs, com importação opcional do módulo Soluções Contábeis |
| 3 | Upload manual de arquivos | Drag & drop, múltiplos arquivos, com deduplicação por hash |
| 4 | Caixa de entrada | Tela principal do produto |
| 5 | Análise/classificação | Regras determinísticas primeiro, IA como fallback |
| 6 | Identificação de cliente, competência e categoria | Três campos independentes, com confiança independente |
| 7 | Confirmação manual quando houver dúvida | Status `revisar` + painel de revisão |
| 8 | Organização automática no Drive | Move por metadados (sem re-upload) |
| 9 | Histórico | Log append-only por documento |
| 10 | Status: processando, organizado, revisar, erro | Máquina de estados explícita |
| 11 | Configuração da estrutura de pastas | Template com tokens + pré-visualização |

### Fora do MVP (mas com arquitetura preparada)

- **Ingestão por e-mail/Gmail** — o pipeline recebe um `origem` desde o primeiro
  dia e é acionado por uma função única `ingest()`. O conector Gmail vira apenas
  mais um produtor que chama a mesma função.
- **Disparador de documentos** (cobrar arquivos pendentes / enviar arquivos ao
  cliente) — depende de canal (e-mail/WhatsApp) e de contato do cliente, que já
  são modelados agora (`email`, `telefone` em `noradocs_clients`).
- **Portal do cliente** (cliente logando para enviar arquivos).
- **OCR pesado de documentos digitalizados** — no MVP, PDFs sem camada de texto
  vão direto para a IA multimodal ou caem em `revisar`.
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
│  BROWSER (React/Vite)                                            │
│  • Caixa de entrada, revisão, cadastros, configurações           │
│  • Hash SHA-256 do arquivo (SubtleCrypto)                        │
│  • Extração de texto de PDF com camada textual (pdfjs-dist)      │
│  • Upload dos BYTES direto para o Google (URL resumable)         │
└───────────┬─────────────────────────────────┬────────────────────┘
            │ supabase-js (RLS)               │ PUT bytes
            ▼                                 ▼
┌────────────────────────────┐    ┌──────────────────────────────┐
│  SUPABASE / POSTGRES       │    │  GOOGLE DRIVE (do escritório)│
│  • Tabelas noradocs_*      │    │  • Pasta raiz escolhida      │
│  • RLS por tenant          │    │  • _triagem/ (staging)       │
│  • Histórico append-only   │    │  • Estrutura final           │
└────────────┬───────────────┘    └──────────────▲───────────────┘
             │                                   │ API (metadados, move)
             ▼                                   │
┌──────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTIONS (Deno, service_role) — o único lugar com token   │
│  noradocs-google-oauth    → troca code por refresh token         │
│  noradocs-upload-url      → devolve URL resumable de upload      │
│  noradocs-process         → classifica (regras → IA) e decide    │
│  noradocs-organize        → garante pastas e move o arquivo      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  GEMINI API        │  (mesmo provedor já usado
                    │  classificação     │   em supabase/functions/
                    │  estruturada       │   support-chat)
                    └────────────────────┘
```

### Princípios que sustentam esse desenho

1. **O refresh token do Google nunca chega ao navegador.** Ele vive em uma tabela
   sem nenhuma policy de RLS — inacessível pela `anon key` por construção — e só
   é lido por Edge Functions com `service_role`.
2. **Os bytes do arquivo nunca passam pela nossa infraestrutura.** A Edge Function
   negocia com o Drive uma *URL de sessão resumable*; o navegador envia o arquivo
   direto para o Google. Isso elimina o limite de tamanho de corpo da Edge
   Function, reduz custo de banda e mantém o token protegido.
3. **Nenhum armazenamento próprio de arquivos.** Nem bucket, nem staging local: o
   arquivo entra direto numa pasta `_triagem` dentro do Drive do escritório e,
   quando classificado, é **movido por metadados** (`files.update` com
   `addParents`/`removeParents`) — operação barata, sem re-upload.
4. **Edge Function deriva o tenant do JWT do chamador, nunca do corpo da
   requisição.** Convenção já aplicada em `support-chat/index.ts` e que precisa
   valer aqui com ainda mais rigor.
5. **Cada passo é idempotente e re-executável.** Reprocessar um documento com erro
   nunca duplica arquivo no Drive nem linha no banco.

---

## 5. Modelo de dados

Todas as tabelas com prefixo `noradocs_`, RLS habilitada, `tenant_company_id`
apontando para `companies`, e trigger `touch_updated_at()` (já existe no banco).

### 5.1 Entidades centrais

**`noradocs_settings`** — uma linha por escritório
```
tenant_company_id      uuid PK → companies
drive_root_folder_id   text          -- pasta raiz escolhida via Google Picker
drive_root_folder_name text
drive_staging_folder_id text         -- subpasta _triagem
folder_template        text          -- default '{cliente}/{ano}/{competencia}/{categoria}'
auto_organize          boolean       -- default true
ai_enabled             boolean       -- default true
confidence_threshold   numeric(3,2)  -- default 0.85
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

suggestion        jsonb  -- { client_id, competencia, category_id, confidences{}, method, rationale }
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

**`noradocs_classification_runs`** — auditoria da decisão automática
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
próximos"*. É o mecanismo mais barato de melhorar a precisão sem tocar em IA.

### 5.3 Preparado para a etapa 2 (não criado agora)

`noradocs_document_requests` (solicitações do disparador) e
`noradocs_email_accounts` (contas Gmail monitoradas). Ficam desenhadas, não
implementadas — mas `origem`, `origem_ref` e os contatos do cliente já existem
para que a etapa 2 não exija migração destrutiva.

---

## 6. O pipeline de classificação

Executado pela Edge Function `noradocs-process`, um documento por invocação,
idempotente.

```
      arquivo recebido
             │
   ┌─────────▼──────────┐
   │ 0. Sinais          │  nome do arquivo, mime, tamanho, hash,
   │    (browser)       │  texto extraído (pdfjs) quando há camada textual
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 1. REGRAS          │  • CNPJ no texto (com validação de dígitos)
   │    determinísticas │    → casa com noradocs_clients
   │    custo zero      │  • noradocs_client_rules (padrões do escritório)
   │                    │  • data/competência por regex (MM/AAAA, AAAA-MM, mês por extenso)
   │                    │  • categoria por dicionário de keywords
   └─────────┬──────────┘
             │  campos ainda indefinidos?
       não ──┤── sim
             │        ┌────────────────────┐
             │        │ 2. IA (Gemini)     │  só os campos que faltam,
             │        │    JSON estruturado│  lista FECHADA de candidatos,
             │        │    confiança 0..1  │  texto/página amostrados
             │        └─────────┬──────────┘
             ▼                  ▼
   ┌──────────────────────────────────────┐
   │ 3. PORTÃO DE DECISÃO                 │
   │  todos os campos ≥ threshold         │
   │   e auto_organize ligado?            │
   └───────┬──────────────────────┬───────┘
          sim                    não
           ▼                      ▼
   noradocs-organize          status = revisar
   (move no Drive)            (sugestões pré-preenchidas)
           ▼
   status = organizado
```

### Por que regras antes de IA

- **Custo e latência**: a maioria dos documentos de um escritório é repetitiva.
  Extrato do Itaú do cliente X chega todo mês com o mesmo padrão de nome. Isso é
  regex, não LLM.
- **Determinismo auditável**: quando o contador pergunta "por que foi para cá?",
  "a regra CNPJ 12.345.678/0001-90 → Cliente X" é uma resposta; "o modelo achou"
  não é.
- **A IA fica para o caso difícil**, que é onde ela realmente ganha: PDF
  digitalizado, nome de arquivo `documento(3).pdf`, boleto sem CNPJ legível.

### Regras de contenção da IA

1. A IA **nunca** recebe a lista completa de clientes — só um conjunto de
   candidatos (top-N por similaridade) mais a opção "nenhum". Isso controla custo
   de token e reduz alucinação.
2. Saída em **JSON com schema fechado**; qualquer campo fora do enum vira
   `revisar` automaticamente.
3. A IA **não tem ferramenta de escrita**. Ela devolve uma sugestão; quem move é
   `noradocs-organize`, e só depois do portão de decisão.
4. Confiança é **por campo**. Um documento pode ter cliente certo e competência
   duvidosa — nesse caso vai para revisão com apenas um campo destacado.
5. `ai_enabled = false` desliga a IA por escritório; tudo que as regras não
   resolverem cai em `revisar`. Um escritório conservador pode operar assim.

### Máquina de estados

```
                  ┌──────────────┐
   upload ───────▶│ processando  │
                  └──┬────┬───┬──┘
        alta confiança│    │   │falha
                      ▼    │   ▼
              ┌───────────┐│┌───────┐
              │ organizado│││ erro  │──── retry ──┐
              └───────────┘│└───────┘             │
                    ▲      │baixa confiança       │
                    │      ▼                      │
                    │  ┌─────────┐                │
                    └──┤ revisar │◀───────────────┘
           confirmação └────┬────┘
              manual        │ descartar
                            ▼
                      ┌────────────┐
                      │ descartado │
                      └────────────┘
```

Transições válidas ficam em `domain/status.js`, uma única fonte de verdade
consultada tanto pela UI quanto pelas Edge Functions.

---

## 7. Integração com o Google Drive

### 7.1 Escopo OAuth — a decisão mais delicada do projeto

O escopo `https://www.googleapis.com/auth/drive` (acesso total) é classificado
pelo Google como **restrito**. Publicar um app com ele exige verificação com
avaliação de segurança **CASA** — processo caro (US$ 500–4.500/ano) e demorado
(semanas a meses). Antes disso, o app fica limitado a 100 usuários de teste.

**Recomendação: usar `drive.file` + Google Picker.**

- `drive.file` é escopo **não sensível**: dá acesso apenas aos arquivos e pastas
  que o app criou **ou que o usuário selecionou explicitamente** pelo Picker.
- Fluxo: o escritório clica em "Escolher pasta raiz", o Picker abre, ele
  seleciona a pasta existente do escritório. A partir daí o NoraDocs pode criar
  subpastas e arquivos **dentro dela** normalmente.
- Resultado prático: cobre 100% do MVP, sem verificação restrita, sem custo, sem
  espera. O escritório também ganha a garantia de que o sistema não enxerga o
  resto do Drive dele — argumento comercial forte.

O escopo total fica como opção futura, se algum caso de uso realmente exigir
varrer o Drive inteiro.

### 7.2 Fluxo de conexão

```
Escritório clica "Conectar Google Drive"
   → OAuth consent (access_type=offline, prompt=consent)
   → callback com `code` → Edge Function noradocs-google-oauth
   → troca code por refresh_token → grava em noradocs_google_accounts
   → Picker escolhe a pasta raiz → grava drive_root_folder_id em settings
   → Edge Function cria a subpasta `_triagem`
```

Só quem tem papel `owner`/`admin` no escritório pode conectar ou desconectar.

### 7.3 Upload e organização

```
1. Browser: calcula hash, cria a linha em noradocs_documents (status=processando)
2. Browser → noradocs-upload-url: pede uma sessão de upload
3. Edge Function: cria a sessão resumable no Drive, dentro de _triagem
4. Browser: PUT dos bytes direto para o Google (com progresso e retomada)
5. Browser → noradocs-process: classifica
6. Se aprovado → noradocs-organize:
   a. resolve o caminho pelo template
   b. garante cada pasta (cache → busca → cria), gravando em noradocs_drive_folders
   c. files.update com addParents / removeParents  ← MOVE, não copia
   d. grava drive_path, drive_web_link, status=organizado, evento no histórico
```

Todas as chamadas com `supportsAllDrives: true` desde o início, para que Drives
Compartilhados funcionem sem retrabalho.

### 7.4 Template de pastas

```
{cliente}/{ano}/{competencia}/{categoria}
```

Tokens disponíveis: `{cliente}`, `{cnpj}`, `{ano}`, `{mes}`, `{competencia}`,
`{categoria}`, `{tipo}`. A tela de configuração mostra **pré-visualização ao
vivo** com um documento de exemplo — o contador precisa ver o caminho antes de
salvar, não descobrir depois com 300 arquivos arquivados errado.

Normalização de nomes (acentos, barras, espaços duplos) é centralizada em
`domain/folderTemplate.js` e usada tanto na pré-visualização quanto na criação
real, para que nunca divirjam.

---

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

- Campos sugeridos pela IA aparecem com marcação visual discreta (`?`), não com
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
palavras-chave), automação (IA ligada/desligada, limiar de confiança,
organização automática).

### 8.6 Linguagem visual

Herda a identidade já usada no hub contábil — roxo `#7C3AED`, paleta tema-aware
clara/escura, `Inter` para UI e `JetBrains Mono` para dados técnicos. Tabelas com
linhas de 44px, bordas sutis, hover discreto. Sem gradientes, sem ilustrações,
sem KPI cards.

---

## 9. Decisões técnicas

| # | Decisão | Escolha | Por quê |
|---|---------|---------|---------|
| D1 | Escopo OAuth | `drive.file` + Picker | Evita verificação CASA (custo e meses de espera) e é mais defensável comercialmente |
| D2 | Armazenamento | Nenhum próprio; `_triagem` no Drive do escritório | Atende o requisito do produto; mover é operação de metadado, barata |
| D3 | Caminho dos bytes | Sessão resumable → browser envia direto ao Google | Sem limite de corpo da Edge Function, sem custo de banda, token protegido |
| D4 | Guarda do refresh token | Tabela sem policies + criptografia; só `service_role` | Sem caminho de leitura pela `anon key`, por construção |
| D5 | Classificação | Regras primeiro, IA como fallback | Custo, latência e auditabilidade |
| D6 | Extração de texto | `pdfjs-dist` no browser (já é dependência); IA multimodal para digitalizados | Zero infra de OCR no MVP |
| D7 | Cadastro de clientes | Tabela própria + link opcional para `accounting_companies` | Mantém os dois produtos vendáveis separadamente |
| D8 | Competência | `text` no formato `YYYY-MM` com CHECK | Consistente com o módulo contábil já em produção |
| D9 | Processamento | Uma Edge Function por documento, idempotente; UI acompanha por Realtime | Simples; fila dedicada só quando o volume exigir |
| D10 | Isolamento | RLS em todas as tabelas; Edge Function deriva tenant do JWT | Convenção já validada em `support-chat` |
| D11 | Provedor de IA | Gemini | Já configurado no projeto (`GEMINI_API_KEY`), multimodal, barato no tier flash |
| D12 | Nome do arquivo | Preserva o original por padrão | Renomeação automática destrói a referência que o cliente usa; fica como opção |

---

## 10. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Verificação do Google** | Bloquearia o lançamento | D1: escopo não sensível resolve. Ainda assim, criar o projeto no Google Cloud e a tela de consentimento **na Etapa 2**, não na véspera do lançamento |
| **Token revogado** (senha trocada, acesso removido) | Todo o pipeline para | Detectar `invalid_grant`, marcar `status=revoked`, banner persistente na UI, documentos ficam em `processando` e são retomados após reconectar — nunca marcados como erro definitivo |
| **Classificação errada com confiança alta** | Perda de confiança no produto | Limiar conservador no início (0,85+), `auto_organize` desligado nos primeiros dias de cada escritório, histórico com um clique para desfazer |
| **LGPD** — documentos contêm dados pessoais e financeiros de terceiros | Jurídico | Enviar à IA apenas trechos de texto e amostras, nunca o acervo; registrar o que foi enviado em `classification_runs`; permitir desligar a IA; tratar isso no contrato do escritório (ele é o controlador, NoraTech é operadora) |
| **Limites de API do Drive** (rate limit por usuário) | Lentidão em lote | Backoff exponencial, cache de pastas, limite de concorrência por tenant |
| **Pastas duplicadas** em uploads simultâneos | Estrutura suja | `unique(tenant, path)` em `noradocs_drive_folders` + criação sob a mesma transação lógica |
| **Timeout de Edge Function** em PDFs grandes | Documento travado | Trabalho pesado no browser; Edge Function só decide; `retry_count` com reprocessamento manual |
| **Contador move arquivos manualmente no Drive** | `drive_path` fica mentindo | Aceitar no MVP; validar o `drive_file_id` ao abrir o histórico e sinalizar divergência |
| **Escopo do MVP inchar** | Atraso | O disparador e o Gmail estão explicitamente fora; a arquitetura os acomoda, o cronograma não |

---

## 11. Plano de execução em etapas

Cada etapa é pequena, entregável e testável isoladamente. Nada de script gigante.

| Etapa | Entrega | Definição de pronto |
|-------|---------|---------------------|
| **E0 — Fundação** | Slug `noradocs` no catálogo e na tabela `systems`; rota `/noradocs` com `SubscriptionRoute`; esqueleto do módulo; paleta promovida para `src/lib/palette.js`; layout com sidebar | Acesso a `/noradocs` com assinatura ativa, telas vazias navegáveis |
| **E1 — Banco** | Migration com todas as tabelas `noradocs_*`, RLS, `has_noradocs_access`, categorias-semente | Migration aplicada; `get_advisors` sem alerta de segurança |
| **E2 — Clientes** | CRUD de `noradocs_clients` + importação do módulo contábil | Escritório cadastra e edita clientes; CNPJ validado |
| **E3 — Google Drive** | OAuth, Picker, `noradocs_google_accounts`, tela de conexão, criação do `_triagem` | Escritório conecta a conta, escolhe a raiz, vê o status |
| **E4 — Estrutura de pastas** | Template com tokens, pré-visualização ao vivo, `ensureFolderPath` + cache | Salvar template e ver o caminho de exemplo; pastas criadas sob demanda no Drive |
| **E5 — Upload** | Dropzone, hash, sessão resumable, documento em `processando`, deduplicação | Arquivo aparece na caixa de entrada e no `_triagem` do Drive |
| **E6 — Caixa de entrada + regras** | Motor de regras puro, tabela da inbox, abas de status, coluna Destino | Documentos com CNPJ reconhecível são classificados sem IA |
| **E7 — Revisão e organização** | Drawer de revisão, confirmação (individual e em lote), move no Drive, eventos | Documento confirmado aparece na pasta final; histórico registra |
| **E8 — Camada de IA** | Edge Function com Gemini, JSON estruturado, confiança por campo, portão de decisão, `classification_runs` | Documento sem CNPJ é sugerido pela IA; abaixo do limiar vai para `revisar` |
| **E9 — Histórico e resiliência** | Tela de histórico com filtros, tratamento de erro, retry, reconexão do Drive | Erro é visível, explicado e reprocessável |
| **E10 — Acabamento** | Atalhos de teclado, estados vazios, responsividade, `DOCS.md`, revisão de segurança | Fluxo completo executado ponta a ponta por um usuário real |

**Ordem de valor**: ao fim de **E7** o produto já é utilizável de verdade — um
escritório consegue subir arquivos, classificar por regras, confirmar e arquivar
no Drive. E8 em diante é aumento de automação, não requisito de funcionamento.
Isso é proposital: se o cronograma apertar, a IA é a parte adiável, não o núcleo.

### Preparação para a etapa 2 (pós-MVP)

- **Gmail**: novo produtor chamando o mesmo `ingest()`, gravando `origem='email'`
  e `origem_ref` com o id da mensagem. Nenhuma mudança no pipeline.
- **Disparador**: `noradocs_document_requests` cruzando clientes × competência ×
  categoria esperada contra o que já chegou. Os contatos do cliente já existem
  desde E2.

---

## Próximo passo

Revisar e aprovar este documento — em especial **D1 (escopo OAuth)**, **D2
(staging dentro do Drive)** e **D7 (cadastro de clientes próprio)**, que são as
três decisões com maior custo de reversão. Aprovadas, começamos pela **Etapa 0**.
