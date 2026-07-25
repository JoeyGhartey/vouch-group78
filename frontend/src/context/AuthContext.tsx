import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { loadToken, saveToken, clearToken, getProfile, registerPushToken } from '../services/api';
import { registerForPushNotifications } from '../utils/pushNotifications';
import { hasSeenOnboarding, markOnboardingSeen } from '../utils/onboardingStorage';

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
  // Whether this device has ever completed/skipped onboarding, persisted in
  // SecureStore so it survives app restarts and is independent of login
  // state -- a fresh install with no data shows onboarding exactly once,
  // regardless of whether the person then registers or logs into an
  // existing account. null while still loading from storage.
  onboardingSeen: boolean | null;
  completeOnboarding: () => Promise<void>;
  signIn: (loginResponse: { token: string; [key: string]: unknown }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

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
      const [token, seen] = await Promise.all([loadToken(), hasSeenOnboarding()]);
      setOnboardingSeen(seen);
      if (token) {
        await fetchProfile();
        syncPushToken();
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const completeOnboarding = async (): Promise<void> => {
    await markOnboardingSeen();
    setOnboardingSeen(true);
  };

  const signIn = async (loginResponse: { token: string; [key: string]: unknown }): Promise<void> => {
    await saveToken(loginResponse.token);
    await fetchProfile();
    syncPushToken();
  };

  const signOut = async (): Promise<void> => {
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, onboardingSeen, completeOnboarding, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
