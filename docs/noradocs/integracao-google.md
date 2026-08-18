# NoraDocs — Investigação técnica das integrações Google

> Pesquisa feita nas fontes do Google e na documentação pública em agosto/2026,
> para decidir as premissas do MVP. Complementa `arquitetura.md`.
>
> Cada afirmação abaixo está marcada como **[confirmado]** (documentação ou
> fonte pública encontrada) ou **[a validar]** (precisa de spike antes de virar
> premissa de código).

---

## Sumário das conclusões

| Pergunta | Resposta |
|----------|----------|
| `drive.file` serve para o MVP? | **Sim.** Escopo não sensível, sem CASA, funciona com toda a REST API do Drive |
| Dá para criar pastas com `drive.file`? | **Sim.** Pasta é um arquivo; criada pelo app, fica acessível ao app |
| O app enxerga o que já existe na pasta escolhida? | **Não.** E isso muda o desenho do setup — ver §2.3 |
| Upload direto navegador → Drive? | **Sim**, via URL de sessão resumable emitida pelo servidor · **[a validar: CORS]** |
| Extensão Chrome para Gmail? | Tecnicamente possível, **mas exige escopo restrito (CASA) ou raspagem de DOM** |
| Google Apps Script como alternativa? | **Melhor opção**: escopo apenas sensível, sem CASA, esforço muito menor |
| IA no MVP? | **Fora.** Classificação 100% determinística — e isso vira argumento comercial |

---

## 1. Escopos do Google Drive e exigências de publicação

O Google organiza os escopos em três níveis, e o nível define o caminho de
publicação — não a dificuldade técnica.

| Nível | Exemplos | O que exige |
|-------|----------|-------------|
| **Não sensível** | `drive.file`, `openid`, `email`, `script.external_request` | Verificação básica da marca. Sem auditoria |
| **Sensível** | `gmail.addons.current.message.readonly`, `drive.metadata.readonly` | Verificação OAuth manual do Google. **Gratuita** |
| **Restrito** | `drive`, `drive.readonly`, `gmail.readonly`, `gmail.modify` | Verificação + **auditoria CASA anual por laboratório terceiro** |

Sobre o CASA, dois pontos atualizados: o *self-scan* gratuito de Tier 2 **deixou
de existir** — hoje é obrigatoriamente um laboratório autorizado, com custo
anual na faixa de centenas a alguns milhares de dólares (o Google negociou
tarifa reduzida com a TAC Security). **[confirmado]**

**Conclusão: nenhum escopo restrito entra no MVP.** Isso elimina custo recorrente,
auditoria anual e semanas de espera antes do lançamento.

### 1.1 O que `drive.file` dá e o que não dá

**[confirmado]** `drive.file` concede acesso **por arquivo**, e apenas a:

1. arquivos e pastas **criados pelo próprio app**;
2. itens que o usuário **selecionou explicitamente** pelo Google Picker.

E funciona com toda a REST API do Drive — não é um subconjunto de métodos. Criar
pasta é `files.create` com `mimeType: application/vnd.google-apps.folder`; como o
app criou, o app mantém acesso. Mover é `files.update` com `addParents` /
`removeParents`. Tudo disponível.

A concessão **persiste entre sessões**: um token novo com `drive.file` continua
alcançando os arquivos previamente concedidos ao app. Não é acesso efêmero.
**[confirmado]**

> ⚠️ Uma ressalva operacional: revogar o token revoga **todos** os escopos já
> concedidos àquele client ID, não só o da sessão. O botão "Desconectar" precisa
> deixar isso claro para o escritório.

---

## 2. Google Picker

### 2.1 Como funciona

Biblioteca JavaScript do Google carregada no navegador. Precisa de uma **API key**
e de um **access token** OAuth. O escritório navega no próprio Drive dentro de um
modal do Google — o NoraDocs não vê nada além do que for selecionado — e o que
for escolhido passa a ser acessível ao app sob `drive.file`.

