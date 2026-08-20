# NoraDocs — manual de operação

O que ligar, o que esperar, e o que fazer quando algo falha.

Para **por que** cada coisa é assim, veja `arquitetura.md` (decisões),
`integracao-google.md` (a investigação do Drive) e `spike-e0.md` (o que foi
medido antes de construir).

---

## 1. O que o produto faz

O escritório de contabilidade recebe documentos dos clientes (extratos, notas,
folha) e precisa arquivá-los na pasta certa do Drive do escritório. O NoraDocs
faz esse caminho:

```
arquivo → hash → texto → regras → cliente + competência + categoria
                                       │
                        identificou?  ─┤
                                       │
                   sim ────────────────┴──────────── não
                    │                                 │
          vai direto para a pasta final       vai para _triagem
          status: organizado                  status: revisar
                                                      │
                                              contador confirma
                                                      │
                                              move para a pasta final
```

**Três coisas que o produto não faz, por decisão:**

- **Não guarda arquivo.** O Drive do escritório é o armazenamento oficial. O
  Supabase guarda metadados: nome, hash, cliente, competência, categoria,
  caminho, ids do Drive e a trilha de eventos. Os bytes vão do navegador
  direto ao Google.
- **Não manda documento para IA.** A classificação é 100% determinística:
  dígito verificador de CNPJ/CPF, apelidos do cliente, regras ensinadas pelo
  escritório, regex de competência, dicionário de palavras-chave. Nenhum
  conteúdo sai para serviço externo.
- **Não enxerga o resto do Drive.** O escopo é `drive.file`, que dá acesso
  apenas ao que o próprio app criou ou ao que foi explicitamente escolhido
  pelo seletor do Google.

---

## 2. Ligando em um ambiente novo

### 2.1 Banco

Rode, em ordem:

```
supabase/migration_20260818_noradocs.sql              -- tabelas, RLS, RPC
supabase/migration_20260818_register_noradocs_system.sql  -- linha em public.systems
supabase/migration_20260820_noradocs_trilha.sql       -- policies de documents
```

O primeiro cria dez tabelas, as funções `has_noradocs_access` /
`has_noradocs_manage` e o RPC idempotente `noradocs_bootstrap`. O segundo faz o
NoraDocs aparecer na Central de Controle — sem ele o módulo existe e funciona
por link direto, mas ninguém o encontra. O terceiro tira o DELETE de
`noradocs_documents` (ver §6).

### 2.2 Google Cloud

No projeto do Google Cloud:

1. **OAuth 2.0 Client ID** (tipo *Web application*). Em *Authorized redirect
   URIs*, cadastre **cada origem** que vai usar o produto:
   `https://SEUDOMINIO/noradocs/configuracoes/google/callback` e o
   equivalente em `http://localhost:5173`. Origem que não estiver na lista
   devolve `redirect_uri_mismatch` — é o erro mais comum na primeira conexão,
   e normalmente significa que você testou por uma URL de preview do Vercel
   que não foi cadastrada.
2. **API key** para o Picker. Restrinja por *HTTP referrer* às origens do
   NoraTech; ela vai para o navegador.
3. Habilite **Google Drive API** e **Google Picker API**.
4. Escopos: `openid`, `email`, `https://www.googleapis.com/auth/drive.file`.
   Todos não sensíveis — **não** exigem auditoria CASA.

### 2.3 Variáveis

No frontend (`.env.local` em dev, variáveis do Vercel em produção):

| Variável | O que é |
|---|---|
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Client ID do OAuth. Público. |
| `VITE_GOOGLE_PICKER_API_KEY` | API key do Picker. Pública, restrita por referrer. |

Nos **secrets das Edge Functions** (Supabase → Edge Functions → Secrets):

| Secret | O que é |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Mesmo Client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | **Segredo.** Nunca em `.env`, nunca no repositório. |

> O ambiente de nuvem e a sua máquina são lugares diferentes. Colar as
> credenciais no `.env` local não as leva para o Vercel nem para o Supabase.

### 2.4 Funções

```
supabase/functions/noradocs-google-oauth   -- connect / disconnect
supabase/functions/noradocs-drive          -- picker-token, set-root-folder,
                                              ensure-folder-path, upload-token,
                                              move-file
```

Ambas com `verify_jwt: true`.

### 2.5 Primeiro uso pelo escritório

1. A empresa precisa de assinatura `noradocs` com status `active` ou
   `trialing`. Sem isso, `has_noradocs_access` recusa tudo.
