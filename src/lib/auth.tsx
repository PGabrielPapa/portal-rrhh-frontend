import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken, getToken, setOnSessionExpired } from './api';
import type { AuthUser, LoginResult } from './types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (dni: string, password: string, token?: string) => Promise<LoginResult>;
  logout: () => void;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try { setUser(await api.get<AuthUser>('/auth/me')); }
    catch { setUser(null); setToken(null); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  // Sesión expirada (401 en un request autenticado): limpiar usuario → redirige al login.
  useEffect(() => { setOnSessionExpired(() => setUser(null)); return () => setOnSessionExpired(null); }, []);

  async function login(dni: string, password: string, token?: string) {
    const r = await api.post<LoginResult>('/auth/login', { dni, password, token });
    setToken(r.token);
    setUser(r.user);
    return r;
  }
  // Cerrar sesión avisa al servidor para que invalide el token en TODOS los
  // dispositivos. Borrarlo solo del navegador dejaba viva cualquier copia robada
  // hasta que venciera por tiempo.
  function logout() {
    api.post('/auth/logout').catch(() => { /* igual se cierra localmente */ });
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
