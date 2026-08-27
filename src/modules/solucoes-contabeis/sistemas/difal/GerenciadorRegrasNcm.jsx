// Cadastro das regras de NCM — a tela que substitui o deploy.
//
// Um componente só, montado em dois lugares com escopos diferentes:
//
//   escopo="global"  /admin — o admin da plataforma edita a base
//                    compartilhada (tenantCompanyId null). Vale para
//                    qualquer escritório que ainda não tenha ajuste próprio.
//   escopo="tenant"  dentro de Soluções Contábeis — o owner/admin do
//                    escritório cadastra um ajuste que sobrepõe a base
//                    global só para eles, prefixo a prefixo.
//
// A tela não calcula nada: ela grava linhas, e é `regrasNcmMerge.js` (fora
// daqui, puro, testado) que decide como global e ajuste se combinam para o
// motor. Aqui só existe CRUD e a leitura do que já está cadastrado.

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getPalette, FONT_INTER, FONT_MONO } from '../../theme';
import {
  listarConfigsUf, salvarConfigUf, listarRegras, salvarRegra, excluirRegra, importarRegras,
} from '../../services/regrasNcm.service';
import { validarTabela, TIPOS_REGRA, digitosNcm } from './ncmRegras';
import { montarTabelaUf } from './regrasNcmMerge';
import { linhasDePlanilha, MODELO_CABECALHO } from './importarRegrasPlanilha';
import { parseResultadosAliquota } from './econetParser';
import { parseApiAliquotasEconetEmLote } from './econetApiParser';
import { parseAliquotasPortalSvrs, ufsDoPortalSvrs, siglaUf } from './svrsPortalParser';
import { fmtNcm, fmtPct } from './difalFormato';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// ── UI base — mesmo padrão visual do resto do módulo ──────────────────────
function Card({ children, style = {}, P }) {
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, boxShadow: P.shadow, ...style }}>
      {children}
    </div>
  );
}
function Campo({ label, hint, children, P }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: P.muted, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: P.muted2, marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </label>
  );
}
function inputStyle(P) {
  return {
    width: '100%', padding: '9px 11px', borderRadius: 9, fontFamily: FONT_INTER,
    fontSize: 13, background: P.inputBg, color: P.text, border: `1px solid ${P.border2}`, outline: 'none',
  };
}
function Botao({ children, onClick, disabled, variante = 'primario', P, style = {} }) {
  const primario = variante === 'primario';
  const perigo = variante === 'perigo';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
        borderRadius: 9, fontFamily: FONT_INTER, fontSize: 12.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${perigo ? 'rgba(255,92,92,0.4)' : primario ? P.primaryBorder : P.border}`,
        background: perigo ? 'rgba(255,92,92,0.1)' : primario ? P.primarySoft : 'transparent',
        color: perigo ? P.red : primario ? P.primaryText : P.muted,
        ...style,
      }}
    >{children}</button>
  );
}

const CONFIG_VAZIA = {
  versao: '', metodoBase: 'base_simples', politicaRevenda: 'nao_incide',
  regraGeralAliquota: '', regraGeralFcp: '0', regraGeralFundamento: '',
};
const REGRA_VAZIA = {
  ncm: '', tipo: 'posicao', aliquota: '', seguirGeral: false, fcp: '',
  excecaoDe: '', fundamento: '', vigenciaInicio: '', vigenciaFim: '',
};

export default function GerenciadorRegrasNcm({ escopo, tenantCompanyId, titulo, descricao }) {
  const { theme } = useTheme();
  const P = getPalette(theme);
  const ehGlobal = escopo === 'global';
  const escopoAtual = useMemo(() => ({ tenantCompanyId: ehGlobal ? null : tenantCompanyId }), [ehGlobal, tenantCompanyId]);

  const [uf, setUf] = useState('SP');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const [configGlobal, setConfigGlobal] = useState(null);
  const [configTenant, setConfigTenant] = useState(null);
  const [regrasGlobais, setRegrasGlobais] = useState([]);
  const [regrasTenant, setRegrasTenant] = useState([]);

  const [formConfig, setFormConfig] = useState(CONFIG_VAZIA);
  const [editandoRegra, setEditandoRegra] = useState(null); // null | REGRA_VAZIA | linha existente
  const [salvandoRegra, setSalvandoRegra] = useState(false);

  const [arquivoImport, setArquivoImport] = useState(null);
  const [previaImport, setPreviaImport] = useState(null);
  const [importando, setImportando] = useState(false);

  const [htmlEconet, setHtmlEconet] = useState('');
  const [resultadosEconet, setResultadosEconet] = useState(undefined); // undefined | [] (nada reconhecido) | [{ registros, baseLegal, observacoes }, ...]

  const [arquivoSvrs, setArquivoSvrs] = useState(null);
  const [registrosSvrs, setRegistrosSvrs] = useState(null); // null | [] (nada reconhecido) | [{ uf, mercadoria, ncmSh, aliquotaInterna, fecp, observacao, dataAtualizacao }]
  const [lendoSvrs, setLendoSvrs] = useState(false);
  const [buscaSvrs, setBuscaSvrs] = useState('');

  const [arquivosApiEconet, setArquivosApiEconet] = useState([]);
  const [resultadoApiEconet, setResultadoApiEconet] = useState(null); // null | { registros, paginas }
  const [lendoApiEconet, setLendoApiEconet] = useState(false);
  const [buscaApiEconet, setBuscaApiEconet] = useState('');

  async function recarregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [configsGlobais, globais] = await Promise.all([
        listarConfigsUf({ tenantCompanyId: null }),
        listarRegras(uf, { tenantCompanyId: null }),
      ]);
      const cGlobal = configsGlobais.find((c) => c.uf === uf) || null;
      setConfigGlobal(cGlobal);
      setRegrasGlobais(globais);

      let cTenant = null;
      let doTenant = [];
      if (tenantCompanyId) {
        const [configsTenant, regrasDoTenant] = await Promise.all([
          listarConfigsUf({ tenantCompanyId }),
          listarRegras(uf, { tenantCompanyId }),
        ]);
        cTenant = configsTenant.find((c) => c.uf === uf) || null;
        doTenant = regrasDoTenant;
      }
      setConfigTenant(cTenant);
      setRegrasTenant(doTenant);

      // O formulário edita o registro DESTE escopo. Se ainda não existe,
      // começa vazio — salvar cria um registro novo neste escopo, nunca uma
      // cópia silenciosa do que já existe no outro.
      const configDesteEscopo = ehGlobal ? cGlobal : cTenant;
      setFormConfig(configDesteEscopo ? {
        versao: configDesteEscopo.versao || '', metodoBase: configDesteEscopo.metodo_base,
        politicaRevenda: configDesteEscopo.politica_revenda,
        regraGeralAliquota: String(configDesteEscopo.regra_geral_aliquota),
        regraGeralFcp: String(configDesteEscopo.regra_geral_fcp ?? 0),
        regraGeralFundamento: configDesteEscopo.regra_geral_fundamento,
      } : CONFIG_VAZIA);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { recarregar(); }, [uf, tenantCompanyId, escopo]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabelaEfetiva = useMemo(() => montarTabelaUf({
    uf, configGlobal, configTenant, regrasGlobais, regrasTenant,
  }), [uf, configGlobal, configTenant, regrasGlobais, regrasTenant]);

  const regrasDaAba = ehGlobal ? regrasGlobais : regrasTenant;

  const registrosSvrsDaUf = useMemo(() => {
    if (!registrosSvrs) return [];
    const termo = buscaSvrs.trim().toLowerCase();
    return registrosSvrs.filter((r) => {
      if (siglaUf(r.uf) !== uf) return false;
      if (!termo) return true;
      return r.mercadoria.toLowerCase().includes(termo) || r.ncmSh.toLowerCase().includes(termo);
    });
  }, [registrosSvrs, uf, buscaSvrs]);

  const registrosApiEconetFiltrados = useMemo(() => {
    if (!resultadoApiEconet) return [];
    const termo = buscaApiEconet.trim().toLowerCase();
    if (!termo) return resultadoApiEconet.registros;
    return resultadoApiEconet.registros.filter((r) => (
      r.descricao.toLowerCase().includes(termo) || r.ncm.toLowerCase().includes(termo)
    ));
  }, [resultadoApiEconet, buscaApiEconet]);

  async function salvarConfig() {
    setErro(null);
    try {
      // `Number('')` é 0 — checa a string bruta antes de converter, senão um
      // campo deixado em branco vira "regra geral 0%" sem avisar ninguém.
      if (formConfig.regraGeralAliquota === '' || !Number.isFinite(Number(formConfig.regraGeralAliquota))) {
        throw new Error('Preencha a alíquota geral antes de salvar.');
      }
      if (!formConfig.regraGeralFundamento?.trim()) {
        throw new Error('Preencha o fundamento da regra geral antes de salvar.');
      }
      const payload = {
        uf,
        versao: formConfig.versao || null,
        metodoBase: formConfig.metodoBase,
        politicaRevenda: formConfig.politicaRevenda,
        regraGeralAliquota: Number(formConfig.regraGeralAliquota),
        regraGeralFcp: Number(formConfig.regraGeralFcp || 0),
        regraGeralFundamento: formConfig.regraGeralFundamento,
      };
      await salvarConfigUf(payload, escopoAtual);
      await recarregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function salvarRegraAtual() {
    const r = editandoRegra;
    // `Number('')` é 0 — sem esta checagem, um campo de alíquota deixado em
    // branco vira silenciosamente "0%" em vez de travar o salvamento. 0% é
    // um valor legítimo (existe alíquota interna zerada); vazio não é.
    if (!r.seguirGeral && (r.aliquota === '' || !Number.isFinite(Number(r.aliquota)))) {
      setErro('Preencha a alíquota ou marque "segue geral".');
      return;
    }
    if (!r.fundamento?.trim()) {
      setErro('Preencha o fundamento legal.');
      return;
    }
    setSalvandoRegra(true);
    setErro(null);
    try {
      const payload = {
        uf, ncm: r.ncm, tipo: r.tipo,
        ...(r.seguirGeral ? { seguirGeral: true } : { aliquota: Number(r.aliquota) }),
        fcp: r.fcp === '' ? null : Number(r.fcp),
        excecaoDe: r.excecaoDe || undefined,
        fundamento: r.fundamento,
        vigenciaInicio: r.vigenciaInicio || undefined,
        vigenciaFim: r.vigenciaFim || undefined,
        fonte: r.fonte || 'manual',
      };
      await salvarRegra(payload, escopoAtual, r.id || null);
      setEditandoRegra(null);
      await recarregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvandoRegra(false);
    }
  }

  async function removerRegra(linha) {
    if (!window.confirm(`Excluir a regra do NCM ${fmtNcm(linha.ncm_prefixo)}?`)) return;
    setErro(null);
    try {
      await excluirRegra(linha.id);
      await recarregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  function abrirEdicao(linha) {
    setEditandoRegra(linha ? {
      id: linha.id, ncm: linha.ncm_prefixo, tipo: linha.tipo,
      aliquota: linha.aliquota ?? '', seguirGeral: linha.segue_geral,
      fcp: linha.fcp ?? '', excecaoDe: linha.excecao_de || '',
      fundamento: linha.fundamento, vigenciaInicio: linha.vigencia_inicio || '',
      vigenciaFim: linha.vigencia_fim || '', fonte: linha.fonte,
    } : { ...REGRA_VAZIA });
  }

  function analisarEconet() {
    setResultadosEconet(parseResultadosAliquota(htmlEconet));
  }

  function usarRegistroEconet(registro, bloco) {
    const ncm = digitosNcm(registro.ncm);
    const nivel = ncm.length;
    const tipo = nivel === 2 ? 'capitulo' : nivel === 6 ? 'subposicao' : nivel === 8 ? 'item' : 'posicao';
    const semAliquotaPropria = registro.aliquota == null;
    const base = bloco?.baseLegal;
    const fundamento = [base?.texto, base?.url].filter(Boolean).join(' — ');
    setEditandoRegra({
      ...REGRA_VAZIA,
      ncm, tipo,
      aliquota: semAliquotaPropria ? '' : String(registro.aliquota),
      seguirGeral: semAliquotaPropria,
      fcp: registro.fecp != null ? String(registro.fecp) : '',
      fundamento,
      fonte: 'econet',
    });
  }

  async function lerArquivoSvrs(file) {
    setArquivoSvrs(file);
    setRegistrosSvrs(null);
    setLendoSvrs(true);
    try {
      const html = await file.text();
      setRegistrosSvrs(parseAliquotasPortalSvrs(html));
    } catch {
      setRegistrosSvrs([]);
    } finally {
      setLendoSvrs(false);
    }
  }

  function usarComoRegraGeralSvrs(registro) {
    setFormConfig({
      ...CONFIG_VAZIA,
      regraGeralAliquota: registro.aliquotaInterna != null ? String(registro.aliquotaInterna) : '',
      regraGeralFcp: registro.fecp != null ? String(registro.fecp) : '0',
      regraGeralFundamento: [registro.mercadoria, registro.observacao].filter(Boolean).join(' — '),
    });
  }

  function usarComoExcecaoSvrs(registro) {
    setEditandoRegra({
      ...REGRA_VAZIA,
      // O portal nem sempre dá um NCM específico (categorias legais, não
      // código por código) — quem cadastra decide o prefixo, informado pela
      // descrição da mercadoria.
      ncm: /^\d{2,8}$/.test(digitosNcm(registro.ncmSh)) ? digitosNcm(registro.ncmSh) : '',
      tipo: 'posicao',
      aliquota: registro.aliquotaInterna != null ? String(registro.aliquotaInterna) : '',
      seguirGeral: false,
      fcp: registro.fecp != null ? String(registro.fecp) : '',
      fundamento: [registro.mercadoria, registro.observacao].filter(Boolean).join(' — '),
      fonte: 'svrs',
    });
  }

  async function lerArquivosApiEconet(files) {
    setLendoApiEconet(true);
    try {
      const textos = await Promise.all(files.map((f) => f.text()));
      setResultadoApiEconet(parseApiAliquotasEconetEmLote(textos));
      setArquivosApiEconet(files.map((f) => f.name));
    } catch {
      setResultadoApiEconet({ registros: [], paginas: [] });
    } finally {
      setLendoApiEconet(false);
    }
  }

  function dataIsoOuVazia(valor) {
    return /^\d{4}-\d{2}-\d{2}/.test(String(valor || '')) ? String(valor).slice(0, 10) : '';
  }

  function usarRegistroApiEconet(registro) {
    const ncm = digitosNcm(registro.ncm);
    const nivel = ncm.length;
    const tipo = nivel === 2 ? 'capitulo' : nivel === 6 ? 'subposicao' : nivel === 8 ? 'item' : 'posicao';
    const semAliquotaPropria = registro.aliquota == null;
    const base = registro.baseLegal[0];
    const fundamento = [base?.texto, base?.url].filter(Boolean).join(' — ');
    setEditandoRegra({
      ...REGRA_VAZIA,
      ncm, tipo,
      aliquota: semAliquotaPropria ? '' : String(registro.aliquota),
      seguirGeral: semAliquotaPropria,
      fcp: registro.fecp != null ? String(registro.fecp) : '',
      fundamento,
      vigenciaInicio: dataIsoOuVazia(registro.vigenciaInicio),
      vigenciaFim: dataIsoOuVazia(registro.vigenciaFim),
      fonte: 'econet',
    });
  }

  async function lerArquivo(file) {
    setArquivoImport(file);
    setPreviaImport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      setPreviaImport(linhasDePlanilha(matriz, uf));
    } catch {
      setPreviaImport({ ok: false, linhas: [], erros: [{ linha: 0, motivo: 'Não foi possível ler o arquivo. Use .xlsx ou .csv.' }] });
    }
  }

  async function confirmarImport(sobrescrever) {
    if (!previaImport?.linhas.length) return;
    setImportando(true);
    setErro(null);
    try {
      const resultado = await importarRegras(previaImport.linhas, escopoAtual, { sobrescrever });
      setPreviaImport((atual) => ({ ...atual, resultado }));
      await recarregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setImportando(false);
    }
  }

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([MODELO_CABECALHO, ['3307', 'posicao', '25', '', '', '', 'RICMS art. 55', '', '', uf]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Regras NCM');
    XLSX.writeFile(wb, 'modelo-regras-ncm.xlsx');
  }

  const th = { textAlign: 'left', padding: '9px 11px', fontSize: 10.5, fontWeight: 700, color: P.muted2, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${P.border}`, whiteSpace: 'nowrap' };
  const td = { padding: '10px 11px', fontSize: 12.5, borderBottom: `1px solid ${P.border}` };

  return (
    <div style={{ fontFamily: FONT_INTER, color: P.text }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.6, maxWidth: 720 }}>{descricao}</div>
      </div>

      {erro && (
        <Card P={P} style={{ padding: '12px 14px', marginBottom: 16, borderColor: P.red }}>
          <div style={{ fontSize: 12.5, color: P.red }}>{erro}</div>
        </Card>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Campo label="UF" P={P}>
          <select value={uf} onChange={(e) => setUf(e.target.value)} style={{ ...inputStyle(P), width: 90, cursor: 'pointer' }}>
            {UFS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Campo>
        {!ehGlobal && (
          <div style={{ fontSize: 11.5, color: P.muted2, alignSelf: 'flex-end', paddingBottom: 9 }}>
            {configTenant || regrasTenant.length
              ? 'Este escritório tem ajuste próprio para esta UF.'
              : 'Sem ajuste próprio ainda — usando a base global da plataforma.'}
          </div>
        )}
      </div>

      {/* ── Config da UF ── */}
      <Card P={P} style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Regra geral, método e revenda {ehGlobal ? '(base global)' : '(ajuste deste escritório)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Campo label="Alíquota geral (%)" P={P}>
            <input type="number" step="0.01" style={inputStyle(P)} value={formConfig.regraGeralAliquota}
              onChange={(e) => setFormConfig((f) => ({ ...f, regraGeralAliquota: e.target.value }))} />
          </Campo>
          <Campo label="FCP da regra geral (%)" P={P}>
            <input type="number" step="0.01" style={inputStyle(P)} value={formConfig.regraGeralFcp}
              onChange={(e) => setFormConfig((f) => ({ ...f, regraGeralFcp: e.target.value }))} />
          </Campo>
          <Campo label="Método de base" P={P}>
            <select style={inputStyle(P)} value={formConfig.metodoBase}
              onChange={(e) => setFormConfig((f) => ({ ...f, metodoBase: e.target.value }))}>
              <option value="base_simples">Base simples</option>
              <option value="base_dupla">Base dupla (por dentro)</option>
            </select>
          </Campo>
          <Campo label="Revenda" P={P}>
            <select style={inputStyle(P)} value={formConfig.politicaRevenda}
              onChange={(e) => setFormConfig((f) => ({ ...f, politicaRevenda: e.target.value }))}>
              <option value="nao_incide">Não incide na revenda</option>
              <option value="antecipacao_parcial">Cobrar antecipação parcial</option>
            </select>
          </Campo>
          <Campo label="Versão / referência" P={P}>
            <input style={inputStyle(P)} value={formConfig.versao} placeholder="ex.: 2026-01"
              onChange={(e) => setFormConfig((f) => ({ ...f, versao: e.target.value }))} />
          </Campo>
        </div>
        <Campo label="Fundamento da regra geral" P={P}>
          <input style={inputStyle(P)} value={formConfig.regraGeralFundamento}
            onChange={(e) => setFormConfig((f) => ({ ...f, regraGeralFundamento: e.target.value }))} />
        </Campo>
        <div style={{ marginTop: 14 }}>
          <Botao P={P} onClick={salvarConfig}>Salvar config da UF</Botao>
        </div>
      </Card>

      {/* ── Regras por NCM ── */}
      <Card P={P} style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Exceções por NCM ({regrasDaAba.length})
          </div>
          <Botao P={P} onClick={() => abrirEdicao(null)}>+ Nova regra</Botao>
        </div>

        {editandoRegra && (
          <div style={{ padding: '14px 18px', background: P.surface2, borderTop: `1px solid ${P.border}`, borderBottom: `1px solid ${P.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
              <Campo label="NCM (prefixo)" P={P}>
                <input style={inputStyle(P)} placeholder="3307 ou 33072010" value={editandoRegra.ncm}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, ncm: e.target.value }))} disabled={Boolean(editandoRegra.id)} />
              </Campo>
              <Campo label="Tipo" P={P}>
                <select style={inputStyle(P)} value={editandoRegra.tipo}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, tipo: e.target.value }))}>
                  {TIPOS_REGRA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label="Alíquota (%)" P={P}>
                <input type="number" step="0.01" style={inputStyle(P)} value={editandoRegra.aliquota}
                  disabled={editandoRegra.seguirGeral}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, aliquota: e.target.value }))} />
              </Campo>
              <Campo label="FCP (%)" P={P}>
                <input type="number" step="0.01" style={inputStyle(P)} value={editandoRegra.fcp}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, fcp: e.target.value }))} />
              </Campo>
              <Campo label="Exceção de (NCM pai)" P={P}>
                <input style={inputStyle(P)} value={editandoRegra.excecaoDe}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, excecaoDe: e.target.value }))} />
              </Campo>
              <Campo label="Vigência início" P={P}>
                <input type="date" style={inputStyle(P)} value={editandoRegra.vigenciaInicio}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, vigenciaInicio: e.target.value }))} />
              </Campo>
              <Campo label="Vigência fim" P={P}>
                <input type="date" style={inputStyle(P)} value={editandoRegra.vigenciaFim}
                  onChange={(e) => setEditandoRegra((r) => ({ ...r, vigenciaFim: e.target.value }))} />
              </Campo>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: P.text, marginBottom: 12 }}>
              <input type="checkbox" checked={editandoRegra.seguirGeral}
                onChange={(e) => setEditandoRegra((r) => ({ ...r, seguirGeral: e.target.checked, aliquota: e.target.checked ? '' : r.aliquota }))} />
              É exceção que cai na regra geral (sem alíquota própria)
            </label>
            <Campo label="Fundamento legal" P={P}>
              <input style={inputStyle(P)} value={editandoRegra.fundamento}
                onChange={(e) => setEditandoRegra((r) => ({ ...r, fundamento: e.target.value }))} />
            </Campo>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Botao P={P} onClick={salvarRegraAtual} disabled={salvandoRegra}>
                {salvandoRegra ? 'Salvando…' : 'Salvar regra'}
              </Botao>
              <Botao P={P} variante="secundario" onClick={() => setEditandoRegra(null)}>Cancelar</Botao>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>NCM</th><th style={th}>Tipo</th><th style={th}>Alíquota</th>
                <th style={th}>FCP</th><th style={th}>Fundamento</th><th style={th}>Vigência</th>
                <th style={{ ...th, width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: P.muted }}>Carregando…</td></tr>
              ) : !regrasDaAba.length ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: P.muted }}>Nenhuma regra cadastrada para {uf}.</td></tr>
              ) : regrasDaAba.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: FONT_MONO }}>{fmtNcm(r.ncm_prefixo)}</td>
                  <td style={td}>{r.tipo}</td>
                  <td style={td}>{r.segue_geral ? 'segue geral' : fmtPct(r.aliquota)}</td>
                  <td style={td}>{r.fcp ? fmtPct(r.fcp) : '—'}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{r.fundamento}</td>
                  <td style={{ ...td, fontSize: 11, color: P.muted }}>
                    {r.vigencia_inicio || '—'} → {r.vigencia_fim || '—'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => abrirEdicao(r)} style={{ border: 'none', background: 'none', color: P.primaryText, cursor: 'pointer', fontSize: 12, marginRight: 10 }}>Editar</button>
                    <button onClick={() => removerRegra(r)} style={{ border: 'none', background: 'none', color: P.red, cursor: 'pointer', fontSize: 12 }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Importar da Econet ── */}
      <Card P={P} style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Importar da Econet
        </div>
        <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6, marginBottom: 12, maxWidth: 640 }}>
          Consulte um NCM na ferramenta "Alíquotas Internas e Benefícios Fiscais"
          da Econet, para a UF que você está editando aqui ({uf}). Depois, na
          página do resultado, use Ctrl+U (ver código-fonte) e cole abaixo. Nada
          é enviado para fora — a leitura acontece só no seu navegador, e nada
          é gravado até você revisar e clicar em salvar.
        </div>
        <textarea
          value={htmlEconet}
          onChange={(e) => { setHtmlEconet(e.target.value); setResultadosEconet(undefined); }}
          placeholder="Cole aqui o(s) resultado(s) copiados da Econet ('Copiar conteúdo') — pode colar vários, um atrás do outro…"
          style={{ ...inputStyle(P), minHeight: 110, fontFamily: FONT_MONO, fontSize: 11.5, resize: 'vertical', marginBottom: 10 }}
        />
        <Botao P={P} onClick={analisarEconet} disabled={!htmlEconet.trim()}>Analisar</Botao>

        {resultadosEconet?.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: P.red }}>
            Não reconheci nenhum resultado de alíquota nesse HTML. Confirme que
            colou o que o botão "Copiar conteúdo" da Econet gerou, depois de
            consultar um NCM.
          </div>
        )}

        {resultadosEconet?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {resultadosEconet.length > 1 && (
              <div style={{ fontSize: 11.5, color: P.muted2, marginBottom: 10 }}>
                {resultadosEconet.length} resultados reconhecidos nessa colagem.
              </div>
            )}
            {resultadosEconet.map((bloco, b) => (
              <div key={b} style={{ marginBottom: 16, paddingTop: b > 0 ? 12 : 0, borderTop: b > 0 ? `1px dashed ${P.border}` : 'none' }}>
                {bloco.registros.map((registro, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${P.border}`, background: P.surface2, marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, color: P.text, marginBottom: 6 }}>
                      <b style={{ fontFamily: FONT_MONO }}>{fmtNcm(registro.ncm)}</b>
                      {registro.ex && <span style={{ color: P.muted2 }}> · EX {registro.ex}</span>}
                      {' — '}
                      {registro.aliquota == null ? 'sem alíquota própria na consulta (verifique se segue a geral)' : fmtPct(registro.aliquota)}
                      {registro.fecp != null && ` + FCP ${fmtPct(registro.fecp)}`}
                    </div>
                    {registro.descricao && (
                      <div style={{ fontSize: 11.5, color: P.muted, lineHeight: 1.5, marginBottom: 8 }}>{registro.descricao}</div>
                    )}
                    <Botao P={P} variante="secundario" onClick={() => usarRegistroEconet(registro, bloco)}>
                      Usar esta linha no formulário →
                    </Botao>
                  </div>
                ))}

                {bloco.baseLegal && (
                  <div style={{ fontSize: 11.5, color: P.muted, marginBottom: 8 }}>
                    Base legal: {bloco.baseLegal.texto}
                    {bloco.baseLegal.url && (
                      <> — <a href={bloco.baseLegal.url} target="_blank" rel="noreferrer" style={{ color: P.primaryText }}>fonte</a></>
                    )}
                  </div>
                )}

                {bloco.observacoes.length > 0 && (
                  <div style={{ fontSize: 11.5, color: P.muted, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Observações da Econet (não são gravadas sozinhas — se apontarem
                      um NCM diferente com alíquota própria, consulte aquele código
                      separadamente e cole o resultado dele aqui também):
                    </div>
                    {bloco.observacoes.map((obs, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        • {obs.texto}
                        {obs.links.map((l, j) => <span key={j}> (<a href={l.url} target="_blank" rel="noreferrer" style={{ color: P.primaryText }}>{l.texto}</a>)</span>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Importar da API da Econet (JSON) ── */}
      <Card P={P} style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Importar da API da Econet (JSON)
        </div>
        <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6, marginBottom: 12, maxWidth: 640 }}>
          Mais completo que o "Copiar conteúdo": no DevTools (F12) → Network →
          Fetch/XHR, depois de consultar na Econet, clique na requisição que
          carregou o resultado e copie o conteúdo da aba Response — cada página
          traz até 100 linhas de uma vez, com NCM, vigência e base legal já
          organizados. Salve num arquivo .json ou .txt e envie aqui (pode
          enviar várias páginas juntas). As alíquotas gravadas valem para a UF
          selecionada lá em cima ({uf}) — confira se é a mesma UF da consulta.
        </div>
        <input type="file" accept=".json,.txt" multiple onChange={(e) => e.target.files.length && lerArquivosApiEconet(Array.from(e.target.files))} />

        {lendoApiEconet && <div style={{ marginTop: 12, fontSize: 12, color: P.muted }}>Lendo {arquivosApiEconet.length} arquivo(s)…</div>}

        {resultadoApiEconet && resultadoApiEconet.registros.length === 0 && !lendoApiEconet && (
          <div style={{ marginTop: 12, fontSize: 12, color: P.red }}>
            Não reconheci nenhuma página dessa API nos arquivos enviados.
            Confirme que copiou o conteúdo da aba Response (não a Preview
            formatada) de uma requisição de consulta de alíquota.
          </div>
        )}

        {resultadoApiEconet && resultadoApiEconet.registros.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, color: P.muted2, marginBottom: 10 }}>
              {resultadoApiEconet.registros.length} linha(s) carregadas de {arquivosApiEconet.length} arquivo(s).
              {resultadoApiEconet.paginas[0]?.total > resultadoApiEconet.registros.length && (
                <> Faltam páginas: a Econet reporta {resultadoApiEconet.paginas[0].total} no total
                  (página {resultadoApiEconet.paginas[0].atual} de {resultadoApiEconet.paginas[0].ultima} enviada) —
                  envie as próximas páginas pra completar.</>
              )}
            </div>
            <input
              value={buscaApiEconet}
              onChange={(e) => setBuscaApiEconet(e.target.value)}
              placeholder="Buscar por descrição ou NCM…"
              style={{ ...inputStyle(P), marginBottom: 12 }}
            />
            {!registrosApiEconetFiltrados.length ? (
              <div style={{ fontSize: 12, color: P.muted }}>Nada encontrado com esse filtro.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {registrosApiEconetFiltrados.map((r, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${P.border}`, background: P.surface2 }}>
                    <div style={{ fontSize: 12.5, color: P.text, marginBottom: 4 }}>
                      <b>{r.descricao}</b>
                      {r.ncm && <span style={{ color: P.muted2, fontFamily: FONT_MONO }}> · NCM: {r.ncm}</span>}
                      {!r.ncmVigente && <span style={{ color: P.gold }}> · NCM pode não estar mais vigente</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: P.muted, marginBottom: 8 }}>
                      {r.aliquota != null ? fmtPct(r.aliquota) : 'sem alíquota própria'}
                      {r.fecp != null && ` + FECP ${fmtPct(r.fecp)}`}
                      {r.baseLegal[0] && ` — ${r.baseLegal[0].texto}`}
                    </div>
                    <Botao P={P} variante="secundario" onClick={() => usarRegistroApiEconet(r)}>
                      Usar esta linha no formulário →
                    </Botao>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Importar do Portal da DIFAL (SVRS) ── */}
      <Card P={P} style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Importar do Portal da DIFAL (SVRS)
        </div>
        <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6, marginBottom: 12, maxWidth: 640 }}>
          Fonte pública oficial (Sefaz Virtual do RS) com as 27 UFs numa página
          só, sem consulta protegida — dá pra baixar tudo de uma vez. Abra{' '}
          <a href="https://dfe-portal.svrs.rs.gov.br/Difal/Aliquotas" target="_blank" rel="noreferrer" style={{ color: P.primaryText }}>
            dfe-portal.svrs.rs.gov.br/Difal/Aliquotas
          </a>{' '}
          no seu navegador, Ctrl+U (ver código-fonte), salve como .html e envie
          aqui. As categorias são descritas por texto legal — nem sempre um NCM
          específico — então cada linha pede pra você confirmar o prefixo antes
          de gravar.
        </div>
        <input type="file" accept=".html,.htm" onChange={(e) => e.target.files[0] && lerArquivoSvrs(e.target.files[0])} />

        {lendoSvrs && <div style={{ marginTop: 12, fontSize: 12, color: P.muted }}>Lendo {arquivoSvrs?.name}…</div>}

        {registrosSvrs?.length === 0 && !lendoSvrs && (
          <div style={{ marginTop: 12, fontSize: 12, color: P.red }}>
            Não reconheci a estrutura do Portal da DIFAL nesse arquivo. Confirme
            que salvou a página de Alíquotas (não a de Benefícios) com Ctrl+U
            ou "Salvar como → Página HTML completa".
          </div>
        )}

        {registrosSvrs?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, color: P.muted2, marginBottom: 10 }}>
              {registrosSvrs.length} linha(s) em {ufsDoPortalSvrs(registrosSvrs).length} UF(s) reconhecidas no arquivo.
              Mostrando {uf} — troque a UF lá em cima pra ver outro estado.
            </div>
            <input
              value={buscaSvrs}
              onChange={(e) => setBuscaSvrs(e.target.value)}
              placeholder="Buscar por descrição ou NCM…"
              style={{ ...inputStyle(P), marginBottom: 12 }}
            />
            {!registrosSvrsDaUf.length ? (
              <div style={{ fontSize: 12, color: P.muted }}>Nada encontrado para {uf} com esse filtro.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {registrosSvrsDaUf.map((r, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${P.border}`, background: P.surface2 }}>
                    <div style={{ fontSize: 12.5, color: P.text, marginBottom: 4 }}>
                      <b>{r.mercadoria}</b>
                      {r.ncmSh && <span style={{ color: P.muted2, fontFamily: FONT_MONO }}> · NCM/SH: {r.ncmSh}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: P.muted, marginBottom: 8 }}>
                      {r.aliquotaInterna != null ? fmtPct(r.aliquotaInterna) : '—'}
                      {r.fecp != null && ` + FECP ${fmtPct(r.fecp)}`}
                      {r.observacao && ` — ${r.observacao}`}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Botao P={P} variante="secundario" onClick={() => usarComoRegraGeralSvrs(r)}>
                        Usar como regra geral da UF
                      </Botao>
                      <Botao P={P} variante="secundario" onClick={() => usarComoExcecaoSvrs(r)}>
                        Usar como exceção de NCM →
                      </Botao>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Importar planilha ── */}
      <Card P={P} style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Importar de planilha
        </div>
        <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6, marginBottom: 12, maxWidth: 640 }}>
          Cadastro em lote — cole as regras copiadas de uma fonte externa (a
          consulta na Econet, por exemplo) numa planilha e importe aqui. NCM
          que já existe entra como conflito, sem sobrescrever sem avisar.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && lerArquivo(e.target.files[0])} />
          <Botao P={P} variante="secundario" onClick={baixarModelo}>Baixar planilha modelo</Botao>
        </div>

        {previaImport && (
          <div>
            {previaImport.erros.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: P.gold, marginBottom: 6 }}>
                  {previaImport.erros.length} linha(s) com problema — não entram na importação:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {previaImport.erros.map((e, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: P.muted }}>
                      Linha {e.linha || '—'}: {e.motivo}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previaImport.linhas.length > 0 && (
              <div style={{ fontSize: 12.5, color: P.text, marginBottom: 10 }}>
                {previaImport.linhas.length} linha(s) prontas para importar de <b>{arquivoImport?.name}</b>.
              </div>
            )}
            {previaImport.resultado ? (
              <div style={{ fontSize: 12.5, color: P.text }}>
                {previaImport.resultado.gravadas} gravada(s)
                {previaImport.resultado.conflitos.length > 0 && `, ${previaImport.resultado.conflitos.length} em conflito`}
                {previaImport.resultado.erros.length > 0 && `, ${previaImport.resultado.erros.length} com erro`}.
                {previaImport.resultado.conflitos.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Botao P={P} variante="perigo" onClick={() => confirmarImport(true)} disabled={importando}>
                      Sobrescrever os {previaImport.resultado.conflitos.length} em conflito
                    </Botao>
                  </div>
                )}
              </div>
            ) : previaImport.linhas.length > 0 && (
              <Botao P={P} onClick={() => confirmarImport(false)} disabled={importando}>
                {importando ? 'Importando…' : `Importar ${previaImport.linhas.length} linha(s)`}
              </Botao>
            )}
          </div>
        )}
      </Card>

      {/* ── Prévia do que o motor vai usar ── */}
      {tabelaEfetiva && (
        <Card P={P} style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Como {uf} fica para o motor, hoje
          </div>
          <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6 }}>
            Regra geral {fmtPct(tabelaEfetiva.regraGeral.aliquota)}
            {tabelaEfetiva.regraGeral.fcp > 0 && ` + FCP ${fmtPct(tabelaEfetiva.regraGeral.fcp)}`}
            {' · '}{tabelaEfetiva.metodoBase === 'base_dupla' ? 'base dupla' : 'base simples'}
            {' · '}{tabelaEfetiva.regras.length} exceção(ões) de NCM
            {tabelaEfetiva.regras.some((r) => r.origemAjuste === 'tenant') && ' (com ajuste deste escritório)'}
          </div>
          {(() => {
            const erros = validarTabela(tabelaEfetiva);
            return erros.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: P.red }}>
                Cadastro com problema — o motor vai recusar esta UF até corrigir:
                {erros.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}