2. **Configurações → conectar o Google.** Só dono ou admin da empresa.
3. **Escolher a pasta raiz** pelo seletor do Google. O NoraDocs cria uma
   subpasta `_triagem` dentro dela.
4. **Cadastrar os clientes.** O CNPJ é o sinal mais forte — é ele que permite
   arquivar um extrato sem ninguém dizer de quem é.
5. Já dá para enviar arquivos.

---

## 3. Como a classificação decide

Em ordem de força:

| Sinal | Onde procura |
|---|---|
| CNPJ/CPF com dígito verificador válido | texto do PDF e nome do arquivo |
| Regra do escritório (`noradocs_client_rules`) | trecho do nome do arquivo |
| Apelido do cliente (`aliases`) | texto e nome |
| Competência | `MM-AAAA`, `AAAA-MM`, `MM/AAAA` e nomes de mês em português |
| Categoria | palavras-chave da categoria + heurística de nome de banco |

Fecharam **cliente + competência + categoria**? Vai direto para a pasta final.
Faltou qualquer um, ou dois clientes casaram? Vai para `_triagem` com o motivo
escrito em português na coluna *review_reason*.

**O produto aprende sem IA:** ao confirmar um documento na revisão, marque
*"criar regra para os próximos"*. O trecho do nome vira uma regra em
`noradocs_client_rules` e os próximos arquivos parecidos não passam mais pela
fila. É esse mecanismo que faz a fila encolher com o uso.

### Estrutura de pastas

Padrão: `{cliente}/{ano}/{competencia}/{categoria}`

Tokens disponíveis: `{cliente}` `{cnpj}` `{ano}` `{mes}` `{competencia}`
`{categoria}` `{tipo}`. Editável em Configurações; token desconhecido é
recusado na hora de salvar, não silenciosamente ignorado.

### Modo da raiz

- **`raiz_nova`** (padrão) — o NoraDocs cria a árvore do zero dentro da pasta
  escolhida.
- **`mapeamento_por_cliente`** — para quem já tem uma estrutura montada.

Existe essa distinção porque **`drive.file` não enxerga o que já existe dentro
de uma pasta escolhida no seletor.** Apontar para uma estrutura legada e
esperar que o sistema a reconheça criaria pastas duplicadas em silêncio.

---

## 4. Teclado

**Na caixa de entrada:** `↑` `↓` (ou `j` `k`) percorrem a fila · `enter` abre o
documento · `espaço` marca para confirmação em lote · `esc` limpa cursor e
seleção.

**No painel de revisão:** `esc` fecha · `⌘↵` / `Ctrl+↵` confirma e arquiva.

Nada dispara enquanto o foco está num campo de formulário.

---

## 5. Quando algo dá errado

| Sintoma | Causa | O que fazer |
|---|---|---|
| `redirect_uri_mismatch` | A origem que você está usando não está cadastrada no Google Cloud | Cadastre a URL exata, inclusive a de preview do Vercel |
| `invalid_client` | Client Secret errado ou ausente nos secrets | Regravar `GOOGLE_OAUTH_CLIENT_SECRET` |
| "The API developer key is invalid" | Falta `VITE_GOOGLE_PICKER_API_KEY`, ou o referrer não bate | Conferir a chave e as restrições no Cloud Console |
| "Não foi possível acessar a pasta escolhida" | O seletor abriu sem `setAppId`, então nenhuma concessão foi criada e o servidor levou 404 | Reabrir o seletor; se persistir, conferir se o Client ID tem prefixo numérico (é dele que sai o `appId`) |
| "A conexão com o Google expirou" (409) | O `refresh_token` foi revogado fora do NoraDocs | Reconectar em Configurações |
| "Este arquivo já foi recebido antes" | Deduplicação por hash | Histórico → **Descartar** o registro antigo → reenviar (§6) |
| Documento na aba **Erro** | O envio falhou | Abra: se o arquivo chegou ao Drive, há *Tentar novamente*; se não chegou, descarte e reenvie |
| NoraDocs não aparece na Central de Controle | Falta a linha em `public.systems` | Rodar a migração de registro, ou criar em `/admin/sistemas` |

**Onde olhar:** a aba *Erro* mostra o que não foi arquivado e por quê. Cada
documento tem uma trilha (`noradocs_events`) que responde "por que este arquivo
foi parar aqui?" semanas depois. Os logs das Edge Functions ficam no painel do
Supabase.

