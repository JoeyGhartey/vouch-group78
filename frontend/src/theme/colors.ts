export interface ColorScheme {
  // Core palette
  bg: string;
  surface: string;
  dark: string;
  muted: string;
  border: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;

  // Slate variants
  slate300: string;
  slate400: string;
  slate500: string;
  slate700: string;
  slate800: string;

  // Status colors (loan/dispute states)
  statusBlue: string;
  statusPurple: string;
  statusOrange: string;

  // Alert/feedback
  successGreen: string;
  errorRed: string;
  alertMessageText: string;

  // Tinted backgrounds
  successBgTint: string;
  dangerBgTint: string;
  warningBgTint: string;
  warningBorderTint: string;
  goldBgTint: string;

  // Chart/data viz
  chartGreen: string;
  chartRed: string;

  // Button fills
  buttonDark: string;
  buttonDarkText: string;

  // Accent variants
  accentDark: string;
  accentMuted: string;
}

export const lightColors: ColorScheme = {
  bg: '#EDEEF2',
  surface: '#FFFFFF',
  dark: '#0f172a',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#C9A84C',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',

  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1e293b',

  statusBlue: '#2196F3',
  statusPurple: '#9C27B0',
  statusOrange: '#FF9800',

  successGreen: '#22c55e',
  errorRed: '#ef4444',
  alertMessageText: '#475569',

  successBgTint: '#f0fdf4',
  dangerBgTint: '#fef2f2',
  warningBgTint: '#FDF6E3',
  warningBorderTint: '#F0E6C0',
  goldBgTint: '#FFFDF5',

  chartGreen: '#4ade80',
  chartRed: '#f87171',

  buttonDark: '#0f172a',
  buttonDarkText: '#FFFFFF',

  accentDark: '#D4A017',
  accentMuted: '#394856',
};

export const darkColors: ColorScheme = {
  bg: '#121212',
  surface: '#1E1E1E',
  dark: '#E8E8E8',
  muted: '#9E9E9E',
  border: '#2C2C2C',
  accent: '#C9A84C',
  danger: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',

  slate300: '#424242',
  slate400: '#757575',
  slate500: '#9E9E9E',
  slate700: '#E0E0E0',
  slate800: '#EEEEEE',

  statusBlue: '#60a5fa',
  statusPurple: '#c084fc',
  statusOrange: '#fb923c',

  successGreen: '#4ade80',
  errorRed: '#f87171',
  alertMessageText: '#BDBDBD',

  successBgTint: '#1B3726',
  dangerBgTint: '#3B1515',
  warningBgTint: '#2C2510',
  warningBorderTint: '#3D3418',
  goldBgTint: '#272310',

  chartGreen: '#4ade80',
  chartRed: '#f87171',

  buttonDark: '#e0b83a',
  buttonDarkText: '#121212',

  accentDark: '#e0b83a',
  accentMuted: '#9E9E9E',
};
