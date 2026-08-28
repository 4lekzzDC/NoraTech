import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { estadoDeManutencao, useIsDeveloper } from '../lib/dev';

// Portão de manutenção.
//
// O QUE ISTO É: um bloqueio de TELA. Impede que gente use o produto durante uma
// migração. Quem tem a anon key — que é pública e está no bundle — continua
// alcançando o PostgREST com o modo ligado, então isto não contém quem está
// tentando entrar à força. Para isso seria preciso derrubar o projeto ou pôr um
// WAF na frente.
//
// /login NUNCA é bloqueada, e não é detalhe: o bypass depende de estar logado
// como developer. Bloquear a porta de entrada trancaria você do lado de fora do
// próprio site, com o modo ligado e nenhum jeito de desligar pela interface.
// /proposta também é livre: é a página pública que o cliente abre pelo
// link da proposta, sem login — bloquear ela em manutenção derrubaria o
// aceite de uma proposta que o cliente estava prestes a assinar.
const LIVRES = ['/login', '/cadastro', '/redefinir-senha', '/recuperar-senha', '/proposta'];

export default function MaintenanceGate({ children }) {
  const { pathname } = useLocation();
  const { isDeveloper, loading: checandoDev } = useIsDeveloper();
  const [estado, setEstado] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    estadoDeManutencao()
      .then((e) => { if (ativo) setEstado(e); })
      // Falha ao consultar não pode derrubar o site. Se não dá para saber se
      // está em manutenção, o certo é deixar passar: um site no ar por engano
      // é melhor que um site fora do ar por engano.
      .catch(() => { if (ativo) setEstado({ maintenance_mode: false }); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  if (carregando || checandoDev) return children;
  if (!estado?.maintenance_mode) return children;
  if (isDeveloper) return <><FaixaDeManutencao />{children}</>;
  if (LIVRES.some((r) => pathname.startsWith(r))) return children;

  return <PaginaDeManutencao mensagem={estado.maintenance_message} />;
}

// Faixa fixa para o developer. Sem ela, navegar normalmente com o modo ligado
// dá a impressão de que está tudo no ar — e o modo fica esquecido ligado.
function FaixaDeManutencao() {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#f59e0b', color: '#1a1205', textAlign: 'center',
      padding: '7px 14px', fontSize: '.78rem', fontWeight: 700,
      fontFamily: "'Inter', sans-serif",
    }}>
      Modo de manutenção LIGADO — o público vê a página de espera. Você navega porque é dev.
    </div>
  );
}

function PaginaDeManutencao({ mensagem }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#08080a', color: '#eeede9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 22px',
          background: 'rgba(124,58,237,.14)', border: '1px solid rgba(124,58,237,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: -.5, margin: '0 0 12px' }}>
          Voltamos logo
        </h1>
        <p style={{ fontSize: '.92rem', color: '#999', lineHeight: 1.6, margin: 0 }}>
          {mensagem || 'Estamos fazendo uma manutenção rápida. Tente de novo em alguns minutos.'}
        </p>
      </div>
    </div>
  );
}
