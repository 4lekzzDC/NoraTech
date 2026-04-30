import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveMember,
  createCompany,
  fetchCompanyMembers,
  fetchMyCompany,
  leaveCompany,
  rejectMember,
  requestJoinCompany,
} from '../lib/companies';

const PURPLE = '#7C3AED';
const CARD_BG = 'rgba(255,255,255,0.02)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const palette = type === 'success'
    ? { bg: 'rgba(124, 58, 237,0.12)', bd: 'rgba(124, 58, 237,0.3)', fg: '#b197ff' }
    : { bg: 'rgba(255,80,80,0.12)', bd: 'rgba(255,80,80,0.3)', fg: '#ff6b6b' };

  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        padding: '12px 18px', borderRadius: 10,
        background: palette.bg, border: `1px solid ${palette.bd}`, color: palette.fg,
        fontSize: '0.88rem', fontWeight: 600, maxWidth: 360,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      }}
    >
      {message}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 150,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#101015', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
          maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#eeede9', fontSize: '0.92rem', fontFamily: "'Inter', sans-serif",
  outline: 'none', transition: 'border-color 0.15s',
};

const primaryBtn = {
  padding: '11px 18px', background: PURPLE, borderRadius: 10,
  color: '#fff', fontSize: '0.88rem', fontWeight: 700, border: 'none',
  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
};

const ghostBtn = {
  padding: '11px 18px', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
  color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
};

function CodePill({ code }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback silencioso
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', borderRadius: 10,
        background: 'rgba(124, 58, 237,0.08)', border: '1px solid rgba(124, 58, 237,0.3)',
        color: '#d6c4ff', fontFamily: "'JetBrains Mono', monospace",
        fontSize: '1rem', fontWeight: 700, letterSpacing: 2,
        cursor: 'pointer',
      }}
      title="Copiar código"
    >
      {code}
      <span style={{ fontSize: '0.7rem', color: copied ? '#7dff7d' : 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>
        {copied ? 'COPIADO' : 'COPIAR'}
      </span>
    </button>
  );
}

function MemberRow({ member, currentUserId, isOwner, onApprove, onReject, busyId }) {
  const profile = member.profile;
  const name = profile?.name || 'Convidado';
  const initials = (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const isMe = member.user_id === currentUserId;
  const busy = busyId === member.id;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      {profile?.photo_url ? (
        <img src={profile.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(124, 58, 237,0.15)', color: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>
          {initials}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
          {name}{isMe && <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}> · você</span>}
        </div>
        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
          {member.role === 'owner' ? 'Dono' : 'Membro'}
          {member.status === 'pending' && ' · Aguardando'}
        </div>
      </div>
      {isOwner && member.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onApprove(member.id)}
            disabled={busy}
            style={{ ...primaryBtn, padding: '8px 14px', fontSize: '0.78rem', opacity: busy ? 0.6 : 1 }}
          >
            Aceitar
          </button>
          <button
            onClick={() => onReject(member.id)}
            disabled={busy}
            style={{ ...ghostBtn, padding: '8px 14px', fontSize: '0.78rem', opacity: busy ? 0.6 : 1 }}
          >
            Recusar
          </button>
        </div>
      )}
      {isOwner && member.status === 'active' && member.role !== 'owner' && (
        <button
          onClick={() => onReject(member.id)}
          disabled={busy}
          style={{ ...ghostBtn, padding: '8px 14px', fontSize: '0.78rem', color: '#ff9ab4', borderColor: 'rgba(255,80,80,0.25)', opacity: busy ? 0.6 : 1 }}
        >
          Remover
        </button>
      )}
    </div>
  );
}

function Chooser({ onCreate, onJoin }) {
  return (
    <div style={{ background: CARD_BG, border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 32 }}>
      <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
        Sem empresa vinculada
      </span>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 10 }}>
        Configure sua empresa
      </h3>
      <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto 22px' }}>
        Crie uma empresa para gerenciar sua operação ou ingresse em uma empresa existente usando o código fornecido pelo dono.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={onCreate} style={primaryBtn}>Criar empresa</button>
        <button onClick={onJoin} style={ghostBtn}>Ingressar com código</button>
      </div>
    </div>
  );
}

function CreateForm({ busy, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    onSubmit(name);
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        Nome da empresa
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex.: Noratech"
        maxLength={80}
        style={inputStyle}
      />
      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        Você receberá um código único. Compartilhe-o com quem quiser ingressar — apenas você poderá aceitar novos membros.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" onClick={onCancel} style={ghostBtn} disabled={busy}>Cancelar</button>
        <button type="submit" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
          {busy ? 'Criando…' : 'Criar empresa'}
        </button>
      </div>
    </form>
  );
}

function JoinForm({ busy, onSubmit, onCancel }) {
  const [code, setCode] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    onSubmit(code);
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        Código da empresa
      </label>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ex.: A2K9PX"
        maxLength={12}
        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 4, textAlign: 'center', fontSize: '1.1rem' }}
      />
      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        Sua solicitação ficará pendente até que o dono da empresa aprove o ingresso.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" onClick={onCancel} style={ghostBtn} disabled={busy}>Cancelar</button>
        <button type="submit" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
          {busy ? 'Enviando…' : 'Solicitar ingresso'}
        </button>
      </div>
    </form>
  );
}

