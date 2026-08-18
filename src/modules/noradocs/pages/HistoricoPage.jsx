import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import NoraDocsLayout from '../components/NoraDocsLayout';
import { competenciaLegivel } from '../domain/competencia';
import { fetchContextoDeClassificacao, listHistorico } from '../services/documents.service';
import { listarEventos } from '../services/review.service';
import { resolveTenant } from '../services/tenant';
import { getPalette, FONT_MONO } from '../theme';

// Tudo que já saiu da fila, com a trilha completa de cada documento.
//
// A trilha existe para responder "por que este arquivo foi parar aqui?"
// semanas depois — a pergunta que aparece na primeira semana de uso de
// qualquer sistema que move arquivo sozinho.

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
};

function dataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Trilha({ documentId, P }) {
  const [eventos, setEventos] = useState(null);

  useEffect(() => {
    let ativo = true;
    listarEventos(documentId).then((lista) => { if (ativo) setEventos(lista); });
    return () => { ativo = false; };
  }, [documentId]);

  if (eventos === null) {
    return <p style={{ margin: 0, color: P.muted, fontSize: '0.8rem' }}>Carregando trilha…</p>;
  }
  if (!eventos.length) {
    return <p style={{ margin: 0, color: P.muted2, fontSize: '0.8rem' }}>Sem eventos registrados.</p>;
  }

  return (
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
                {ev.actor_type === 'user' ? 'por uma pessoa' : 'pelo sistema'}
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
  );
}

export default function HistoricoPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [tenantId, setTenantId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [clients, setClients] = useState([]);
  const [filtros, setFiltros] = useState({ clientId: '', competencia: '', status: '', busca: '' });
  const [expandido, setExpandido] = useState(null);

  const buscar = useCallback(async (f) => {
    try {
      setDocumentos(await listHistorico(f));
    } catch {
      setDocumentos([]);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { tenantId: id } = await resolveTenant();
      if (!ativo) return;
      if (!id) { setCarregando(false); return; }
      setTenantId(id);
      const ctx = await fetchContextoDeClassificacao();
      if (!ativo) return;
      setClients(ctx.clients);
      await buscar(filtros);
      if (ativo) setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [buscar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtro é ação do usuário: aplica no evento, não por efeito.
  function aplicar(patch) {
    const novos = { ...filtros, ...patch };
    setFiltros(novos);
    buscar(novos);
  }

  const campo = {
    padding: '8px 11px', borderRadius: 9, border: `1px solid ${P.border2}`,
    background: P.inputBg, color: P.text, fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
  };
  const th = {
    textAlign: 'left', padding: '9px 14px', fontSize: '0.64rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 14px', borderBottom: `1px solid ${P.border}`, fontSize: '0.85rem' };

  return (
    <NoraDocsLayout
      title="Histórico"
      subtitle="Todos os documentos já processados, com a trilha completa de cada um."
    >
      {!carregando && !tenantId && (
        <div style={{
          border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
          padding: '26px 24px', boxShadow: P.shadow,
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhum escritório vinculado a este usuário.</p>
        </div>
      )}

      {!carregando && tenantId && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              style={{ ...campo, flex: '1 1 180px' }}
              placeholder="Buscar pelo nome do arquivo"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') aplicar({ busca: e.target.value }); }}
              onBlur={(e) => aplicar({ busca: e.target.value })}
            />
            <select style={campo} value={filtros.clientId} onChange={(e) => aplicar({ clientId: e.target.value })}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input
              type="month" style={{ ...campo, fontFamily: FONT_MONO }}
              value={filtros.competencia}
              onChange={(e) => aplicar({ competencia: e.target.value })}
            />
            <select style={campo} value={filtros.status} onChange={(e) => aplicar({ status: e.target.value })}>
              <option value="">Arquivados e descartados</option>
              <option value="organizado">Só arquivados</option>
              <option value="descartado">Só descartados</option>
            </select>
          </div>

          <div style={{
            border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
            overflow: 'hidden', boxShadow: P.shadow,
          }}>
            {documentos.length === 0 ? (
              <div style={{ padding: '30px 24px' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum documento no histórico ainda.</p>
                <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.87rem', maxWidth: '58ch' }}>
                  O que for arquivado ou descartado na caixa de entrada aparece aqui, com a trilha
                  de tudo que aconteceu com ele.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={th}>Arquivo</th>
                      <th style={th}>Cliente</th>
                      <th style={th}>Competência</th>
                      <th style={th}>Categoria</th>
                      <th style={th}>Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((doc) => (
                      // Fragment nomeado, não `<>`: o elemento raiz de um map
                      // precisa de key, e o fragment curto não aceita uma.
                      <Fragment key={doc.id}>
                        <tr
                          onClick={() => setExpandido(expandido === doc.id ? null : doc.id)}
                          style={{ cursor: 'pointer', opacity: doc.status === 'descartado' ? 0.55 : 1 }}
                        >
                          <td style={td}>
                            <span style={{ fontWeight: 600 }}>{doc.file_name}</span>
                            {doc.status === 'descartado' && (
                              <span style={{ marginLeft: 8, fontSize: '0.68rem', color: P.muted2 }}>descartado</span>
                            )}
                          </td>
                          <td style={td}>{doc.client?.nome || <span style={{ color: P.muted2 }}>—</span>}</td>
                          <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {doc.competencia ? competenciaLegivel(doc.competencia) : '—'}
                          </td>
                          <td style={td}>{doc.category?.nome || <span style={{ color: P.muted2 }}>—</span>}</td>
                          <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.74rem', color: P.muted, maxWidth: 260 }}>
                            {doc.drive_path || <span style={{ color: P.muted2 }}>em triagem</span>}
                          </td>
                        </tr>
                        {expandido === doc.id && (
                          <tr>
                            <td colSpan={5} style={{ ...td, background: P.surface2 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                                <strong style={{ fontSize: '0.8rem' }}>Trilha do documento</strong>
                                {doc.drive_web_link && (
                                  <a
                                    href={doc.drive_web_link} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '0.79rem', color: P.primaryText }}
                                  >
                                    Abrir no Google Drive →
                                  </a>
                                )}
                              </div>
                              <Trilha documentId={doc.id} P={P} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </NoraDocsLayout>
  );
}
