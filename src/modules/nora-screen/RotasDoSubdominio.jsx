import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import NoraScreenHome from './pages/NoraScreenHome.jsx';
import NoraScreenSala from './pages/NoraScreenSala.jsx';

// ═══════════════════════════════════════════════════════════════
// As rotas do Nora Screen quando ele é o site inteiro.
//
// Em transmissao.noratech.com.br o produto ocupa a raiz: a home fica em
// `/` e a sala em `/sala/CODIGO`. O resto da NoraTech não é montado aqui
// de propósito — montar faria transmissao.noratech.com.br/admin
// responder, e isso não é endereço de nada.
// ═══════════════════════════════════════════════════════════════

// Sala pedida pelo caminho antigo dentro do subdomínio: leva à forma
// limpa sem trocar de host, preservando o código que veio no link.
function SalaPeloCaminhoAntigo() {
  const { codigo } = useParams();
  return <Navigate to={`/sala/${codigo}`} replace />;
}

export default function RotasDoSubdominio() {
  return (
    <Routes>
      <Route path="/" element={<NoraScreenHome />} />
      <Route path="/sala/:codigo" element={<NoraScreenSala />} />
      {/* Salas são canais efêmeros: "Ver salas" é um overlay na entrada. */}
      <Route path="/salas" element={<Navigate to="/" replace />} />
      {/* Compatibilidade com os links de /transmissao já espalhados por aí. */}
      <Route path="/transmissao" element={<Navigate to="/" replace />} />
      <Route path="/transmissao/sala/:codigo" element={<SalaPeloCaminhoAntigo />} />
      {/* Qualquer outro caminho no subdomínio volta para a entrada. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
