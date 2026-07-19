import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { loadToken, saveToken, clearToken, getProfile, registerPushToken } from '../services/api';
import { registerForPushNotifications } from '../utils/pushNotifications';

interface UserProfile {
  id: number;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  trustScore: number;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  justRegistered: boolean;
  setJustRegistered: (value: boolean) => void;
  signIn: (loginResponse: { token: string; [key: string]: unknown }, isNewRegistration?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [justRegistered, setJustRegistered] = useState<boolean>(false);

  const syncPushToken = async (): Promise<void> => {
    try {
      const pushToken = await registerForPushNotifications();
      if (pushToken) await registerPushToken(pushToken);
    } catch (e) {
      console.warn('Push token sync failed:', e);
    }
  };

  const fetchProfile = async (): Promise<void> => {
    try {
      const profile = await getProfile() as UserProfile;
      setUser(profile);
    } catch {
      await clearToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const token = await loadToken();
      if (token) {
        await fetchProfile();
        syncPushToken();
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // isNewRegistration is set explicitly by the caller on every sign-in —
  // never inferred or left over from a previous call — so a plain login can
  // never accidentally inherit a stale "just registered" flag from earlier
  // in the same app session (e.g. register -> onboarding -> log out -> log
  // back in without restarting the app).
  const signIn = async (loginResponse: { token: string; [key: string]: unknown }, isNewRegistration: boolean = false): Promise<void> => {
    setJustRegistered(isNewRegistration);
    await saveToken(loginResponse.token);
    await fetchProfile();
    syncPushToken();
  };

  const signOut = async (): Promise<void> => {
    await clearToken();
    setUser(null);
    setJustRegistered(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, justRegistered, setJustRegistered, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
