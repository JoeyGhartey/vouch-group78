import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightColors, darkColors, ColorScheme } from '../theme/colors';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

interface ThemeContextType {
  theme: ResolvedTheme;
  preference: ThemePreference;
  colors: ColorScheme;
  setThemeOverride: (theme: 'light' | 'dark') => void;
  resetToSystem: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setPreference(stored);
        }
      } catch {
        // SecureStore unavailable (web fallback)
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored === 'light' || stored === 'dark') {
            setPreference(stored);
          }
        } catch {}
      }
      setLoaded(true);
    };
    load();
  }, []);

  const persist = useCallback(async (value: ThemePreference) => {
    try {
      if (value === 'system') {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, value);
      }
    } catch {
      try {
        if (value === 'system') {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, value);
        }
      } catch {}
    }
  }, []);

  const setThemeOverride = useCallback((theme: 'light' | 'dark') => {
    setPreference(theme);
    persist(theme);
  }, [persist]);

  const resetToSystem = useCallback(() => {
    setPreference('system');
    persist('system');
  }, [persist]);

  const theme: ResolvedTheme = preference === 'system'
    ? (systemScheme ?? 'light')
    : preference;

  const colors = theme === 'dark' ? darkColors : lightColors;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, preference, colors, setThemeOverride, resetToSystem }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
