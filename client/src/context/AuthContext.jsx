import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => { const d = await api.get('/auth/me'); setUser(d.user); return d.user; }, []);

  const hasRole = useCallback((...roles) => !!user && (user.role === 'admin' || roles.includes(user.role)), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
