import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import NoraDocsLayout from '../components/NoraDocsLayout';
import { noradocsRoute } from '../constants';
import { completeGoogleConnect } from '../services/googleDrive.service';
import { getPalette } from '../theme';

// Página de destino do redirect do Google após o consentimento OAuth. Existe
// só para consumir o `code` da URL e devolver o contador para Configurações
// — não é uma tela de navegação normal e não aparece na sidebar.

// Lê a URL uma única vez, na montagem: se já dá para saber que é erro (o
// Google recusou, ou não veio `code`), o estado nasce resolvido, sem passar
// por um effect só para setState síncrono. Só o caminho que depende de rede
// (trocar o code pela conexão) precisa do effect — e mesmo esse só chama
// setState de dentro do .then/.catch, nunca no corpo do effect.
function lerCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const erroGoogle = params.get('error');

  if (erroGoogle) {
    return {
      estado: 'erro',
      mensagem: erroGoogle === 'access_denied' ? 'A conexão foi cancelada.' : `O Google recusou a conexão (${erroGoogle}).`,
      code: null, state: null,
    };
  }
  if (!code) return { estado: 'erro', mensagem: 'Link de conexão inválido.', code: null, state: null };
  return { estado: 'processando', mensagem: '', code, state };
}

export default function GoogleCallbackPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [inicial] = useState(lerCallback);
  const [estado, setEstado] = useState(inicial.estado);
  const [mensagem, setMensagem] = useState(inicial.mensagem);

  useEffect(() => {
    if (!inicial.code) return; // já resolvido como erro no estado inicial
    completeGoogleConnect({ code: inicial.code, state: inicial.state })
      .then(() => setEstado('ok'))
      .catch((err) => { setEstado('erro'); setMensagem(err.message); });
  }, [inicial.code, inicial.state]);

  return (
    <NoraDocsLayout title="Conectando ao Google">
      <div style={{
        border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
        padding: '28px 26px', boxShadow: P.shadow, maxWidth: 460,
      }}>
        {estado === 'processando' && <p style={{ margin: 0, fontSize: '0.9rem' }}>Confirmando a conexão com o Google…</p>}

        {estado === 'ok' && (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>Conta conectada.</p>
            <p style={{ margin: '8px 0 18px', color: P.muted, fontSize: '0.87rem' }}>
              Agora escolha a pasta raiz na tela de Configurações.
            </p>
            <Link to={noradocsRoute('configuracoes')} style={{ color: P.primaryText, fontSize: '0.86rem', fontWeight: 600 }}>
              Voltar para Configurações →
            </Link>
          </>
        )}

        {estado === 'erro' && (
          <>
            <p style={{ margin: 0, fontWeight: 700, color: P.red }}>Não foi possível conectar.</p>
            <p style={{ margin: '8px 0 18px', color: P.muted, fontSize: '0.87rem' }}>{mensagem}</p>
            <Link to={noradocsRoute('configuracoes')} style={{ color: P.primaryText, fontSize: '0.86rem', fontWeight: 600 }}>
              Voltar para Configurações →
            </Link>
          </>
        )}
      </div>
    </NoraDocsLayout>
  );
}
