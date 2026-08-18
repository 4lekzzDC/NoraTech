import { useCallback, useEffect, useState } from 'react';
import { ToastHost } from '../../../components/Toast';
import { useToasts } from '../../../lib/useToasts';
import { useTheme } from '../../../contexts/ThemeContext';
import NoraDocsLayout from '../components/NoraDocsLayout';
import ClienteForm from '../components/ClienteForm';
import { formatCNPJ } from '../domain/cnpj';
import {
  createClient, deleteClient, fetchImportaveis, importarDoContabil,
  listClients, setClientAtivo, updateClient,
} from '../services/clients.service';
import { resolveTenant } from '../services/tenant';
import { getPalette, FONT_MONO } from '../theme';

// As empresas atendidas pelo escritório. É o cadastro que dá sentido a todo o
// resto: sem cliente cadastrado, não há como o motor de regras dizer de quem
// é um documento.

export default function ClientesPage() {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const { toasts, showToast, dismissToast } = useToasts();

  const [tenantId, setTenantId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);   // null = fechado, {} = novo
  const [salvando, setSalvando] = useState(false);
  const [importaveis, setImportaveis] = useState([]);

  const recarregar = useCallback(async (termo) => {
    try {
      setClientes(await listClients({ search: termo ?? busca }));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [busca, showToast]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { tenantId: id } = await resolveTenant();
      if (!ativo) return;
      setTenantId(id);
      if (id) {
        await recarregar('');
        setImportaveis(await fetchImportaveis(id));
      }
      if (ativo) setCarregando(false);
    })();
    return () => { ativo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca com debounce: a lista de um escritório cabe em uma consulta, mas
  // disparar uma a cada tecla é desperdício sem ganho nenhum de percepção.
  useEffect(() => {
    if (carregando) return undefined;
    const t = setTimeout(() => { recarregar(busca); }, 250);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(form) {
    setSalvando(true);
    try {
      if (editando?.id) {
        await updateClient(editando.id, form);
        showToast('Cliente atualizado.');
      } else {
        await createClient(tenantId, form);
        showToast('Cliente cadastrado.');
      }
      setEditando(null);
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(cliente) {
    try {
      await setClientAtivo(cliente.id, !cliente.ativo);
      showToast(cliente.ativo ? 'Cliente inativado.' : 'Cliente reativado.');
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function excluir(cliente) {
    const ok = window.confirm(
      `Excluir "${cliente.nome}"?\n\nOs documentos já arquivados continuam no Drive e no histórico, ` +
      'mas deixam de apontar para este cliente. Para apenas tirá-lo da classificação, use Inativar.'
    );
    if (!ok) return;
    try {
      await deleteClient(cliente.id);
      if (editando?.id === cliente.id) setEditando(null);
      showToast('Cliente excluído.');
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function importar() {
    try {
      const criados = await importarDoContabil(tenantId, importaveis);
      showToast(`${criados.length} cliente(s) importado(s). Falta preencher o CNPJ de cada um.`);
      setImportaveis(await fetchImportaveis(tenantId));
      await recarregar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const botaoNovo = (
    <button
      onClick={() => setEditando({})}
      style={{
        padding: '9px 18px', borderRadius: 9, border: 'none', background: P.primary,
        color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      Novo cliente
    </button>
  );

  const th = {
    textAlign: 'left', padding: '9px 14px', fontSize: '0.66rem', fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', color: P.muted2,
    borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap',
  };
  const td = { padding: '11px 14px', borderBottom: `1px solid ${P.border}`, fontSize: '0.86rem' };
  const acao = {
    background: 'none', border: 'none', color: P.muted, fontSize: '0.78rem',
    cursor: 'pointer', padding: '3px 6px', fontFamily: 'inherit', textDecoration: 'underline',
  };

  return (
    <NoraDocsLayout
      title="Clientes"
      subtitle="As empresas atendidas pelo escritório. É o que permite identificar de quem é cada documento."
      actions={tenantId ? botaoNovo : null}
    >
      {!carregando && !tenantId && (
        <div style={{
          border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
          padding: '26px 24px', boxShadow: P.shadow,
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhum escritório vinculado a este usuário.</p>
          <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.88rem' }}>
            O NoraDocs organiza os documentos de um escritório, e o seu usuário precisa ser membro
            ativo de um. Crie ou entre em uma empresa na Central de Controle e volte aqui.
          </p>
        </div>
      )}

      {tenantId && (
        <div style={{ display: 'grid', gridTemplateColumns: editando ? 'minmax(0,1fr) 380px' : '1fr', gap: 22, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou CNPJ"
                style={{
                  flex: '1 1 220px', padding: '9px 12px', borderRadius: 9,
                  border: `1px solid ${P.border2}`, background: P.inputBg,
                  color: P.text, fontSize: '0.86rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              {importaveis.length > 0 && (
                <button
                  onClick={importar}
                  title="Traz nome e regime dos clientes cadastrados em Soluções Contábeis. O CNPJ não existe lá e precisará ser preenchido."
                  style={{
                    padding: '9px 16px', borderRadius: 9, border: `1px solid ${P.primaryBorder}`,
                    background: P.primarySoft, color: P.primaryText, fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  Importar {importaveis.length} de Soluções Contábeis
                </button>
              )}
            </div>

            <div style={{
              border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
              overflow: 'hidden', boxShadow: P.shadow,
            }}>
              {carregando ? (
                <p style={{ padding: '26px 20px', margin: 0, color: P.muted, fontSize: '0.88rem' }}>
                  Carregando…
                </p>
              ) : clientes.length === 0 ? (
                <div style={{ padding: '30px 24px' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
                  </p>
                  <p style={{ margin: '8px 0 0', color: P.muted, fontSize: '0.87rem', maxWidth: '58ch' }}>
                    {busca
                      ? 'Tente outro nome ou outro trecho do CNPJ.'
                      : 'Cadastre os clientes cujos documentos o escritório recebe. O CNPJ é o sinal mais forte de identificação — é ele que permite arquivar um extrato sem ninguém precisar dizer de quem é.'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                    <thead>
                      <tr>
                        <th style={th}>Cliente</th>
                        <th style={th}>CNPJ</th>
                        <th style={th}>Apelidos</th>
                        <th style={th}>Regime</th>
                        <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr
                          key={c.id}
                          style={{ background: editando?.id === c.id ? P.rowHover : 'transparent', opacity: c.ativo ? 1 : 0.55 }}
                        >
                          <td style={td}>
                            <button
                              onClick={() => setEditando(c)}
                              style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                color: P.text, fontWeight: 600, fontSize: '0.86rem',
                                fontFamily: 'inherit', textAlign: 'left',
                              }}
                            >
                              {c.nome}
                            </button>
                            {!c.ativo && (
                              <span style={{ marginLeft: 8, fontSize: '0.68rem', color: P.muted2 }}>inativo</span>
                            )}
                          </td>
                          <td style={{ ...td, fontFamily: FONT_MONO, fontSize: '0.78rem', color: c.cnpj ? P.text : P.muted2 }}>
                            {c.cnpj ? formatCNPJ(c.cnpj) : '— sem CNPJ'}
                          </td>
                          <td style={{ ...td, color: P.muted, fontSize: '0.8rem' }}>
                            {(c.aliases || []).length ? c.aliases.join(', ') : '—'}
                          </td>
                          <td style={{ ...td, color: P.muted, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {c.regime || '—'}
                          </td>
                          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button style={acao} onClick={() => setEditando(c)}>Editar</button>
                            <button style={acao} onClick={() => alternarAtivo(c)}>
                              {c.ativo ? 'Inativar' : 'Reativar'}
                            </button>
                            <button style={{ ...acao, color: P.red }} onClick={() => excluir(c)}>Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {editando && (
            <ClienteForm
              key={editando.id || 'novo'}
              cliente={editando.id ? editando : null}
              salvando={salvando}
              onSalvar={salvar}
              onCancelar={() => setEditando(null)}
            />
          )}
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </NoraDocsLayout>
  );
}
