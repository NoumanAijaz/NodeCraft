import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, type User } from '../utils/api';
import { useDiagramStore } from '../store/useDiagramStore';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('nodecraft_user');
      if (saved) JSON.parse(saved);
    } catch {
      // Defer clearing to effect to avoid side-effects in render (StrictMode)
      return localStorage.getItem('nodecraft_token');
    }
    return localStorage.getItem('nodecraft_token');
  });
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nodecraft_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved) as User;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Handle corrupted storage that was deferred from initializer
    const saved = localStorage.getItem('nodecraft_user');
    if (saved) {
      try {
        JSON.parse(saved);
      } catch {
        console.warn('Corrupted nodecraft_user in localStorage — clearing');
        localStorage.removeItem('nodecraft_user');
        localStorage.removeItem('nodecraft_token');
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;

    const checkAuth = async () => {
      const storedToken = localStorage.getItem('nodecraft_token');
      if (!storedToken) {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await api.get('/auth/me');
        if (cancelled) return;
        setUser(data.user);
        setToken(storedToken);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to restore session:', err);
        localStorage.removeItem('nodecraft_token');
        localStorage.removeItem('nodecraft_user');
        try {
          useDiagramStore.getState().clearCanvas();
          localStorage.removeItem('nodecraft-storage');
          useDiagramStore.temporal.getState().clear();
        } catch {}
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAuth();

    const handleUnauthorized = () => {
      if (cancelled) return;
      setToken(null);
      setUser(null);
      // Prevent cross-user diagram leak
      try {
        useDiagramStore.getState().clearCanvas();
        localStorage.removeItem('nodecraft-storage');
        useDiagramStore.temporal.getState().clear();
      } catch {}
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('nodecraft_token', newToken);
    localStorage.setItem('nodecraft_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('nodecraft_token');
    localStorage.removeItem('nodecraft_user');
    try {
      useDiagramStore.getState().clearCanvas();
      localStorage.removeItem('nodecraft-storage');
      useDiagramStore.temporal.getState().clear();
    } catch {}
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
