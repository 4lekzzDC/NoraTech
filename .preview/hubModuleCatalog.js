// Dublê do catálogo de módulos do hub — store em memória, sem banco.
// Mesma API que src/lib/hubModuleCatalog.js, seedado com uma cópia da
// estrutura real de produção (Contábil com 4 sub-categorias, Fiscal e
// Pessoal flat, Financeiro/Gestão vazias) pra exercitar o mesmo caminho
// que o cliente e o admin usam de verdade.

let seq = 0;
const proximoId = () => `cat-${++seq}`;

const categorias = [];
const ferramentas = [];

function addCategoria({ slug, name, icon, description, status = 'available', sortOrder = 0, parentId = null }) {
  const c = {
    id: proximoId(), system_slug: 'solucoes-contabeis', slug, name, icon, description,
    status, active: true, sort_order: sortOrder, parent_categoria_id: parentId,
  };
  categorias.push(c);
  return c;
}
function addFerramenta(categoriaId, { slug, name, icon, color = '#7C3AED', description, status = 'available', sortOrder = 0 }) {
  ferramentas.push({
    id: proximoId(), categoria_id: categoriaId, slug, name, icon, color, description,
    status, active: true, sort_order: sortOrder,
  });
}

const contabil = addCategoria({ slug: 'contabil', name: 'Contábil', icon: '📒', description: 'Grade dos módulos contábeis.', sortOrder: 0 });
const extrato = addCategoria({ slug: 'extrato', name: 'Extrato', icon: '🏦', description: 'Codificação, conciliação e transformação de extratos bancários.', parentId: contabil.id, sortOrder: 0 });
const fornecedores = addCategoria({ slug: 'fornecedores', name: 'Fornecedores', icon: '🚚', description: 'Conciliação e controle de pagamentos a fornecedores.', parentId: contabil.id, sortOrder: 1 });
const demonstracoes = addCategoria({ slug: 'demonstracoes', name: 'Demonstrações', icon: '🥧', description: 'Análise de demonstrações contábeis e indicadores financeiros.', parentId: contabil.id, sortOrder: 2 });
const fechamento = addCategoria({ slug: 'fechamento', name: 'Fechamento', icon: '📅', description: 'Controle mensal do fechamento contábil por empresa.', parentId: contabil.id, sortOrder: 3 });
addFerramenta(extrato.id, { slug: 'transformador-extrato', name: 'Transformador de Extrato', icon: '🔄', description: 'Conversão de extratos entre formatos.', sortOrder: 0 });
addFerramenta(extrato.id, { slug: 'codificador', name: 'Codificador de Arquivos', icon: '🔢', description: 'Aplicação de regras e parsing de arquivos contábeis.', sortOrder: 1 });
addFerramenta(extrato.id, { slug: 'conciliador-extratos', name: 'Conciliador de Extratos', icon: '🧮', description: 'Conciliação automática de extratos bancários.', sortOrder: 2 });
addFerramenta(fornecedores.id, { slug: 'conciliador-fornecedores', name: 'Conciliador de Fornecedores', icon: '🤝', description: 'Conciliação de relatórios de fornecedores.', sortOrder: 0 });
addFerramenta(demonstracoes.id, { slug: 'analise-demonstracoes', name: 'Análise de Demonstrações', icon: '📈', description: 'Indicadores financeiros e gráficos analíticos.', sortOrder: 0 });
addFerramenta(fechamento.id, { slug: 'acompanhamento-contabil', name: 'Acompanhamento Contábil', icon: '📊', description: 'Status mensal por empresa: arquivos, conciliação e prazos.', sortOrder: 0 });
addFerramenta(fechamento.id, { slug: 'calculadora-irpj-csll', name: 'Calculadora de IRPJ e CSLL', icon: '🧮', description: 'Apuração trimestral no Lucro Presumido e no Lucro Real.', sortOrder: 1 });

const fiscal = addCategoria({ slug: 'fiscal', name: 'Fiscal', icon: '🧾', description: 'Apuração de tributos e obrigações fiscais.', sortOrder: 10 });
addFerramenta(fiscal.id, { slug: 'calculadora-difal', name: 'Calculadora de DIFAL', icon: '🧾', description: 'Diferencial de alíquota do Simples Nacional, produto a produto, a partir do XML da NF-e.', sortOrder: 0 });

addCategoria({ slug: 'financeiro', name: 'Financeiro', icon: '💸', description: 'Grade dos módulos financeiros.', status: 'soon', sortOrder: 20 });
addCategoria({ slug: 'gestao', name: 'Gestão', icon: '🗂️', description: 'Grade dos módulos de gestão.', status: 'soon', sortOrder: 30 });

