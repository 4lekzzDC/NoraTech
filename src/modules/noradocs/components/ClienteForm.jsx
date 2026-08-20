import { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { REGIME_OPTIONS } from '../constants';
import { formatCNPJ, formatCPF, isValidCNPJ, isValidCPF, onlyDigits } from '../domain/cnpj';
import { getPalette, FONT_MONO } from '../theme';

// Painel lateral de cadastro e edição de cliente.
//
// Abre sobre a lista em vez de virar uma página nova: quem cadastra 40
// clientes seguidos não deveria perder o contexto da lista a cada um.

const VAZIO = {
  nome: '', cnpj: '', cpf: '', email: '', telefone: '', regime: '',
  aliases: '', ativo: true,
};

function paraFormulario(cliente) {
  if (!cliente) return VAZIO;
  return {
    nome: cliente.nome || '',
    cnpj: formatCNPJ(cliente.cnpj || ''),
    cpf: formatCPF(cliente.cpf || ''),
    email: cliente.email || '',
    telefone: cliente.telefone || '',
    regime: cliente.regime || '',
    aliases: (cliente.aliases || []).join(', '),
    ativo: cliente.ativo !== false,
  };
}

// `titulo` e `rotuloSalvar` existem para um caso só: confirmar um cliente
// provisório usa este mesmo formulário, e chamá-lo de "Novo cliente" faria o
// contador achar que vai criar um segundo registro ao lado do provisório em
// vez de promover aquele.
export default function ClienteForm({ cliente, salvando, onSalvar, onCancelar, titulo, rotuloSalvar }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  // Sem efeito para recarregar o formulário quando o cliente muda: quem chama
  // passa `key={cliente.id}`, então o React remonta e o estado inicial abaixo
  // já nasce do cliente certo. Trocar de cliente na lista não deixa resto do
  // anterior, e um re-render qualquer não descarta o que foi digitado.
  const [form, setForm] = useState(() => paraFormulario(cliente));
  const [erros, setErros] = useState({});

  const editando = Boolean(cliente?.id);
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome do cliente.';
    if (onlyDigits(form.cnpj) && !isValidCNPJ(form.cnpj)) e.cnpj = 'CNPJ inválido — confira os dígitos.';
    if (onlyDigits(form.cpf) && !isValidCPF(form.cpf)) e.cpf = 'CPF inválido — confira os dígitos.';
    if (!onlyDigits(form.cnpj) && !onlyDigits(form.cpf)) {
      // Aviso, não erro: dá para cadastrar sem documento, mas aí o cliente só
      // será identificado pelo nome e pelos apelidos.
      e.aviso = 'Sem CNPJ, este cliente só será identificado pelo nome do arquivo.';
    }
    setErros(e);
    return !e.nome && !e.cnpj && !e.cpf;
  }

  function submeter(ev) {
    ev.preventDefault();
    if (validar()) onSalvar(form);
  }

  const label = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: P.muted, marginBottom: 5 };
  const input = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: `1px solid ${P.border2}`, background: P.inputBg, color: P.text,
    fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none',
  };
  const erro = { fontSize: '0.74rem', color: P.red, marginTop: 5 };

  return (
    <form
      onSubmit={submeter}
      style={{
        border: `1px solid ${P.border}`, borderRadius: 14, background: P.surface,
        padding: '22px 22px 20px', boxShadow: P.shadow,
        position: 'sticky', top: 88,
      }}
    >
      <h2 style={{ margin: '0 0 18px', fontSize: '1rem', fontWeight: 700 }}>
        {titulo || (editando ? 'Editar cliente' : 'Novo cliente')}
      </h2>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={label} htmlFor="nd-nome">Nome *</label>
          <input
            id="nd-nome" style={input} value={form.nome} autoFocus
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Silva Comércio de Alimentos ME"
          />
          {erros.nome && <p style={erro}>{erros.nome}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label} htmlFor="nd-cnpj">CNPJ</label>
            <input
              id="nd-cnpj" style={{ ...input, fontFamily: FONT_MONO }} value={form.cnpj}
              onChange={(e) => set('cnpj', formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00" inputMode="numeric"
            />
            {erros.cnpj && <p style={erro}>{erros.cnpj}</p>}
          </div>
          <div>
            <label style={label} htmlFor="nd-cpf">CPF</label>
            <input
              id="nd-cpf" style={{ ...input, fontFamily: FONT_MONO }} value={form.cpf}
              onChange={(e) => set('cpf', formatCPF(e.target.value))}
              placeholder="000.000.000-00" inputMode="numeric"
            />
            {erros.cpf && <p style={erro}>{erros.cpf}</p>}
          </div>
        </div>

        {erros.aviso && (
          <p style={{
            margin: 0, fontSize: '0.78rem', color: P.gold,
            background: theme === 'light' ? 'rgba(180,83,9,0.07)' : 'rgba(240,180,41,0.09)',
            border: `1px solid ${P.border2}`, borderRadius: 8, padding: '8px 11px',
          }}>
            {erros.aviso}
          </p>
        )}

        <div>
          <label style={label} htmlFor="nd-aliases">Apelidos</label>
          <input
            id="nd-aliases" style={input} value={form.aliases}
            onChange={(e) => set('aliases', e.target.value)}
            placeholder="Silva ME, Silva Alimentos, SILVACOM"
          />
          <p style={{ fontSize: '0.73rem', color: P.muted2, margin: '5px 0 0' }}>
            Separados por vírgula. É como o cliente aparece no nome dos arquivos que ele manda.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label} htmlFor="nd-email">E-mail</label>
            <input
              id="nd-email" type="email" style={input} value={form.email}
              onChange={(e) => set('email', e.target.value)} placeholder="contato@cliente.com.br"
            />
          </div>
          <div>
            <label style={label} htmlFor="nd-telefone">Telefone</label>
            <input
              id="nd-telefone" style={input} value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <div>
          <label style={label} htmlFor="nd-regime">Regime tributário</label>
          <select
            id="nd-regime" style={input} value={form.regime}
            onChange={(e) => set('regime', e.target.value)}
          >
            <option value="">Não informado</option>
            {REGIME_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.85rem', cursor: 'pointer' }}>
          <input
            type="checkbox" checked={form.ativo}
            onChange={(e) => set('ativo', e.target.checked)}
            style={{ width: 15, height: 15, accentColor: P.primary, cursor: 'pointer' }}
          />
          Cliente ativo
        </label>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
        <button
          type="submit" disabled={salvando}
          style={{
            flex: 1, padding: '10px 18px', borderRadius: 9, border: 'none',
            background: P.primary, color: '#fff', fontSize: '0.86rem', fontWeight: 700,
            cursor: salvando ? 'progress' : 'pointer', opacity: salvando ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {salvando ? 'Salvando…' : rotuloSalvar || (editando ? 'Salvar alterações' : 'Cadastrar cliente')}
        </button>
        <button
          type="button" onClick={onCancelar}
          style={{
            padding: '10px 18px', borderRadius: 9, border: `1px solid ${P.border2}`,
            background: 'transparent', color: P.muted, fontSize: '0.86rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
