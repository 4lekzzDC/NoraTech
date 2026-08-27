// Histórico das apurações salvas.
//
// Existe para responder "o que foi recolhido em julho?" sem reabrir os XMLs
// — e para que a apuração de uma competência tenha um estado: aberta
// (rascunho, aceita nota nova) ou fechada (guia recolhida, virou registro).
//
// Aberta pode ser reprocessada com as regras de hoje, porque é rascunho.
// Fechada mostra os números como foram gravados, e só. A distinção não é
// decoração: se a tabela de NCM mudar depois do recolhimento, uma apuração
// fechada que se recalculasse sozinha passaria a contar outra história sobre
// uma guia já paga.

import { useState } from 'react';
import { competenciaLegivel, fmtBRL, fmtCnpj } from './difalFormato';

function IFolder({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
function ILock({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function HistoricoApuracoes({
  P, FONT_MONO, apuracoes, carregando, abertaId,
  onAbrir, onAlternarStatus, onExcluir,
}) {
  const [ocupado, setOcupado] = useState(null);

  const th = {
    textAlign: 'left', padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
    color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 12px', fontSize: 12.5, borderBottom: `1px solid ${P.border}` };
  const acao = (perigo) => ({
    padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
    border: `1px solid ${P.border}`, background: 'transparent',
    color: perigo ? P.red : P.muted, fontFamily: 'inherit',
  });

  async function executar(chave, acaoAsync) {
    setOcupado(chave);
    try { await acaoAsync(); } finally { setOcupado(null); }
  }

  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14,
      boxShadow: P.shadow, overflow: 'hidden', marginBottom: 20,
    }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase',
          letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <IFolder /> Apurações salvas
        </div>
        <div style={{ fontSize: 12, color: P.muted, marginTop: 4, lineHeight: 1.5 }}>
          Abrir uma apuração aberta traz as notas de volta para a tela e permite continuar.
          Uma apuração fechada é registro: mostra os números como foram gravados.
        </div>
      </div>

      {carregando ? (
        <div style={{ padding: '24px 20px', color: P.muted, fontSize: 13 }}>Carregando…</div>
      ) : !apuracoes.length ? (
        <div style={{ padding: '8px 20px 22px', color: P.muted, fontSize: 12.5, lineHeight: 1.6 }}>
          Nenhuma apuração salva ainda. Processe um lote e use <b>Salvar apuração</b> — a
          competência fica registrada com a versão do motor e da tabela de alíquotas usadas.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Competência</th>
                <th style={th}>Cliente</th>
                <th style={th}>Situação</th>
                <th style={{ ...th, textAlign: 'right' }}>Itens</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={{ ...th, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {apuracoes.map((a) => {
                const fechada = a.status === 'fechada';
                const aberta = a.id === abertaId;
                const totais = a.totais || {};
                const trabalhando = ocupado === a.id;
                return (
                  <tr key={a.id} style={{ background: aberta ? P.rowHover : 'transparent' }}>
                    <td style={{ ...td, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                      {competenciaLegivel(a.competencia)}
                      {a.uf_destino && <span style={{ color: P.muted2 }}> · {a.uf_destino}</span>}
                    </td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.cliente?.nome || <span style={{ color: P.muted2 }}>Sem cliente vinculado</span>}
                      {a.cliente?.cnpj && (
                        <div style={{ fontSize: 11, color: P.muted2, fontFamily: FONT_MONO }}>
                          {fmtCnpj(a.cliente.cnpj)}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: fechada ? P.surface2 : 'rgba(16,185,129,0.12)',
                        color: fechada ? P.muted : P.green,
                        border: `1px solid ${fechada ? P.border : 'transparent'}`,
                      }}>
                        {fechada && <ILock size={11} />}
                        {fechada ? 'Fechada' : 'Aberta'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, color: P.muted }}>
                      {totais.calculados ?? 0}/{totais.itens ?? 0}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700 }}>
                      {fmtBRL(totais.vTotal ?? 0)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          style={acao(false)}
                          disabled={trabalhando}
                          onClick={() => executar(a.id, () => onAbrir(a))}
                        >{aberta ? 'Recarregar' : 'Abrir'}</button>
                        <button
                          style={acao(false)}
                          disabled={trabalhando}
                          onClick={() => executar(a.id, () => onAlternarStatus(a))}
                        >{fechada ? 'Reabrir' : 'Fechar'}</button>
                        <button
                          style={acao(true)}
                          disabled={trabalhando}
                          onClick={() => executar(a.id, () => onExcluir(a))}
                        >Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
