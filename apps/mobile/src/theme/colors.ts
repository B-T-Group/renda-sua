/**
 * Rendasua palette — light + dark.
 * Aligned with the web renda-sua frontend (light); dark is a cool navy surface scale.
 *
 * Prefer semantic aliases (`pageBackground`, `surface`, `*Tint`) in new code.
 * `background.default` / `background.paper` remain as aliases during migration.
 */

export type ThemeColors = {
  primary: {
    main: string;
    light: string;
    dark: string;
    contrast: string;
    hover: string;
  };
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrast: string;
  };
  success: { main: string; light: string; dark: string };
  warning: { main: string; light: string; dark: string };
  error: { main: string; light: string; dark: string };
  info: { main: string; light: string; dark: string };
  /** @deprecated Prefer `pageBackground` / `surface` */
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  border: string;
  surface: string;
  pageBackground: string;
  /** Slightly elevated card on dark (same as surface in light) */
  surfaceElevated: string;
  disabled: string;
  disabledText: string;
  overlay: string;
  overlayDark: string;
  onDark: string;
  primaryTint: string;
  successTint: string;
  warningTint: string;
  errorTint: string;
  infoTint: string;
};

export const lightColors: ThemeColors = {
  primary: {
    main: '#1E3A8A',
    light: '#3b82f6',
    dark: '#1e3a8a',
    contrast: '#ffffff',
    hover: '#1E3A8A14',
  },
  secondary: {
    main: '#0F766E',
    light: '#14b8a6',
    dark: '#0f766e',
    contrast: '#ffffff',
  },
  success: {
    main: '#15803D',
    light: '#22c55e',
    dark: '#15803d',
  },
  warning: {
    main: '#B45309',
    light: '#f59e0b',
    dark: '#b45309',
  },
  error: {
    main: '#B91C1C',
    light: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    main: '#0891b2',
    light: '#06b6d4',
    dark: '#0e7490',
  },
  background: {
    default: '#F8FAFC',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    disabled: '#94a3b8',
  },
  divider: '#e2e8f0',
  border: '#e2e8f0',
  surface: '#FFFFFF',
  pageBackground: '#F8FAFC',
  surfaceElevated: '#ffffff',
  disabled: '#e5e5ea',
  disabledText: '#94a3b8',
  overlay: 'rgba(0,0,0,0.45)',
  overlayDark: 'rgba(0,0,0,0.72)',
  onDark: '#ffffff',
  primaryTint: '#dbeafe',
  successTint: '#dcfce7',
  warningTint: '#FFEDD5',
  errorTint: '#fee2e2',
  infoTint: '#e6f7fb',
};

export const darkColors: ThemeColors = {
  primary: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    contrast: '#ffffff',
    hover: '#3b82f628',
  },
  secondary: {
    main: '#22c55e',
    light: '#4ade80',
    dark: '#16a34a',
    contrast: '#0f1115',
  },
  success: {
    main: '#22c55e',
    light: '#4ade80',
    dark: '#16a34a',
  },
  warning: {
    main: '#fbbf24',
    light: '#fcd34d',
    dark: '#f59e0b',
  },
  error: {
    main: '#f87171',
    light: '#fca5a5',
    dark: '#ef4444',
  },
  info: {
    main: '#22d3ee',
    light: '#67e8f9',
    dark: '#06b6d4',
  },
  background: {
    default: '#0f1115',
    paper: '#1a1d23',
  },
  text: {
    primary: '#f3f4f6',
    secondary: '#9ca3af',
    disabled: '#6b7280',
  },
  divider: '#2d3340',
  border: '#2d3340',
  surface: '#1a1d23',
  pageBackground: '#0f1115',
  surfaceElevated: '#232730',
  disabled: '#2d3340',
  disabledText: '#6b7280',
  overlay: 'rgba(0,0,0,0.6)',
  overlayDark: 'rgba(0,0,0,0.8)',
  onDark: '#ffffff',
  primaryTint: '#1a2744',
  successTint: '#15291e',
  warningTint: '#2a2414',
  errorTint: '#2a1818',
  infoTint: '#14262c',
};

/** Static light palette for rare non-React call sites. Prefer `useTheme().colors`. */
export const colors = lightColors;

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = '@RendasuaAgent:themeMode';
