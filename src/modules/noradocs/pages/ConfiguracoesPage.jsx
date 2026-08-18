import NoraDocsLayout from '../components/NoraDocsLayout';
import EtapaPendente from '../components/EtapaPendente';

export default function ConfiguracoesPage() {
  return (
    <NoraDocsLayout
      title="Configurações"
      subtitle="Conexão com o Google Drive, estrutura de pastas e categorias do escritório."
    >
      <EtapaPendente
        etapa="Etapas 3 e 4"
        entrega="Conexão com o Drive e estrutura de pastas."
        itens={[
          'Conexão com o Google usando apenas o escopo drive.file',
          'Escolha da pasta raiz pelo Google Picker, com aviso sobre estrutura já existente',
          'Modelo de pastas com tokens e pré-visualização do caminho antes de salvar',
          'Categorias do escritório: ordem, nome e palavras-chave',
        ]}
      />
    </NoraDocsLayout>
  );
}
