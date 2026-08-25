import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import.meta.url em vez de process.cwd(): o config roda em contexto ESM e
// `process` não está declarado no lint deste projeto.
const m = (arquivo) => new URL(`./.preview/${arquivo}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  server: { port: 5199 },
  // Valores de fachada: o cliente real chega a ser construído (alguns módulos
  // o importam por caminhos que o alias não pega), mas nunca é chamado — os
  // serviços estão todos dublados.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://localhost:9/preview'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('preview-anon-key'),
  },
  resolve: {
    alias: [
      { find: /.*\/lib\/supabase$/, replacement: m('supabase.js') },
      // Os módulos DENTRO de src/lib/ importam o vizinho como './supabase', que
      // não casa com o padrão acima — e aí a preview acabava usando o cliente
      // real, tentando falar com a URL de fachada. Só existe um supabase.js no
      // projeto, então casar o caminho relativo não tem como pegar outro alvo.
      { find: /^\.\/supabase$/, replacement: m('supabase.js') },
      { find: /.*\/lib\/subscriptions$/, replacement: m('subscriptions.js') },
      { find: /.*\/services\/settings\.service$/, replacement: m('settings.service.js') },
      { find: /.*\/services\/categories\.service$/, replacement: m('categories.service.js') },
      { find: /.*\/services\/inbound\.service$/, replacement: m('inbound.service.js') },
      { find: /.*\/services\/clients\.service$/, replacement: m('clients.service.js') },
      { find: /.*\/services\/verificacao\.service$/, replacement: m('verificacao.service.js') },
      { find: /.*\/services\/documents\.service$/, replacement: m('documents.service.js') },
      { find: /.*\/services\/review\.service$/, replacement: m('review.service.js') },
      { find: /.*\/services\/googleDrive\.service$/, replacement: m('googleDrive.service.js') },
      { find: /.*\/services\/tenant$/, replacement: m('tenant.js') },
      { find: /.*\/services\/upload\.service$/, replacement: m('upload.service.js') },
    ],
  },
});
