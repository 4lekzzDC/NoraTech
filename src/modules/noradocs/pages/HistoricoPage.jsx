import NoraDocsLayout from '../components/NoraDocsLayout';
import EtapaPendente from '../components/EtapaPendente';

export default function HistoricoPage() {
  return (
    <NoraDocsLayout
      title="Histórico"
      subtitle="Todos os documentos já processados, com a trilha completa de cada um."
    >
      <EtapaPendente
        etapa="Etapa 7"
        entrega="Trilha de eventos por documento."
        itens={[
          'Filtros por cliente, competência, categoria, período e status',
          'Linha expandida com o histórico append-only e o link do arquivo no Drive',
          'Sinalização quando o arquivo foi movido à mão no Drive',
        ]}
      />
    </NoraDocsLayout>
  );
}