---

## 6. Deduplicação e descarte

O mesmo arquivo (mesmo hash SHA-256) não entra duas vezes no mesmo escritório.
Registros com status `descartado` ficam de fora da checagem — reenviar algo
descartado é intencional.

Isso cria uma situação que precisa de saída: se alguém **apagou o arquivo no
Drive** e quer reenviá-lo, a deduplicação bloqueia pelo hash. O caminho é
**Histórico → Descartar**. O descarte não toca no arquivo do Drive; só tira o
registro da frente.

`noradocs_documents` **não tem policy de DELETE**, de propósito: apagar um
documento apagaria em cascata a sua trilha em `noradocs_events`. Descartar é
uma mudança de status, reversível e registrada.

---

## 7. Segurança — o desenho em cinco linhas

- **Refresh token isolado por construção.** `noradocs_google_tokens` tem RLS
  habilitada e **zero policies** — inalcançável pela anon key. Só as Edge
  Functions, com `service_role`, leem de lá. O linter do Supabase aponta isso
  como INFO; é exatamente o desenho pretendido.
- **Duas alçadas.** Configurar a conexão e a pasta raiz exige dono/admin
  (`has_noradocs_manage`). Arquivar documento no dia a dia é trabalho de
  qualquer membro (`has_noradocs_access`).
- **O tenant nunca vem do corpo da requisição.** As Edge Functions resolvem o
  escritório pela membresia de quem chama, com a mesma regra de
  `src/lib/companies.js`.
- **Trilha append-only.** `noradocs_events` e `noradocs_classification_runs`
  não têm policy de update nem de delete.
- **No navegador só o que é público.** Client ID e chave do Picker. O Client
  Secret vive apenas nos secrets das Edge Functions.

O único segredo que chega ao navegador é um `access_token` de 1 hora, limitado
a `drive.file`, para o upload direto. É uma troca deliberada: a alternativa
(sessão resumable sem token no cliente) **não funciona** — o host do Google que
serve a URL de sessão não responde cabeçalhos CORS. Medição em `spike-e0.md`.

---

## 8. Desenvolvendo

```bash
npm run dev          # app completo (exige credenciais do Supabase)
npm run preview:ui   # só a caixa de entrada, com dados falsos, sem backend
npm test             # 60 testes do domínio puro (node --test)
npx eslint src/modules/noradocs --max-warnings=0
```

`preview:ui` sobe em `localhost:5199/.preview/index.html` e dubla os serviços
(`.preview/`), então roda sem banco, sem Google e sem variáveis de ambiente.
Serve para iterar em layout, estados vazios e teclado — foi assim que a
rolagem horizontal no celular e a tabela ilegível em tela estreita apareceram.

**Onde mexer:**

| Preciso mudar… | Vá em |
|---|---|
| como um documento é classificado | `domain/rules.js` (puro, testado) |
| o que conta como CNPJ/competência válidos | `domain/cnpj.js`, `domain/competencia.js` |
| a árvore de pastas | `domain/folderTemplate.js` |
| a jornada do upload | `services/upload.service.js` |
| o que acontece ao confirmar | `services/review.service.js` |
| qualquer chamada ao Drive | `supabase/functions/noradocs-drive/index.ts` |

`domain/` é código puro: sem React, sem Supabase, sem rede. É a única parte com
testes, e é onde a lógica de negócio deve ficar. Componente que precisa de uma
decisão (*este documento pode ser reprocessado?*) importa de `domain/`, nunca de
`services/` — esse acoplamento já foi introduzido duas vezes por engano.

---

## 9. O que ficou fora do MVP

- **Gmail.** O desenho está pronto (a coluna `origem` já aceita `'email'` e o
  pipeline é o mesmo), mas nada foi construído. A direção escolhida é o
  contador **selecionar** os e-mails e mandar os anexos — nunca monitoramento
  contínuo da caixa. Comparação entre extensão de navegador e Apps Script em
  `integracao-google.md`.
- **IA.** Se um dia entrar, entra como opcional e explícito, nunca como padrão.
- **Disparo de documentos** (escritório → cliente).
- **Upload acima de 25 MB.** O envio é multipart de uma tacada; acima disso
  precisaria de resumable, que exige um caminho diferente por causa do CORS.
- **OCR de PDF escaneado.** Sem texto extraível, o arquivo cai em revisão com o
  motivo dito claramente.
