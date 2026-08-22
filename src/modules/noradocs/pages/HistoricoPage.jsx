import { Fragment, useCallback, useEffect, useState } from 'react';
import { ToastHost } from '../../../components/Toast';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import NoraDocsLayout from '../components/NoraDocsLayout';
import EventTrail from '../components/EventTrail';
import { competenciaLegivel } from '../domain/competencia';
import { fetchContextoDeClassificacao, listHistorico } from '../services/documents.service';
import { descartarDocumento } from '../services/review.service';
import { resolveTenant } from '../services/tenant';
import { getPalette, FONT_MONO } from '../theme';

// Tudo que já saiu da fila, com a trilha completa de cada documento.
//
// A trilha existe para responder "por que este arquivo foi parar aqui?"
// semanas depois — a pergunta que aparece na primeira semana de uso de
// qualquer sistema que move arquivo sozinho.

export default function HistoricoPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [tenantId, setTenantId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [clients, setClients] = useState([]);
  const [filtros, setFiltros] = useState({ clientId: '', competencia: '', status: '', busca: '' });
  const [expandido, setExpandido] = useState(null);
  const [descartando, setDescartando] = useState(null);
  const { toasts, showToast, dismissToast } = useToasts();

  // Uma consulta que falha não pode virar "nenhum documento": o histórico
  // vazio é uma afirmação sobre o arquivo do escritório, e afirmá-la quando
  // na verdade a busca quebrou é mentir para quem está procurando um papel.
  const buscar = useCallback(async (f) => {
    try {
      setDocumentos(await listHistorico(f));
    } catch (err) {
      setDocumentos([]);
      showToast(err.message, 'error');
    }
  }, [showToast]);

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

  // Descartar é a ÚNICA saída para quem apagou o arquivo no Drive e quer
  // reenviá-lo: a deduplicação bloqueia pelo hash, e só um registro
  // descartado sai do caminho dela. Sem esta ação aqui, o documento
  // arquivado virava um beco sem saída — não aparece na caixa de entrada, e
  // não havia nenhuma outra tela onde mexer nele.
  async function descartar(doc) {
    const ok = window.confirm(
      `Descartar o registro de "${doc.file_name}"?\n\n`
      + 'Se o arquivo ainda existir no Drive, ele vai para a pasta _descartados. '
      + 'Se já não existir mais lá, só o registro sai do histórico — use isto para poder reenviá-lo.'
    );
    if (!ok) return;
    setDescartando(doc.id);
    try {
      await descartarDocumento(doc, tenantId);
      await buscar(filtros);
      showToast('Registro descartado. O arquivo pode ser reenviado.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDescartando(null);
    }
  }

  // Filtro é ação do usuário: aplica no evento, não por efeito.
  function aplicar(patch) {
    const novos = { ...filtros, ...patch };
    setFiltros(novos);
    buscar(novos);
  }

  const temFiltro = Object.values(filtros).some(Boolean);

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
              // "Nenhum documento ainda" é falso quando o escritório tem
              // centenas e o filtro é que não bate — e manda procurar o papel
              // no lugar errado. Filtro ativo pede outra frase, e a saída.
              <div style={{ padding: '30px 24px' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {temFiltro ? 'Nenhum documento com esses filtros.' : 'Nenhum documento no histórico ainda.'}
                </p>
                <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.87rem', maxWidth: '58ch' }}>
                  {temFiltro
                    ? 'O histórico pode ter outros documentos — estes filtros é que não alcançaram nenhum.'
                    : 'O que for arquivado ou descartado na caixa de entrada aparece aqui, com a trilha de tudo que aconteceu com ele.'}
                </p>
                {temFiltro && (
                  <button
                    onClick={() => aplicar({ clientId: '', competencia: '', status: '', busca: '' })}
                    style={{
                      marginTop: 13, padding: '7px 14px', borderRadius: 8,
                      border: `1px solid ${P.border2}`, background: P.surface, color: P.text,
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Limpar filtros
                  </button>
                )}
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
                      <th style={{ ...th, width: 90 }} />
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
                          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {doc.status !== 'descartado' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); descartar(doc); }}
                                disabled={descartando === doc.id}
                                title="Tira o registro do histórico e libera o arquivo para ser reenviado"
                                style={{
                                  background: 'none', border: 'none', color: P.muted,
                                  fontSize: '0.78rem', cursor: 'pointer', padding: '3px 6px',
                                  fontFamily: 'inherit', textDecoration: 'underline',
                                }}
                              >
                                {descartando === doc.id ? 'Descartando…' : 'Descartar'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandido === doc.id && (
                          <tr>
                            <td colSpan={6} style={{ ...td, background: P.surface2 }}>
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
                              <EventTrail doc={doc} tenantId={tenantId} P={P} />
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

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
