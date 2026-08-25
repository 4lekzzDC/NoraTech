import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

// Guarda de segredos. Roda junto com `npm test`.
//
// A separação que este arquivo protege é a única linha que impede um segredo
// de virar público neste produto:
//
//   VITE_*  → é COMPILADO DENTRO do bundle e servido para o navegador.
//             Qualquer pessoa lê com F12. Só pode carregar valor público.
//   secrets → ficam nos secrets das Edge Functions (Deno.env), nunca no
//             repositório e nunca no .env do front.
//
// O erro que isto pega é sempre o mesmo e é fácil de cometer: alguém precisa
// de uma chave nova no código, copia a linha de cima no .env, e escreve
// `VITE_STRIPE_SECRET_KEY`. Funciona na hora, passa no code review porque a
// linha parece com as outras, e publica a chave secreta da Stripe para o
// mundo no próximo deploy. Sem um teste, nada avisa.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../..');

// As ÚNICAS variáveis que podem chegar ao navegador. Acrescentar uma aqui é
// uma decisão consciente de tornar aquele valor público — é para isso que a
// lista existe, e é por isso que ela é explícita em vez de um padrão como
// "tudo que começa com VITE_".
const PUBLICAS_PERMITIDAS = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ADMIN_EMAIL',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_GOOGLE_OAUTH_CLIENT_ID',
  'VITE_GOOGLE_PICKER_API_KEY',
]);

// Palavras que nunca deveriam aparecer no nome de uma variável exposta ao
// navegador, por mais que o valor pareça inofensivo no momento.
const PALAVRAS_DE_SEGREDO = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|SENHA|CREDENTIAL)/;

const PADROES_DE_SEGREDO = [
  ['chave secreta da Stripe', /\b(sk|rk)_(live|test)_[A-Za-z0-9]{20,}/],
  ['token pessoal do Supabase', /\bsbp_[a-f0-9]{40}\b/],
  ['secret key do Supabase', /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ['client secret do Google', /\bGOCSPX-[A-Za-z0-9_-]{20,}/],
  ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
];

const IGNORAR_PASTAS = new Set(['node_modules', '.git', 'dist', 'coverage', '.preview']);
const EXTENSOES = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.sql', '.html']);

function* arquivos(dir) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR_PASTAS.has(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else if (EXTENSOES.has(extname(nome))) yield caminho;
  }
}

test('nenhuma variável de ambiente fora da lista pública chega ao navegador', () => {
  const encontradas = new Map();
  for (const caminho of arquivos(join(RAIZ, 'src'))) {
    const conteudo = readFileSync(caminho, 'utf8');
    for (const m of conteudo.matchAll(/import\.meta\.env\.([A-Za-z0-9_]+)/g)) {
      if (!encontradas.has(m[1])) encontradas.set(m[1], relative(RAIZ, caminho));
    }
  }

  for (const [nome, onde] of encontradas) {
    // MODE, DEV, PROD e BASE_URL são do próprio Vite, não são configuração nossa.
    if (['MODE', 'DEV', 'PROD', 'BASE_URL', 'SSR'].includes(nome)) continue;

    assert.ok(
      !PALAVRAS_DE_SEGREDO.test(nome),
      `${onde} lê import.meta.env.${nome}. Tudo que é lido assim é compilado `
      + 'dentro do bundle e fica visível para qualquer visitante. Um valor com '
      + 'esse nome pertence aos secrets da Edge Function (Deno.env), não ao .env do front.',
    );

    assert.ok(
      PUBLICAS_PERMITIDAS.has(nome),
      `${onde} lê import.meta.env.${nome}, que não está na lista de variáveis `
      + 'públicas em src/lib/segredos.test.js. Se o valor é mesmo público '
      + '(URL, chave publicável, client id), acrescente o nome à lista. Se for '
      + 'segredo, mova para os secrets da Edge Function.',
    );
  }
});

test('nenhum segredo escrito à mão no repositório', () => {
  const achados = [];
  for (const caminho of arquivos(RAIZ)) {
    const rel = relative(RAIZ, caminho);
    // Este próprio arquivo contém os padrões, por definição.
    if (rel === join('src', 'lib', 'segredos.test.js')) continue;
    const conteudo = readFileSync(caminho, 'utf8');
    for (const [rotulo, rx] of PADROES_DE_SEGREDO) {
      const m = conteudo.match(rx);
      if (m) achados.push(`${rel}: ${rotulo} (${m[0].slice(0, 12)}...)`);
    }
  }
  assert.deepEqual(achados, [], `Segredo encontrado no repositório:\n  ${achados.join('\n  ')}`);
});

test('.env está no .gitignore e não é rastreado', () => {
  const gitignore = readFileSync(join(RAIZ, '.gitignore'), 'utf8');
  const linhas = gitignore.split('\n').map((l) => l.trim());
  assert.ok(
    linhas.includes('.env') || linhas.includes('.env*'),
    'O .gitignore precisa ignorar .env — é o arquivo onde as credenciais reais ficam.',
  );
});

test('o .env.example não carrega valor real, só formato', () => {
  const caminho = join(RAIZ, '.env.example');
  if (!existsSync(caminho)) return;
  const conteudo = readFileSync(caminho, 'utf8');

  for (const [rotulo, rx] of PADROES_DE_SEGREDO) {
    assert.ok(!rx.test(conteudo), `.env.example contém ${rotulo} de verdade. Troque por um placeholder.`);
  }

  // Um JWT completo no .env.example quase sempre é a anon key real colada por
  // engano — e a service_role tem exatamente a mesma forma.
  assert.ok(
    !/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/.test(conteudo),
    '.env.example contém um JWT completo. Deixe só o prefixo (eyJhbGciOiJI...) como exemplo.',
  );
});
