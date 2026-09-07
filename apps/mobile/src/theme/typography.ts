import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

/**
 * Typography scale for Rendasua.
 *
 * Canonical six-style system (use these for all new code):
 *   display   – hero numbers, large price, 28/34 Bold
 *   title     – screen/section titles, 24/30 SemiBold
 *   heading   – card headings, 20/26 SemiBold
 *   subheading – list item titles, 16/22 SemiBold
 *   body      – default prose, 16/24 Regular
 *   caption   – meta text, labels, 12/16 Medium
 *
 * Legacy variants (h1–h6, body1/2, subtitle1/2, overline, button) are kept
 * as aliases so existing code does not break.
 */
export const typography = {
  fontFamily,

  // ── Canonical scale ──────────────────────────────────────────────────────
  display: {
    fontFamily,
    fontWeight: '700' as const,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily,
    fontWeight: '600' as const,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily,
    fontWeight: '600' as const,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  subheading: {
    fontFamily,
    fontWeight: '600' as const,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },
  body: {
    fontFamily,
    fontWeight: '400' as const,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily,
    fontWeight: '500' as const,
    fontSize: 12,
    lineHeight: 16,
  },

  // ── Legacy aliases (do not use in new code) ───────────────────────────────
  h1: { fontFamily, fontWeight: '700' as const, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily, fontWeight: '600' as const, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontFamily, fontWeight: '600' as const, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h4: { fontFamily, fontWeight: '600' as const, fontSize: 18, lineHeight: 24 },
  h5: { fontFamily, fontWeight: '600' as const, fontSize: 16, lineHeight: 22 },
  h6: { fontFamily, fontWeight: '600' as const, fontSize: 15, lineHeight: 20 },
  body1: { fontFamily, fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2: { fontFamily, fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  subtitle1: { fontFamily, fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  subtitle2: { fontFamily, fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  button: { fontFamily, fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.2 },
  overline: { fontFamily, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
};
