import NoraDocsLayout from '../components/NoraDocsLayout';
import EtapaPendente from '../components/EtapaPendente';

// Tela principal do produto. Densa e tabular por decisão de projeto: existe
// para zerar a fila, não para exibir indicadores.

export default function InboxPage() {
  return (
    <NoraDocsLayout
      title="Caixa de entrada"
      subtitle="Arquivos recebidos aguardando identificação de cliente, competência e categoria."
    >
      <EtapaPendente
        etapa="Etapa 6"
        entrega="Upload e classificação chegam aqui."
        itens={[
          'Área de arrastar e soltar, com hash SHA-256 e deduplicação',
          'Classificação por regras determinísticas, executada no navegador',
          'Tabela com arquivo, cliente, competência, categoria, status e destino',
          'Arquivo identificado vai direto para a pasta final; duvidoso, para "Revisar"',
        ]}
      />
    </NoraDocsLayout>
  );
}