Configurando a `DocsView` para incluir e permitir seleção de pastas, o retorno é
o `folderId` da pasta escolhida. **[confirmado]**

### 2.2 O que resolve

Resolve exatamente o que o escopo restrito resolveria para o nosso caso: apontar
onde o NoraDocs pode trabalhar, sem dar acesso ao resto do Drive. É a peça que
torna `drive.file` suficiente.

### 2.3 A limitação que muda o setup do produto

**[confirmado] Selecionar uma pasta pelo Picker NÃO dá acesso aos arquivos e
subpastas que já existem dentro dela.** O app ganha acesso à pasta em si — pode
criar conteúdo lá dentro — mas o que já estava lá permanece invisível.

A consequência prática é concreta e precisa ser dita ao escritório antes da
venda:

> Se o escritório já tem `/Clientes/Silva ME/2026/` e aponta `/Clientes` como
> raiz, o NoraDocs **não enxerga** a pasta `Silva ME` existente. Ao arquivar o
> primeiro documento, ele criaria uma **segunda** pasta `Silva ME` ao lado da
> original. O Drive permite nomes duplicados — ninguém receberia erro, e a
> estrutura silenciosamente se dividiria em duas.

Três caminhos, e o produto deve suportar dois deles:

| Caminho | Como funciona | Quando usar |
|---------|---------------|-------------|
| **A. Raiz nova (padrão)** | O escritório escolhe/cria uma pasta vazia. O NoraDocs constrói toda a árvore a partir dela | Escritório começando, ou disposto a adotar a estrutura do NoraDocs |
| **B. Mapeamento por cliente** | O escritório aponta, pelo Picker, a pasta **de cada cliente** uma única vez. Vai para `noradocs_clients.drive_folder_id` | Escritório com estrutura legada que quer preservar |
| ~~C. Escopo `drive` completo~~ | Enxergaria tudo | **Descartado** — restrito, CASA, contra o princípio de menor privilégio |

O caminho B já cabe no modelo de dados proposto: o campo `drive_folder_id` em
`noradocs_clients` existe justamente para isso. Vira uma tela de "vincular pasta"
no cadastro do cliente, opcional.

**Recomendação: A como padrão no MVP, B como opção na mesma tela de cadastro.**
Nenhum dos dois exige escopo adicional.

---

## 3. Upload direto do navegador para o Drive

### 3.1 O mecanismo

O protocolo resumable do Google funciona em duas etapas: uma requisição inicia a
sessão e devolve, no cabeçalho `Location`, uma **URL de sessão**; os bytes vão
depois num `PUT` para essa URL.

O ponto que interessa: **a URL de sessão funciona como credencial**. Ela carrega
um `upload_id` e as requisições que a usam **não precisam ser assinadas** — não
vai cabeçalho `Authorization`. A sessão expira em cerca de uma semana.
**[confirmado]**

Disso decorre o desenho:

```
1. Navegador  → Edge Function: "quero enviar extrato.pdf para a pasta X"
2. Edge Fn    → Drive (com o token do escritório): inicia sessão resumable
3. Edge Fn    → Navegador: devolve só a URL de sessão
4. Navegador  → Google: PUT dos bytes direto        ← nunca passa pela NoraTech
5. Navegador  → Supabase: grava os metadados
```

O token do escritório **nunca sai do servidor**, e os bytes **nunca entram** nele.

### 3.2 O que ainda precisa ser validado

**[a validar]** Se o endpoint de upload do Drive responde com cabeçalhos CORS que
permitam o `PUT` a partir do navegador. Há um detalhe conhecido: o navegador
**não consegue ler o cabeçalho `Location`** numa resposta CORS — mas isso não nos
afeta, porque quem inicia a sessão é o servidor. Resta confirmar o `PUT` em si.

Isso é um spike de vinte linhas, e deve ser a **primeira tarefa da Etapa 0** —
antes de qualquer decisão de código depender dele. Dois planos B, em ordem:

