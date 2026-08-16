import { useState } from 'react';
import NoriVector from './NoriVector';

// Nori — mascote da Noratech.
//
// A arte é um PNG recortado (fundo transparente), porque render 3D tem
// oclusão de contato, reflexo e sombra suave que SVG escrito à mão não
// alcança. Só o robô vem na imagem: balão e chips seguem em HTML para
// continuarem responsivos, acompanharem o tema claro e manterem o texto
// selecionável, indexável e legível por leitor de tela.
//
// O caminho aponta para public/ em vez de um import de src/assets de
// propósito: assim o arquivo pode ser trocado sem mexer no código, e a
// ausência dele não quebra o build — cai no vetor de reserva.
const ART_SRC = '/nori.png';

export default function NoriRobot({ className = '', style = {} }) {
  const [semArte, setSemArte] = useState(false);

  if (semArte) return <NoriVector className={className} style={style} />;

  return (
    <div className={`nori-art ${className}`} style={style}>
      <style>{`
        .nori-art { position: relative; display: block; width: 100%; }
        .nori-art img { position: relative; display: block; width: 100%; height: auto; }

        /* O recorte perde o glow que existia no render, então ele é
           reconstruído aqui — sem isso o robô fica "colado" no fundo. */
        .nori-art-halo {
          position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%);
          width: 94%; aspect-ratio: 1; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.40) 0%, transparent 62%);
          filter: blur(28px); pointer-events: none;
        }
        /* Ele flutua, então embaixo vai poça de luz e não sombra */
        .nori-art-pool {
          position: absolute; left: 50%; bottom: 1%; transform: translateX(-50%);
          width: 52%; height: 26px; border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(124,58,237,0.6) 0%, transparent 70%);
          filter: blur(9px); pointer-events: none;
          animation: nori-art-pool 6s ease-in-out infinite;
        }
        @keyframes nori-art-pool {
          0%, 100% { opacity: 0.75; transform: translateX(-50%) scaleX(1); }
          50% { opacity: 0.45; transform: translateX(-50%) scaleX(0.88); }
        }

        @media (prefers-reduced-motion: reduce) {
          .nori-art-pool { animation: none; }
        }
      `}</style>

      <span className="nori-art-halo" aria-hidden="true" />
      <span className="nori-art-pool" aria-hidden="true" />
      <img
        src={ART_SRC}
        alt="Nori, o assistente da Noratech"
        draggable="false"
        onError={() => setSemArte(true)}
      />
    </div>
  );
}
