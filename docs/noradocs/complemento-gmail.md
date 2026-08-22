# Complemento do Gmail — instalação e implantação

O complemento vive num projeto Apps Script na **sua** conta Google. O código
está em `addon/`; a criação do projeto, a colagem e a implantação são feitas no
navegador, e ninguém consegue fazê-las por você.

Leva uns 15 minutos na primeira vez.

---

## O que o complemento faz

Abre no painel lateral do Gmail, sobre o e-mail que você abriu. Mostra os
anexos, você marca os que quer e clica em **Arquivar no NoraDocs**. Os arquivos
vão direto para a pasta certa do Drive do escritório.

**Um e-mail por vez, o que estiver aberto.** Não existe multisseleção na
plataforma de complementos do Gmail — os gatilhos disparam para a mensagem
aberta e não há API que devolva as marcadas na lista.

---

## O que ele acessa, e o que não acessa

| Escopo | O que dá | Exige auditoria? |
|---|---|---|
| `gmail.addons.current.message.readonly` | Só a mensagem aberta, e só enquanto o painel roda | Não. Sensível, não restrito — verificação gratuita |
| `gmail.addons.execute` | Rodar o complemento | Não |
| `script.external_request` | Chamar o NoraDocs | Não. Não sensível |

**Não há escopo do Drive.** O complemento não pede acesso ao seu Drive nem ao
do escritório. Os bytes vão para uma URL de sessão que o NoraDocs emite,
autorizada para aquele arquivo naquela pasta e para mais nada.

**Não há leitura da caixa de entrada.** Nenhum monitoramento, nenhuma varredura,
nenhum "ler todos os e-mails". O complemento só enxerga o que você abriu.

**São três escopos, e nenhum a mais.** Se o Gmail pedir permissão para algo fora
desta lista — `script.locale`, por exemplo —, é sinal de que o manifesto colado
no Apps Script está desatualizado, não de que o complemento precisa daquilo.

---

## Passo a passo

### 1. Gerar o token de entrada

No NoraDocs: **Configurações → Entrada pelo Gmail → Gerar token**. Dê um nome
que diga de quem é ("Gmail do João").

O token aparece **uma única vez**. Copie antes de fechar — ele não é
recuperável, só revogável e substituível.

### 2. Criar o projeto Apps Script

1. Abra <https://script.google.com> e clique em **Novo projeto**.
2. Renomeie para `NoraDocs` (canto superior esquerdo).
3. Cole o conteúdo de `addon/Codigo.gs` no editor, substituindo o `myFunction`
   que vem por padrão.
4. **Confira a primeira linha de configuração.** `NORADOCS_URL` precisa apontar
   para o seu projeto Supabase:
   ```js
   var NORADOCS_URL = 'https://SEU-PROJETO.supabase.co/functions/v1/noradocs-inbound';
   ```
5. Clique na engrenagem (**Configurações do projeto**) e marque
   **"Mostrar arquivo de manifesto appsscript.json no editor"**.
6. Volte ao editor, abra `appsscript.json` e substitua tudo pelo conteúdo de
   `addon/appsscript.json`.
7. Salve.

> O `logoUrl` no manifesto é um ícone genérico do Google. Troque pela URL de um
> logotipo da NoraTech hospedado publicamente antes de publicar para outros
> escritórios — é o ícone que aparece na barra lateral do Gmail.

### 3. Implantar para você mesmo (teste)

1. **Implantar → Testar implantações**.
2. Em *Selecionar tipo*, escolha **Complemento do Google Workspace**.
3. Clique em **Instalar** e depois em **Concluído**.
4. Recarregue o Gmail (F5). O ícone do NoraDocs aparece na barra lateral direita.

### 4. Conectar

1. Abra um e-mail qualquer e clique no ícone do NoraDocs.
2. O Google vai pedir autorização na primeira vez — aceite.
3. Cole o token gerado no passo 1 e clique em **Conectar**.
4. Abra um e-mail **com anexo**. Os arquivos aparecem marcados; clique em
   **Arquivar no NoraDocs**.

