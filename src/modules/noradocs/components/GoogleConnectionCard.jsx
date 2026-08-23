import { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPalette, FONT_MONO } from '../theme';
import {
  confirmRootFolder, disconnectGoogle, fetchConnectionStatus, pickRootFolder, startGoogleConnect,
} from '../services/googleDrive.service';

// Cartão de conexão com o Google Drive, na tela de Configurações.
//
// Qualquer membro do escritório vê o status; só owner/admin (`isManager`) vê
// os botões de ação — conectar, trocar pasta e desconectar são decisões de
// quem responde pela conta, não do time que usa o produto no dia a dia.

const STATUS_LABEL = {
  connected: { label: 'Conectado', tone: 'ok' },
  revoked: { label: 'Desconectado', tone: 'danger' },
  error: { label: 'Com erro', tone: 'danger' },
};

export default function GoogleConnectionCard({ tenantId, isManager, showToast }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const [carregando, setCarregando] = useState(true);
  const [account, setAccount] = useState(null);
  const [settings, setSettings] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function recarregar() {
    const { account: acc, settings: cfg } = await fetchConnectionStatus(tenantId);
    setAccount(acc);
    setSettings(cfg);
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      await recarregar();
      if (ativo) setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  function conectar() {
    try {
      startGoogleConnect(); // navega para o Google — não retorna
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function desconectar() {
    const ok = window.confirm(
      'Desconectar o Google Drive?\n\nIsso revoga TODAS as permissões que esta conta concedeu a este aplicativo, ' +
      'não só as do NoraDocs. Documentos já organizados continuam no Drive normalmente.'
    );
    if (!ok) return;
    setOcupado(true);
    try {
      await disconnectGoogle();
      showToast('Google Drive desconectado.');
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setOcupado(false);
    }
  }

  async function escolherPasta() {
    setOcupado(true);
    try {
      const escolhida = await pickRootFolder();
      if (!escolhida) return; // cancelado no seletor
      await confirmRootFolder(escolhida);
      showToast(`Pasta raiz definida: ${escolhida.name}`);
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setOcupado(false);
    }
  }

  const conectado = account?.status === 'connected';
  const statusInfo = account ? (STATUS_LABEL[account.status] || STATUS_LABEL.error) : null;

  return (
    <div className="nd-card-hover" style={{ border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface, padding: '22px 24px' }}>
      <style>{`
        .nd-gc-btn { transition: all 0.2s ease; font-family: inherit; cursor: pointer; }
        .nd-gc-btn:disabled { cursor: default; opacity: 0.6; }
        .nd-gc-btn-primary {
          padding: 9px 16px; border-radius: 9px; border: none;
          background: ${P.primary}; color: #fff; font-size: 0.83rem; font-weight: 700;
        }
        .nd-gc-btn-primary:not(:disabled):hover {
          box-shadow: 0 0 0 5px ${P.primarySoft}, 0 4px 18px rgba(124,58,237,0.45);
          transform: translateY(-1px);
        }
        .nd-gc-btn-secondary {
          padding: 9px 16px; border-radius: 9px; border: 1px solid ${P.border2};
          background: transparent; color: ${P.muted}; font-size: 0.83rem; font-weight: 600;
        }
        .nd-gc-btn-secondary:not(:disabled):hover {
          border-color: rgba(255,92,92,0.5); color: ${P.red}; background: rgba(255,92,92,0.08);
        }
        .nd-gc-dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: ${P.green}; flex-shrink: 0; }
        .nd-gc-dot::after {
          content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid ${P.green};
          animation: nd-gc-pulse 1.8s cubic-bezier(0.2,0,0,1) infinite;
        }
        @keyframes nd-gc-pulse { 0% { opacity: 0.7; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.8); } }
        @media (prefers-reduced-motion: reduce) {
          .nd-gc-dot::after { animation: none; }
          .nd-gc-btn-primary:not(:disabled):hover { transform: none; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Google Drive</h2>
          <p style={{ margin: '5px 0 0', color: P.muted, fontSize: '0.85rem', maxWidth: '52ch' }}>
            Onde os documentos organizados pelo NoraDocs são arquivados. Escopo{' '}
            <code style={{ fontFamily: FONT_MONO, fontSize: '0.78em' }}>drive.file</code> — o NoraDocs só enxerga a
            pasta que o escritório escolher, nunca o restante do Drive.
          </p>
        </div>
        {statusInfo && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: '0.72rem', fontWeight: 700, padding: '4px 11px 4px 9px', borderRadius: 999, whiteSpace: 'nowrap',
            color: statusInfo.tone === 'ok' ? P.green : P.red,
            background: statusInfo.tone === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(255,92,92,0.12)',
            border: `1px solid ${statusInfo.tone === 'ok' ? 'rgba(52,211,153,0.32)' : 'rgba(255,92,92,0.32)'}`,
          }}>
            {statusInfo.tone === 'ok' && <span className="nd-gc-dot" aria-hidden="true" />}
            {statusInfo.label}
          </span>
        )}
      </div>

      {carregando ? (
        <p style={{ marginTop: 16, color: P.muted, fontSize: '0.85rem' }}>Carregando…</p>
      ) : !account ? (
        <div style={{ marginTop: 18 }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: P.muted }}>Nenhuma conta conectada ainda.</p>
          {isManager ? (
            <button className="nd-gc-btn nd-gc-btn-primary" onClick={conectar} disabled={ocupado}>Conectar Google Drive</button>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8rem', color: P.muted2 }}>
              Peça a um responsável pelo escritório (dono ou admin) para conectar.
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', color: P.muted2, marginBottom: 2 }}>Conectado como</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{account.google_email}</span>
            </div>

            {conectado && settings?.drive_root_folder_id && (
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: P.muted2, marginBottom: 2 }}>Pasta raiz</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  {settings.drive_root_folder_name || settings.drive_root_folder_id}
                </span>
              </div>
            )}
          </div>

          {!conectado && (
            <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: P.gold }}>
              A conexão expirou{account.last_error ? ` (${account.last_error})` : ''}. Reconecte para continuar
              organizando documentos.
            </p>
          )}

          {conectado && !settings?.drive_root_folder_id && (
            <div style={{
              margin: '12px 0 0', padding: '11px 13px', borderRadius: 9,
              border: `1px solid ${P.border2}`,
              background: theme === 'light' ? 'rgba(180,83,9,0.06)' : 'rgba(240,180,41,0.08)',
              fontSize: '0.8rem', color: P.muted,
            }}>
              O NoraDocs só enxerga o que existir <em>dentro</em> da pasta escolhida se ele mesmo criar. Se o
              escritório já tem uma estrutura organizada no Drive, prefira criar uma pasta nova para o NoraDocs —
              evita pastas duplicadas com o mesmo nome.
            </div>
          )}

          {isManager && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 16 }}>
              {conectado ? (
                <button className="nd-gc-btn nd-gc-btn-primary" onClick={escolherPasta} disabled={ocupado}>
                  {settings?.drive_root_folder_id ? 'Trocar pasta raiz' : 'Escolher pasta raiz'}
                </button>
              ) : (
                <button className="nd-gc-btn nd-gc-btn-primary" onClick={conectar} disabled={ocupado}>Reconectar</button>
              )}
              <button className="nd-gc-btn nd-gc-btn-secondary" onClick={desconectar} disabled={ocupado}>Desconectar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
