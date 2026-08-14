// Telefone e endereço do usuário. Moram em `profile_contacts` e não em
// `profiles` porque `profiles` é legível por qualquer usuário autenticado
// (policy `profiles_read_authenticated`) — ver migration_20260814_profile_contacts.sql.

import { supabase } from './supabase';

const EMPTY = {
  phone: '',
  addressZip: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressDistrict: '',
  addressCity: '',
  addressState: '',
};

export const EMPTY_CONTACT = EMPTY;

function fromRow(row) {
  if (!row) return { ...EMPTY };
  return {
    phone: row.phone || '',
    addressZip: row.address_zip || '',
    addressStreet: row.address_street || '',
    addressNumber: row.address_number || '',
    addressComplement: row.address_complement || '',
    addressDistrict: row.address_district || '',
    addressCity: row.address_city || '',
    addressState: row.address_state || '',
  };
}

export async function fetchProfileContact(userId) {
  const { data, error } = await supabase
    .from('profile_contacts')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return fromRow(data);
}

export async function saveProfileContact(userId, contact) {
  const payload = {
    id: userId,
    phone: contact.phone?.trim() || null,
    address_zip: contact.addressZip?.trim() || null,
    address_street: contact.addressStreet?.trim() || null,
    address_number: contact.addressNumber?.trim() || null,
    address_complement: contact.addressComplement?.trim() || null,
    address_district: contact.addressDistrict?.trim() || null,
    address_city: contact.addressCity?.trim() || null,
    address_state: contact.addressState?.trim()?.toUpperCase() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('profile_contacts')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return fromRow(payload);
}

// ─── Formatação / validação ──────────────────────────────────────────────────

export function formatPhone(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatZip(value) {
  const d = (value || '').replace(/\D/g, '').slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidPhone(value) {
  const d = (value || '').replace(/\D/g, '');
  return d.length === 0 || d.length === 10 || d.length === 11;
}

export function isValidZip(value) {
  const d = (value || '').replace(/\D/g, '');
  return d.length === 0 || d.length === 8;
}

// Busca o endereço pelo CEP (ViaCEP, público e sem chave). Retorna null se o
// CEP não existir ou a consulta falhar — o preenchimento manual continua valendo.
export async function lookupZip(zip) {
  const d = (zip || '').replace(/\D/g, '');
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      addressStreet: data.logradouro || '',
      addressDistrict: data.bairro || '',
      addressCity: data.localidade || '',
      addressState: data.uf || '',
    };
  } catch {
    return null;
  }
}
