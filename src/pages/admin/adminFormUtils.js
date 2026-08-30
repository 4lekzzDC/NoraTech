// Funções puras compartilhadas pelas telas de admin que editam o catálogo
// de sistemas/módulos — separadas de adminFormHelpers.jsx (que só exporta
// componentes) porque misturar os dois quebra o fast-refresh do Vite.

export function slugify(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateLogoFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type))
    return 'Use PNG, JPG, SVG ou WebP.';
  if (file.size > 3 * 1024 * 1024) return 'Imagem acima de 3 MB.';
  return null;
}
