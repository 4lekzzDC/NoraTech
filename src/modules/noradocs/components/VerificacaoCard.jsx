import { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';

// A fila de empresas que chegaram por e-mail e ainda não são clientes.
//
// Fica no topo de Clientes, acima da lista, porque é trabalho pendente — e
// trabalho pendente que exige rolar a tela é trabalho que não acontece. Some
// por inteiro quando não há nenhuma: uma seção vazia permanente ensina o olho
// a ignorar aquele espaço.

function porQue(origem) {
  if (origem?.tipo === 'dominio_remetente' && origem.valor) {
    return `detectado pelo domínio ${origem.valor}`;
  }
  return 'detectado na entrada automática';
}

export default function VerificacaoCard({ provisorios, clientes, ocupado, onConfirmar, onFundir }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [fundindo, setFundindo] = useState(null);   // id do provisório
  const [alvo, setAlvo] = useState('');

  if (!provisorios.length) return null;

  const confirmados = clientes.filter((c) => c.status !== 'provisorio');

  const acao = {
    background: 'none', border: 'none', fontSize: '0.79rem', cursor: 'pointer',
    padding: '3px 6px', fontFamily: 'inherit', textDecoration: 'underline',
  };

  return (
    <div style={{
      border: `1px solid ${P.gold}55`, borderRadius: 14, marginBottom: 18,
      background: theme === 'light' ? 'rgba(180,83,9,0.05)' : 'rgba(240,180,41,0.06)',
      padding: '18px 20px',
    }}>
      <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
        Em verificação ({provisorios.length})
      </h2>
      <p style={{ margin: '5px 0 0', color: P.muted, fontSize: '0.84rem', maxWidth: '64ch' }}>
        Documentos chegaram por e-mail dessas empresas, que ainda não estão cadastradas. Estão
        arquivados numa pasta <span style={{ fontFamily: FONT_MONO }}>_verificação</span>, separada
        da árvore de clientes. Confirmar traz a pasta inteira para o lugar certo; fundir move os
        documentos para um cliente que já existe.
      </p>

      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {provisorios.map((p) => (
          <div
            key={p.id}
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${P.border}`, background: P.surface,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {p.nome}
                </div>
                <div style={{ fontSize: '0.75rem', color: P.muted2, marginTop: 2 }}>
                  {p.documentos} documento{p.documentos === 1 ? '' : 's'}
                  {' · '}
                  {/* Explicar de onde veio o nome é o que impede a pasta de
                      parecer ter aparecido sozinha — que é o que faz o
                      contador desconfiar do produto inteiro. */}
                  {porQue(p.origem_deteccao)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => onConfirmar(p)}
                  disabled={ocupado}
                  style={{ ...acao, color: P.primaryText, fontWeight: 600 }}
                >
                  Confirmar como cliente
                </button>
                <button
                  onClick={() => { setFundindo(fundindo === p.id ? null : p.id); setAlvo(''); }}
                  disabled={ocupado}
                  style={{ ...acao, color: P.muted }}
                >
                  Fundir
                </button>
              </div>
            </div>

            {fundindo === p.id && (
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.border}`,
                display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
              }}>
                <select
                  value={alvo}
                  onChange={(e) => setAlvo(e.target.value)}
                  style={{
                    flex: '1 1 220px', padding: '8px 10px', borderRadius: 8,
                    border: `1px solid ${P.border2}`, background: P.inputBg,
                    color: P.text, fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  <option value="">É na verdade qual cliente?</option>
                  {confirmados.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <button
                  onClick={() => onFundir(p, alvo)}
                  disabled={!alvo || ocupado}
                  style={{
                    padding: '8px 15px', borderRadius: 8, border: 'none',
                    background: P.primary, color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                    cursor: alvo && !ocupado ? 'pointer' : 'default',
                    opacity: alvo && !ocupado ? 1 : 0.5, fontFamily: 'inherit',
                  }}
                >
                  Fundir
                </button>
                <p style={{ margin: 0, flexBasis: '100%', fontSize: '0.75rem', color: P.muted2 }}>
                  Os documentos passam para o cliente escolhido e são rearquivados na pasta dele.
                  A pasta antiga fica vazia no Drive — o NoraDocs não apaga pasta.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
