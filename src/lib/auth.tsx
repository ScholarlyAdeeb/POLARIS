import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (b: { name: string; email: string; password: string; institution?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.auth.me());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value: AuthState = {
    user,
    loading,
    refresh,
    login: async (email, password) => {
      const u = await api.auth.login(email, password);
      setUser(u);
      return u;
    },
    register: async (b) => {
      const u = await api.auth.register(b);
      setUser(u);
      return u;
    },
    logout: async () => {
      await api.auth.logout().catch(() => undefined);
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const isReviewerRole = (u: User | null) => u?.role === 'reviewer' || u?.role === 'admin';
