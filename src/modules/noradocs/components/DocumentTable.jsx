import { useTheme } from '../../../contexts/ThemeContext';
import { competenciaLegivel } from '../domain/competencia';
import { DOCUMENT_STATUS } from '../constants';
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

export default function DocumentTable({ documentos, onAbrir }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const th = {
    textAlign: 'left', padding: '9px 14px', fontSize: '0.64rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 14px', borderBottom: `1px solid ${P.border}`, fontSize: '0.85rem', verticalAlign: 'top' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
        <thead>
          <tr>
            <th style={th}>Arquivo</th>
            <th style={th}>Cliente</th>
            <th style={th}>Competência</th>
            <th style={th}>Categoria</th>
            <th style={th}>Status</th>
            <th style={th}>Destino</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((doc) => {
            const pendencias = doc.matched?.pendencias || [];
            return (
              <tr
                key={doc.id}
                onClick={() => onAbrir?.(doc)}
                style={{ cursor: onAbrir ? 'pointer' : 'default' }}
              >
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{doc.file_name}</div>
                  {doc.review_reason && (
                    <div style={{ color: P.muted, fontSize: '0.76rem', marginTop: 3, maxWidth: '46ch' }}>
                      {doc.review_reason}
                    </div>
                  )}
                </td>
                <td style={td}>
                  <Campo valor={doc.client?.nome} pendente={pendencias.includes('cliente')} P={P} />
                </td>
                <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  <Campo valor={doc.competencia ? competenciaLegivel(doc.competencia) : null} P={P} />
                </td>
                <td style={td}>
                  <Campo valor={doc.category?.nome} pendente={pendencias.includes('categoria')} P={P} />
                </td>
                <td style={td}><StatusBadge status={doc.status} P={P} /></td>
                <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.74rem', color: P.muted, maxWidth: 280 }}>
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
