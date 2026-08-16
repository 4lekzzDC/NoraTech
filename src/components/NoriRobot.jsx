// Nori — mascote da Noratech, desenhado em SVG.
//
// Vetor em vez de imagem: escala sem perder nitidez em qualquer tela, pesa
// alguns KB em vez de centenas e herda a paleta do site.
//
// Duas lições que definem o desenho, aprendidas errando:
//
// 1. Membro contínuo, não segmentos com junta no meio. Círculo escuro no
//    cotovelo vira buraco no braço quando o robô é exibido a ~300px — a
//    articulação aqui é uma costura fina por cima do traço contínuo.
// 2. Escuro sem ser preto. Preto puro em peça pequena lê como recorte
//    vazado; o cinza-arroxeado escuro lê como plástico na sombra.
//
// O volume vem de três camadas dentro de cada clipPath: cor base, sombra
// degradê embaixo e brilho difuso em cima, mais um rim light roxo na borda.

const SHELL = 'url(#nori-shell)';
const JOINT = 'url(#nori-joint)';
const ACCENT = 'url(#nori-accent)';

// Mão aberta em gesto de apresentação, em coordenadas locais com a palma na
// origem. Dedos largos e bem separados: finos demais viram franja indistinta
// no tamanho em que o robô aparece na página.
function OpenHand() {
  return (
    <g>
      <rect x="-21" y="-15" width="42" height="42" rx="18" fill={SHELL} />
      {[
        { x: -16, y: -12, r: -27, h: 34 },
        { x: -5, y: -18, r: -9, h: 39 },
        { x: 6, y: -18, r: 8, h: 38 },
        { x: 17, y: -11, r: 24, h: 33 },
      ].map((f, i) => (
        <rect
          key={i}
          x="-6.5" y={-f.h + 3} width="13" height={f.h} rx="6.5" fill={SHELL}
          transform={`translate(${f.x} ${f.y}) rotate(${f.r})`}
        />
      ))}
      <rect
        x="-6.5" y="-25" width="13" height="29" rx="6.5" fill={SHELL}
        transform="translate(-21 9) rotate(-74)"
      />
      <rect x="-17" y="-12" width="34" height="5" rx="2.5" fill={JOINT} opacity="0.3" />
    </g>
  );
}

