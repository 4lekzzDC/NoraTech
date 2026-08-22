// Constantes e helpers puros da Gestão de Clientes — sem React, sem DOM.
//
// O cadastro em si (CRUD de clientes e contas bancárias) mora em
// clients.service.js, a base compartilhada da equipe (Supabase). Este
// arquivo guarda só o que não depende de onde os dados estão salvas:
// opções de formulário e as buscas externas (CNPJ, CEP, geocoding).
import { saveCliente } from '../../services/clients.service';

// ──────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────

export const TRIBUT_COLORS = {
  'MEI':              '#4a9eff',
  'Simples Nacional': '#34d399',
  'Lucro Presumido':  '#f0b429',
  'Lucro Real':       '#a78bfa',
  'Outro':            '#8899aa',
};

export const TRIBUT_OPTIONS = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'];

// Ramo de atividade CLASSIFICADO — diferente do campo `atividade`, que é a
// descrição livre do CNAE.
//
// Existe porque no Lucro Presumido o percentual de presunção depende do ramo:
// comércio e serviços presumem bases muito diferentes sobre a mesma receita.
// Texto livre ("Atividades de contabilidade") não permite essa decisão por
// código — daí a lista fechada.
export const RAMO_ATIVIDADE_OPTIONS = [
  { id: 'comercio_industria',    label: 'Comércio / Indústria' },
  { id: 'servicos_gerais',       label: 'Serviços em geral' },
  { id: 'servicos_hospitalares', label: 'Serviços hospitalares e de diagnóstico' },
  { id: 'transporte_cargas',     label: 'Transporte de cargas' },
  { id: 'transporte_passageiros',label: 'Transporte de passageiros' },
  { id: 'revenda_combustiveis',  label: 'Revenda de combustíveis' },
  { id: 'intermediacao_imoveis', label: 'Intermediação de negócios / locação de imóveis' },
];

export const RAMO_LABEL_BY_ID = RAMO_ATIVIDADE_OPTIONS.reduce((acc, r) => {
  acc[r.id] = r.label;
  return acc;
}, {});

// Deduz o ramo a partir do código CNAE. Só devolve valor quando a faixa é
// inequívoca — na dúvida devolve null para o usuário classificar à mão, já
// que um chute aqui vira alíquota errada lá na frente.
export function inferRamoFromCnae(cnae) {
  const d = String(cnae || '').replace(/\D/g, '');
  if (d.length < 4) return null;
  const div = d.slice(0, 2);          // divisão CNAE (2 dígitos)
  const grupo = d.slice(0, 3);        // grupo (3 dígitos)
  const classe = d.slice(0, 5);       // classe (5 dígitos)

  if (classe === '47301') return 'revenda_combustiveis';       // comércio varejista de combustíveis
  // Divisão 49: 49.2 é rodoviário de passageiros e 49.3 é rodoviário de carga.
  // 49.1 (ferroviário/metroferroviário) e 49.5 (trens turísticos) ficam de
  // fora porque misturam carga e passageiro — presunção diferente, então
  // melhor exigir a classificação manual do que arriscar.
  if (grupo === '492') return 'transporte_passageiros';
  if (grupo === '493' || grupo === '494') return 'transporte_cargas'; // 49.4 = dutoviário
  if (div === '86') return 'servicos_hospitalares';
  if (div === '68') return 'intermediacao_imoveis';

  const n = Number(div);
  if (n >= 10 && n <= 33) return 'comercio_industria';         // indústrias de transformação
  if (n >= 45 && n <= 47) return 'comercio_industria';          // comércio
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Geocoding (Nominatim — background, non-blocking)
// ──────────────────────────────────────────────────────────────────────

export async function geocode(cliente, tenantCompanyId) {
  async function tryQ(q) {
    try {
      const r = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q),
        { headers: { Accept: 'application/json' } }
      );
      const d = await r.json();
      return d[0] ? { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) } : null;
    } catch { return null; }
  }

  // Build candidate queries in priority order
  const queries = [];

  // 1 — full street address
  const street = [
    cliente.logradouro,
    cliente.numero,
    cliente.bairro,
    cliente.cidade,
    cliente.estado,
    'Brasil',
  ].filter(Boolean);
  if (street.length >= 4) queries.push(street.join(', '));

  // 2 — CEP only (very precise when available)
  const cep = (cliente.cep || '').replace(/\D/g, '');
  if (cep.length === 8) queries.push(cep + ', Brasil');

  // 3 — city / state fallback
  if (cliente.cidade) {
    queries.push([cliente.cidade, cliente.estado, 'Brasil'].filter(Boolean).join(', '));
  }

  const LEVELS = ['address', 'cep', 'city'];
  for (let qi = 0; qi < queries.length; qi++) {
    const coords = await tryQ(queries[qi]);
    if (coords) {
      try {
        await saveCliente(
          { lat: coords.lat, lng: coords.lng, geo_level: LEVELS[qi] ?? 'city' },
          cliente.id,
          tenantCompanyId
        );
      } catch { /* geocoding é best-effort — falha aqui não deve travar a UI */ }
      return coords;
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
}

// ──────────────────────────────────────────────────────────────────────
// CNPJ lookup — BrasilAPI
// ──────────────────────────────────────────────────────────────────────

export async function buscarCNPJ(cnpj) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos');
  const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + digits);
  if (!r.ok) throw new Error('CNPJ não encontrado');
  const d = await r.json();
  const cepRaw = (d.cep || '').replace(/\D/g, '');
  return {
    name:        d.razao_social || '',
    trade_name:  d.nome_fantasia || '',
    email:       d.email || '',
    phone:       d.ddd_telefone_1 || '',
    cep:         cepRaw ? cepRaw.replace(/(\d{5})(\d{3})/, '$1-$2') : '',
    logradouro:  d.logradouro || '',
    numero:      d.numero || '',
    complemento: d.complemento || '',
    bairro:      d.bairro || '',
    cidade:      d.municipio || '',
    estado:      d.uf || '',
    atividade:   d.cnae_fiscal_descricao || '',
    cnae:        d.cnae_fiscal ? String(d.cnae_fiscal) : '',
    tributacao:  d.opcao_pelo_mei ? 'MEI' : d.opcao_pelo_simples ? 'Simples Nacional' : '',
    // null quando o CNAE não é conclusivo — o formulário then exige a
    // classificação manual em vez de gravar um palpite.
    ramo_atividade: inferRamoFromCnae(d.cnae_fiscal) || '',
  };
}

// ──────────────────────────────────────────────────────────────────────
// CEP lookup — ViaCEP
// ──────────────────────────────────────────────────────────────────────

export async function buscarCEP(cep) {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) throw new Error('CEP inválido');
  const r = await fetch('https://viacep.com.br/ws/' + digits + '/json/');
  const d = await r.json();
  if (d.erro) throw new Error('CEP não encontrado');
  return {
    logradouro: d.logradouro || '',
    bairro:     d.bairro || '',
    cidade:     d.localidade || '',
    estado:     d.uf || '',
  };
}
