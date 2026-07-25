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

// Dev/QA helper only -- lets you re-trigger the onboarding flow without a
// full uninstall, which is unreliable on iOS since Keychain-backed storage
// (what SecureStore uses under the hood) can survive app deletion. Not
// called anywhere in production code paths.
export const resetOnboarding = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  } catch (e) {
    localStorage.removeItem(ONBOARDING_KEY);
  }
};
