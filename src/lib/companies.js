import { supabase } from './supabase';

// Rótulo em português do papel do membro dentro da empresa.
export const COMPANY_ROLE_LABEL = { owner: 'Dono', admin: 'Admin / Gestor', member: 'Membro' };

function translate(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Erro de conexão. Tente novamente.';
  return msg;
}

export async function fetchMyCompany() {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return null;

  const { data: memberships, error: mErr } = await supabase
    .from('company_members')
    .select('id, company_id, role, status, created_at')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false });
  if (mErr) throw new Error(translate(mErr));
  if (!memberships || memberships.length === 0) return null;

  const membership = memberships.find((m) => m.status === 'active') || memberships[0];

  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('id, name, code, owner_id, logo_url, created_at')
    .eq('id', membership.company_id)
    .maybeSingle();
  if (cErr) throw new Error(translate(cErr));
  if (!company) return null;

  return { company, membership };
}

export async function fetchCompanyMembers(companyId) {
  const { data: members, error } = await supabase
    .from('company_members')
    .select('id, user_id, role, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(translate(error));

  const ids = [...new Set((members || []).map((m) => m.user_id))];
  let profilesById = {};
  if (ids.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, photo_url')
      .in('id', ids);
    if (!pErr && profiles) {
      profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    }
  }

  return (members || []).map((m) => ({
    ...m,
    profile: profilesById[m.user_id] || null,
  }));
}

export async function createCompany(name) {
  const { data, error } = await supabase.rpc('create_company', { p_name: name });
  if (error) throw new Error(translate(error));
  return data;
}

export async function requestJoinCompany(code) {
  const { data, error } = await supabase.rpc('request_join_company', { p_code: code });
  if (error) throw new Error(translate(error));
  return data;
}

export async function approveMember(memberId) {
  const { error } = await supabase.rpc('approve_member', { p_member_id: memberId });
  if (error) throw new Error(translate(error));
}

export async function rejectMember(memberId) {
  const { error } = await supabase.rpc('reject_member', { p_member_id: memberId });
  if (error) throw new Error(translate(error));
}

export async function leaveCompany(companyId) {
  const { error } = await supabase.rpc('leave_company', { p_company_id: companyId });
  if (error) throw new Error(translate(error));
}

export async function updateCompanyLogo(companyId, logoUrl) {
  const { error } = await supabase
    .from('companies')
    .update({ logo_url: logoUrl })
    .eq('id', companyId);
  if (error) throw new Error(translate(error));
}

export async function setMemberRole(memberId, role) {
  const { data, error } = await supabase.rpc('set_member_role', {
    p_member_id: memberId,
    p_role: role,
  });
  if (error) throw new Error(translate(error));
  return data;
}
