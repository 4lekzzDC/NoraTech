// Serviço da Gestão de Clientes — localStorage, sem React, sem DOM.
// Porta fiel das funções gc* do Autonomy (dashboard.html 4561-5005).
//
// Chave localStorage (compartilhada com todos os sistemas):
//   gestao_clientes → array de clientes

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

// ──────────────────────────────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────────────────────────────

export function getAll() {
  try { return JSON.parse(localStorage.getItem('gestao_clientes') || '[]'); }
  catch { return []; }
}

export function saveAll(v) {
  localStorage.setItem('gestao_clientes', JSON.stringify(v));
}

export function getClientes() {
  return getAll();
}

export function saveCliente(data, id) {
  const lista = getAll();
  if (id) {
    const i = lista.findIndex((c) => c.id === id);
    if (i > -1) lista[i] = { ...lista[i], ...data, updated_at: new Date().toISOString() };
    saveAll(lista);
    return lista[i >= 0 ? i : 0];
  } else {
    const obj = {
      ...data,
      id: 'cli_' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    lista.push(obj);
    saveAll(lista);
    return obj;
  }
}

export function deleteCliente(id) {
  saveAll(getAll().filter((c) => c.id !== id));
}

// ──────────────────────────────────────────────────────────────────────
// Geocoding (Nominatim — background, non-blocking)
// ──────────────────────────────────────────────────────────────────────

export async function geocode(cliente) {
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
      const lista = getAll();
      const i = lista.findIndex((c) => c.id === cliente.id);
      if (i > -1) {
        lista[i].lat       = coords.lat;
        lista[i].lng       = coords.lng;
        lista[i].geo_level = LEVELS[qi] ?? 'city';
        saveAll(lista);
      }
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
    tributacao:  d.opcao_pelo_mei ? 'MEI' : d.opcao_pelo_simples ? 'Simples Nacional' : '',
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

// ──────────────────────────────────────────────────────────────────────
// Contas bancárias (via Codificador de Extrato)
// ──────────────────────────────────────────────────────────────────────

export function getBancos(clienteId) {
  try {
    const banks = JSON.parse(localStorage.getItem('cod_banks') || '[]');
    return banks.filter((b) => b.company_id === clienteId);
  } catch { return []; }
}
