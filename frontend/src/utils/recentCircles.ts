import * as SecureStore from 'expo-secure-store';

// Tracks which circle the user last opened, so the Home screen can show
// that one instead of an arbitrary/oldest-first slice of their circle list.
// Device-local only (mirrors onboardingStorage.ts's pattern) -- this is a
// UI convenience, not something that needs to sync across devices.
const LAST_CIRCLE_KEY = 'vouch_last_accessed_circle_id';

export const recordCircleAccess = async (circleId: number): Promise<void> => {
  try {
    await SecureStore.setItemAsync(LAST_CIRCLE_KEY, String(circleId));
  } catch (e) {
    localStorage.setItem(LAST_CIRCLE_KEY, String(circleId));
  }
};

export const getLastAccessedCircleId = async (): Promise<number | null> => {
  try {
    const value = await SecureStore.getItemAsync(LAST_CIRCLE_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (e) {
    const value = localStorage.getItem(LAST_CIRCLE_KEY);
    return value ? parseInt(value, 10) : null;
  }
};
