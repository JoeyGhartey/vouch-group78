import React, { createContext, useState, useContext, useEffect } from 'react';
import { loadToken, saveToken, clearToken } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await loadToken();
    if (token) {
      // Token exists but we don't have user data
      // The app will fetch profile on home screen
      setUser({ token });
    }
    setLoading(false);
  };

  const signIn = async (userData) => {
    await saveToken(userData.token);
    setUser(userData);
  };

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
