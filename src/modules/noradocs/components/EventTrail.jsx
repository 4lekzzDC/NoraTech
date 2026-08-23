import { useEffect, useState } from 'react';
import { listarEventos, verificarNoDrive } from '../services/review.service';
import { FONT_MONO } from '../theme';

// A trilha de um documento — recebido, classificado, confirmado, descartado,
// reprocessado, verificado — no mesmo formato em qualquer tela que precise
// dela. Nasceu só no Histórico, mas um documento ainda em revisão também
// acumula trilha (a reclassificação automática pelo texto do PDF, uma
// verificação no Drive) e até agora não havia onde vê-la antes de confirmar
// ou descartar: a pergunta "o que já aconteceu com este arquivo?" ficava sem
// resposta bem na hora em que o analista mais precisa dela, decidindo.

const ROTULO_EVENTO = {
  recebido: 'Recebido',
  classificado: 'Classificado',
  revisao_solicitada: 'Enviado para revisão',
  confirmado: 'Confirmado manualmente',
  organizado: 'Arquivado no Drive',
  erro: 'Erro',
  reprocessado: 'Reprocessado',
  descartado: 'Descartado',
  regra_criada: 'Regra criada',
  divergencia_drive: 'Divergência no Drive',
  verificado_drive: 'Verificado no Drive',
};

// Documento recebido por e-mail traz o remetente no payload (a caixa de
// entrada do Gmail é system, não tem usuário logado); qualquer outro
// evento de pessoa mostra nome e e-mail de quem fez, quando o perfil ainda
// existe — senão cai no genérico.
function quemFez(ev) {
  if (ev.payload?.origem === 'email' && ev.payload?.remetente) {
    return `por e-mail de ${ev.payload.remetente}`;
  }
  if (ev.actor_type === 'user') {
    const nome = ev.actor?.name;
    const email = ev.actor?.email;
    if (nome && email) return `por ${nome} (${email})`;
    if (email) return `por ${email}`;
    if (nome) return `por ${nome}`;
    return 'por uma pessoa';
  }
  return 'pelo sistema';
}

function dataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * @param {object} props
 * @param {object} props.doc       o documento como veio do banco
 * @param {string} props.tenantId
 * @param {object} props.P         paleta de cores da tela
 * @param {boolean} [props.mostrarVerificar] botão "Conferir no Drive" — só
 *   faz sentido onde há id de tenant à mão e um arquivo já enviado.
 */
export default function EventTrail({ doc, tenantId, P, mostrarVerificar = true }) {
  const documentId = doc.id;
  const [eventos, setEventos] = useState(null);
  const [verificacao, setVerificacao] = useState(null);

  async function verificar() {
    setVerificacao({ carregando: true });
    const r = await verificarNoDrive(doc, tenantId);
    setVerificacao(r);
    setEventos(await listarEventos(documentId));
  }

  useEffect(() => {
    let ativo = true;
    listarEventos(documentId).then((lista) => { if (ativo) setEventos(lista); });
    return () => { ativo = false; };
  }, [documentId]);

  if (eventos === null) {
    return <p style={{ margin: 0, color: P.muted, fontSize: '0.8rem' }}>Carregando trilha…</p>;
  }

  return (
    <>
      {mostrarVerificar && doc.drive_file_id && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={(e) => { e.stopPropagation(); verificar(); }}
            disabled={verificacao?.carregando}
            style={{
              padding: '5px 12px', borderRadius: 8, border: `1px solid ${P.border2}`,
              background: 'transparent', color: P.muted, fontSize: '0.78rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {verificacao?.carregando ? 'Verificando…' : 'Conferir no Drive'}
          </button>
          {verificacao && !verificacao.carregando && (
            <span style={{ fontSize: '0.78rem', color: verificacao.ok ? P.green : P.red }}>
              {verificacao.ok ? 'O arquivo está onde deveria.' : verificacao.motivo}
            </span>
          )}
        </div>
      )}

      {!eventos.length && (
        <p style={{ margin: 0, color: P.muted2, fontSize: '0.8rem' }}>Sem eventos registrados.</p>
      )}

      {eventos.length > 0 && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {eventos.map((ev) => {
            const evidencias = ev.payload?.evidence || [];
            return (
              <li key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: '0.7rem', color: P.muted2,
                  whiteSpace: 'nowrap', paddingTop: 2, minWidth: '11ch',
                }}>
                  {dataHora(ev.created_at)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {ROTULO_EVENTO[ev.type] || ev.type}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: P.muted2, marginLeft: 8 }}>
                    {quemFez(ev)}
                  </span>
                  {evidencias.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: P.muted, fontSize: '0.76rem' }}>
                      {evidencias.map((e, i) => (
                        <li key={i}>{e.campo}: {e.detalhe}</li>
                      ))}
                    </ul>
                  )}
                  {ev.payload?.drive_path && (
                    <p style={{ margin: '3px 0 0', fontFamily: FONT_MONO, fontSize: '0.72rem', color: P.muted }}>
                      {ev.payload.drive_path}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
