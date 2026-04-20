import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function buildUser(authUser) {
  if (!authUser) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, photo_url, company')
    .eq('id', authUser.id)
    .single()
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.user_metadata?.name || '',
    photoUrl: profile?.photo_url || null,
    company: profile?.company || null,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async (authUser) => {
    const u = await buildUser(authUser)
    setUser(u)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await refreshUser(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await refreshUser(session.user)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [refreshUser])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const u = await buildUser(data.user)
    setUser(u)
    return u
  }

  const register = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(error.message)
    // session may be null if email confirmation is required
    if (data.session) {
      const u = await buildUser(data.user)
      setUser(u)
      return u
    }
    // email confirmation pending — return partial info so caller can show message
    return { email, pendingConfirmation: true }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const updateUser = (newData) => setUser((prev) => ({ ...prev, ...newData }))

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
