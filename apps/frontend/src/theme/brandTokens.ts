/**
 * Trust Coast Blue — the single source of truth for Rendasua brand colours.
 *
 * Chrome stays blue (trust), delivery/agent surfaces read teal, and the orange
 * accent is reserved for purchase intent only: Buy / Pay / Checkout. Anything
 * that needs a brand colour should read it from here (or, preferably, from the
 * MUI palette that is built from these tokens) rather than inlining a hex.
 */
export const brandTokens = {
  /** Client persona, app chrome, links and secondary actions. */
  primary: {
    main: '#1E3A8A',
    light: '#1D4ED8',
    dark: '#172554',
    contrastText: '#FFFFFF',
  },
  /** Agent persona, delivery and logistics chrome. */
  secondary: {
    main: '#0F766E',
    light: '#14B8A6',
    dark: '#115E59',
    contrastText: '#FFFFFF',
  },
  /**
   * Purchase accent. Only for Buy / Pay / Checkout intent and the business
   * persona accent family — never for general brand chrome.
   */
  cta: {
    main: '#C2410C',
    light: '#EA580C',
    dark: '#9A3412',
    soft: '#FFEDD5',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#15803D',
    light: '#22C55E',
    dark: '#166534',
    soft: '#DCFCE7',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#B91C1C',
    light: '#DC2626',
    dark: '#991B1B',
    soft: '#FEE2E2',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#B45309',
    light: '#D97706',
    dark: '#92400E',
    soft: '#FEF3C7',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#0E7490',
    light: '#06B6D4',
    dark: '#155E75',
    soft: '#CFFAFE',
    contrastText: '#FFFFFF',
  },
  surface: {
    background: '#F8FAFC',
    paper: '#FFFFFF',
    /** Neutral tint for muted rows, placeholders and empty states. */
    subtle: '#F1F5F9',
    divider: '#E2E8F0',
  },
  text: {
    primary: '#0F172A',
    /** Meets AA (4.58:1) against the app background. */
    muted: '#64748B',
  },
  /** Soft tints used for persona underlines and low-emphasis brand surfaces. */
  tint: {
    primary: '#DBEAFE',
    primaryStrong: '#93C5FD',
    secondary: '#CCFBF1',
    secondaryStrong: '#5EEAD4',
  },
} as const;

export type BrandTokens = typeof brandTokens;