export default function NoriRobot({ className = '', style = {} }) {
  return (
    <svg
      className={`nori-svg ${className}`}
      viewBox="0 0 460 540"
      role="img"
      aria-label="Nori, o assistente da Noratech"
      style={style}
    >
      <style>{`
        @keyframes nori-lit { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
        @keyframes nori-pool { 0%, 100% { opacity: 0.36; transform: scaleX(1); } 50% { opacity: 0.22; transform: scaleX(0.9); } }

        .nori-svg { display: block; width: 100%; height: auto; overflow: visible; }
        .nori-lit { animation: nori-lit 4.6s ease-in-out infinite; }
        .nori-lit.slow { animation-duration: 6.4s; animation-delay: 0.8s; }
        .nori-pool { transform-box: view-box; transform-origin: 234px 454px; animation: nori-pool 6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-lit, .nori-pool { animation: none; }
        }
      `}</style>

      <defs>
        <linearGradient id="nori-shell" x1="0.12" y1="0" x2="0.86" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="32%" stopColor="#f6f5fb" />
          <stop offset="68%" stopColor="#d6d2e3" />
          <stop offset="100%" stopColor="#a8a2be" />
        </linearGradient>
        {/* cinza-arroxeado, não preto: preto puro em peça pequena vira buraco */}
        <linearGradient id="nori-joint" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4a4463" />
          <stop offset="100%" stopColor="#221e33" />
        </linearGradient>
        <linearGradient id="nori-shade" x1="0.05" y1="0" x2="0.28" y2="1">
          <stop offset="0%" stopColor="#33285a" stopOpacity="0" />
          <stop offset="54%" stopColor="#33285a" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#241a45" stopOpacity="0.4" />
        </linearGradient>
        {/* mesmo vidro escuro do balão de fala — é o que amarra os dois */}
        <linearGradient id="nori-visor" x1="0.18" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#241b3f" />
          <stop offset="52%" stopColor="#0f0a1e" />
          <stop offset="100%" stopColor="#05030c" />
        </linearGradient>
        <linearGradient id="nori-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0d7ff" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="nori-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        <clipPath id="nori-head-clip">
          <rect x="145" y="56" width="178" height="162" rx="62" />
        </clipPath>
        <clipPath id="nori-torso-clip">
          <path d="M 234 228 C 198 228, 176 241, 171 266 L 160 336 C 155 388, 187 418, 234 418 C 281 418, 313 388, 308 336 L 297 266 C 292 241, 270 228, 234 228 Z" />
        </clipPath>

        <filter id="nori-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="nori-glow-sm" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="nori-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id="nori-soft-sm" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse cx="234" cy="238" rx="200" ry="228" fill="url(#nori-halo)" />
      {/* Ele flutua, então embaixo vai poça de luz e não sombra */}
      <ellipse className="nori-pool" cx="234" cy="454" rx="98" ry="14" fill="#7C3AED" opacity="0.36" filter="url(#nori-soft)" />

      {/* ── Fones: a carcaça invade 16px da cabeça, então fica acoplada em vez
             de um anel solto boiando ao lado ── */}
      {[{ x: 130, cx: 146 }, { x: 306, cx: 322 }].map((e, i) => (
        <g key={e.x}>
          <rect x={e.x} y="108" width="32" height="58" rx="16" fill={JOINT} />
          <circle
            className={`nori-lit${i ? ' slow' : ''}`}
            cx={e.cx} cy="137" r="11"
            fill="none" stroke={ACCENT} strokeWidth="5.5" filter="url(#nori-glow)"
          />
        </g>
      ))}

      {/* Colarinho */}
      <rect x="206" y="194" width="56" height="48" rx="21" fill={JOINT} />

      {/* ── Braço direito, relaxado ao lado (atrás do tronco) ── */}
      <path d="M 288 262 L 312 316 L 318 366" fill="none" stroke={SHELL} strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-13" y="-2" width="26" height="4" rx="2" fill={JOINT} opacity="0.32" transform="translate(312 316) rotate(-7)" />
      <rect x="300" y="372" width="36" height="36" rx="16" fill={SHELL} />
      <rect x="306" y="380" width="24" height="5" rx="2.5" fill={JOINT} opacity="0.3" />

      {/* ── Tronco ── */}
      <g clipPath="url(#nori-torso-clip)">
        <path d="M 234 228 C 198 228, 176 241, 171 266 L 160 336 C 155 388, 187 418, 234 418 C 281 418, 313 388, 308 336 L 297 266 C 292 241, 270 228, 234 228 Z" fill={SHELL} />
        <path d="M 234 228 C 198 228, 176 241, 171 266 L 160 336 C 155 388, 187 418, 234 418 C 281 418, 313 388, 308 336 L 297 266 C 292 241, 270 228, 234 228 Z" fill="url(#nori-shade)" />
        <ellipse cx="198" cy="294" rx="25" ry="48" fill="#ffffff" opacity="0.5" filter="url(#nori-soft)" />
        <ellipse cx="158" cy="336" rx="12" ry="68" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
        <path d="M 176 256 Q 234 275 292 256" fill="none" stroke="#3b3355" strokeWidth="2.5" opacity="0.28" />
      </g>

      {/* Emblema do peito */}
      <rect x="210" y="296" width="48" height="48" rx="15" fill="#150e28" stroke={ACCENT} strokeWidth="1.5" />
      <text
        x="234" y="321"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize="27" fontWeight="800"
        fill={ACCENT} filter="url(#nori-glow-sm)"
      >
        N
      </text>

      {/* ── Cabeça ── */}
      <g clipPath="url(#nori-head-clip)">
        <rect x="145" y="56" width="178" height="162" fill={SHELL} />
        <rect x="145" y="56" width="178" height="162" fill="url(#nori-shade)" />
        <ellipse cx="194" cy="84" rx="44" ry="19" fill="#ffffff" opacity="0.6" filter="url(#nori-soft)" />
        <ellipse cx="147" cy="138" rx="11" ry="46" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
        <path d="M 174 70 Q 234 58 294 70" fill="none" stroke="#332c4d" strokeWidth="3" opacity="0.32" />
      </g>

      {/* Visor */}
      <rect x="162" y="74" width="144" height="122" rx="50" fill="url(#nori-visor)" />
      <ellipse cx="234" cy="90" rx="57" ry="10" fill="#ffffff" opacity="0.08" />
      <ellipse cx="200" cy="154" rx="29" ry="10" fill="#a78bfa" opacity="0.15" filter="url(#nori-soft-sm)" />
      <ellipse cx="268" cy="154" rx="29" ry="10" fill="#a78bfa" opacity="0.15" filter="url(#nori-soft-sm)" />

      {/* Olhos: arco com o topo pra cima (∩), como o "^_^" */}
      <g className="nori-lit" filter="url(#nori-glow-sm)">
        <path d="M 182 146 Q 200 123 218 146" fill="none" stroke={ACCENT} strokeWidth="11" strokeLinecap="round" />
        <path d="M 250 146 Q 268 123 286 146" fill="none" stroke={ACCENT} strokeWidth="11" strokeLinecap="round" />
      </g>

      {/* ── Braço esquerdo, mão aberta apresentando (na frente do tronco) ── */}
      <path d="M 180 262 L 148 310 L 118 276" fill="none" stroke={SHELL} strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-13" y="-2" width="26" height="4" rx="2" fill={JOINT} opacity="0.32" transform="translate(148 310) rotate(-41)" />
      <g transform="translate(102 246) rotate(-18)">
        <OpenHand />
      </g>
    </svg>
  );
}
