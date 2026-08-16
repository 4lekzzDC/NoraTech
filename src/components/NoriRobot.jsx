// Nori — mascote da Noratech, desenhado em SVG.
//
// Vetor em vez de imagem: escala sem perder nitidez em qualquer tela, pesa
// alguns KB em vez de centenas, herda a paleta roxa do site e — o principal —
// as partes ficam animáveis individualmente (olhos piscam, orelhas pulsam,
// braço acena), o que um PNG não permite.
//
// O volume vem de três camadas dentro de cada clipPath: cor base, sombra
// degradê embaixo e brilho difuso em cima. É o que separa um desenho "chapado"
// de um que parece ter forma.

const SHELL = 'url(#nori-shell)';

export default function NoriRobot({ className = '', style = {} }) {
  return (
    <svg
      className={`nori-svg ${className}`}
      viewBox="0 0 420 520"
      role="img"
      aria-label="Nori, o mascote da Noratech"
      style={style}
    >
      <style>{`
        @keyframes nori-blink { 0%, 91%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.16); } }
        @keyframes nori-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-9deg); } }
        @keyframes nori-ear { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes nori-antenna { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.16); } }
        @keyframes nori-shadow { 0%, 100% { transform: scaleX(1); opacity: 0.45; } 50% { transform: scaleX(0.86); opacity: 0.28; } }

        .nori-svg { display: block; width: 100%; height: auto; overflow: visible; }
        .nori-eyes { transform-box: fill-box; transform-origin: center; animation: nori-blink 6s ease-in-out infinite; }
        .nori-arm-up { transform-box: fill-box; transform-origin: 88% 92%; animation: nori-wave 3.6s ease-in-out infinite; }
        .nori-ear-ring { animation: nori-ear 2.6s ease-in-out infinite; }
        .nori-ear-ring.b { animation-delay: 0.5s; }
        .nori-antenna-ball { transform-box: fill-box; transform-origin: center; animation: nori-antenna 2.2s ease-in-out infinite; }
        .nori-shadow { transform-box: fill-box; transform-origin: center; animation: nori-shadow 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-eyes, .nori-arm-up, .nori-ear-ring, .nori-antenna-ball, .nori-shadow { animation: none; }
        }
      `}</style>

      <defs>
        <linearGradient id="nori-shell" x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="34%" stopColor="#efedf6" />
          <stop offset="68%" stopColor="#cbc7da" />
          <stop offset="100%" stopColor="#a49ebc" />
        </linearGradient>
        {/* sombra interna: transparente em cima, escurecendo até a base */}
        <linearGradient id="nori-shade" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#3b2f63" stopOpacity="0" />
          <stop offset="55%" stopColor="#3b2f63" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#2c2150" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id="nori-visor" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#2b2148" />
          <stop offset="55%" stopColor="#140e26" />
          <stop offset="100%" stopColor="#080512" />
        </linearGradient>
        <linearGradient id="nori-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddd6fe" />
          <stop offset="55%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="nori-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        <clipPath id="nori-head-clip">
          <rect x="100" y="54" width="220" height="194" rx="72" />
        </clipPath>
        <clipPath id="nori-body-clip">
          <rect x="134" y="244" width="152" height="228" rx="64" />
        </clipPath>

        <filter id="nori-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nori-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id="nori-soft-sm" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* brilho dos olhos mais fechado que o geral: com desfoque alto o
            crescente vira um borrão e perde o desenho da curva */}
        <filter id="nori-eye-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="210" cy="256" rx="188" ry="222" fill="url(#nori-halo)" opacity="0.55" />
      <ellipse className="nori-shadow" cx="210" cy="494" rx="110" ry="16" fill="#7C3AED" opacity="0.4" filter="url(#nori-soft)" />

      {/* Antena */}
      <rect x="204" y="26" width="12" height="36" rx="6" fill={SHELL} />
      <circle className="nori-antenna-ball" cx="210" cy="22" r="12" fill="url(#nori-accent)" filter="url(#nori-glow)" />

      {/* Orelhas / fones */}
      {[84, 336].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="150" r="31" fill={SHELL} />
          <circle cx={cx} cy="150" r="30" fill="url(#nori-shade)" />
          <circle cx={cx} cy="150" r="19" fill="url(#nori-visor)" />
          <circle
            className={`nori-ear-ring${i ? ' b' : ''}`}
            cx={cx} cy="150" r="11"
            fill="none" stroke="url(#nori-accent)" strokeWidth="6"
            filter="url(#nori-glow)"
          />
        </g>
      ))}

      {/* Corpo */}
      <g clipPath="url(#nori-body-clip)">
        <rect x="134" y="244" width="152" height="228" fill={SHELL} />
        <rect x="134" y="244" width="152" height="228" fill="url(#nori-shade)" />
        <ellipse cx="176" cy="292" rx="30" ry="46" fill="#ffffff" opacity="0.5" filter="url(#nori-soft)" />
      </g>

      {/* Ombros — juntam os braços ao corpo em vez de deixá-los soltos */}
      <circle cx="144" cy="302" r="27" fill={SHELL} />
      <circle cx="276" cy="302" r="27" fill={SHELL} />

      {/* Braço baixo */}
      <path d="M 276 302 L 306 348 L 304 394" fill="none" stroke={SHELL} strokeWidth="33" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="304" cy="402" r="22" fill={SHELL} />

      {/* Peito com o N */}
      <circle cx="210" cy="352" r="41" fill="url(#nori-visor)" />
      <circle cx="210" cy="352" r="41" fill="none" stroke="url(#nori-accent)" strokeWidth="2" opacity="0.4" />
      <text
        x="210" y="352"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize="34" fontWeight="800"
        fill="url(#nori-accent)" filter="url(#nori-glow)"
      >
        N
      </text>

      {/* Cabeça */}
      <g clipPath="url(#nori-head-clip)">
        <rect x="100" y="54" width="220" height="194" fill={SHELL} />
        <rect x="100" y="54" width="220" height="194" fill="url(#nori-shade)" />
        <ellipse cx="163" cy="94" rx="52" ry="24" fill="#ffffff" opacity="0.62" filter="url(#nori-soft)" />
      </g>

      {/* Visor */}
      <rect x="122" y="78" width="176" height="146" rx="62" fill="url(#nori-visor)" />
      {/* reflexo do vidro */}
      <ellipse cx="210" cy="100" rx="74" ry="15" fill="#ffffff" opacity="0.07" />
      {/* luz que os olhos espalham no visor */}
      <ellipse cx="173" cy="176" rx="34" ry="12" fill="#a78bfa" opacity="0.16" filter="url(#nori-soft-sm)" />
      <ellipse cx="247" cy="176" rx="34" ry="12" fill="#a78bfa" opacity="0.16" filter="url(#nori-soft-sm)" />

      {/* Olhos sorrindo: arco com o topo pra cima (∩), como o "^_^". A curva
          invertida (∪) lê como "u_u" — sono ou mau humor. Crescente
          preenchido, grosso no meio e afinando nas pontas, porque um traço de
          espessura constante fica com cara de sobrancelha franzida. */}
      <g className="nori-eyes" filter="url(#nori-eye-glow)">
        <path d="M 144 164 C 152 128, 188 128, 196 164 C 188 146, 152 146, 144 164 Z" fill="url(#nori-accent)" />
        <path d="M 224 164 C 232 128, 268 128, 276 164 C 268 146, 232 146, 224 164 Z" fill="url(#nori-accent)" />
      </g>

      {/* Braço levantado. Fica por último para passar à frente da orelha, e
          afastado do rosto para não cobrir o visor. */}
      <g className="nori-arm-up">
        <path d="M 144 302 L 98 296 L 74 240" fill="none" stroke={SHELL} strokeWidth="33" strokeLinecap="round" strokeLinejoin="round" />
        {/* mão: palma + indicador apontando pra cima */}
        <circle cx="72" cy="230" r="23" fill={SHELL} />
        <rect x="63" y="186" width="18" height="48" rx="9" fill={SHELL} />
      </g>
    </svg>
  );
}