1. **Access token efêmero no navegador.** O servidor emite um token de 1h, só
   `drive.file`, da conta do escritório; o navegador faz o upload direto. Mantém
   os bytes fora da nossa infra; expõe um token de curta duração na memória do
   navegador de um funcionário já autenticado.
2. **Proxy pela Edge Function.** Os bytes passam pela função e seguem para o
   Drive, sem nunca serem gravados. Viola "os bytes não passam pela NoraTech",
   mas não viola "a NoraTech não armazena".

### 3.3 Por que o token fica no servidor, e não no navegador

Esta foi a decisão menos óbvia da investigação, e vale registrar o raciocínio.

Seria mais simples autenticar o Google direto no navegador (fluxo GIS, token de
1h, sem refresh token, sem guardar segredo nenhum). Mas a concessão do
`drive.file` é por **(app, usuário, arquivo)** — e isso quebra o produto:

- A funcionária **Ana** envia um documento que cai em "Revisar".
- Dois dias depois, **Bruno** abre a fila e confirma.
- O arquivo foi criado sob a concessão da Ana. **O token do Bruno não alcança
  esse arquivo.** A confirmação falha.

Com uma **conta única do escritório conectada no servidor**, a identidade que
opera o Drive é sempre a mesma, independente de quem está na tela. Como bônus, os
funcionários **não precisam ter conta Google nenhuma** — só login no NoraDocs.

O custo é guardar um refresh token. Fica em tabela sem nenhuma policy de RLS
(inalcançável pela `anon key` por construção), criptografado, lido apenas por
Edge Function com `service_role`.

### 3.4 Detalhe da conexão

O Picker roda no navegador com a conta ali logada; o refresh token vem do fluxo
de código. **Precisam ser a mesma conta Google**, senão a concessão do Picker não
serve ao token do servidor. O fluxo de conexão deve comparar o e-mail retornado
pelo OAuth com o da sessão do Picker e recusar se divergirem. **[a validar]** que
a concessão feita via Picker no navegador vale para o refresh token do mesmo
`client_id` e mesmo usuário — mesmo spike da Etapa 0.

---

## 4. O caminho do Gmail: extensão Chrome × Apps Script

O fluxo desejado é: contador seleciona e-mails no Gmail → clica → anexos vão para
o NoraDocs. As duas abordagens chegam lá por caminhos muito diferentes.

### 4.1 Extensão Chrome (Manifest V3)

Para obter os bytes do anexo, só existem dois caminhos:

- **Gmail API** com `gmail.readonly` ou `gmail.modify` — ambos **restritos**.
  Auditoria CASA anual, custo recorrente. **[confirmado]**
- **Ler o DOM do Gmail** e buscar as URLs de download do anexo com os cookies da
  sessão. Sem OAuth nenhum. É o que fazem várias extensões de mercado — e é
  frágil por construção: depende de HTML não documentado, que o Google altera sem
  aviso. Uma mudança no Gmail derruba o produto de todos os escritórios ao mesmo
  tempo, sem alerta prévio.

Vantagem real e exclusiva: **é a única forma de agir sobre múltiplos e-mails
selecionados na lista**, porque enxerga as caixas de seleção da interface.

Distribuição pela Chrome Web Store, com revisão própria, e só funciona no Chrome
desktop.

### 4.2 Complemento do Gmail (Google Workspace Add-on / Apps Script)

Roda no painel lateral do Gmail. Acessa os anexos nativamente
(`getAttachments()`), sem raspagem.

Escopos necessários:

- `gmail.addons.current.message.readonly` — **sensível**, não restrito. Só
  enxerga a mensagem que o usuário abriu, e só enquanto o complemento está em
  execução. Verificação OAuth **gratuita**, sem CASA. **[confirmado]**
- `script.external_request` — **não sensível**. Para chamar o NoraDocs.

