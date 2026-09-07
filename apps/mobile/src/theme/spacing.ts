/**
 * Spacing and border-radius tokens — aligned with the 8-point grid.
 * All layout spacing should use one of the allowed values below.
 *
 * Allowed spacing values: 4, 8, 12, 16, 24, 32, 40, 48, 64
 *
 * Semantic radius names were added so call-sites can express intent
 * (`borderRadius.card`, `borderRadius.button`) rather than size.
 * The legacy size-based names are kept as aliases for backwards compatibility.
 */

export const spacing = {
  /** 4dp */
  xxs: 4,
  /** 8dp */
  xs: 8,
  /** 12dp */
  sm: 12,
  /** 16dp */
  md: 16,
  /** 24dp */
  lg: 24,
  /** 32dp */
  xl: 32,
  /** 40dp */
  xl2: 40,
  /** 48dp */
  xxl: 48,
  /** 64dp */
  xl3: 64,
} as const;

export const borderRadius = {
  // ── Size-based aliases (legacy — keep for backwards compat) ──
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,

  // ── Semantic aliases (preferred for new code) ──
  /** Primary action buttons */
  button: 16,
  /** Cards and elevated panels */
  card: 20,
  /** Text inputs and text areas */
  input: 16,
  /** Filter chips and short labels */
  chip: 12,
  /** Icon containers and avatar frames */
  icon: 12,
} as const;

/** react-native-paper `theme.roundness` (MD3 buttons use × 5 for border radius). */
export const paperRoundness = 3;