O resultado aparece linha a linha:

```
✓ extrato_itau_08-2026.pdf → Silva Comércio ME/2026/2026-08/Extratos bancários
⚠ nota-sem-data.pdf → _triagem (aguarda revisão)
• boleto.pdf — Já recebido antes como "boleto.pdf", arquivado em …
```

`✓` foi para a pasta final · `⚠` precisa de revisão na caixa de entrada ·
`•` já existia, nada foi duplicado.

---

## Instalar para o escritório inteiro

Duas formas:

**Cada pessoa instala a sua.** Compartilhe o projeto Apps Script com a conta
dela (botão *Compartilhar*), ela repete os passos 3 e 4 com **o token dela**.
Simples, e cada token é revogável separadamente.

**O administrador instala para o domínio.** Requer publicar no Google Workspace
Marketplace (mesmo que como app privado do domínio) — é a etapa E14, ainda não
feita. Enquanto isso, a instalação por pessoa funciona igual.

---

## Quando algo dá errado

| O que aparece | O que é | O que fazer |
|---|---|---|
| "Token de entrada inválido ou revogado" | O token foi revogado, ou colado errado | Gere outro em Configurações e reconecte |
| "O token deve começar com ndin_" | Faltou parte do texto ao copiar | Copie o token inteiro |
| "Limite de entrada por hora atingido" | Mais de 300 documentos numa hora | Espere; se não foi você, revogue o token |
| "A conexão do escritório com o Google expirou" | O Drive do escritório precisa reconectar | Configurações → reconectar o Google |
| "maior que 25 MB" | Anexo grande demais | Baixe e envie pela caixa de entrada |
| O ícone não aparece no Gmail | A implantação de teste não foi instalada | Repita o passo 3 e recarregue o Gmail |
| "O script não tem permissão… Permissões necessárias: …/auth/script.locale" | O `appsscript.json` colado é uma versão antiga, que tinha `useLocaleFromApp` | Recole o `addon/appsscript.json` atual (a opção foi removida), salve e reimplante |
| "enviado, mas o registro falhou" | O arquivo chegou ao Drive; o NoraDocs não soube | O documento fica em erro na caixa de entrada, com *Tentar novamente* |

**Onde olhar:** no Apps Script, **Execuções** (menu lateral) mostra cada
chamada, com erro e log. No NoraDocs, a aba **Erro** da caixa de entrada mostra
o que não foi arquivado e por quê.

---

## Revogar o acesso

- **De uma pessoa:** NoraDocs → Configurações → Entrada pelo Gmail → **Revogar**
  no token dela. O complemento dela para de funcionar na hora; os outros
  continuam.
- **Do complemento na sua conta:** no painel do NoraDocs no Gmail, botão
  **Desconectar** — apaga o token só daquele dispositivo/conta.
- **Da autorização Google:** <https://myaccount.google.com/permissions>.

Revogar um token não apaga nada do que já foi arquivado.

---

## Manutenção

O `sha256Hex` do complemento é uma reimplementação do `domain/hash.js` — o
Apps Script não importa módulo do repositório. As duas precisam concordar, ou
a deduplicação deixa de reconhecer o mesmo arquivo vindo do Gmail e do upload
manual, silenciosamente.

`src/modules/noradocs/domain/hash-no-complemento.test.js` guarda isso: lê o
`addon/Codigo.gs`, executa a função dentro de um dublê do Apps Script (com os
bytes com sinal que ele devolve de verdade) e compara com a implementação do
navegador. Roda no `npm test`.

Ao mudar o `addon/Codigo.gs`, lembre que o editor do Apps Script tem a **sua**
cópia: o repositório é a fonte, mas nada sincroniza sozinho. Cole de novo e
reimplante.
