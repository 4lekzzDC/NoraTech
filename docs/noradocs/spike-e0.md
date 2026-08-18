# Spike E0 — validação das premissas de upload direto

> Executado em 18/08/2026, antes de qualquer código do NoraDocs.
> Duas perguntas travavam o desenho da arquitetura. Uma está respondida; a outra
> precisa de um teste manual com um projeto Google real.

---

## Pergunta 1 — o navegador consegue fazer `PUT` na sessão resumable do Drive?

**Resposta: SIM.** ✅

### O teste

Preflight CORS contra o endpoint de upload do Drive, simulando exatamente o que
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

**Resposta: pendente de teste manual.** ⏳

Não é validável sem um projeto no Google Cloud com tela de consentimento
configurada e um usuário real consentindo. Fica como a primeira tarefa da
**Etapa 3**, antes de a tela de conexão ser construída.

### O raciocínio, enquanto não há teste

A concessão do `drive.file` é registrada pela tripla **(client ID, usuário,
arquivo)**. Nem o Picker nem o fluxo de código criam identidades separadas: se
os dois usarem o mesmo `client_id` e a mesma conta Google, o arquivo concedido
via Picker deve ser alcançável por qualquer token daquele par — inclusive o
emitido a partir do refresh token guardado no servidor.

O risco real não é o modelo de permissão, é **erro de conta**: o admin consente
com uma conta e opera o Picker logado em outra. Por isso a conferência de
igualdade de conta é requisito da tela de conexão, não item de polimento.

### Procedimento do teste (Etapa 3)

1. Criar o projeto no Google Cloud, ativar Drive API e Picker API, configurar a
   tela de consentimento com o escopo `drive.file`.
2. No navegador: consentir com `access_type=offline` e guardar o refresh token.
3. Ainda no navegador, com a **mesma conta**, abrir o Picker e escolher uma pasta.
4. **No servidor**, trocar o refresh token por um access token novo e chamar
   `files.create` com `parents: [<id da pasta escolhida>]`.
5. Sucesso = a premissa está confirmada. `404` ou `403` = ver plano B.

**Plano B**, se falhar: em vez de o escritório escolher uma pasta existente, o
NoraDocs **cria** a própria pasta raiz (`files.create` no servidor). Pasta criada
pelo app é acessível ao app por definição, sem depender do Picker. Perde-se a
escolha de onde a raiz fica; ganha-se independência da concessão do Picker. O
modo "mapeamento por cliente" cairia junto, e a estrutura legada passaria a ser
tratada só por migração manual.

---

## Efeito no plano

Nenhuma etapa muda de ordem. A E0 segue para a fundação do módulo, e a validação
da Pergunta 2 vira a primeira tarefa da E3 — que é onde a tela de conexão nasce,
e o único ponto onde a resposta muda alguma linha de código.
