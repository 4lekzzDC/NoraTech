import { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { gerarToken, revogarToken } from '../services/inbound.service';
import { getPalette, FONT_MONO } from '../theme';

// Tokens de entrada — a ponte entre o complemento do Gmail e este escritório.
//
// A tela inteira gira em torno de um fato: o token aparece uma vez e some. Por
// isso ele não é exibido numa lista junto dos outros; ele ocupa o card inteiro
// no momento em que nasce, com o aviso e o botão de copiar, e só sai dali
// quando o contador diz que guardou.

function quando(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function InboundTokensCard({ tenantId, tokens, isManager, showToast, onMudou }) {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [label, setLabel] = useState('');
  const [gerando, setGerando] = useState(false);
  const [novoToken, setNovoToken] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const ativos = tokens.filter((t) => !t.revoked_at);

  async function gerar() {
    setGerando(true);
    try {
      const token = await gerarToken(tenantId, label.trim());
      setNovoToken(token);
      setCopiado(false);
      setLabel('');
      await onMudou();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(novoToken);
      setCopiado(true);
    } catch {
      // Área de transferência bloqueada (contexto não seguro, permissão
      // negada). O token está na tela e é selecionável — dizer isso é mais
      // útil que um erro genérico.
      showToast('Não foi possível copiar automaticamente. Selecione o token e copie à mão.', 'error');
    }
  }

  async function revogar(token) {
    const nome = token.label || 'sem nome';
    const ok = window.confirm(
      `Revogar o token "${nome}"?\n\n`
      + 'O complemento que estiver usando este token para de arquivar na hora. '
      + 'Não dá para desfazer — seria preciso gerar outro e configurar de novo.'
    );
    if (!ok) return;
    try {
      await revogarToken(token.id);
      showToast('Token revogado.');
      await onMudou();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const cartao = {
    border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
    padding: '22px 24px',
  };

  // ── O token recém-criado toma a tela ────────────────────────────────────
  if (novoToken) {
    return (
      <div className="nd-card-hover" style={{ ...cartao, borderColor: P.primaryBorder }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Guarde este token agora</h2>
        <p style={{ margin: '5px 0 14px', color: P.muted, fontSize: '0.85rem', maxWidth: '58ch' }}>
          Ele não será mostrado de novo. O NoraDocs guarda apenas um resumo criptográfico —
          nem nós conseguimos recuperá-lo. Se perder, revogue e gere outro.
        </p>

        <p style={{
          margin: 0, padding: '12px 13px', borderRadius: 9,
          background: P.surface2, border: `1px solid ${P.border2}`,
          fontFamily: FONT_MONO, fontSize: '0.78rem', color: P.text,
          wordBreak: 'break-all', userSelect: 'all',
        }}>
          {novoToken}
        </p>

        <div style={{ display: 'flex', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            onClick={copiar}
            style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: P.primary, color: '#fff', fontSize: '0.83rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar token'}
          </button>
          <button
            onClick={() => setNovoToken(null)}
            style={{
              padding: '9px 16px', borderRadius: 9, border: `1px solid ${P.border2}`,
              background: 'transparent', color: P.muted, fontSize: '0.83rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Já guardei
          </button>
        </div>
      </div>
    );
  }

  // ── A lista ─────────────────────────────────────────────────────────────
  return (
    <div className="nd-card-hover" style={cartao}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Entrada pelo Gmail</h2>
      <p style={{ margin: '5px 0 0', color: P.muted, fontSize: '0.85rem', maxWidth: '58ch' }}>
        O complemento do Gmail usa um token para saber a qual escritório entregar os anexos.
        Gere um por pessoa que for usá-lo — assim dá para revogar o de quem sair sem
        derrubar os outros.
      </p>
      {/* O token já é real e já vale; o que ainda não existe é o complemento
          que o consome. Dizer isso aqui evita que alguém gere um token e fique
          procurando onde colá-lo. */}
      <p style={{ margin: '8px 0 0', fontSize: '0.79rem', color: P.muted2 }}>
        O complemento ainda está em desenvolvimento. Os tokens gerados agora continuarão
        valendo quando ele chegar.
      </p>

      {ativos.length === 0 ? (
        <p style={{ margin: '16px 0 0', fontSize: '0.83rem', color: P.muted2 }}>
          Nenhum token ativo. Sem um deles, o complemento não consegue arquivar nada.
        </p>
      ) : (
        <div style={{ margin: '16px 0 0', display: 'grid', gap: 8 }}>
          {ativos.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap',
                padding: '11px 13px', borderRadius: 10,
                border: `1px solid ${P.border}`, background: P.surface2,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                  {t.label || <span style={{ color: P.muted2, fontWeight: 500 }}>sem nome</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: P.muted2, marginTop: 2 }}>
                  {/* "Nunca usado" é o sinal que importa: um token que nunca
                      arquivou nada é candidato a ter sido criado por engano,
                      ou a estar colado no lugar errado. */}
                  criado em {quando(t.created_at)}
                  {' · '}
                  {t.last_used_at ? `último uso em ${quando(t.last_used_at)}` : 'nunca usado'}
                </div>
              </div>
              {isManager && (
                <button
                  onClick={() => revogar(t)}
                  style={{
                    background: 'none', border: 'none', color: P.muted,
                    fontSize: '0.79rem', cursor: 'pointer', padding: '3px 6px',
                    fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  Revogar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isManager && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Para quem é este token? ex.: Gmail da Ana"
            maxLength={60}
            style={{
              flex: 1, minWidth: 200, padding: '9px 11px', borderRadius: 9,
              border: `1px solid ${P.border2}`, background: P.inputBg, color: P.text,
              fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={gerar}
            disabled={gerando}
            style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: P.primary, color: '#fff', fontSize: '0.83rem', fontWeight: 700,
              cursor: gerando ? 'progress' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {gerando ? 'Gerando…' : 'Gerar token'}
          </button>
        </div>
      )}

      {!isManager && (
        <p style={{ margin: '14px 0 0', fontSize: '0.79rem', color: P.muted2 }}>
          Só o dono ou um admin do escritório pode gerar e revogar tokens.
        </p>
      )}
    </div>
  );
}
