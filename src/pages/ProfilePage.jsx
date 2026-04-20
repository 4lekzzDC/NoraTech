import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px', marginBottom: 16 }}>
      <h2 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      padding: '12px 20px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 600,
      background: type === 'success' ? 'rgba(200,255,0,0.12)' : 'rgba(255,80,80,0.12)',
      border: `1px solid ${type === 'success' ? 'rgba(200,255,0,0.3)' : 'rgba(255,80,80,0.3)'}`,
      color: type === 'success' ? '#c8ff00' : '#ff6b6b',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      fontFamily: "'Manrope', sans-serif",
    }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const photoInputRef = useRef(null)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [infoLoading, setInfoLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [photoLoading, setPhotoLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (user) { setName(user.name); setEmail(user.email) }
  }, [user])

  const showToast = (message, type = 'success') => setToast({ message, type })

  const handleUpdateInfo = async (e) => {
    e.preventDefault()
    setInfoLoading(true)
    try {
      const updates = {}
      if (name !== user?.name) updates.name = name.trim()

      if (Object.keys(updates).length > 0) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        if (profileErr) throw new Error(profileErr.message)
      }

      if (email !== user?.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email })
        if (emailErr) throw new Error(emailErr.message)
        showToast('Confirme o novo e-mail na sua caixa de entrada')
      } else {
        updateUser({ name: name.trim() })
        showToast('Perfil atualizado com sucesso')
      }
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar perfil', 'error')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return showToast('As senhas não coincidem', 'error')
    if (newPassword.length < 8) return showToast('Nova senha deve ter pelo menos 8 caracteres', 'error')
    setPassLoading(true)
    try {
      // verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInErr) throw new Error('Senha atual incorreta')

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('Senha alterada com sucesso')
    } catch (err) {
      showToast(err.message || 'Erro ao alterar senha', 'error')
    } finally {
      setPassLoading(false)
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw new Error(uploadErr.message)

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ photo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (profileErr) throw new Error(profileErr.message)

      updateUser({ photoUrl })
      showToast('Foto atualizada com sucesso')
    } catch (err) {
      showToast(err.message || 'Erro ao enviar foto', 'error')
    } finally {
      setPhotoLoading(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    setPhotoLoading(true)
    try {
      if (user?.photoUrl) {
        // extract storage path from URL
        const url = user.photoUrl.split('?')[0]
        const storagePath = url.split('/avatars/')[1]
        if (storagePath) {
          await supabase.storage.from('avatars').remove([storagePath])
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw new Error(error.message)
      updateUser({ photoUrl: null })
      showToast('Foto removida')
    } catch (err) {
      showToast(err.message || 'Erro ao remover foto', 'error')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: '13px 16px', color: '#eeede9', fontFamily: "'Manrope', sans-serif",
    fontSize: '0.92rem', outline: 'none', transition: 'border-color 0.2s',
  }

  const btnPrimary = {
    padding: '12px 24px', background: '#c8ff00', color: '#08080a', border: 'none',
    borderRadius: 10, fontFamily: "'Manrope', sans-serif", fontSize: '0.88rem',
    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Manrope', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .profile-input:focus { border-color: rgba(200,255,0,0.4) !important; background: rgba(200,255,0,0.02) !important; }
        .profile-input::placeholder { color: rgba(255,255,255,0.2); }
        .btn-primary:hover:not(:disabled) { background: #d4ff33 !important; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .btn-ghost:hover { background: rgba(255,255,255,0.05) !important; }
        .btn-danger:hover { background: rgba(255,80,80,0.15) !important; border-color: rgba(255,80,80,0.3) !important; color: #ff6b6b !important; }
        .photo-overlay { opacity: 0; transition: opacity 0.2s; }
        .photo-wrapper:hover .photo-overlay { opacity: 1; }
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        a { text-decoration: none; color: inherit; }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle, rgba(200,255,0,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      </div>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/area-do-cliente" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem', color: '#c8ff00', letterSpacing: -0.5 }}>
              NORA<span style={{ color: 'rgba(255,255,255,0.3)' }}>TECH</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>/</span>
            <Link to="/area-do-cliente" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', transition: 'color 0.2s' }}>Central</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Perfil</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost"
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontFamily: "'Manrope', sans-serif", fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 6 }}>Editar perfil</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>Atualize suas informações pessoais e senha de acesso.</p>
        </div>

        {/* Photo */}
        <Section title="Foto de perfil">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div
              className="photo-wrapper"
              style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => !photoLoading && photoInputRef.current?.click()}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="Foto de perfil" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(200,255,0,0.2)' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '2px solid rgba(200,255,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#c8ff00' }}>
                  {initials}
                </div>
              )}
              <div className="photo-overlay" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                {photoLoading ? '⏳' : '📷'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 2 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: 4 }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => photoInputRef.current?.click()} disabled={photoLoading} className="btn-primary" style={{ ...btnPrimary, padding: '9px 18px', fontSize: '0.82rem' }}>
                  {photoLoading ? 'Enviando...' : 'Trocar foto'}
                </button>
                {user?.photoUrl && (
                  <button onClick={handleRemovePhoto} disabled={photoLoading} className="btn-danger" style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'Manrope', sans-serif", fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                    Remover
                  </button>
                )}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.74rem' }}>JPG, PNG ou WebP · Máx. 5MB</p>
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </Section>

        {/* Info */}
        <Section title="Informações pessoais">
          <form onSubmit={handleUpdateInfo}>
            <Field label="Nome completo">
              <input className="profile-input" style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
            </Field>
            <Field label="E-mail">
              <input className="profile-input" style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              {email !== user?.email && (
                <p style={{ marginTop: 6, fontSize: '0.78rem', color: '#ffb347' }}>Um link de confirmação será enviado para o novo e-mail.</p>
              )}
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={infoLoading} className="btn-primary" style={btnPrimary}>
                {infoLoading ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </Section>

        {/* Password */}
        <Section title="Alterar senha">
          <form onSubmit={handleChangePassword}>
            <Field label="Senha atual">
              <div style={{ position: 'relative' }}>
                <input className="profile-input" style={{ ...inputStyle, paddingRight: 44 }} type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '0.95rem', padding: 2 }}>
                  {showCurrent ? '🙈' : '👁'}
                </button>
              </div>
            </Field>
            <Field label="Nova senha">
              <div style={{ position: 'relative' }}>
                <input className="profile-input" style={{ ...inputStyle, paddingRight: 44 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} />
                <button type="button" onClick={() => setShowNew((v) => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '0.95rem', padding: 2 }}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: newPassword.length >= i * 3 ? (newPassword.length >= 12 ? '#c8ff00' : newPassword.length >= 8 ? '#ff8a3d' : '#ff5f57') : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                  ))}
                </div>
              )}
            </Field>
            <Field label="Confirmar nova senha">
              <input className="profile-input" style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== newPassword ? 'rgba(255,80,80,0.4)' : undefined }} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              {confirmPassword && confirmPassword !== newPassword && (
                <p style={{ marginTop: 6, fontSize: '0.78rem', color: '#ff6b6b' }}>As senhas não coincidem</p>
              )}
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={passLoading} className="btn-primary" style={btnPrimary}>
                {passLoading ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </Section>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
