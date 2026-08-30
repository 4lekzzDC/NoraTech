// Registro de "configurações internas" por ferramenta — a chave é o slug da
// ferramenta em `hub_module_ferramentas`. Uma ferramenta sem entrada aqui
// simplesmente não tem aba de configuração interna: só nome/ícone/descrição
// (a "visualização"), como qualquer outra.
//
// Deliberadamente fora do banco: o painel em si é código de verdade (ex.: o
// CRUD de regras de NCM), não um dado que caiba em uma tabela de catálogo.

import GerenciadorRegrasNcm from '../../../modules/solucoes-contabeis/sistemas/difal/GerenciadorRegrasNcm';

export const PAINEIS_INTERNOS = {
  'calculadora-difal': {
    aba: 'Regras de DIFAL',
    Componente: function PainelRegrasDifal() {
      return (
        <GerenciadorRegrasNcm
          escopo="global"
          tenantCompanyId={null}
          titulo="Base global"
          descricao='Vale para qualquer escritório que ainda não tenha cadastrado um ajuste próprio para esta UF. Uma correção aqui é sentida por todo mundo — confira o fundamento antes de salvar.'
        />
      );
    },
  },
};

export function painelInternoDe(ferramentaSlug) {
  return PAINEIS_INTERNOS[ferramentaSlug] || null;
}
