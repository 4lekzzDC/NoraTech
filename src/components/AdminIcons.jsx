// Ícones do Admin — SVG stroke, 24x24, herdando `currentColor` e o tamanho
// pelo prop `size`. Existe porque emoji como ícone de UI (💲 📄 🧩) renderiza
// diferente em cada SO, não acompanha a cor do texto e derruba a leitura
// "executiva" de um painel gerencial — o traço monocromático resolve os três.
//
// Desenhos no estilo Lucide (stroke 2, cantos e pontas arredondadas). Para
// adicionar um ícone, acrescente o `d` (ou a lista de `d`) em TRACOS.

const TRACOS = {
  // ── KPIs ──────────────────────────────────────────────────────────
  dollar: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v5h5', 'M9 13h6', 'M9 17h4'],
  card: ['M2 10h20', 'M21 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z'],
  trending: ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],

  // ── Cabeçalho dos widgets ─────────────────────────────────────────
  pie: ['M21.21 15.89A10 10 0 1 1 8 2.83', 'M22 12A10 10 0 0 0 12 2v10z'],
  layers: [
    'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
  ],
  bars: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  clock: ['M12 6v6l4 2'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M19 8v6', 'M22 11h-6'],

  // ── Feed de atividades ────────────────────────────────────────────
  check: ['M21.8 10A10 10 0 1 1 17 3.34', 'm9 11 3 3L22 4'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  eye: ['M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0'],
  xCircle: ['m15 9-6 6', 'm9 9 6 6'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  refresh: [
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M3 21v-5h5',
  ],
  zap: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  pencil: ['M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z'],
  note: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v5h5'],

  // ── Controles ─────────────────────────────────────────────────────
  plus: ['M5 12h14', 'M12 5v14'],
  sliders: ['M20 7h-9', 'M14 17H5'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
};

// Círculos que alguns ícones precisam além dos traços.
const CIRCULOS = {
  users: [[9, 7, 4]],
  userPlus: [[9, 7, 4]],
  clock: [[12, 12, 10]],
  eye: [[12, 12, 3]],
  xCircle: [[12, 12, 10]],
  sliders: [[17, 17, 3], [7, 7, 3]],
};

// Pontos preenchidos (grip/⋯) — desenhados como círculos com fill, não stroke.
const PONTOS = {
  grip: [[9, 5], [9, 12], [9, 19], [15, 5], [15, 12], [15, 19]],
  more: [[5, 12], [12, 12], [19, 12]],
};

export function Icon({ name, size = 16, strokeWidth = 2, style }) {
  const pontos = PONTOS[name];
  const comum = {
    width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
    style: { flexShrink: 0, display: 'block', ...style },
  };

  if (pontos) {
    return (
      <svg {...comum} fill="currentColor">
        {pontos.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" />)}
      </svg>
    );
  }

  const tracos = TRACOS[name];
  if (!tracos) return null;
  return (
    <svg
      {...comum}
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {tracos.map((d) => <path key={d} d={d} />)}
      {(CIRCULOS[name] || []).map(([cx, cy, r]) => <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />)}
    </svg>
  );
}
