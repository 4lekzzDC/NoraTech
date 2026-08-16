// Nori — mascote da Noratech, desenhado em SVG.
//
// Vetor em vez de imagem: escala sem perder nitidez em qualquer tela, pesa
// alguns KB em vez de centenas e herda a paleta do site.
//
// Direção de design: assistente de tecnologia, não brinquedo. O que mantém a
// leitura "premium" aqui é subtração — casco branco/cinza com poucas peças,
// roxo usado só como luz (olhos, faixas, emblema) e nunca como cor de área,
// e nenhuma expressão exagerada. O volume vem de três camadas dentro de cada
// clipPath: cor base, sombra degradê na parte de baixo e brilho difuso em
// cima, mais um leve rim light roxo na borda, que é o que faz parecer um
// objeto iluminado pela cena em vez de um desenho chapado.

const SHELL = 'url(#nori-shell)';
const ACCENT = 'url(#nori-accent)';

export default function NoriRobot({ className = '', style = {} }) {
  return (
    <svg
      className={`nori-svg ${className}`}
      viewBox="0 0 440 520"
      role="img"
      aria-label="Nori, o assistente da Noratech"
      style={style}
    >
      <style>{`
        /* Só flutuação e glow: qualquer movimento além disso (acenar, piscar
           rápido) puxa a leitura de volta pro cartoon. */
        @keyframes nori-lit { 0%, 100% { opacity: 0.78; } 50% { opacity: 1; } }
        @keyframes nori-pool { 0%, 100% { opacity: 0.34; transform: scaleX(1); } 50% { opacity: 0.2; transform: scaleX(0.9); } }

        .nori-svg { display: block; width: 100%; height: auto; overflow: visible; }
        .nori-lit { animation: nori-lit 4.6s ease-in-out infinite; }
        .nori-lit.slow { animation-duration: 6.4s; animation-delay: 0.8s; }
        .nori-pool { transform-box: view-box; transform-origin: 220px 456px; animation: nori-pool 6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-lit, .nori-pool { animation: none; }
        }
      `}</style>

      <defs>
        <linearGradient id="nori-shell" x1="0.14" y1="0" x2="0.84" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="34%" stopColor="#f5f4f9" />
          <stop offset="72%" stopColor="#dad7e4" />
          <stop offset="100%" stopColor="#b0aac2" />
        </linearGradient>
        <linearGradient id="nori-joint" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#3d3855" />
          <stop offset="100%" stopColor="#16131f" />
        </linearGradient>
        <linearGradient id="nori-shade" x1="0.05" y1="0" x2="0.28" y2="1">
          <stop offset="0%" stopColor="#33285a" stopOpacity="0" />
          <stop offset="54%" stopColor="#33285a" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#241a45" stopOpacity="0.42" />
        </linearGradient>
        {/* mesmo vidro escuro do balão de fala — é o que amarra os dois */}
        <linearGradient id="nori-visor" x1="0.18" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#241b40" />
          <stop offset="55%" stopColor="#100b20" />
          <stop offset="100%" stopColor="#05030c" />
        </linearGradient>
        <linearGradient id="nori-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddd4ff" />
          <stop offset="52%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="nori-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        <clipPath id="nori-head-clip">
          <rect x="131" y="66" width="178" height="154" rx="68" />
        </clipPath>
        <clipPath id="nori-torso-clip">
          <path d="M 176 238 C 165 238, 158 251, 156 270 L 148 358 C 144 398, 172 428, 220 428 C 268 428, 296 398, 292 358 L 284 270 C 282 251, 275 238, 264 238 Z" />
        </clipPath>

        <filter id="nori-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nori-glow-sm" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
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
      </defs>

      <ellipse cx="220" cy="242" rx="192" ry="218" fill="url(#nori-halo)" />
      {/* poça de luz: o Nori flutua, então embaixo dele vai luz e não sombra */}
      <ellipse className="nori-pool" cx="220" cy="456" rx="88" ry="13" fill="#7C3AED" opacity="0.34" filter="url(#nori-soft)" />

      {/* Colarinho: largo o bastante para casar com a base achatada da cabeça,
          senão sobra um vão escuro que some no fundo e a cabeça parece flutuar
          solta acima do corpo. */}
      <rect x="197" y="200" width="46" height="46" rx="19" fill="url(#nori-joint)" />

      {/* Braços: finos, encostados no corpo, sem mãos articuladas — mão
          desenhada em detalhe é o que mais puxa a leitura pro infantil. */}
      <path d="M 170 272 C 150 288, 136 320, 131 352" fill="none" stroke={SHELL} strokeWidth="25" strokeLinecap="round" />
      <circle cx="131" cy="356" r="12.5" fill={SHELL} />
      <path d="M 270 272 C 290 288, 304 320, 309 352" fill="none" stroke={SHELL} strokeWidth="25" strokeLinecap="round" />
      <circle cx="309" cy="356" r="12.5" fill={SHELL} />

      {/* Tronco */}
      <g clipPath="url(#nori-torso-clip)">
        <path d="M 176 238 C 165 238, 158 251, 156 270 L 148 358 C 144 398, 172 428, 220 428 C 268 428, 296 398, 292 358 L 284 270 C 282 251, 275 238, 264 238 Z" fill={SHELL} />
        <path d="M 176 238 C 165 238, 158 251, 156 270 L 148 358 C 144 398, 172 428, 220 428 C 268 428, 296 398, 292 358 L 284 270 C 282 251, 275 238, 264 238 Z" fill="url(#nori-shade)" />
        <ellipse cx="186" cy="304" rx="22" ry="44" fill="#ffffff" opacity="0.48" filter="url(#nori-soft)" />
        {/* rim light roxo na borda esquerda */}
        <ellipse cx="146" cy="336" rx="12" ry="70" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
        {/* costura de painel: dá estrutura ao tronco, que sem ela vira um
            volume liso sem leitura de peça montada */}
        <path d="M 160 264 Q 220 279 280 264" fill="none" stroke="#463a70" strokeWidth="2" opacity="0.34" />
      </g>

      {/* Emblema do peito: o N fica gravado num anel fino, discreto. */}
      <circle cx="220" cy="324" r="30" fill="#a78bfa" opacity="0.09" filter="url(#nori-soft-sm)" />
      <circle className="nori-lit slow" cx="220" cy="324" r="21" fill="none" stroke={ACCENT} strokeWidth="1.6" opacity="0.85" />
      <text
        x="220" y="325"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize="21" fontWeight="700" letterSpacing="0.5"
        fill={ACCENT} filter="url(#nori-glow-sm)"
      >
        N
      </text>

      {/* Faixa de luz na base do tronco */}
      <path className="nori-lit slow" d="M 166 400 Q 220 424 274 400" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" filter="url(#nori-glow-sm)" />

      {/* Cabeça */}
      <g clipPath="url(#nori-head-clip)">
        <rect x="131" y="66" width="178" height="154" fill={SHELL} />
        <rect x="131" y="66" width="178" height="154" fill="url(#nori-shade)" />
        <ellipse cx="184" cy="94" rx="44" ry="19" fill="#ffffff" opacity="0.5" filter="url(#nori-soft)" />
        <ellipse cx="133" cy="148" rx="11" ry="48" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
      </g>

      {/* LED fino no topo da cabeça */}
      <rect className="nori-lit" x="209" y="73" width="22" height="5" rx="2.5" fill={ACCENT} filter="url(#nori-glow-sm)" />

      {/* Visor */}
      <rect x="147" y="84" width="146" height="112" rx="50" fill="url(#nori-visor)" />
      <ellipse cx="220" cy="99" rx="58" ry="10" fill="#ffffff" opacity="0.07" />
      <ellipse cx="190" cy="160" rx="30" ry="10" fill="#a78bfa" opacity="0.14" filter="url(#nori-soft-sm)" />
      <ellipse cx="250" cy="160" rx="30" ry="10" fill="#a78bfa" opacity="0.14" filter="url(#nori-soft-sm)" />

      {/* Olhos: arcos rasos e finos. A curva de leve pra cima mantém o
          semblante amigável; funda demais vira carinha de desenho. */}
      <g className="nori-lit" filter="url(#nori-glow-sm)">
        <path d="M 172 148 Q 190 132 208 148" fill="none" stroke={ACCENT} strokeWidth="9.5" strokeLinecap="round" />
        <path d="M 232 148 Q 250 132 268 148" fill="none" stroke={ACCENT} strokeWidth="9.5" strokeLinecap="round" />
      </g>

      {/* Sensores laterais, no lugar das orelhas-fone */}
      <rect className="nori-lit slow" x="134" y="124" width="8" height="34" rx="4" fill={ACCENT} opacity="0.9" filter="url(#nori-glow-sm)" />
      <rect className="nori-lit slow" x="298" y="124" width="8" height="34" rx="4" fill={ACCENT} opacity="0.9" filter="url(#nori-glow-sm)" />
    </svg>
  );
}
