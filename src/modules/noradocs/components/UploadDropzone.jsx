import { useState } from 'react';
import AnimatedDropzone from '../../../components/AnimatedDropzone';

// Área de arrastar e soltar da caixa de entrada.
//
// Aceita vários arquivos de uma vez porque é assim que o trabalho chega: o
// contador baixa os anexos do e-mail do cliente e joga o lote inteiro aqui.
// Cada arquivo mostra seu próprio progresso — num lote de 30, saber QUAL
// falhou (e poder tentar só aquele de novo) é o que importa.
//
// A apresentação (arrastar, animação de entrada, revelação da miniatura por
// progresso) mora em AnimatedDropzone, compartilhada com o resto da
// plataforma. Aqui só traduz o `progresso` por etapa que o InboxPage já
// mantinha para o formato genérico do componente.

const ETAPA_PCT = { lendo: 20, classificando: 45, enviando: 70, gravando: 90 };
const ETAPA_LABEL = {
  lendo: 'Lendo o arquivo…',
  classificando: 'Identificando…',
  enviando: 'Enviando ao Drive…',
  gravando: 'Finalizando…',
};

export default function UploadDropzone({ onArquivos, progresso, ocupado, onRetry, onClear }) {
  // Guarda o tamanho de cada arquivo pra exibir na linha — `progresso` só
  // carrega nome e etapa, não o File em si. Precisa ser state (não ref)
  // porque é lido durante o render.
  const [tamanhos, setTamanhos] = useState({});

  function selecionar(fileList) {
    const arquivos = Array.from(fileList || []);
    if (!arquivos.length) return;
    setTamanhos((t) => ({ ...t, ...Object.fromEntries(arquivos.map((f) => [f.name, f.size])) }));
    onArquivos(arquivos);
  }

  const items = Object.entries(progresso || {}).map(([nome, info]) => {
    const status = info.erro ? 'error' : info.pronto ? 'done' : 'uploading';
    return {
      id: nome,
      name: nome,
      size: tamanhos[nome],
      status,
      progress: status === 'done' ? 100 : (ETAPA_PCT[info.etapa] || 0),
      message: info.erro || info.pronto || (info.etapa ? ETAPA_LABEL[info.etapa] : 'Na fila…'),
    };
  });

  return (
    <div style={{ marginBottom: 18 }}>
      <AnimatedDropzone
        items={items}
        onFiles={selecionar}
        disabled={ocupado}
        onRetry={onRetry}
        onClear={onClear}
        title="Arraste os arquivos ou clique para escolher"
        hint="Vários de uma vez · você também pode colar. O NoraDocs identifica cliente, competência e categoria e arquiva no Drive — o que ficar em dúvida vai para revisão."
      />
    </div>
  );
}
