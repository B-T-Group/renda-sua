import { fontFamily } from './fonts';

/**
 * Typography scale for Rendasua.
 *
 * Roles (use these for new UI):
 *   display, h1, h2, h3, bodyLarge, body, bodySmall, caption, label,
 *   price, priceLarge, nav
 *
 * Prices use the bold face and tabular figures so amounts align.
 * Legacy aliases (title, heading, h4–h6, body1/2, subtitle*, button, overline)
 * stay so existing screens keep compiling.
 */
const regular = fontFamily.regular;
const medium = fontFamily.medium;
const semibold = fontFamily.semibold;
const bold = fontFamily.bold;

export const typography = {
  fontFamily: regular,

  display: {
    fontFamily: bold,
    fontWeight: '700' as const,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: bold,
    fontWeight: '700' as const,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: semibold,
    fontWeight: '600' as const,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: semibold,
    fontWeight: '600' as const,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: regular,
    fontWeight: '400' as const,
    fontSize: 17,
    lineHeight: 24,
  },
  body: {
    fontFamily: regular,
    fontWeight: '400' as const,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: regular,
    fontWeight: '400' as const,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: medium,
    fontWeight: '500' as const,
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontFamily: medium,
    fontWeight: '500' as const,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  price: {
    fontFamily: bold,
    fontWeight: '700' as const,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'] as const,
  },
  priceLarge: {
    fontFamily: bold,
    fontWeight: '700' as const,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as const,
  },
  nav: {
    fontFamily: medium,
    fontWeight: '500' as const,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },

  /** @deprecated Use `h1`. */
  title: {
    fontFamily: semibold,
    fontWeight: '600' as const,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  /** @deprecated Use `h3`. */
  heading: {
    fontFamily: semibold,
    fontWeight: '600' as const,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  /** @deprecated Use `body` with weight 600. */
  subheading: {
    fontFamily: semibold,
    fontWeight: '600' as const,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },
  h4: { fontFamily: semibold, fontWeight: '600' as const, fontSize: 18, lineHeight: 24 },
  h5: { fontFamily: semibold, fontWeight: '600' as const, fontSize: 16, lineHeight: 22 },
  h6: { fontFamily: semibold, fontWeight: '600' as const, fontSize: 15, lineHeight: 20 },
  body1: { fontFamily: regular, fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2: { fontFamily: regular, fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  subtitle1: { fontFamily: medium, fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  subtitle2: { fontFamily: medium, fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  button: { fontFamily: semibold, fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.1 },
  overline: { fontFamily: semibold, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
};
