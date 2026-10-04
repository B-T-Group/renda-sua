import type { ViewStyle } from 'react-native';

/**
 * Cross-platform elevation tokens.
 *
 * Two semantic levels. Prefer whitespace and hairlines over shadow.
 *   small  – resting cards
 *   medium – raised sheets and sticky bars
 *   large  – alias of medium (kept so existing call sites stay flat)
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  /** Raised – sheets, sticky bars */
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,

  /** Alias of md. Heavy drop shadows are not part of the system. */
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,

  small: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,
  large: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,
} as const;
