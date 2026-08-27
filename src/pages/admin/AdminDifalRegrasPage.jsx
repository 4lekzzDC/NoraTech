// Base global das regras de NCM do DIFAL — o admin da plataforma cadastra
// aqui, e vale para qualquer escritório que não tenha ajuste próprio.
//
// Casca fina: todo o CRUD, a importação de planilha e a prévia de como a
// UF fica para o motor moram em `GerenciadorRegrasNcm.jsx`, compartilhado
// com a tela de ajuste por escritório dentro de Soluções Contábeis.
import AdminLayout from '../../components/AdminLayout';
import GerenciadorRegrasNcm from '../../modules/solucoes-contabeis/sistemas/difal/GerenciadorRegrasNcm';

export default function AdminDifalRegrasPage() {
  return (
    <AdminLayout title="Regras de DIFAL" subtitle="Base compartilhada de alíquotas por NCM, usada pela Calculadora de DIFAL de todos os escritórios.">
      <GerenciadorRegrasNcm
        escopo="global"
        tenantCompanyId={null}
        titulo="Base global"
        descricao="Vale para qualquer escritório que ainda não tenha cadastrado um ajuste próprio para esta UF. Uma correção aqui é sentida por todo mundo — confira o fundamento antes de salvar."
      />
    </AdminLayout>
  );
}
