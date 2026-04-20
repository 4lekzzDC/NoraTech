import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('nt_token');

  const parseJsonResponse = async (res, fallbackMessage) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (res.ok) throw new Error('Resposta inválida do servidor');
      throw new Error(
        res.status === 404
          ? 'Serviço indisponível. Tente novamente em instantes.'
          : `${fallbackMessage} (erro ${res.status})`
      );
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Resposta inválida do servidor');
    }
    if (!res.ok) throw new Error(data?.error || fallbackMessage);
    return data;
  };

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { localStorage.removeItem('nt_token'); setLoading(false); return; }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        localStorage.removeItem('nt_token');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data);
    } catch {
      localStorage.removeItem('nt_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (email, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
    }
    const data = await parseJsonResponse(res, 'Erro ao fazer login');
    localStorage.setItem('nt_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    let res;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
    }
    const data = await parseJsonResponse(res, 'Erro ao criar conta');
    localStorage.setItem('nt_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('nt_token');
    setUser(null);
  };

  const updateUser = (newData) => setUser((prev) => ({ ...prev, ...newData }));

  const authFetch = async (url, options = {}) => {
    const token = getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
