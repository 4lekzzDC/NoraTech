import { useTheme } from '../../../contexts/ThemeContext';
import { competenciaLegivel } from '../domain/competencia';
import { DOCUMENT_STATUS } from '../constants';
import { podeConfirmarEmLote } from '../domain/status';
import { getPalette, FONT_MONO } from '../theme';

// Tabela da caixa de entrada. Densa e tabular por decisão de projeto: a tela
// existe para zerar a fila, não para exibir indicadores.

function StatusBadge({ status, P }) {
  const info = DOCUMENT_STATUS[status] || { label: status, tone: 'neutral' };
  const cor = { ok: P.green, warn: P.gold, danger: P.red, muted: P.muted2, neutral: P.muted }[info.tone];
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999,
      color: cor, background: `${cor}1a`, border: `1px solid ${cor}44`, whiteSpace: 'nowrap',
    }}>
      {info.label}
    </span>
  );
}

// Campo que a regra não fechou aparece com marcação discreta, não com alarde:
// a fila de revisão já diz que há algo a fazer.
function Campo({ valor, pendente, P }) {
  if (valor) return <span>{valor}</span>;
  return (
    <span style={{ color: P.muted2, fontStyle: pendente ? 'normal' : 'italic' }}>
      {pendente ? '— a definir' : '—'}
    </span>
  );
}

// `selecionados`/`onAlternar` e `focadoId` são opcionais: o Histórico usa a
// mesma tabela sem seleção nem cursor de teclado.
export default function DocumentTable({ documentos, onAbrir, selecionados, onAlternar, focadoId }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const th = {
    textAlign: 'left', padding: '9px 14px', fontSize: '0.64rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 14px', borderBottom: `1px solid ${P.border}`, fontSize: '0.85rem', verticalAlign: 'top' };

  return (
    <div className="nd-tabela-wrap" style={{ overflowX: 'auto' }}>
      {/* Em tela estreita a tabela deixa de ser tabela.
          Com sete colunas num celular, o que se via era só o nome do arquivo
          e uma barra de rolagem lateral — para saber de que cliente era, o
          contador tinha que arrastar. Abaixo de 720px as colunas do meio
          somem e viram uma linha de resumo sob o nome, que cabe na tela. */}
      <style>{`
        .nd-resumo { display: none; }
        @media (max-width: 720px) {
          .nd-tabela-wrap { overflow-x: visible; }
          .nd-tabela { min-width: 0 !important; }
          .nd-col-secundaria { display: none; }
          .nd-resumo { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; }
        }
      `}</style>
      <table className="nd-tabela" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
        <thead>
          <tr>
            {onAlternar && <th style={{ ...th, width: 34 }} />}
            <th style={th}>Arquivo</th>
            <th className="nd-col-secundaria" style={th}>Cliente</th>
            <th className="nd-col-secundaria" style={th}>Competência</th>
            <th className="nd-col-secundaria" style={th}>Categoria</th>
            <th style={th}>Status</th>
            <th className="nd-col-secundaria" style={th}>Destino</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((doc) => {
            const pendencias = doc.matched?.pendencias || [];
            const focado = doc.id === focadoId;
            return (
              <tr
                key={doc.id}
                onClick={() => onAbrir?.(doc)}
                // A linha sob o cursor do teclado precisa ser achável de
                // relance numa lista densa — daí a barra na lateral, e não só
                // um fundo, que a 30 linhas some.
                ref={focado ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                style={{
                  cursor: onAbrir ? 'pointer' : 'default',
                  background: focado ? P.primarySoft : 'transparent',
                  boxShadow: focado ? `inset 3px 0 0 ${P.primary}` : 'none',
                }}
              >
                {onAlternar && (
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      disabled={!podeConfirmarEmLote(doc)}
                      checked={selecionados?.has(doc.id) || false}
                      onChange={() => onAlternar(doc.id)}
                      title={podeConfirmarEmLote(doc)
                        ? 'Selecionar para confirmar em lote'
                        : 'Faltam campos — precisa de revisão individual'}
                      style={{
                        width: 15, height: 15, accentColor: P.primary,
                        cursor: podeConfirmarEmLote(doc) ? 'pointer' : 'not-allowed',
                      }}
                    />
                  </td>
                )}
                <td style={td}>
                  {/* Nome de arquivo contábil não tem espaço onde quebrar
                      ("NFe_98765432000110_072026.xml"), e sem permissão para
                      quebrar em qualquer ponto ele empurra a coluna e joga o
                      status para fora da tela no celular. O minWidth é o piso
                      contrário: impede a coluna de virar uma letra por linha. */}
                  <div
                    style={{ fontWeight: 600, minWidth: '9ch', overflowWrap: 'anywhere' }}
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </div>
                  {doc.review_reason && (
                    <div style={{ color: P.muted, fontSize: '0.76rem', marginTop: 3, maxWidth: '46ch' }}>
                      {doc.review_reason}
                    </div>
                  )}
                  <div className="nd-resumo" style={{ fontSize: '0.76rem', color: P.muted }}>
                    <Campo valor={doc.client?.nome} pendente={pendencias.includes('cliente')} P={P} />
                    <span style={{ color: P.muted2 }}>·</span>
                    <span style={{ fontFamily: FONT_MONO }}>
                      <Campo valor={doc.competencia ? competenciaLegivel(doc.competencia) : null} P={P} />
                    </span>
                    <span style={{ color: P.muted2 }}>·</span>
                    <Campo valor={doc.category?.nome} pendente={pendencias.includes('categoria')} P={P} />
                  </div>
                </td>
                <td className="nd-col-secundaria" style={td}>
                  <Campo valor={doc.client?.nome} pendente={pendencias.includes('cliente')} P={P} />
                </td>
                <td className="nd-col-secundaria" style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  <Campo valor={doc.competencia ? competenciaLegivel(doc.competencia) : null} P={P} />
                </td>
                <td className="nd-col-secundaria" style={td}>
                  <Campo valor={doc.category?.nome} pendente={pendencias.includes('categoria')} P={P} />
                </td>
                <td style={td}><StatusBadge status={doc.status} P={P} /></td>
                <td className="nd-col-secundaria" style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.74rem', color: P.muted, maxWidth: 280 }}>
                  {/* Sem caminho, o texto depende do status: um documento em
                      revisão está mesmo em _triagem, mas um que falhou no
                      envio não chegou a lugar nenhum — dizer "em triagem" ali
                      mandaria o contador procurar um arquivo que não existe. */}
                  {doc.drive_path || (
                    <span style={{ color: P.muted2 }}>
                      {doc.status === 'erro' ? 'não enviado' : 'em triagem'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
