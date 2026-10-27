import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/auth/me')
      .then((result) => { if (active) setUser(result.user); })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        if (error.status !== 401) setConnectionError('LabTrack API is currently unavailable. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setConnectionError('');
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload) => {
    return api('/api/auth/register', { method: 'POST', body: payload });
  }, []);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); }
    finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, connectionError, login, register, logout }), [
    user, loading, connectionError, login, register, logout,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
