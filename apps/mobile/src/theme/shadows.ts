import type { ViewStyle } from 'react-native';

/**
 * Cross-platform elevation tokens.
 *
 * Three semantic levels:
 *   small  – subtle card lift (list rows, chips)
 *   medium – elevated panels (modals, bottom sheets)
 *   large  – prominent surfaces (FABs, sticky CTAs)
 *
 * Use these on a plain `View` (shadow* for iOS, elevation for Android)
 * instead of Paper `Surface` when the card also has a visible border,
 * which causes a doubled edge on iOS.
 *
 * See: .cursor/rules/no-surface-bordered-cards.mdc
 */
export const shadows = {
  none: {} as ViewStyle,

  /** Small – cards, list rows, subtle surfaces */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,

  /** Medium – bottom sheets, filter panels, popovers */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  } as ViewStyle,

  /** Large – FABs, sticky action bars, prominent overlays */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  } as ViewStyle,

  // ── Semantic aliases (match the three levels above) ─────────────────────
  /** Alias for sm – use on cards and row items */
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,
  /** Alias for md – use on elevated panels */
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  } as ViewStyle,
  /** Alias for lg – use on FABs and sticky action bars */
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  } as ViewStyle,
} as const;
