import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, setTokens, getAccessToken } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Remplace l'utilisateur en memoire (apres edition de profil). */
  patchUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data);
        connectSocket();
      })
      .catch(() => setTokens(null, null))
      .finally(() => setLoading(false));
  }, []);

  async function handleAuth(payload: { user: User; accessToken: string; refreshToken: string }) {
    setTokens(payload.accessToken, payload.refreshToken);
    setUser(payload.user);
    connectSocket();
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const r = await api.post('/auth/login', { email, password });
        await handleAuth(r.data);
      },
      register: async (fullName, email, password) => {
        const r = await api.post('/auth/register', { fullName, email, password });
        await handleAuth(r.data);
      },
      logout: () => {
        setTokens(null, null);
        setUser(null);
        disconnectSocket();
      },
      patchUser: (u) => setUser(u),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans AuthProvider');
  return ctx;
}
