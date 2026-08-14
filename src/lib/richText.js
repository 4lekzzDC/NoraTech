// Sanitização do HTML da bio do perfil.
//
// A bio é escrita num contentEditable e guardada como HTML. Como o profile é
// legível pelos colegas de equipe, HTML não sanitizado seria um vetor de XSS:
// bastaria alguém salvar `<img src=x onerror=...>` para executar script no
// navegador de quem abrisse o perfil.
//
// Estratégia: allowlist fechada. Tudo que não estiver explicitamente liberado
// é removido — é o oposto de uma denylist, que sempre deixa buracos (svg,
// math, entidades codificadas, `javascript:` com espaços/quebras no meio...).
//
// Sanitizamos ao salvar E ao renderizar. Só ao salvar não basta: o que já está
// no banco pode ter vindo de outra versão do código ou direto pela API.

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'P', 'BR', 'DIV', 'SPAN',
  'UL', 'OL', 'LI',
  'A',
]);

// Tags cujo conteúdo de texto também deve sumir junto (não só a marcação).
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT']);

function isSafeHref(value) {
  // Tira controles/espaços antes de testar: "java\tscript:" e "JAVASCRIPT:"
  // são a mesma tentativa de burlar o prefixo.
  const v = Array.from(value || '')
    .filter((ch) => ch.charCodeAt(0) > 32)
    .join('')
    .toLowerCase();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:');
}

/**
 * Devolve o HTML contendo apenas tags/atributos da allowlist.
 * Roda no navegador (usa DOMParser); em SSR devolve string vazia.
 */
export function sanitizeBioHtml(html) {
  if (!html || typeof html !== 'string') return '';
  if (typeof DOMParser === 'undefined') return '';

  // DOMParser não executa scripts nem carrega recursos — parsear aqui é seguro.
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return '';

  // Percorre a lista VIVA de filhos, e não um snapshot: ao desembrulhar uma
  // tag não permitida os filhos dela sobem de nível e precisam ser inspecionados
  // também. Com snapshot eles escapavam sem análise — `<form><input onx=...>`
  // perdia o <form> mas entregava o <input> intacto.
  const walk = (node) => {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;

      if (child.nodeType === 3) { child = next; continue; } // texto: ok
      if (child.nodeType !== 1) { child.remove(); child = next; continue; } // comentário, CDATA...

      const tag = child.tagName.toUpperCase();

      if (DROP_WITH_CONTENT.has(tag)) { child.remove(); child = next; continue; }

      if (!ALLOWED_TAGS.has(tag)) {
        // Tag não permitida mas inofensiva (ex.: <h1>): preserva o conteúdo,
        // descarta a marcação — e retoma a partir do conteúdo promovido.
        const promoted = child.firstChild;
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        child.remove();
        child = promoted || next;
        continue;
      }

      // Remove TODOS os atributos e recoloca só o permitido — pega handlers
      // (onerror, onclick), style, srcset, data-* etc. de uma vez só.
      const href = tag === 'A' ? child.getAttribute('href') : null;
      Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
      if (tag === 'A' && href && isSafeHref(href)) {
        child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer nofollow');
      }

      walk(child);
      child = next;
    }
  };

  walk(root);
  return root.innerHTML;
}

/** Texto puro do HTML — usado para contar caracteres e detectar bio vazia. */
export function bioPlainText(html) {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  return (doc.getElementById('root')?.textContent || '').replace(/\s+/g, ' ').trim();
}

export const BIO_MAX_CHARS = 2000;
