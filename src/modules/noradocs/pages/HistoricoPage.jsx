import { useCallback, useEffect, useState } from 'react';
import { ToastHost } from '../../../components/Toast';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import NoraDocsLayout from '../components/NoraDocsLayout';
import HistoricoDrawer from '../components/HistoricoDrawer';
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

function IconeCalendario({ P }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.muted2} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function StatusBadge({ status, P }) {
  const arquivado = status === 'organizado';
  return (
    <span style={{
      display: 'inline-flex', padding: '3px 10px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
      color: arquivado ? P.primaryText : P.muted,
      background: arquivado ? P.primarySoft : P.surface2,
      border: `1px solid ${arquivado ? P.primaryBorder : P.border2}`,
    }}>
      {arquivado ? 'Arquivado' : 'Descartado'}
    </span>
  );
}

export default function HistoricoPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);

  const [tenantId, setTenantId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [clients, setClients] = useState([]);
  const [filtros, setFiltros] = useState({ clientId: '', dataDe: '', dataAte: '', status: '', busca: '' });
  const [selecionado, setSelecionado] = useState(null);
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

  // O painel abre com uma cópia do documento; sem isto, ele fica com essa
  // cópia parada mesmo depois de a lista acima trazer os dados atualizados
  // (ex.: descartar pelo próprio painel).
  useEffect(() => {
    if (!selecionado) return;
    const atualizado = documentos.find((d) => d.id === selecionado.id);
    if (!atualizado) { setSelecionado(null); return; }
    if (atualizado !== selecionado) setSelecionado(atualizado);
  }, [documentos, selecionado]);

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

  const alturaCampo = 36;
  const campo = {
    height: alturaCampo, padding: '0 11px', borderRadius: 9, border: `1px solid ${P.border2}`,
    background: P.inputBg, color: P.text, fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
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
      <style>{`
        .nd-hist-row { cursor: pointer; transition: background 120ms ease-out, box-shadow 120ms ease-out; }
        .nd-hist-row:hover { background: ${P.rowHover}; }
        .nd-hist-row.selecionada {
          background: ${P.primarySoft};
          box-shadow: inset 3px 0 0 ${P.primary}, 0 0 14px ${P.primarySoft};
        }
      `}</style>

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
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={{ ...campo, flex: '1 1 180px' }}
              placeholder="Buscar pelo nome do arquivo"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') aplicar({ busca: e.target.value }); }}
              onBlur={(e) => aplicar({ busca: e.target.value })}
            />
            <select style={{ ...campo, flex: '0 1 200px' }} value={filtros.clientId} onChange={(e) => aplicar({ clientId: e.target.value })}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <IconeCalendario P={P} />
                <input
                  type="date" style={{ ...campo, fontFamily: FONT_MONO, paddingLeft: 32, width: 140 }}
                  value={filtros.dataDe} max={filtros.dataAte || undefined}
                  onChange={(e) => aplicar({ dataDe: e.target.value })}
                  aria-label="Data inicial"
                />
              </div>
              <span style={{ color: P.muted2, fontSize: '0.8rem' }}>até</span>
              <div style={{ position: 'relative' }}>
                <IconeCalendario P={P} />
                <input
                  type="date" style={{ ...campo, fontFamily: FONT_MONO, paddingLeft: 32, width: 140 }}
                  value={filtros.dataAte} min={filtros.dataDe || undefined}
                  onChange={(e) => aplicar({ dataAte: e.target.value })}
                  aria-label="Data final"
                />
              </div>
            </div>

            <select style={{ ...campo, flex: '0 1 200px' }} value={filtros.status} onChange={(e) => aplicar({ status: e.target.value })}>
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
                    onClick={() => aplicar({ clientId: '', dataDe: '', dataAte: '', status: '', busca: '' })}
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
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((doc) => (
                      <tr
                        key={doc.id}
                        onClick={() => setSelecionado(doc)}
                        className={`nd-hist-row${selecionado?.id === doc.id ? ' selecionada' : ''}`}
                        style={{ opacity: doc.status === 'descartado' ? 0.55 : 1 }}
                      >
                        <td style={td}>
                          <span style={{ fontWeight: 600 }}>{doc.file_name}</span>
                        </td>
                        <td style={td}>{doc.client?.nome || <span style={{ color: P.muted2 }}>—</span>}</td>
                        <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {doc.competencia ? competenciaLegivel(doc.competencia) : '—'}
                        </td>
                        <td style={td}>{doc.category?.nome || <span style={{ color: P.muted2 }}>—</span>}</td>
                        <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.74rem', color: P.muted, maxWidth: 260 }}>
                          {doc.drive_path || <span style={{ color: P.muted2 }}>em triagem</span>}
                        </td>
                        <td style={td}><StatusBadge status={doc.status} P={P} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {selecionado && (
        <HistoricoDrawer
          documento={selecionado}
          tenantId={tenantId}
          onFechar={() => setSelecionado(null)}
          onDescartar={descartar}
          descartando={descartando === selecionado.id}
        />
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
