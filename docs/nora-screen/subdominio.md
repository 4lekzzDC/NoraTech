# Nora Screen em `transmissao.noratech.com.br`

O Nora Screen continua no mesmo projeto e no mesmo deploy da NoraTech. O
que muda é o endereço público: quem usa o produto vê o subdomínio, e não
`noratech.com.br/transmissao`.

## Por que a troca de endereço não é um rewrite do Vercel

A intuição natural é resolver isso com um rewrite por hostname no
`vercel.json`:

```jsonc
// NÃO faz o que parece
{ "source": "/", "has": [{ "type": "host", "value": "transmissao.noratech.com.br" }],
  "destination": "/transmissao" }
```

Num app de página única isso não funciona, e é importante entender por
quê antes de alguém tentar de novo.

O rewrite do Vercel decide **qual arquivo o servidor entrega**. Como
`/transmissao` não é um arquivo, ele cai no mesmo `index.html` de sempre
— exatamente o que o catch-all já fazia. O navegador continua exibindo
`transmissao.noratech.com.br/`, e quem lê esse caminho e escolhe a tela é
o React Router, dentro do navegador. Ou seja: o rewrite troca o arquivo,
mas o roteador nunca fica sabendo. O resultado seria a landing
institucional aparecendo no subdomínio.

Por isso a reescrita mora no roteador:

| host                          | URL visível        | tela              |
| ----------------------------- | ------------------ | ----------------- |
| `transmissao.noratech.com.br` | `/`                | home do Nora Screen |
| `transmissao.noratech.com.br` | `/sala/CODIGO`     | sala              |
| `noratech.com.br`             | `/transmissao`     | home do Nora Screen |
| `noratech.com.br`             | `/transmissao/sala/CODIGO` | sala      |

A decisão está em `src/modules/nora-screen/constants.js`
(`ehHostDoNoraScreen`, `NO_SUBDOMINIO`, `noraScreenRoute`) e as rotas do
subdomínio em `src/modules/nora-screen/RotasDoSubdominio.jsx`.

O `vercel.json` precisa apenas do catch-all de SPA que já existe — ele
vale para qualquer host, e é o que faz `transmissao.noratech.com.br/sala/ABCD-1234`
ser servido em vez de dar 404 num refresh.

## Configurar o domínio no Vercel

Projeto: **noratech** (`prj_BYuipOXtRRIPvFDmliNqscvliPoh`), time
`alemarin2k20-3816s-projects`. Não mexer em `noratech.com.br` nem em
`www.noratech.com.br`.

1. Vercel → projeto **noratech** → *Settings* → *Domains* → *Add Domain*
2. Informar `transmissao.noratech.com.br`
3. Escolher **No redirect** (o subdomínio serve o app, não redireciona)
4. No DNS de `noratech.com.br`, criar:

   ```
   CNAME   transmissao   cname.vercel-dns.com.
   ```

5. Esperar a verificação do Vercel e o certificado ser emitido

Nenhuma variável de ambiente nova é necessária: o produto usa o mesmo
Supabase e a mesma build.

## Compatibilidade durante a validação

As rotas antigas continuam inteiras de propósito:

- `noratech.com.br/transmissao` e `/transmissao/sala/CODIGO` seguem
  funcionando normalmente;
- no subdomínio, quem chegar por `/transmissao/sala/CODIGO` (link antigo
  já compartilhado) é levado a `/sala/CODIGO` sem trocar de host;
- os dois endereços entram na **mesma sala**: o canal de sinalização é
  `nora-screen:CODIGO`, derivado do código e não do caminho. Uma pessoa
  no subdomínio e outra no domínio principal se veem e trocam vídeo
  normalmente.

O link de convite sai sempre no host de quem convida.

## Depois da validação: aposentar `/transmissao`

Quando o subdomínio estiver validado em produção e não se quiser mais
expor a URL antiga, basta um redirect no `vercel.json` (aí sim o Vercel
resolve, porque é uma troca de URL visível, não de roteamento interno):

```json
{
  "redirects": [
    {
      "source": "/transmissao/:caminho*",
      "has": [{ "type": "host", "value": "noratech.com.br" }],
      "destination": "https://transmissao.noratech.com.br/:caminho*",
      "permanent": true
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Só fazer isso depois da validação: um `permanent: true` fica em cache no
navegador das pessoas e é chato de desfazer. Vale começar com
`permanent: false` por alguns dias.
