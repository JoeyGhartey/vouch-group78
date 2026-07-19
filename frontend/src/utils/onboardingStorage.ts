import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'vouch_onboarding_seen';

export const hasSeenOnboarding = async (): Promise<boolean> => {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  }
};

export const markOnboardingSeen = async (): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch (e) {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }
};
