import * as SecureStore from 'expo-secure-store';

// Tracks the order in which the user has opened circles (most recent first),
// so the Home screen can show the single most recent one, and the full
// Circles list can pin recently-accessed circles to the top without hiding
// anything else. Device-local only (mirrors onboardingStorage.ts's pattern)
// -- this is a UI convenience, not something that needs to sync across
// devices.
const RECENT_CIRCLES_KEY = 'vouch_recent_circle_ids';
const MAX_TRACKED = 20;

const readList = async (): Promise<number[]> => {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_CIRCLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    const raw = localStorage.getItem(RECENT_CIRCLES_KEY);
    return raw ? JSON.parse(raw) : [];
  }
};

const writeList = async (ids: number[]): Promise<void> => {
  const serialized = JSON.stringify(ids.slice(0, MAX_TRACKED));
  try {
    await SecureStore.setItemAsync(RECENT_CIRCLES_KEY, serialized);
  } catch (e) {
    localStorage.setItem(RECENT_CIRCLES_KEY, serialized);
  }
};

export const recordCircleAccess = async (circleId: number): Promise<void> => {
  const current = await readList();
  const withoutThisOne = current.filter((id) => id !== circleId);
  await writeList([circleId, ...withoutThisOne]);
};

// Most-recent-first list of every circle ID the user has opened (capped).
export const getRecentCircleOrder = async (): Promise<number[]> => {
  return readList();
};

export const getLastAccessedCircleId = async (): Promise<number | null> => {
  const list = await readList();
  return list.length > 0 ? list[0] : null;
};
