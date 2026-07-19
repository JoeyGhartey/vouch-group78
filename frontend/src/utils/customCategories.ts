import * as SecureStore from 'expo-secure-store';

const CUSTOM_CATEGORIES_KEY = 'vouch_custom_categories';

const readRaw = async (): Promise<string> => {
  try {
    return (await SecureStore.getItemAsync(CUSTOM_CATEGORIES_KEY)) || '';
  } catch (e) {
    return localStorage.getItem(CUSTOM_CATEGORIES_KEY) || '';
  }
};

const writeRaw = async (value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(CUSTOM_CATEGORIES_KEY, value);
  } catch (e) {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, value);
  }
};

// Title-cases a free-typed category name, e.g. "sports shoes" -> "Sports Shoes"
export const formatCategoryName = (raw: string): string =>
  raw.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

export const getCustomCategories = async (): Promise<string[]> => {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Adds a new permanent category on this device, deduped case-insensitively.
// Returns the full updated list.
export const addCustomCategory = async (name: string): Promise<string[]> => {
  const formatted = formatCategoryName(name);
  if (!formatted) return getCustomCategories();

  const existing = await getCustomCategories();
  const alreadyExists = existing.some((c) => c.toLowerCase() === formatted.toLowerCase());
  const updated = alreadyExists ? existing : [...existing, formatted];

  if (!alreadyExists) {
    await writeRaw(JSON.stringify(updated));
  }
  return updated;
};
