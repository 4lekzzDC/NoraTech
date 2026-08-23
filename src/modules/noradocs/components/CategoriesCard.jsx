import { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';

// Lista editável de categorias, direto na linha — sem drawer, sem modal.
// Cada campo salva ao perder o foco (ou na hora, para o toggle e as tags);
// é uma tela de ajuste fino, não um cadastro que precise de confirmação.

// Palavras-chave como chips dentro do próprio campo — vírgula ou enter fecha
// a palavra em uma tag; backspace num campo vazio apaga a última.
function CampoTags({ valores, onChange, disabled, P }) {
  const [texto, setTexto] = useState('');

  function commit() {
    const t = texto.trim();
    if (t && !valores.includes(t)) onChange([...valores, t]);
    setTexto('');
  }

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
        padding: '5px 7px', borderRadius: 8, minHeight: 32,
        border: `1px solid ${P.border2}`, background: disabled ? 'transparent' : P.inputBg,
      }}
    >
      {valores.map((v) => (
        <span key={v} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
          background: P.primarySoft, border: `1px solid ${P.primaryBorder}`, color: P.primaryText,
          fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {v}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(valores.filter((x) => x !== v))}
              aria-label={`Remover ${v}`}
              style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.65, cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !texto && valores.length) onChange(valores.slice(0, -1));
          }}
          placeholder={valores.length ? '' : 'extrato, conta corrente'}
          style={{
            flex: '1 1 80px', minWidth: 80, border: 'none', background: 'transparent', color: P.text,
            fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit', padding: '3px 2px',
          }}
        />
      )}
    </div>
  );
}

function AlcaArraste({ P, ...props }) {
  return (
    <span
      {...props}
      draggable
      title="Arrastar para reordenar"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 6, color: P.muted2, cursor: 'grab',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
        <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
        <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
      </svg>
    </span>
  );
}

export default function CategoriesCard({ categorias, isManager, onUpdate, onCreate, onDelete }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [arrastandoId, setArrastandoId] = useState(null);

  async function adicionar() {
    if (!novoNome.trim()) return;
    setCriando(true);
    try {
      await onCreate(novoNome);
      setNovoNome('');
    } finally {
      setCriando(false);
    }
  }

  // Solta uma categoria em cima de outra: a lista é reconstruída na nova
  // ordem visual e só as linhas cuja posição de fato mudou vão pro banco —
  // arrastar a última categoria uma posição não precisa regravar as outras 20.
  async function soltar(alvoId) {
    const origemId = arrastandoId;
    setArrastandoId(null);
    if (!origemId || origemId === alvoId) return;

    const lista = [...categorias];
    const origemIdx = lista.findIndex((c) => c.id === origemId);
    const destinoIdx = lista.findIndex((c) => c.id === alvoId);
    if (origemIdx === -1 || destinoIdx === -1) return;

    const [movida] = lista.splice(origemIdx, 1);
    lista.splice(destinoIdx, 0, movida);

    await Promise.all(
      lista
        .map((c, i) => ({ id: c.id, ordemAtual: c.ordem, novaOrdem: i }))
        .filter((c) => c.ordemAtual !== c.novaOrdem)
        .map((c) => onUpdate(c.id, { ordem: c.novaOrdem }))
    );
  }

  const th = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.64rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '7px 10px', borderBottom: `1px solid ${P.border}`, verticalAlign: 'middle' };
  const campo = {
    width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid transparent',
    background: 'transparent', color: P.text, fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none',
  };
  const campoEditavel = { ...campo, border: `1px solid ${P.border2}`, background: P.inputBg };

  return (
    <div className="nd-card-hover" style={{ border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface, padding: '22px 24px' }}>
      <style>{`
        .nd-cat-handle:hover { background: ${P.surface2}; color: ${P.muted}; }
        .nd-cat-handle:active { cursor: grabbing; }
        .nd-cat-toggle { position: relative; display: inline-block; width: 36px; height: 21px; flex-shrink: 0; }
        .nd-cat-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
        .nd-cat-toggle .track {
          position: absolute; inset: 0; border-radius: 999px; background: ${P.surface2};
          border: 1px solid ${P.border2}; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;
        }
        .nd-cat-toggle .thumb {
          position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
          background: ${P.muted}; transition: transform 0.2s cubic-bezier(0.2,0,0,1), background 0.2s ease;
        }
        .nd-cat-toggle input:checked + .track { background: ${P.primary}; border-color: ${P.primary}; }
        .nd-cat-toggle input:checked + .track .thumb { transform: translateX(15px); background: #fff; }
        .nd-cat-toggle input:disabled + .track { cursor: default; opacity: 0.6; }
        .nd-cat-trash {
          display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
          border-radius: 7px; background: none; border: none; color: ${P.muted2}; cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease;
        }
        .nd-cat-trash:hover { color: ${P.red}; background: rgba(255,92,92,0.1); }
        .nd-cat-add-btn { transition: all 0.2s ease; }
        .nd-cat-add-btn:not(:disabled):hover { background: ${P.primary}; color: #fff; }
        @media (prefers-reduced-motion: reduce) {
          .nd-cat-toggle .thumb { transition: background 0.2s ease; }
        }
      `}</style>

      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Categorias</h2>
      <p style={{ margin: '5px 0 14px', color: P.muted, fontSize: '0.85rem', maxWidth: '58ch' }}>
        As palavras-chave alimentam a classificação automática — qualquer uma delas encontrada no nome do
        arquivo ou no texto do documento sugere esta categoria.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 36 }} />
              <th style={th}>Nome</th>
              <th style={th}>Palavras-chave</th>
              <th style={{ ...th, width: 60, textAlign: 'center' }}>Ativa</th>
              {isManager && <th style={{ ...th, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat) => (
              <tr
                key={cat.id}
                style={{ opacity: cat.ativo ? 1 : 0.55 }}
                onDragOver={isManager ? (e) => e.preventDefault() : undefined}
                onDrop={isManager ? () => soltar(cat.id) : undefined}
              >
                <td style={td}>
                  {isManager ? (
                    <AlcaArraste
                      P={P}
                      className="nd-cat-handle"
                      onDragStart={() => setArrastandoId(cat.id)}
                      onDragEnd={() => setArrastandoId(null)}
                    />
                  ) : (
                    <span style={{ display: 'inline-block', width: 26 }} />
                  )}
                </td>
                <td style={td}>
                  <input
                    defaultValue={cat.nome} disabled={!isManager} style={isManager ? campoEditavel : campo}
                    onBlur={(e) => {
                      const nome = e.target.value.trim();
                      if (nome && nome !== cat.nome) onUpdate(cat.id, { nome });
                    }}
                  />
                </td>
                <td style={td}>
                  <CampoTags
                    valores={cat.keywords || []}
                    onChange={(keywords) => onUpdate(cat.id, { keywords })}
                    disabled={!isManager}
                    P={P}
                  />
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <label className="nd-cat-toggle">
                    <input
                      type="checkbox" checked={cat.ativo} disabled={!isManager}
                      onChange={(e) => onUpdate(cat.id, { ativo: e.target.checked })}
                    />
                    <span className="track"><span className="thumb" /></span>
                  </label>
                </td>
                {isManager && (
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => onDelete(cat)} title="Excluir categoria" className="nd-cat-trash">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isManager && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }}
            placeholder="Nova categoria"
            style={{ ...campoEditavel, flex: '0 1 240px' }}
          />
          <button
            className="nd-cat-add-btn"
            onClick={adicionar} disabled={criando || !novoNome.trim()}
            style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${P.primaryBorder}`,
              background: P.primarySoft, color: P.primaryText, fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}
