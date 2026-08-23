const cats = [
  { id: 'k1', nome: 'Extratos bancários', ordem: 0, ativo: true, keywords: ['extrato', 'conta corrente'] },
  { id: 'k2', nome: 'Notas fiscais', ordem: 1, ativo: true, keywords: ['nfe', 'danfe'] },
  { id: 'k3', nome: 'Folha', ordem: 2, ativo: false, keywords: ['holerite'] },
];
let seq = 4;

export const listCategories = async () => [...cats].sort((a, b) => a.ordem - b.ordem);

export const createCategory = async (_tenantId, nome) => {
  const proximaOrdem = Math.max(-1, ...cats.map((c) => c.ordem)) + 1;
  const nova = { id: `k${seq++}`, nome, ordem: proximaOrdem, ativo: true, keywords: [] };
  cats.push(nova);
  return nova;
};

export const updateCategory = async (id, patch) => {
  const cat = cats.find((c) => c.id === id);
  if (cat) Object.assign(cat, patch);
  return cat;
};

export const deleteCategory = async (id) => {
  const i = cats.findIndex((c) => c.id === id);
  if (i !== -1) cats.splice(i, 1);
};
