// Single source of truth for displaying a GHS amount anywhere in the app.
// Always renders exactly 2 decimal places AND comma thousands-separators
// (e.g. 1234.5 -> "1,234.50", 1000000 -> "1,000,000.00"), unlike bare
// `.toFixed(2)` (no commas) or bare `.toLocaleString()` (inconsistent
// decimal digits), both of which were used inconsistently across screens
// before this existed. Handles null/undefined/NaN defensively so a missing
// field renders "0.00" instead of "NaN" or crashing the screen.
export const formatMoney = (amount: number | null | undefined): string => {
  const value = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
