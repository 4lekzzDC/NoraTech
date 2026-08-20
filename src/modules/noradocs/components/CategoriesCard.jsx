import { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';

// Lista editável de categorias, direto na linha — sem drawer, sem modal.
// Cada campo salva ao perder o foco (ou na hora, para o checkbox de ativo);
// é uma tela de ajuste fino, não um cadastro que precise de confirmação.

export default function CategoriesCard({ categorias, isManager, onUpdate, onCreate, onDelete }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);

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

  const th = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.64rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '7px 10px', borderBottom: `1px solid ${P.border}` };
  const campo = {
    width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid transparent`,
    background: 'transparent', color: P.text, fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none',
  };
  const campoEditavel = { ...campo, border: `1px solid ${P.border2}`, background: P.inputBg };

  return (
    <div style={{ border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface, padding: '22px 24px', boxShadow: P.shadow }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Categorias</h2>
      <p style={{ margin: '5px 0 14px', color: P.muted, fontSize: '0.85rem', maxWidth: '58ch' }}>
        As palavras-chave alimentam a classificação automática — qualquer uma delas encontrada no nome do
        arquivo ou no texto do documento sugere esta categoria.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 52 }}>Ordem</th>
              <th style={th}>Nome</th>
              <th style={th}>Palavras-chave</th>
              <th style={{ ...th, width: 60, textAlign: 'center' }}>Ativa</th>
              {isManager && <th style={{ ...th, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat) => (
              <tr key={cat.id} style={{ opacity: cat.ativo ? 1 : 0.55 }}>
                <td style={td}>
                  <input
                    type="number" defaultValue={cat.ordem} disabled={!isManager}
                    style={{ ...campoEditavel, width: 52, fontFamily: FONT_MONO }}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n !== cat.ordem) onUpdate(cat.id, { ordem: n });
                    }}
                  />
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
                  <input
                    defaultValue={(cat.keywords || []).join(', ')}
                    disabled={!isManager}
                    placeholder="extrato, conta corrente"
                    style={isManager ? campoEditavel : campo}
                    onBlur={(e) => {
                      const keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
                      onUpdate(cat.id, { keywords });
                    }}
                  />
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <input
                    type="checkbox" checked={cat.ativo} disabled={!isManager}
                    onChange={(e) => onUpdate(cat.id, { ativo: e.target.checked })}
                    style={{ width: 15, height: 15, accentColor: P.primary, cursor: isManager ? 'pointer' : 'default' }}
                  />
                </td>
                {isManager && (
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      onClick={() => onDelete(cat)}
                      title="Excluir categoria"
                      style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: '0.9rem', padding: 4 }}
                    >
                      ×
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
