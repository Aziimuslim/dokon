import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, refreshSession, setAccessToken, setOnAuthLost } from '../lib/api';

const AuthCtx = createContext(null);
const HINT = 'has_session';
const setHint = (on) => { try { if (on) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* */ } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOnAuthLost(() => { setUser(null); setHint(false); });
    // Sahifa yangilanganda httpOnly cookie orqali sessiyani tiklash
    // Sessiya belgisi bo'lmasa (mehmon) refresh so'rovini yubormaymiz
    let hint = null;
    try { hint = localStorage.getItem(HINT); } catch { /* */ }
    if (!hint) { setReady(true); return; }
    refreshSession().then((d) => setUser(d.user)).catch(() => setHint(false)).finally(() => setReady(true));
  }, []);

  const handle = (d) => { setAccessToken(d.accessToken); setUser(d.user); setHint(true); return d.user; };
  const login = useCallback((login, password) => api('/login', { method: 'POST', body: { login, password } }).then(handle), []);
  const register = useCallback((data) => api('/register', { method: 'POST', body: data }).then(handle), []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setHint(false);
  }, []);

  return <AuthCtx.Provider value={{ user, setUser, ready, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
