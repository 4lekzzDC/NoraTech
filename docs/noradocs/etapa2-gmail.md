# Etapa 2 — a entrada pelo Gmail

Desenho da automação da entrada de documentos. O MVP provou o caminho
`arquivo → regras → pasta`; esta etapa tira o download manual do meio.

Decisões de plataforma já investigadas e fechadas em `integracao-google.md` §4.
Aqui está o que se constrói, e as três decisões novas que esta etapa exige.

---

## 1. O que muda para o contador

Hoje: abre o e-mail → baixa o anexo → vai ao NoraDocs → arrasta o arquivo.

Depois: abre o e-mail → clica em **Arquivar no NoraDocs**, no painel lateral do
Gmail. O anexo vai direto para a pasta certa do Drive do escritório.

**Um e-mail por vez, o aberto.** Não há multisseleção — e não é limitação de
implementação, é da plataforma de complementos do Gmail: os gatilhos contextuais
disparam para a mensagem aberta e não existe API que devolva as marcadas na
lista (`integracao-google.md` §4.2, confirmado). A extensão Chrome teria
multisseleção, ao custo de auditoria CASA anual ou de raspagem de HTML não
documentado. Não vale para este produto.

---

## 2. Decisão nova nº 1 — como o complemento prova de que escritório é

O complemento roda na conta Google do contador. O NoraDocs autentica por sessão
Supabase. São duas identidades que não se falam, e o Apps Script não tem acesso
à sessão do navegador.

**Token de conexão por escritório.** Gerado em Configurações, mostrado **uma
vez**, colado no complemento na primeira utilização. Guardamos só o hash
SHA-256; o token em claro nunca é gravado nem pode ser recuperado — só
revogado e substituído.

O que limita o estrago se vazar: **o token é de escrita, e só de entrada.** Ele
autoriza uma única coisa — acrescentar um documento à caixa de entrada daquele
escritório. Não lê documento, não lista cliente, não apaga nada, não devolve
nem o nome da pasta raiz. Quem tiver o token consegue, no pior caso, empurrar
lixo para a fila de revisão de um escritório — visível, rastreável na trilha e
descartável em massa.

```
noradocs_inbound_tokens
  tenant_company_id   uuid
  token_hash          text     -- sha-256; o token em claro não existe aqui
  label               text     -- "Gmail do João", para o contador saber qual revogar
  created_by          uuid
  last_used_at        timestamptz
  revoked_at          timestamptz
```

A Edge Function `noradocs-inbound` roda com `verify_jwt: false` — o token *é* a
autenticação. É a única função do produto assim, e por isso é a que precisa de
teto de requisições por escritório e de recusa a anexo acima do limite antes de
ler o corpo.

> **Alternativa descartada:** o `ScriptApp.getIdentityToken()` do Apps Script
> provaria qual conta Google está usando o complemento, mas o usuário do
> NoraDocs não é necessariamente autenticado por Google — casar por e-mail seria
> um vínculo frágil e silenciosamente errado quando o contador usa um e-mail
> pessoal no Gmail e outro no NoraTech.

---

## 3. Decisão nova nº 2 — onde a classificação roda

No MVP ela roda no navegador: o arquivo já está lá, `pdfjs` extrai o texto, as
regras decidem. Pelo Gmail não há navegador nenhum no caminho.

**A classificação passa a rodar na Edge Function**, reaproveitando
`domain/*.js` — que é código puro, sem React e sem Supabase, exatamente para
poder rodar nos dois lugares. Os arquivos vão junto no pacote da função, lidos
de `src/` no momento do deploy, e o `RULES_VERSION` gravado em
`noradocs_classification_runs` torna qualquer defasagem visível em vez de
silenciosa.

**Sem texto de PDF nesta etapa.** Levar `pdfjs` para o Deno é peso e risco que
não se pagam agora, porque o e-mail traz um sinal que o upload manual não tem:
**o remetente**. `financeiro@padariaaurora.com.br` identifica o cliente melhor
que qualquer nome de arquivo. O motor já sabe usá-lo — `match_type:
'email_sender'` está no schema e no `casaRegra()` desde o início, só nunca
recebeu sinal.

Sinais na entrada por e-mail, em ordem de força:

