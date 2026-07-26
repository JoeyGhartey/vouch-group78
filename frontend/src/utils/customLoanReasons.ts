import * as SecureStore from 'expo-secure-store';
import { formatCategoryName } from './customCategories';

// Mirrors customCategories.ts exactly, but kept as a separate storage key --
// loan reasons and expense categories are conceptually different lists and
// shouldn't get mixed together under one key.
const CUSTOM_LOAN_REASONS_KEY = 'vouch_custom_loan_reasons';

// Shared preset list -- used by both RequestLoanScreen.tsx and the Request
// Loan modal in LoansScreen.tsx, so they stay in sync.
export const LOAN_REASONS = [
  'Business', 'Education', 'Medical', 'Rent',
  'Emergency', 'Debt Repayment', 'Personal', 'Other',
];

const readRaw = async (): Promise<string> => {
  try {
    return (await SecureStore.getItemAsync(CUSTOM_LOAN_REASONS_KEY)) || '';
  } catch (e) {
    return localStorage.getItem(CUSTOM_LOAN_REASONS_KEY) || '';
  }
};

const writeRaw = async (value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(CUSTOM_LOAN_REASONS_KEY, value);
  } catch (e) {
    localStorage.setItem(CUSTOM_LOAN_REASONS_KEY, value);
  }
};

export const getCustomLoanReasons = async (): Promise<string[]> => {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Adds a new permanent loan-reason preset on this device, deduped
// case-insensitively. Returns the full updated list.
export const addCustomLoanReason = async (name: string): Promise<string[]> => {
  const formatted = formatCategoryName(name);
  if (!formatted) return getCustomLoanReasons();

  const existing = await getCustomLoanReasons();
  const alreadyExists = existing.some((r) => r.toLowerCase() === formatted.toLowerCase());
  const updated = alreadyExists ? existing : [...existing, formatted];

  if (!alreadyExists) {
    await writeRaw(JSON.stringify(updated));
  }
  return updated;
};
