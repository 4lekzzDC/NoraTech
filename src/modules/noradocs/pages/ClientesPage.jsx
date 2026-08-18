import NoraDocsLayout from '../components/NoraDocsLayout';
import EtapaPendente from '../components/EtapaPendente';

// As empresas atendidas pelo escritório — não confundir com `companies`, que
// é o escritório em si (o tenant).

export default function ClientesPage() {
  return (
    <NoraDocsLayout
      title="Clientes"
      subtitle="As empresas atendidas pelo escritório. É o que permite identificar de quem é cada documento."
    >
      <EtapaPendente
        etapa="Etapa 2"
        entrega="Cadastro de clientes."
        itens={[
          'CNPJ validado por dígito verificador, usado como sinal principal de identificação',
          'Apelidos alternativos, para casar com o nome do arquivo',
          'Contatos — já servem ao disparador de documentos da etapa seguinte',
          'Importação dos clientes já cadastrados em Soluções Contábeis',
        ]}
      />
    </NoraDocsLayout>
  );
}