| Sinal | De onde vem |
|---|---|
| CNPJ/CPF válido | nome do arquivo, assunto, corpo do e-mail |
| Regra `email_sender` do escritório | endereço do remetente |
| Domínio do remetente ↔ apelido do cliente | `@padariaaurora.com.br` |
| Competência | assunto, nome do arquivo, data do e-mail |
| Categoria | palavras-chave no assunto e no nome |

XML de NFe é caso à parte e fácil: o CNPJ está no XML em texto puro, sem
precisar de biblioteca alguma.

Documento que ficar duvidoso pelo caminho do e-mail continua reprocessável pelo
navegador **com** texto de PDF — o botão *Tentar novamente* já existe e já faz
isso. O caminho fraco tem um caminho forte atrás dele.

---

## 4. Decisão nova nº 3 — a empresa que não está cadastrada

O pedido: arquivar mesmo assim, numa pasta daquela empresa, marcada como *em
verificação*.

O risco de fazer isso ingenuamente: o nome vem de um palpite (domínio do
remetente, assinatura, assunto). "Padaria Aurora", "PADARIA AURORA LTDA" e
"Aurora Panificação" viram três pastas irmãs das pastas de clientes reais, e
juntá-las depois é trabalho manual dentro do Drive — exatamente o operacional
que o produto existe para eliminar.

**O provisório é o cliente, não o documento.** `noradocs_clients` ganha
`status: 'provisorio' | 'confirmado'`. O caminho do e-mail, ao não reconhecer
ninguém, cria um cliente provisório com o nome detectado e arquiva normalmente
por baixo dele. O resto do pipeline não muda em nada.

Cliente provisório mora sob uma raiz separada:

```
Raiz do escritório/
├── Silva Comércio ME/        ← clientes confirmados
├── Padaria Aurora/
└── _verificação/             ← clientes provisórios
    └── Aurora Panificação/
        └── 2026/2026-08/Notas fiscais/
```

Por que raiz separada, e não ao lado dos confirmados: a árvore de clientes é o
arquivo oficial do escritório. Nada entra nela por palpite. E como o provisório
está todo sob um teto só, o contador vê de relance o que está pendente, em vez
de descobrir pastas estranhas no meio das de verdade.

**Confirmar é uma ação, não uma migração.** Em Clientes, a seção *Em
verificação* lista os provisórios. Confirmar (preencher o CNPJ) ou fundir com um
cliente existente move a pasta de `_verificação/` para a árvore real — mover no
Drive é trocar o pai, o arquivo mantém id, link e histórico. Os documentos
seguem apontando para o mesmo `client_id`; nada é reprocessado.

---

## 5. O que se constrói, em ordem

| | Entrega | Pronto quando |
|---|---|---|
| **E10** | `noradocs_inbound_tokens`, cliente provisório, raiz `_verificação`; tela de tokens em Configurações | O escritório gera, vê e revoga um token |
| **E11** | Edge Function `noradocs-inbound`: valida token, classifica com `domain/*`, cria provisório se preciso, envia ao Drive | Um `curl` com anexo cai na pasta certa e aparece na caixa de entrada |
| **E12** | Seção *Em verificação* em Clientes: confirmar, fundir, mover a pasta | Confirmar um provisório move a pasta e some da seção |
| **E13** | O complemento Apps Script: cartão no painel do Gmail, primeiro uso com o token, botão de arquivar | Contador arquiva um anexo sem sair do Gmail |
| **E14** | Publicação no Workspace Marketplace | Complemento instalável por outro escritório |

E11 é o coração e dá para exercitar inteiro por `curl`, sem depender do
complemento nem de revisão de loja. E13 vira, então, uma casca fina sobre algo
já provado.

---

## 6. Riscos

- **O token é credencial portadora.** Mitigado por ser de escrita e só de
  entrada, revogável, com rótulo, teto de requisições e `last_used_at` visível.
- **Classificação mais fraca sem texto de PDF.** Aceito conscientemente: o
  remetente compensa, e o reprocessamento pelo navegador é a rede de segurança.
  Se na prática não compensar, a resposta é `pdfjs` no Deno — não IA.
- **Proliferação de provisórios.** Se o escritório receber de muitas empresas
  não cadastradas, `_verificação` vira depósito. O sinal a observar é a seção
  crescer sem parar; a resposta é fundir por domínio de remetente, não afrouxar
  a criação.
- **Revisão do Workspace Marketplace.** Gratuita e manual, mas com prazo fora do
  nosso controle. Por isso é a última etapa, e o produto funciona sem ela em
  instalação privada do domínio.