E aqui o truque da §3.1 se paga uma segunda vez: como a URL de sessão resumable
já vem pré-autorizada, **o complemento não precisa de escopo nenhum do Drive**.
Ele pede a URL ao NoraDocs e faz o `PUT` do anexo direto no Google.

Limites técnicos: `UrlFetchApp` e `Blob` do Apps Script têm teto de **50 MB** por
chamada — acima do limite de 25 MB de anexo do próprio Gmail, portanto não é
restrição real. Cota de 20.000 chamadas/dia em conta comum e 100.000 em Workspace.
**[confirmado]**

**A limitação decisiva: [confirmado]** os gatilhos contextuais do Gmail disparam
para a **mensagem aberta**, uma por vez. Não existe API que devolva as mensagens
marcadas na lista. **O complemento não faz multisseleção** — e não há como
contornar isso dentro da plataforma de add-ons.

Distribuição pelo Google Workspace Marketplace (revisão manual, gratuita), e
funciona no Gmail web **e no aplicativo móvel**.

### 4.3 Comparação

| Critério | Extensão Chrome | Complemento (Apps Script) |
|----------|-----------------|---------------------------|
| Multisseleção de e-mails | ✅ possível | ❌ só a mensagem aberta |
| Acesso aos anexos | Escopo restrito (CASA) **ou** raspagem de DOM | Nativo, escopo sensível |
| Escopos exigidos | `gmail.readonly` (restrito) ou nenhum (frágil) | `...current.message.readonly` + `script.external_request` |
| Precisa de escopo do Drive | Sim, ou o mesmo truque da URL de sessão | **Não** |
| Auditoria / custo anual | CASA, centenas a milhares de US$/ano | **Nenhum** |
| Fragilidade | Alta — DOM não documentado | Baixa — API estável |
| Onde funciona | Chrome desktop | Gmail web **e móvel** |
| Distribuição | Chrome Web Store | Workspace Marketplace |
| Esforço de desenvolvimento | Alto (MV3, content script, build, store) | Baixo (um projeto Apps Script) |
| Escala p/ vários escritórios | Cada usuário instala | Cada usuário instala, ou o admin instala para todo o domínio |

### 4.4 Recomendação

**Complemento do Gmail via Apps Script**, e não extensão Chrome.

A multisseleção é a única vantagem da extensão, e ela custa caro: ou um escopo
restrito com auditoria anual, ou uma dependência de HTML não documentado que
pode quebrar em produção sem aviso. Não é uma troca razoável para um MVP.

Há ainda um contra-argumento de produto à própria multisseleção: o contador
costuma **abrir** o e-mail para saber de que cliente é antes de arquivar. Agir
sobre a mensagem aberta acompanha o fluxo real de trabalho; a fila de seleção em
massa é mais atraente na descrição do que no uso.

**E, para o MVP, nem o complemento entra.** O caminho do Gmail é a Etapa 2. O
contador que já baixa anexos hoje arrasta vários arquivos de uma vez para a caixa
de entrada do NoraDocs — o mesmo resultado, com zero código de integração,
zero revisão de loja e zero verificação OAuth extra. Provamos a classificação
primeiro; automatizamos a entrada depois.

---

## 5. Privacidade: o que a decisão de não usar IA compra

Com a classificação por regras determinísticas rodando **no navegador**, e o
upload indo direto para o Drive do escritório, o resultado é:

> **Nenhum byte de documento de cliente passa por servidor da NoraTech.**
> O Supabase guarda metadados: nome do arquivo, hash, tamanho, cliente
> identificado, competência, categoria, status, IDs do Drive e histórico.

Isso deixa de ser detalhe de implementação e vira posição comercial. Para um
escritório contábil — que responde como controlador pelos dados dos clientes
dele — é a diferença entre uma conversa sobre LGPD e nenhuma conversa sobre LGPD.

Regras de projeto que sustentam a posição, e que devem ser respeitadas no código:

