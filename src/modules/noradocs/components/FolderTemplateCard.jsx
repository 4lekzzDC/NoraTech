import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { FOLDER_TEMPLATE_TOKENS, formatFolderPath, tokensDesconhecidos } from '../domain/folderTemplate';
import { saveFolderTemplate } from '../services/settings.service';
import { getPalette, FONT_MONO } from '../theme';

// Documento de exemplo usado só para a pré-visualização — nunca sai desta
// tela, não é gravado em lugar nenhum.
const EXEMPLO = {
  clienteNome: 'Silva Comércio de Alimentos ME',
  cnpj: '11.222.333/0001-81',
  competencia: '2026-08',
  categoriaNome: 'Extratos bancários',
  tipo: 'Extrato bancário',
};

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function FolderTemplateCard({ tenantId, template, isManager, showToast, onSaved }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [valor, setValor] = useState(template);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef(null);

  // O template vem de fora (carregado pela página); se o registro mudar por
  // fora desta tela (ex.: outro admin salvou em outra aba), o campo acompanha
  // — mas só enquanto o usuário não começou a editar aqui.
  useEffect(() => { setValor(template); }, [template]);

  function inserirToken(token) {
    const campo = inputRef.current;
    const trecho = `{${token}}`;
    if (!campo) { setValor((v) => v + trecho); return; }
    const inicio = campo.selectionStart ?? valor.length;
    const fim = campo.selectionEnd ?? valor.length;
    const novo = valor.slice(0, inicio) + trecho + valor.slice(fim);
    setValor(novo);
    requestAnimationFrame(() => {
      campo.focus();
      const cursor = inicio + trecho.length;
      campo.setSelectionRange(cursor, cursor);
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const salvo = await saveFolderTemplate(tenantId, valor.trim());
      showToast('Modelo de pastas salvo.');
      onSaved?.(salvo.folder_template);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSalvando(false);
    }
  }

  const avisos = tokensDesconhecidos(valor);
  const caminho = formatFolderPath(valor, EXEMPLO);
  const alterado = valor.trim() !== (template || '').trim();

  // A pré-visualização não troca de texto seca: some com um fade curto e
  // volta já com o caminho novo. `caminhoExibido` fica um passo atrás de
  // `caminho` de propósito — é o que dá tempo do fade-out acontecer antes do
  // texto trocar por baixo.
  const [caminhoExibido, setCaminhoExibido] = useState(caminho);
  const [apagando, setApagando] = useState(false);
  useEffect(() => {
    if (caminho === caminhoExibido) return undefined;
    if (prefersReducedMotion()) { setCaminhoExibido(caminho); return undefined; }
    setApagando(true);
    const t = setTimeout(() => {
      setCaminhoExibido(caminho);
      setApagando(false);
    }, 160);
    return () => clearTimeout(t);
  }, [caminho]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="nd-card-hover" style={{ border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface, padding: '22px 24px' }}>
      <style>{`
        .nd-ft-chip {
          font-family: ${FONT_MONO}; font-size: 0.74rem; font-weight: 600;
          padding: 6px 12px; border-radius: 999px;
          border: 1px solid ${P.border2}; background: ${P.surface2}; color: ${P.muted};
          transition: all 0.2s ease; font: inherit; font-family: ${FONT_MONO};
        }
        .nd-ft-chip:not(:disabled):hover {
          border-color: ${P.primaryBorder}; background: ${P.primarySoft}; color: ${P.primaryText};
          transform: translateY(-1px);
        }
        .nd-ft-chip:disabled { cursor: default; opacity: 0.7; }
        .nd-ft-input:focus { border-color: ${P.primaryBorder} !important; box-shadow: 0 0 0 3px ${P.primarySoft}; }
        @media (prefers-reduced-motion: reduce) {
          .nd-ft-chip:not(:disabled):hover { transform: none; }
        }
      `}</style>

      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Estrutura de pastas</h2>
      <p style={{ margin: '5px 0 0', color: P.muted, fontSize: '0.85rem', maxWidth: '58ch' }}>
        Onde cada documento organizado é arquivado dentro da pasta raiz. Clique nos tokens para inserir no caminho.
      </p>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '14px 0' }}>
        {FOLDER_TEMPLATE_TOKENS.map((token) => (
          <button
            key={token} type="button" className="nd-ft-chip" disabled={!isManager}
            onClick={() => inserirToken(token)}
            title={isManager ? `Inserir {${token}}` : undefined}
          >
            {`{${token}}`}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        className="nd-ft-input"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={!isManager}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 9, outline: 'none',
          border: `1px solid ${P.border2}`, background: P.inputBg, color: P.text,
          fontFamily: FONT_MONO, fontSize: '0.85rem', transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      />

      {avisos.length > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: P.gold }}>
          Token{avisos.length > 1 ? 's' : ''} não reconhecido{avisos.length > 1 ? 's' : ''}: {avisos.map((t) => `{${t}}`).join(', ')}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <p style={{ margin: '0 0 6px', fontFamily: FONT_MONO, fontSize: '0.66rem', letterSpacing: 1, textTransform: 'uppercase', color: P.muted2 }}>
          Pré-visualização com um documento de exemplo
        </p>
        <p style={{
          margin: 0, padding: '10px 12px', borderRadius: 9, background: P.primarySoft,
          border: `1px solid ${P.primaryBorder}`, color: P.primaryText,
          fontFamily: FONT_MONO, fontSize: '0.82rem', wordBreak: 'break-word',
          opacity: apagando ? 0 : 1, transition: 'opacity 160ms ease',
        }}>
          {caminhoExibido || '(caminho vazio)'}
        </p>
      </div>

      {isManager && (
        <button
          onClick={salvar}
          disabled={salvando || !alterado}
          style={{
            marginTop: 16, padding: '9px 16px', borderRadius: 9, border: 'none',
            background: P.primary, color: '#fff', fontSize: '0.83rem', fontWeight: 700,
            cursor: alterado && !salvando ? 'pointer' : 'default', opacity: alterado ? 1 : 0.5,
            fontFamily: 'inherit', transition: 'all 0.2s ease',
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar modelo'}
        </button>
      )}
    </div>
  );
}
