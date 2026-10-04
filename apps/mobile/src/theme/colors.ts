/**
 * Rendasua palette — light + dark.
 * Light values match the web brand tokens (logo blue, logo green for purchase).
 * Dark uses the same hues at a higher lightness on a warm near-black surface.
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
  text: { primary: string; secondary: string; muted: string; disabled: string };
  divider: string;
  border: string;
  borderStrong: string;
  surface: string;
  pageBackground: string;
  /** Alias of pageBackground. Prefer this name in new layouts. */
  appBackground: string;
  /** Slightly elevated card on dark (same as surface in light) */
  surfaceElevated: string;
  surfaceInput: string;
  surfaceSelected: string;
  surfaceModal: string;
  primarySubtle: string;
  primaryHover: string;
  cta: {
    main: string;
    light: string;
    dark: string;
    contrast: string;
    soft: string;
  };
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
    main: '#0A4FB5',
    light: '#2F6FD6',
    dark: '#083A86',
    contrast: '#ffffff',
    hover: '#0A4FB514',
  },
  cta: {
    main: '#0B7A3B',
    light: '#0F9B48',
    dark: '#085C2C',
    contrast: '#ffffff',
    soft: '#DCF5E5',
  },
  secondary: {
    main: '#0B2E6F',
    light: '#2458B0',
    dark: '#071F4D',
    contrast: '#ffffff',
  },
  success: {
    main: '#0F766E',
    light: '#14B8A6',
    dark: '#115E59',
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
    main: '#0E7490',
    light: '#06B6D4',
    dark: '#155E75',
  },
  background: {
    default: '#FAF9F7',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    muted: '#64748B',
    disabled: '#94a3b8',
  },
  divider: '#E6E1D8',
  border: '#E6E1D8',
  borderStrong: '#D0C9BE',
  surface: '#FFFFFF',
  pageBackground: '#FAF9F7',
  appBackground: '#FAF9F7',
  surfaceElevated: '#ffffff',
  surfaceInput: '#F4F1EC',
  surfaceSelected: '#D6E4F7',
  surfaceModal: '#FFFFFF',
  primarySubtle: '#D6E4F7',
  primaryHover: '#0A4FB514',
  disabled: '#E8E4DE',
  disabledText: '#94a3b8',
  overlay: 'rgba(0,0,0,0.45)',
  overlayDark: 'rgba(0,0,0,0.72)',
  onDark: '#ffffff',
  primaryTint: '#D6E4F7',
  successTint: '#CCFBF1',
  warningTint: '#FEF3C7',
  errorTint: '#fee2e2',
  infoTint: '#e6f7fb',
};

export const darkColors: ThemeColors = {
  primary: {
    main: '#2670D0',
    light: '#5B94E0',
    dark: '#1A4F9C',
    contrast: '#ffffff',
    hover: '#2670D028',
  },
  secondary: {
    main: '#2458B0',
    light: '#5B84D0',
    dark: '#163A78',
    contrast: '#ffffff',
  },
  cta: {
    main: '#10804A',
    light: '#3DAB6A',
    dark: '#0B7A3B',
    contrast: '#ffffff',
    soft: '#1A2A1E',
  },
  success: {
    main: '#128078',
    light: '#2BB5A8',
    dark: '#0F766E',
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
    default: '#12110F',
    paper: '#1C1A17',
  },
  text: {
    primary: '#F6F3EE',
    secondary: '#A8A29E',
    muted: '#A8A29E',
    disabled: '#78716C',
  },
  divider: '#3A352F',
  border: '#3A352F',
  borderStrong: '#4A443C',
  surface: '#1C1A17',
  pageBackground: '#12110F',
  appBackground: '#12110F',
  surfaceElevated: '#26231F',
  surfaceInput: '#26231F',
  surfaceSelected: '#1A2C4A',
  surfaceModal: '#26231F',
  primarySubtle: '#1A2C4A',
  primaryHover: '#2670D028',
  disabled: '#3A352F',
  disabledText: '#78716C',
  overlay: 'rgba(0,0,0,0.6)',
  overlayDark: 'rgba(0,0,0,0.8)',
  onDark: '#ffffff',
  primaryTint: '#1A2C4A',
  successTint: '#132824',
  warningTint: '#2A2414',
  errorTint: '#2a1818',
  infoTint: '#14262c',
};

/** Static light palette for rare non-React call sites. Prefer `useTheme().colors`. */
export const colors = lightColors;

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = '@RendasuaAgent:themeMode';
