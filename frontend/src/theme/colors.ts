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

  accentDark: '#D4A017',
  accentMuted: '#394856',
};

export const darkColors: ColorScheme = {
  bg: '#0f172a',
  surface: '#1e293b',
  dark: '#f1f5f9',
  muted: '#94a3b8',
  border: '#334155',
  accent: '#C9A84C',
  danger: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',

  slate300: '#475569',
  slate400: '#64748b',
  slate500: '#94a3b8',
  slate700: '#e2e8f0',
  slate800: '#f1f5f9',

  statusBlue: '#60a5fa',
  statusPurple: '#c084fc',
  statusOrange: '#fb923c',

  successGreen: '#4ade80',
  errorRed: '#f87171',
  alertMessageText: '#cbd5e1',

  successBgTint: '#052e16',
  dangerBgTint: '#450a0a',
  warningBgTint: '#1c1508',
  warningBorderTint: '#3d3212',
  goldBgTint: '#1a1806',

  chartGreen: '#4ade80',
  chartRed: '#f87171',

  accentDark: '#e0b83a',
  accentMuted: '#94a3b8',
};