1. Nunca gravar o texto extraído do documento no banco. Só o **motivo** curto da
   decisão (ex.: *"CNPJ 12.345.678/0001-90 no texto"*).
2. Extração de texto (`pdfjs-dist`, já é dependência do projeto) acontece no
   navegador e o resultado morre ali.
3. Se um dia entrar IA, ela é **opt-in por escritório**, desligada por padrão, com
   aviso explícito de que o conteúdo sairá para um terceiro.

---

## 6. Custo e escalabilidade

| Item | Custo | Escala |
|------|-------|--------|
| Escopos usados no MVP | R$ 0 — nenhum restrito | — |
| Verificação OAuth | Gratuita (verificação básica de marca) | Uma vez |
| Armazenamento dos documentos | R$ 0 para a NoraTech — é o Drive do escritório | Cada escritório paga o próprio Drive |
| Banda de upload | R$ 0 — navegador → Google | Não passa por nós |
| Supabase | Só metadados: linhas pequenas, sem blobs | Milhares de documentos ≈ poucos MB |
| Edge Functions | Duas funções, chamadas curtas | Uma invocação por arquivo |
| IA | R$ 0 no MVP | — |
| Cota da API do Drive | Por usuário/projeto | Backoff exponencial + cache de pastas |

O custo marginal por escritório novo é essencialmente **linhas no Postgres**. O
armazenamento, que é o item que normalmente domina o custo de um produto de
documentos, foi empurrado para o cliente — que já paga por ele de qualquer forma.

Um limite a observar quando o produto crescer: a cota da API do Drive é contada
por projeto do Google Cloud somando todos os escritórios. Não é problema no MVP,
mas entra no radar em algumas dezenas de escritórios ativos — a mitigação é
`noradocs_drive_folders` (cache que evita listar o Drive a cada arquivo) e limite
de concorrência por tenant, ambos já previstos.

---

## 7. Riscos que a investigação levantou

| Risco | Severidade | Resposta |
|-------|-----------|----------|
| CORS bloquear o `PUT` do navegador para a sessão resumable | **Alta** — é premissa do desenho | Spike na Etapa 0, antes de qualquer código. Dois planos B em §3.2 |
| Concessão do Picker não valer para o refresh token do servidor | **Alta** | Mesmo spike |
| Estrutura legada duplicada por invisibilidade do conteúdo existente | **Alta** — silenciosa | Caminho A por padrão + mapeamento por cliente (§2.3). Avisar na tela de conexão, não no contrato |
| Revogar token derrubar todos os escopos do client | Média | Texto explícito no botão "Desconectar" |
| Regras determinísticas terem cobertura baixa no início | Média | Esperado. Documento sem match vai para "Revisar" — a fila revela quais regras faltam. Regra aprendida a partir da correção |
| Sessão resumable expirar (≈1 semana) | Baixa | Sessão é criada e consumida em segundos |
| Apps Script 50 MB (Etapa 2) | Baixa | Acima do limite de anexo do Gmail |

---

## Fontes

- [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Overview of the Google Picker](https://developers.google.com/workspace/drive/picker/guides/overview)
- [Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)
- [Upload file data (resumable)](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Perform resumable uploads — Cloud Storage](https://docs.cloud.google.com/storage/docs/performing-resumable-uploads)
- [Scopes | Google Workspace add-ons](https://developers.google.com/workspace/add-ons/concepts/workspace-scopes)
- [Triggers for Google Workspace add-ons](https://developers.google.com/workspace/add-ons/concepts/workspace-triggers)
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Security Assessment (CASA) — Google Cloud Console Help](https://support.google.com/cloud/answer/13465431)
- [App review process — Google Workspace Marketplace](https://developers.google.com/workspace/marketplace/about-app-review)
- [Quotas for Google Services — Apps Script](https://developers.google.com/apps-script/guides/services/quotas)
- [Secure Google Drive Picker: Token Best Practices](https://dev.to/googleworkspace/secure-google-drive-picker-token-best-practices-43al)