function PendingCard({ company, onCancel, busy }) {
  return (
    <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '28px 26px', marginBottom: 32 }}>
      <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: '#ffb86b', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(255,184,107,0.3)', background: 'rgba(255,184,107,0.06)', borderRadius: 6, marginBottom: 14 }}>
        Aguardando aprovação
      </span>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
        {company.name}
      </h3>
      <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', marginBottom: 18 }}>
        Sua solicitação foi enviada. Você terá acesso à empresa assim que o dono aprovar.
      </p>
      <button onClick={onCancel} style={{ ...ghostBtn, color: '#ff9ab4', borderColor: 'rgba(255,80,80,0.25)', opacity: busy ? 0.6 : 1 }} disabled={busy}>
        Cancelar solicitação
      </button>
    </div>
  );
}

export default function CockpitCompany({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null); // { company, membership }
  const [members, setMembers] = useState([]);
  const [openModal, setOpenModal] = useState(null); // 'create' | 'join' | null
  const [busy, setBusy] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchMyCompany();
      setData(result);
      if (result?.membership?.status === 'active') {
        const list = await fetchCompanyMembers(result.company.id);
        setMembers(list);
      } else {
        setMembers([]);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar empresa', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = useCallback(async (name) => {
    try {
      setBusy(true);
      await createCompany(name);
      setOpenModal(null);
      showToast('Empresa criada com sucesso!');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Erro ao criar empresa', 'error');
    } finally {
      setBusy(false);
    }
  }, [refresh, showToast]);

  const handleJoin = useCallback(async (code) => {
    try {
      setBusy(true);
      await requestJoinCompany(code);
      setOpenModal(null);
      showToast('Solicitação enviada! Aguarde aprovação.');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Erro ao solicitar ingresso', 'error');
    } finally {
      setBusy(false);
    }
  }, [refresh, showToast]);

  const handleApprove = useCallback(async (memberId) => {
    try {
      setBusyMemberId(memberId);
      await approveMember(memberId);
      showToast('Membro aprovado.');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Erro ao aprovar membro', 'error');
    } finally {
      setBusyMemberId(null);
    }
  }, [refresh, showToast]);

  const handleReject = useCallback(async (memberId) => {
    try {
      setBusyMemberId(memberId);
      await rejectMember(memberId);
      showToast('Membro removido.');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Erro ao remover membro', 'error');
    } finally {
      setBusyMemberId(null);
    }
  }, [refresh, showToast]);

  const handleLeave = useCallback(async () => {
    if (!data?.company) return;
    try {
      setBusy(true);
      await leaveCompany(data.company.id);
      showToast('Você saiu da empresa.');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Erro ao sair', 'error');
    } finally {
      setBusy(false);
    }
  }, [data, refresh, showToast]);

  const isOwner = useMemo(() => data?.membership?.role === 'owner', [data]);
  const pendingMembers = useMemo(() => members.filter((m) => m.status === 'pending'), [members]);
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  if (loading) {
    return (
      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 32, color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
        Carregando empresa…
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <Chooser onCreate={() => setOpenModal('create')} onJoin={() => setOpenModal('join')} />
        <Modal open={openModal === 'create'} onClose={() => !busy && setOpenModal(null)} title="Criar empresa">
          <CreateForm busy={busy} onSubmit={handleCreate} onCancel={() => setOpenModal(null)} />
        </Modal>
        <Modal open={openModal === 'join'} onClose={() => !busy && setOpenModal(null)} title="Ingressar em uma empresa">
          <JoinForm busy={busy} onSubmit={handleJoin} onCancel={() => setOpenModal(null)} />
        </Modal>
        <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      </>
    );
  }

  if (data.membership.status === 'pending') {
    return (
      <>
        <PendingCard company={data.company} onCancel={handleLeave} busy={busy} />
        <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <>
      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '26px 28px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, color: PURPLE, textTransform: 'uppercase' }}>
              Empresa · {isOwner ? 'Dono' : 'Membro'}
            </span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: -0.6, marginTop: 6 }}>
              {data.company.name}
            </h3>
          </div>
          {!isOwner && (
            <button
              onClick={handleLeave}
              disabled={busy}
              style={{ ...ghostBtn, color: '#ff9ab4', borderColor: 'rgba(255,80,80,0.25)', fontSize: '0.82rem', opacity: busy ? 0.6 : 1 }}
            >
              Sair da empresa
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
              Código de ingresso
            </div>
            <CodePill code={data.company.code} />
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
              {isOwner
                ? 'Compartilhe este código com quem quiser ingressar.'
                : 'Use este código para convidar outras pessoas (a aprovação cabe ao dono).'}
            </p>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
              Membros ativos
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: PURPLE, letterSpacing: -1 }}>
              {activeMembers.length}
            </div>
          </div>
          {isOwner && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
                Solicitações pendentes
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: pendingMembers.length > 0 ? '#ffb86b' : 'rgba(255,255,255,0.3)', letterSpacing: -1 }}>
                {pendingMembers.length}
              </div>
            </div>
          )}
        </div>
      </div>

      {isOwner && pendingMembers.length > 0 && (
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '22px 26px', marginBottom: 16 }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>Solicitações de ingresso</h4>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
            Aprove ou recuse quem solicitou acesso à sua empresa.
          </p>
          <div>
            {pendingMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                currentUserId={user?.id}
                isOwner
                onApprove={handleApprove}
                onReject={handleReject}
                busyId={busyMemberId}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '22px 26px', marginBottom: 32 }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>Membros</h4>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
          {activeMembers.length === 1 ? '1 pessoa nesta empresa.' : `${activeMembers.length} pessoas nesta empresa.`}
        </p>
        <div>
          {activeMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserId={user?.id}
              isOwner={isOwner}
              onApprove={handleApprove}
              onReject={handleReject}
              busyId={busyMemberId}
            />
          ))}
        </div>
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  );
}
