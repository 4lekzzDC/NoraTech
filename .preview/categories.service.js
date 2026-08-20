const cats = [
  { id: 'k1', nome: 'Extratos bancários', ordem: 1, ativo: true, keywords: ['extrato'] },
  { id: 'k2', nome: 'Notas fiscais', ordem: 2, ativo: true, keywords: ['nfe', 'danfe'] },
  { id: 'k3', nome: 'Folha', ordem: 3, ativo: true, keywords: ['holerite'] },
];
export const listCategories = async () => cats;
export const createCategory = async () => {};
export const updateCategory = async () => {};
export const deleteCategory = async () => {};
