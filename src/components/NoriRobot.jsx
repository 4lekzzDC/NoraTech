// Nori — mascote da Noratech, desenhado em SVG.
//
// Vetor em vez de imagem: escala sem perder nitidez em qualquer tela, pesa
// alguns KB em vez de centenas, herda a paleta roxa do site e — o principal —
// as partes ficam animáveis individualmente (olhos piscam, orelhas pulsam,
// braço acena), o que um PNG não permite.

const SHELL = 'url(#nori-shell)';

export default function NoriRobot({ className = '', style = {} }) {
  return (
    <svg
      className={`nori-svg ${className}`}
      viewBox="0 0 420 512"
      role="img"
      aria-label="Nori, o mascote da Noratech"
      style={style}
    >
      <style>{`
        @keyframes nori-blink { 0%, 91%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.18); } }
        @keyframes nori-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
        @keyframes nori-ear { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes nori-antenna { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }
        @keyframes nori-shadow { 0%, 100% { transform: scaleX(1); opacity: 0.5; } 50% { transform: scaleX(0.88); opacity: 0.32; } }

        .nori-svg { display: block; width: 100%; height: auto; overflow: visible; }
        .nori-eyes { transform-box: fill-box; transform-origin: center; animation: nori-blink 6s ease-in-out infinite; }
        .nori-arm-up { transform-box: fill-box; transform-origin: 30% 95%; animation: nori-wave 3.6s ease-in-out infinite; }
        .nori-ear-ring { animation: nori-ear 2.6s ease-in-out infinite; }
        .nori-ear-ring.b { animation-delay: 0.5s; }
        .nori-antenna-ball { transform-box: fill-box; transform-origin: center; animation: nori-antenna 2.2s ease-in-out infinite; }
        .nori-shadow { transform-box: fill-box; transform-origin: center; animation: nori-shadow 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-eyes, .nori-arm-up, .nori-ear-ring, .nori-antenna-ball, .nori-shadow { animation: none; }
        }
      `}</style>

      <defs>
        {/* Casco: claro em cima, sombreado embaixo — dá volume sem render 3D. */}
        <linearGradient id="nori-shell" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#fbfaff" />
          <stop offset="45%" stopColor="#ddd9ea" />
          <stop offset="100%" stopColor="#9c96b4" />
        </linearGradient>
        <linearGradient id="nori-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#221a3a" />
          <stop offset="100%" stopColor="#0b0714" />
        </linearGradient>
        <linearGradient id="nori-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="nori-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        <filter id="nori-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nori-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Halo roxo atrás do corpo */}
      <ellipse cx="210" cy="250" rx="185" ry="215" fill="url(#nori-halo)" opacity="0.5" />

      {/* Sombra no chão */}
      <ellipse className="nori-shadow" cx="210" cy="494" rx="112" ry="17" fill="#7C3AED" opacity="0.45" filter="url(#nori-soft)" />

      {/* Antena */}
      <rect x="204" y="44" width="12" height="26" rx="6" fill={SHELL} />
      <circle className="nori-antenna-ball" cx="210" cy="34" r="11" fill="url(#nori-accent)" filter="url(#nori-glow)" />

      {/* Orelhas / fones */}
      {[96, 324].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="152" r="34" fill={SHELL} />
          <circle cx={cx} cy="152" r="21" fill="url(#nori-face)" />
          <circle
            className={`nori-ear-ring${i ? ' b' : ''}`}
            cx={cx} cy="152" r="12"
            fill="none" stroke="url(#nori-accent)" strokeWidth="6"
            filter="url(#nori-glow)"
          />
        </g>
      ))}

      {/* Pescoço */}
      <rect x="186" y="230" width="48" height="34" rx="16" fill="#8f89a6" />

      {/* Corpo */}
      <rect x="126" y="250" width="168" height="228" rx="64" fill={SHELL} />
      {/* brilho lateral esquerdo do corpo */}
      <rect x="140" y="270" width="20" height="150" rx="10" fill="#ffffff" opacity="0.35" />

      {/* Braço baixo */}
      <path d="M 278 302 L 302 352 L 300 392" fill="none" stroke={SHELL} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="300" cy="400" r="22" fill={SHELL} />

      {/* Peito com o N */}
      <circle cx="210" cy="344" r="43" fill="url(#nori-face)" />
      <circle cx="210" cy="344" r="43" fill="none" stroke="url(#nori-accent)" strokeWidth="2" opacity="0.45" />
      <text
        x="210" y="344"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize="36" fontWeight="800"
        fill="url(#nori-accent)" filter="url(#nori-glow)"
      >
        N
      </text>

      {/* Cabeça */}
      <rect x="104" y="62" width="212" height="182" rx="70" fill={SHELL} />
      {/* brilho no topo da cabeça */}
      <ellipse cx="168" cy="98" rx="42" ry="18" fill="#ffffff" opacity="0.5" />

      {/* Visor */}
      <rect x="124" y="84" width="172" height="138" rx="58" fill="url(#nori-face)" />
      <ellipse cx="210" cy="106" rx="70" ry="14" fill="#ffffff" opacity="0.06" />

      {/* Olhos sorrindo */}
      <g className="nori-eyes" filter="url(#nori-glow)">
        <path d="M 150 142 Q 172 174 194 142" fill="none" stroke="url(#nori-accent)" strokeWidth="13" strokeLinecap="round" />
        <path d="M 226 142 Q 248 174 270 142" fill="none" stroke="url(#nori-accent)" strokeWidth="13" strokeLinecap="round" />
      </g>

      {/* Braço levantado (aponta pra cima). Fica por último para passar à
          frente da orelha, e afastado do rosto para não cobrir o visor. */}
      <g className="nori-arm-up">
        <path d="M 140 312 L 84 292 L 58 240" fill="none" stroke={SHELL} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="56" cy="232" r="23" fill={SHELL} />
        <rect x="47" y="182" width="18" height="52" rx="9" fill={SHELL} />
      </g>
    </svg>
  );
}
