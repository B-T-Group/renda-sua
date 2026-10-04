/**
 * RendaSua brand colours — the single source of truth.
 *
 * Chrome stays logo blue (trust and speed), agent surfaces read navy, and the
 * logo green is reserved for purchase intent only: Buy / Pay / Checkout.
 * Success is a separate teal so a paid state never looks like a Buy button.
 * Anything that needs a brand colour should read it from here (or, preferably,
 * from the MUI palette that is built from these tokens) rather than inlining a hex.
 */
export const brandTokens = {
  /** Client persona, app chrome, links and secondary actions. */
  primary: {
    main: '#0A4FB5',
    light: '#2F6FD6',
    dark: '#083A86',
    contrastText: '#FFFFFF',
  },
  /** Agent persona, delivery and logistics chrome. */
  secondary: {
    main: '#0B2E6F',
    light: '#2458B0',
    dark: '#071F4D',
    contrastText: '#FFFFFF',
  },
  /**
   * Purchase accent. Only for Buy / Pay / Checkout intent and the business
   * persona accent family — never for general brand chrome.
   * Darkened from the logo green so white label text stays above 4.5:1.
   */
  cta: {
    main: '#0B7A3B',
    light: '#0F9B48',
    dark: '#085C2C',
    soft: '#DCF5E5',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#0F766E',
    light: '#14B8A6',
    dark: '#115E59',
    soft: '#CCFBF1',
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
    background: '#FAF9F7',
    paper: '#FFFFFF',
    /** Neutral tint for muted rows, placeholders and empty states. */
    subtle: '#F4F1EC',
    divider: '#E6E1D8',
    elevated: '#FFFFFF',
    input: '#F4F1EC',
    selected: '#D6E4F7',
    modal: '#FFFFFF',
    border: '#E6E1D8',
    borderStrong: '#D0C9BE',
  },
  text: {
    primary: '#0F172A',
    /** Supporting copy. Same contrast floor as muted. */
    secondary: '#475569',
    /** Meets AA (4.5:1) against the app background. */
    muted: '#64748B',
  },
  /** Soft tints used for persona underlines and low-emphasis brand surfaces. */
  tint: {
    primary: '#D6E4F7',
    primaryStrong: '#8FB6F0',
    secondary: '#E4EAF6',
    secondaryStrong: '#9BB0D6',
  },
} as const;

export type BrandTokens = typeof brandTokens;
