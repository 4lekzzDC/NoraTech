# Spike E0 — validação das premissas de upload direto

> Executado em 18/08/2026, antes de qualquer código do NoraDocs.
> Duas perguntas travavam o desenho da arquitetura. **Atualização (Etapa 3):**
> a segunda deixou de precisar de teste manual — o desenho da implementação
> mudou para resolvê-la por construção. Ver nota no fim desta seção.

---

## Pergunta 1 — o navegador consegue fazer `PUT` na sessão resumable do Drive?

**Resposta original: SIM.** ❌ **Errada — corrigida na Etapa 6.**

> ### Correção (Etapa 6)
>
> O teste abaixo mediu o host errado, e a conclusão não vale.
>
> O endpoint de **iniciação** (`?uploadType=resumable`, sem `upload_id`) é
> servido pelo front-end genérico das APIs do Google (`server: ESF`), que
> responde CORS. Mas a **URL de sessão** que o Google devolve depois — a que o
> navegador de fato chama, com `&upload_id=...` — é servida por outro host
> (`server: UploadServer`), e esse **não devolve cabeçalho CORS nenhum**. O
> `PUT` do navegador morre em `Failed to fetch`, sem detalhe algum.
>
> ```
> OPTIONS .../files?uploadType=resumable                  → 200, ESF           CORS presente
> OPTIONS .../files?uploadType=resumable&upload_id=...    → 404, UploadServer  CORS AUSENTE
> OPTIONS .../files?uploadType=multipart  (authorization) → 200, ESF           CORS presente
> ```
>
> **A lição de método:** testar o endpoint que *inicia* o fluxo não é testar o
> endpoint que o fluxo *usa*. Um spike que não percorre o caminho real até o
> fim mede outra coisa — e dá uma confiança que não foi conquistada. O erro só
> apareceu quando um arquivo de verdade foi enviado, três etapas depois.
>
> **O que foi feito:** o upload passou a usar `uploadType=multipart`, que a
> terceira linha da tabela mostra ser servido pelo ESF e aceitar
> `authorization`. Isso é o **Plano B nº 1** já previsto abaixo — token
> efêmero no navegador. Os bytes continuam indo direto ao Google, sem passar
> por servidor da NoraTech; o que se cede é um token de 1h, limitado a
> `drive.file`, na memória do navegador de um funcionário já autenticado. O
> refresh token continua exclusivamente no servidor.
>
> **Custo colateral:** multipart é envio de uma tacada só, sem retomada — daí
> o teto de 25 MB por arquivo, com recusa explícita acima disso.

### O teste que foi feito (e o que ele realmente mediu)

Preflight CORS contra o endpoint de **iniciação** do upload do Drive, simulando exatamente o que
o navegador enviaria antes de um `PUT` com corpo:

```bash
curl -i -X OPTIONS \
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable" \
  -H "Origin: https://noratech.com.br" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type,content-range"
```

### A resposta

```
HTTP/2 200
access-control-allow-origin:  https://noratech.com.br
access-control-allow-methods: DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT
access-control-allow-headers: content-type,content-range
access-control-max-age:       3600
vary: origin
server: ESF
```

O preflight passa: método `PUT` liberado, cabeçalhos `Content-Type` e
`Content-Range` liberados, e a origem é ecoada de volta (o endpoint não mantém
lista fixa de origens — qualquer `Origin` é aceita, inclusive `localhost` em
desenvolvimento).

A URL de sessão devolvida pelo Drive fica **no mesmo host e caminho**, mudando só
o parâmetro `upload_id`. O preflight acima é, portanto, representativo do que o
navegador fará de verdade.

### Três consequências que viram regra de implementação

**1. Não enviar `Authorization` no `PUT`.** A lista de
`access-control-allow-headers` traz apenas `content-type` e `content-range`. Um
`PUT` com cabeçalho `Authorization` **falharia no preflight**. Isso não é
obstáculo — é confirmação do desenho: a URL de sessão já é a credencial, e o
token do escritório não tem por que estar no navegador.

**2. Upload em uma tacada só, sem fatiar.** A resposta não traz
`access-control-expose-headers`. O navegador consegue enviar, mas **não consegue
ler cabeçalhos de resposta não-simples** — inclusive o `Range`, que é o que o
protocolo usa para descobrir quantos bytes chegaram e retomar de onde parou.

Na prática: `PUT` único com o arquivo inteiro funciona; retomada de upload
interrompido, a partir do navegador, não. Para documentos contábeis — quase todos
abaixo de 10 MB — isso é irrelevante. Se um dia precisar de retomada, o caminho é
a Edge Function consultar o status da sessão pelo servidor, onde não há CORS.

**3. Falha de rede = refazer o upload inteiro.** Decorrência do item 2. O
tratamento de erro deve reenviar do zero, e a deduplicação por hash garante que
uma retentativa não gere documento duplicado no banco.

### O que este teste não prova

Que um `PUT` real, com sessão real e arquivo real, completa com sucesso — isso
depende de token, cota e permissão, e será exercitado naturalmente na Etapa 6.
O que estava em dúvida era o CORS, e o CORS está respondido.

---

## Pergunta 2 — a concessão feita no Picker vale para o refresh token do servidor?

**Resposta original: pendente de teste manual.** Na implementação da Etapa 3,
a pergunta deixou de fazer sentido — o desenho mudou para eliminar o risco em
vez de testá-lo.

### O que mudou

O plano original previa **dois grants independentes**: um consentimento
completo (code flow, com refresh token, feito no back-end) e uma segunda
autenticação do navegador só para o Picker (um token client GIS separado,
implícito). A pergunta era se esses dois grants, feitos em momentos diferentes,
apontavam para o mesmo arquivo depois de escolhido.

A implementação final tem **um grant só**. O Picker nunca autentica o usuário
no Google — ele recebe um `access_token` de curta duração que a Edge Function
`noradocs-drive` obtém **refrescando o mesmo refresh token** guardado na
conexão inicial (ação `picker-token`). Não há uma segunda concessão para
reconciliar com a primeira, porque não existe segunda concessão.

Isso não é só mais simples — é estritamente mais seguro: o navegador nunca
alterna entre logar no NoraDocs e logar no Google, então a possibilidade que
mais preocupava ("o admin consente com uma conta e abre o Picker logado em
outra") deixou de existir. Só há um ponto de escolha de conta: o consentimento
inicial.

### Onde a verificação realmente acontece agora

Não é mais um teste manual prévio — é uma checagem em tempo de execução, a
cada vez que uma pasta raiz é confirmada. `noradocs-drive` (ação
`set-root-folder`) faz `GET /drive/v3/files/{folderId}` com o access token
recém-emitido, **antes** de gravar qualquer coisa em `noradocs_settings`. Se a
pasta escolhida pelo Picker não for alcançável por esse token — o que só
aconteceria se o `client_id` estivesse errado ou a API não estivesse ativada —
a resposta vem `4xx` e a função devolve um erro explícito ao invés de gravar um
estado quebrado. A primeira execução real desse caminho, com um projeto Google
configurado, é o teste que a Pergunta 2 pedia — só que integrado ao fluxo, não
descartável.

---

## Efeito no plano

Nenhuma etapa muda de ordem. A E0 segue para a fundação do módulo, e a validação
da Pergunta 2 vira a primeira tarefa da E3 — que é onde a tela de conexão nasce,
e o único ponto onde a resposta muda alguma linha de código.