const pessoal = addCategoria({ slug: 'pessoal', name: 'Pessoal', icon: '👤', description: 'Gestão de pessoas e processos de RH.', sortOrder: 40 });
addFerramenta(pessoal.id, { slug: 'controle-funcionarios', name: 'Controle dos funcionários', icon: '🪪', description: 'Gerencie admissões, demissões, férias e obrigações trabalhistas dos funcionários.', status: 'soon', sortOrder: 0 });

export async function listarCategorias(systemSlug, { apenasRaiz = false } = {}) {
  return categorias
    .filter((c) => c.system_slug === systemSlug && (!apenasRaiz || c.parent_categoria_id === null))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function listarSubcategorias(parentCategoriaId) {
  return categorias.filter((c) => c.parent_categoria_id === parentCategoriaId).sort((a, b) => a.sort_order - b.sort_order);
}

export async function buscarCategoria(systemSlug, categoriaSlug) {
  return categorias.find((c) => c.system_slug === systemSlug && c.slug === categoriaSlug) || null;
}

export async function salvarCategoria(categoria, id = null) {
  const payload = {
    system_slug: categoria.systemSlug, slug: categoria.slug, name: categoria.name,
    icon: categoria.icon || null, description: categoria.description || null,
    status: categoria.status || 'available', active: categoria.active !== false,
    sort_order: Number(categoria.sortOrder) || 0, parent_categoria_id: categoria.parentCategoriaId || null,
  };
  if (id) {
    const existente = categorias.find((c) => c.id === id);
    Object.assign(existente, payload);
    return existente;
  }
  const nova = { id: proximoId(), ...payload };
  categorias.push(nova);
  return nova;
}

export async function excluirCategoria(id) {
  const i = categorias.findIndex((c) => c.id === id);
  if (i >= 0) categorias.splice(i, 1);
  for (let j = categorias.length - 1; j >= 0; j--) {
    if (categorias[j].parent_categoria_id === id) categorias.splice(j, 1);
  }
  for (let j = ferramentas.length - 1; j >= 0; j--) {
    if (ferramentas[j].categoria_id === id) ferramentas.splice(j, 1);
  }
}

export async function listarFerramentas(categoriaId) {
  return ferramentas.filter((f) => f.categoria_id === categoriaId).sort((a, b) => a.sort_order - b.sort_order);
}

export async function buscarFerramenta(categoriaId, ferramentaSlug) {
  return ferramentas.find((f) => f.categoria_id === categoriaId && f.slug === ferramentaSlug) || null;
}

export async function salvarFerramenta(ferramenta, id = null) {
  const payload = {
    categoria_id: ferramenta.categoriaId, slug: ferramenta.slug, name: ferramenta.name,
    icon: ferramenta.icon || null, color: ferramenta.color || null, description: ferramenta.description || null,
    status: ferramenta.status || 'available', active: ferramenta.active !== false,
    sort_order: Number(ferramenta.sortOrder) || 0,
  };
  if (id) {
    const existente = ferramentas.find((f) => f.id === id);
    Object.assign(existente, payload);
    return existente;
  }
  const nova = { id: proximoId(), ...payload };
  ferramentas.push(nova);
  return nova;
}

export async function excluirFerramenta(id) {
  const i = ferramentas.findIndex((f) => f.id === id);
  if (i >= 0) ferramentas.splice(i, 1);
}

export async function moverFerramenta(id, { categoriaId, sortOrder }) {
  const f = ferramentas.find((x) => x.id === id);
  if (f) { f.categoria_id = categoriaId; f.sort_order = sortOrder; }
}

export async function carregarCategoriaComFerramentas(systemSlug, categoriaSlug) {
  const categoria = await buscarCategoria(systemSlug, categoriaSlug);
  if (!categoria || !categoria.active) return null;
  const lista = await listarFerramentas(categoria.id);
  return { categoria, ferramentas: lista.filter((f) => f.active) };
}

export async function carregarCategoriaComSubcategorias(systemSlug, categoriaSlug) {
  const categoria = await buscarCategoria(systemSlug, categoriaSlug);
  if (!categoria || !categoria.active) return null;
  const [ferramentasDiretas, subs] = await Promise.all([
    listarFerramentas(categoria.id),
    listarSubcategorias(categoria.id),
  ]);
  const subcategorias = await Promise.all(
    subs.filter((s) => s.active).map(async (sub) => ({
      categoria: sub,
      ferramentas: (await listarFerramentas(sub.id)).filter((f) => f.active),
    })),
  );
  return { categoria, ferramentasDiretas: ferramentasDiretas.filter((f) => f.active), subcategorias };
}
