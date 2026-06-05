import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { loadToken, saveToken, clearToken } from '../services/api';

interface User {
  token: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (userData: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<void> => {
    const token = await loadToken();
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  };

  const signIn = async (userData: User): Promise<void> => {
    await saveToken(userData.token);
    setUser(userData);
  };

  const signOut = async (): Promise<void> => {
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};