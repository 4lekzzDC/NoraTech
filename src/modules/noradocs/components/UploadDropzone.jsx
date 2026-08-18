import { useRef, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';

// Área de arrastar e soltar da caixa de entrada.
//
// Aceita vários arquivos de uma vez porque é assim que o trabalho chega: o
// contador baixa os anexos do e-mail do cliente e joga o lote inteiro aqui.
// Cada arquivo mostra seu próprio progresso — num lote de 30, saber QUAL
// falhou é o que importa.

const ROTULO_ETAPA = {
  lendo: 'Lendo o arquivo…',
  classificando: 'Identificando…',
  enviando: 'Enviando ao Drive…',
  gravando: 'Finalizando…',
};

export default function UploadDropzone({ onArquivos, progresso, ocupado }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef(null);

  function selecionar(fileList) {
    const arquivos = Array.from(fileList || []);
    if (arquivos.length) onArquivos(arquivos);
  }

  const itens = Object.entries(progresso || {});

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          selecionar(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${arrastando ? P.primary : P.border2}`,
          background: arrastando ? P.primarySoft : P.surface,
          borderRadius: 14, padding: '26px 22px', textAlign: 'center',
          cursor: ocupado ? 'progress' : 'pointer', transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <input
          ref={inputRef} type="file" multiple hidden
          onChange={(e) => { selecionar(e.target.files); e.target.value = ''; }}
        />
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.94rem' }}>
          {arrastando ? 'Solte os arquivos aqui' : 'Arraste os arquivos ou clique para escolher'}
        </p>
        <p style={{ margin: '6px 0 0', color: P.muted, fontSize: '0.83rem' }}>
          Vários de uma vez. O NoraDocs identifica cliente, competência e categoria e arquiva no Drive —
          o que ficar em dúvida vai para revisão.
        </p>
      </div>

      {itens.length > 0 && (
        <div style={{
          marginTop: 12, border: `1px solid ${P.border}`, borderRadius: 12,
          background: P.surface, overflow: 'hidden',
        }}>
          {itens.map(([nome, info]) => (
            <div
              key={nome}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '9px 14px', borderBottom: `1px solid ${P.border}`, fontSize: '0.83rem',
              }}
            >
              {/* minWidth impede que uma mensagem de erro longa comprima o
                  nome até sobrar uma letra: num lote de 30 arquivos, saber
                  QUAL falhou é a única informação que importa. */}
              <span
                title={nome}
                style={{
                  fontFamily: FONT_MONO, fontSize: '0.76rem', color: P.muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  minWidth: '9ch', flex: '1 1 auto',
                }}
              >
                {nome}
              </span>
              <span style={{
                whiteSpace: 'nowrap', fontSize: '0.78rem',
                color: info.erro ? P.red : info.pronto ? P.green : P.muted,
              }}>
                {info.erro || (info.pronto ? info.pronto : ROTULO_ETAPA[info.etapa] || 'Aguardando…')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
