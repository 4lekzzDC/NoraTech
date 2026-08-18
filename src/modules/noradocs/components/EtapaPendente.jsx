import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';

// Marcador honesto de tela ainda não construída.
//
// O NoraDocs sobe em etapas, e uma tela vazia sem explicação parece defeito.
// Este bloco diz qual etapa entrega aquela tela e o que ela vai fazer — some
// assim que a etapa correspondente for implementada.

export default function EtapaPendente({ etapa, entrega, itens = [] }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  return (
    <div style={{
      border: `1px dashed ${P.border2}`,
      borderRadius: 14,
      background: P.surface,
      padding: '30px 28px',
      boxShadow: P.shadow,
    }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: '0.66rem', letterSpacing: 1.2,
        textTransform: 'uppercase', color: P.primaryText,
        background: P.primarySoft, border: `1px solid ${P.primaryBorder}`,
        borderRadius: 999, padding: '4px 11px', display: 'inline-block',
      }}>
        {etapa}
      </div>

      <p style={{ margin: '16px 0 0', fontSize: '0.95rem', fontWeight: 600 }}>{entrega}</p>

      {itens.length > 0 && (
        <ul style={{ margin: '14px 0 0', paddingLeft: 20, color: P.muted, fontSize: '0.87rem', lineHeight: 1.75 }}>
          {itens.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
