// Nori — mascote da Noratech, desenhado em SVG.
//
// Vetor em vez de imagem: escala sem perder nitidez em qualquer tela, pesa
// alguns KB em vez de centenas e herda a paleta do site.
//
// O que dá a leitura "renderizado em 3D" sem ser um render: (1) juntas
// escuras separando cada segmento do membro, que é o que faz parecer máquina
// montada e não boneco de peça única; (2) três camadas dentro de cada
// clipPath — cor base, sombra degradê embaixo e brilho difuso em cima; (3)
// rim light roxo nas bordas, como se a cena iluminasse o casco.

const SHELL = 'url(#nori-shell)';
const JOINT = 'url(#nori-joint)';
const ACCENT = 'url(#nori-accent)';

// Mão aberta em gesto de apresentação, em coordenadas locais com a palma na
// origem — o grupo inteiro é posicionado e girado depois.
function OpenHand() {
  return (
    <g>
      <rect x="-18" y="-12" width="36" height="36" rx="15" fill={SHELL} />
      {[
        { x: -14, y: -9, r: -26, h: 32 },
        { x: -4.5, y: -14, r: -10, h: 34 },
        { x: 5.5, y: -14, r: 6, h: 34 },
        { x: 15, y: -8, r: 22, h: 30 },
      ].map((f, i) => (
        <rect
          key={i}
          x="-5.5" y={-f.h + 2} width="11" height={f.h} rx="5.5" fill={SHELL}
          transform={`translate(${f.x} ${f.y}) rotate(${f.r})`}
        />
      ))}
      <rect
        x="-5.5" y="-22" width="11" height="26" rx="5.5" fill={SHELL}
        transform="translate(-18 8) rotate(-76)"
      />
      {/* vinco escuro da base dos dedos */}
      <rect x="-15" y="-10" width="30" height="6" rx="3" fill={JOINT} opacity="0.55" />
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
        .nori-pool { transform-box: view-box; transform-origin: 234px 448px; animation: nori-pool 6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nori-lit, .nori-pool { animation: none; }
        }
      `}</style>

      <defs>
        <linearGradient id="nori-shell" x1="0.12" y1="0" x2="0.86" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#f7f6fb" />
          <stop offset="66%" stopColor="#d8d4e4" />
          <stop offset="100%" stopColor="#aaa4bf" />
        </linearGradient>
        <linearGradient id="nori-joint" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#2e2a3d" />
          <stop offset="100%" stopColor="#0c0a13" />
        </linearGradient>
        <linearGradient id="nori-shade" x1="0.05" y1="0" x2="0.28" y2="1">
          <stop offset="0%" stopColor="#33285a" stopOpacity="0" />
          <stop offset="54%" stopColor="#33285a" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#241a45" stopOpacity="0.4" />
        </linearGradient>
        {/* mesmo vidro escuro do balão de fala — é o que amarra os dois */}
        <linearGradient id="nori-visor" x1="0.18" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#221a3c" />
          <stop offset="52%" stopColor="#0d091b" />
          <stop offset="100%" stopColor="#040209" />
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
          <rect x="138" y="50" width="192" height="172" rx="62" />
        </clipPath>
        <clipPath id="nori-torso-clip">
          <path d="M 198 238 C 180 238, 170 252, 167 272 L 160 338 C 156 384, 184 412, 234 412 C 284 412, 312 384, 308 338 L 301 272 C 298 252, 288 238, 270 238 Z" />
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
      <ellipse className="nori-pool" cx="234" cy="448" rx="96" ry="14" fill="#7C3AED" opacity="0.36" filter="url(#nori-soft)" />

      {/* ── Fones laterais (atrás da cabeça) ── */}
      {[{ hx: 118, rx: 133 }, { hx: 308, rx: 335 }].map((e) => (
        <g key={e.hx}>
          <rect x={e.hx} y="106" width="34" height="66" rx="17" fill={JOINT} />
          <circle className="nori-lit" cx={e.rx} cy="139" r="13" fill="none" stroke={ACCENT} strokeWidth="6" filter="url(#nori-glow)" />
        </g>
      ))}

      {/* Pescoço */}
      <rect x="210" y="198" width="48" height="52" rx="18" fill={JOINT} />

      {/* ── Braço direito, relaxado ao lado (atrás do tronco) ── */}
      <path d="M 288 264 L 310 318" fill="none" stroke={SHELL} strokeWidth="30" strokeLinecap="round" />
      <circle cx="313" cy="324" r="14" fill={JOINT} />
      <path d="M 315 330 L 320 372" fill="none" stroke={SHELL} strokeWidth="27" strokeLinecap="round" />
      <circle cx="321" cy="378" r="11" fill={JOINT} />
      <rect x="306" y="382" width="31" height="33" rx="15" fill={SHELL} />
      <rect x="311" y="389" width="21" height="5" rx="2.5" fill={JOINT} opacity="0.5" />

      {/* ── Tronco ── */}
      <g clipPath="url(#nori-torso-clip)">
        <path d="M 198 238 C 180 238, 170 252, 167 272 L 160 338 C 156 384, 184 412, 234 412 C 284 412, 312 384, 308 338 L 301 272 C 298 252, 288 238, 270 238 Z" fill={SHELL} />
        <path d="M 198 238 C 180 238, 170 252, 167 272 L 160 338 C 156 384, 184 412, 234 412 C 284 412, 312 384, 308 338 L 301 272 C 298 252, 288 238, 270 238 Z" fill="url(#nori-shade)" />
        <ellipse cx="198" cy="300" rx="24" ry="46" fill="#ffffff" opacity="0.5" filter="url(#nori-soft)" />
        <ellipse cx="158" cy="336" rx="12" ry="66" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
        {/* costura de painel do peitoral */}
        <path d="M 174 266 Q 234 282 294 266" fill="none" stroke="#2a2340" strokeWidth="2.5" opacity="0.3" />
      </g>

      {/* Ombros: pouco maiores que a espessura do braço, então sobra só uma
          borda escura de encaixe — círculo grande vira bola preta no ombro. */}
      <circle cx="180" cy="262" r="21" fill={JOINT} />
      <circle cx="288" cy="262" r="21" fill={JOINT} />

      {/* Emblema do peito */}
      <rect x="210" y="296" width="48" height="48" rx="15" fill="#120c22" stroke={ACCENT} strokeWidth="1.5" opacity="0.95" />
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
        <rect x="138" y="50" width="192" height="172" fill={SHELL} />
        <rect x="138" y="50" width="192" height="172" fill="url(#nori-shade)" />
        <ellipse cx="192" cy="80" rx="48" ry="20" fill="#ffffff" opacity="0.62" filter="url(#nori-soft)" />
        <ellipse cx="140" cy="140" rx="11" ry="50" fill="#a78bfa" opacity="0.5" filter="url(#nori-soft-sm)" />
        {/* costura do capacete */}
        <path d="M 168 66 Q 234 53 300 66" fill="none" stroke="#211b33" strokeWidth="3" opacity="0.4" />
      </g>

      {/* Visor */}
      <rect x="156" y="68" width="156" height="134" rx="54" fill="url(#nori-visor)" />
      <ellipse cx="234" cy="86" rx="62" ry="12" fill="#ffffff" opacity="0.08" />
      <ellipse cx="206" cy="160" rx="32" ry="11" fill="#a78bfa" opacity="0.15" filter="url(#nori-soft-sm)" />
      <ellipse cx="262" cy="160" rx="32" ry="11" fill="#a78bfa" opacity="0.15" filter="url(#nori-soft-sm)" />

      {/* Olhos: arco com o topo pra cima (∩), como o "^_^" */}
      <g className="nori-lit" filter="url(#nori-glow-sm)">
        <path d="M 186 146 Q 206 120 226 146" fill="none" stroke={ACCENT} strokeWidth="11" strokeLinecap="round" />
        <path d="M 242 146 Q 262 120 282 146" fill="none" stroke={ACCENT} strokeWidth="11" strokeLinecap="round" />
      </g>

      {/* ── Braço esquerdo, mão aberta apresentando (na frente do tronco) ── */}
      <path d="M 180 264 L 152 310" fill="none" stroke={SHELL} strokeWidth="30" strokeLinecap="round" />
      <circle cx="150" cy="315" r="14" fill={JOINT} />
      <path d="M 147 310 L 118 280" fill="none" stroke={SHELL} strokeWidth="27" strokeLinecap="round" />
      <circle cx="115" cy="276" r="11.5" fill={JOINT} />
      <g transform="translate(100 248) rotate(-20)">
        <OpenHand />
      </g>
    </svg>
  );
}
