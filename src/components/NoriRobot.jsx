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
const JOINT = 'url(#nori-joint)';

// Mão aberta, em coordenadas locais com a palma na origem — o grupo inteiro é
// posicionado depois. Aberta e não apontando: um dedo só levantado lê como
// gesto obsceno dependendo do ângulo.
function OpenHand() {
  return (
    <g>
      {/* palma */}
      <rect x="-21" y="-15" width="42" height="41" rx="18" fill={SHELL} />
      {/* dedos, abrindo em leque */}
      {[
        { x: -16, y: -11, r: -25 },
        { x: -5.5, y: -17, r: -9 },
        { x: 5.5, y: -17, r: 6 },
        { x: 16, y: -10, r: 21 },
      ].map((f, i) => (
        <rect
          key={i}
          x="-6.5" y="-35" width="13" height="38" rx="6.5" fill={SHELL}
          transform={`translate(${f.x} ${f.y}) rotate(${f.r})`}
        />
      ))}
      {/* polegar */}
      <rect
        x="-6.5" y="-28" width="13" height="30" rx="6.5" fill={SHELL}
        transform="translate(-21 8) rotate(-74)"
      />
    </g>
  );
}

export default function NoriRobot({ className = '', style = {} }) {
  return (
    <svg
      className={`nori-svg ${className}`}
      viewBox="0 0 440 540"
      role="img"
      aria-label="Nori, o mascote da Noratech"
      style={style}
    >
      <style>{`
        @keyframes nori-blink { 0%, 91%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.14); } }
        @keyframes nori-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-7deg); } }
        @keyframes nori-ear { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes nori-dash { 0%, 100% { opacity: 0.35; transform: translateX(0); } 50% { opacity: 1; transform: translateX(4px); } }
        @keyframes nori-shadow { 0%, 100% { transform: scaleX(1); opacity: 0.45; } 50% { transform: scaleX(0.86); opacity: 0.28; } }

        .nori-svg { display: block; width: 100%; height: auto; overflow: visible; }
        /* transform-box:view-box deixa o transform-origin em coordenadas do
           viewBox, então dá pra fixar exatamente no ombro / centro dos olhos. */
        .nori-eyes { transform-box: view-box; transform-origin: 239px 152px; animation: nori-blink 6s ease-in-out infinite; }
        .nori-arm-up { transform-box: view-box; transform-origin: 168px 296px; animation: nori-wave 3.8s ease-in-out infinite; }
        .nori-ear-ring { animation: nori-ear 2.6s ease-in-out infinite; }
        .nori-ear-ring.b { animation-delay: 0.5s; }
        .nori-dashes { transform-box: view-box; transform-origin: 375px 80px; animation: nori-dash 2.4s ease-in-out infinite; }
        .nori-shadow { transform-box: view-box; transform-origin: 239px 522px; animation: nori-shadow 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-eyes, .nori-arm-up, .nori-ear-ring, .nori-dashes, .nori-shadow { animation: none; }
        }
      `}</style>

      <defs>
        <linearGradient id="nori-shell" x1="0.12" y1="0" x2="0.86" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="36%" stopColor="#f1eff8" />
          <stop offset="70%" stopColor="#cec9dd" />
          <stop offset="100%" stopColor="#a49ec0" />
        </linearGradient>
        {/* juntas escuras dos ombros e do pescoço */}
        <linearGradient id="nori-joint" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#453f60" />
          <stop offset="100%" stopColor="#1a1628" />
        </linearGradient>
        {/* sombra interna: transparente em cima, escurecendo até a base */}
        <linearGradient id="nori-shade" x1="0.05" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#3b2f63" stopOpacity="0" />
          <stop offset="52%" stopColor="#3b2f63" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#281d4c" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="nori-visor" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#241b40" />
          <stop offset="52%" stopColor="#100b20" />
          <stop offset="100%" stopColor="#05030c" />
        </linearGradient>
        <linearGradient id="nori-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2d9ff" />
          <stop offset="52%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="nori-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        <clipPath id="nori-head-clip">
          <rect x="132" y="42" width="214" height="200" rx="92" />
        </clipPath>
        <clipPath id="nori-body-clip">
          <rect x="160" y="252" width="158" height="262" rx="62" />
        </clipPath>

        <filter id="nori-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* brilho dos olhos mais fechado: com desfoque alto o arco vira borrão */}
        <filter id="nori-eye-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
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

      <ellipse cx="239" cy="248" rx="198" ry="232" fill="url(#nori-halo)" opacity="0.55" />
      <ellipse className="nori-shadow" cx="239" cy="522" rx="114" ry="15" fill="#7C3AED" opacity="0.4" filter="url(#nori-soft)" />

      {/* Pescoço: só uma faixa escura estreita aparece entre a cabeça e o
          tronco, o resto fica escondido atrás dos dois. */}
      <rect x="210" y="220" width="58" height="50" rx="22" fill={JOINT} />

      {/* Orelhas / fones */}
      {[134, 344].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="162" r="34" fill={SHELL} />
          <circle cx={cx} cy="162" r="33" fill="url(#nori-shade)" />
          <circle cx={cx} cy="162" r="24" fill="url(#nori-visor)" />
          <circle
            className={`nori-ear-ring${i ? ' b' : ''}`}
            cx={cx} cy="162" r="15"
            fill="none" stroke="url(#nori-accent)" strokeWidth="7"
            filter="url(#nori-glow)"
          />
        </g>
      ))}

      {/* Cabeça */}
      <g clipPath="url(#nori-head-clip)">
        <rect x="132" y="42" width="214" height="200" fill={SHELL} />
        <rect x="132" y="42" width="214" height="200" fill="url(#nori-shade)" />
        <ellipse cx="194" cy="84" rx="52" ry="24" fill="#ffffff" opacity="0.62" filter="url(#nori-soft)" />
      </g>

      {/* Visor */}
      <rect x="156" y="72" width="166" height="132" rx="58" fill="url(#nori-visor)" />
      <ellipse cx="239" cy="92" rx="68" ry="13" fill="#ffffff" opacity="0.07" />
      {/* luz que os olhos espalham no vidro */}
      <ellipse cx="204" cy="170" rx="34" ry="11" fill="#a78bfa" opacity="0.16" filter="url(#nori-soft-sm)" />
      <ellipse cx="274" cy="170" rx="34" ry="11" fill="#a78bfa" opacity="0.16" filter="url(#nori-soft-sm)" />

      {/* Olhos: arco com o topo pra cima (∩), como o "^_^". Invertido (∪) lê
          como "u_u" — sono ou mau humor. */}
      <g className="nori-eyes" filter="url(#nori-eye-glow)">
        <path d="M 181 156 A 23 23 0 0 1 227 156" fill="none" stroke="url(#nori-accent)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 251 156 A 23 23 0 0 1 297 156" fill="none" stroke="url(#nori-accent)" strokeWidth="12" strokeLinecap="round" />
      </g>

      {/* Tracinhos de "animação" saindo da cabeça */}
      <g className="nori-dashes" stroke="url(#nori-accent)" strokeWidth="6" strokeLinecap="round" filter="url(#nori-glow)">
        <path d="M 358 60 L 371 46" />
        <path d="M 376 82 L 394 76" />
        <path d="M 372 108 L 389 114" />
      </g>

      {/* Tronco */}
      <g clipPath="url(#nori-body-clip)">
        <rect x="160" y="252" width="158" height="262" fill={SHELL} />
        <rect x="160" y="252" width="158" height="262" fill="url(#nori-shade)" />
        <ellipse cx="200" cy="306" rx="28" ry="46" fill="#ffffff" opacity="0.5" filter="url(#nori-soft)" />
      </g>

      {/* N do peito, direto no casco e brilhando */}
      <text
        x="239" y="362"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize="78" fontWeight="800"
        fill="url(#nori-accent)" filter="url(#nori-glow)"
      >
        N
      </text>

      {/* Braço direito — desce e sai do quadro */}
      <circle cx="310" cy="296" r="21" fill={JOINT} />
      <path d="M 314 306 L 338 372 L 342 448" fill="none" stroke={SHELL} strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />

      {/* Braço esquerdo levantado, mão aberta. O cotovelo fica bem afastado do
          tronco para o antebraço não cruzar o N. Fica por último para passar à
          frente do tronco e da orelha.
          A junta é pouco maior que a espessura do braço: sobra só uma borda
          escura de encaixe, em vez de um círculo que parece um buraco. */}
      <g className="nori-arm-up">
        <circle cx="168" cy="296" r="21" fill={JOINT} />
        <path d="M 168 304 L 132 362 L 114 300" fill="none" stroke={SHELL} strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
        {/* punho escuro, como na referência */}
        <circle cx="112" cy="292" r="18" fill={JOINT} />
        <g transform="translate(102 260) rotate(-14)">
          <OpenHand />
        </g>
      </g>
    </svg>
  );
}
