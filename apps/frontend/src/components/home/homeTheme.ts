import { brandTokens } from '../../theme/brandTokens';

/**
 * Marketing accents for the homepage, resolved from the Trust Coast Blue
 * tokens. Illustrations and section chrome pick from here so the landing page
 * cannot drift from the product palette.
 */
export const HOME_ACCENTS = {
  /** Shopper persona and general brand chrome. */
  primary: brandTokens.primary.main,
  primaryLight: brandTokens.primary.light,
  /** Agent persona, delivery routes and destination markers. */
  delivery: brandTokens.secondary.main,
  deliveryLight: brandTokens.secondary.light,
  /** Business persona accent, and the purchase step of the story. */
  business: brandTokens.cta.main,
  businessDark: brandTokens.cta.dark,
  success: brandTokens.success.main,
  warning: brandTokens.warning.main,
  info: brandTokens.info.main,
  ink: brandTokens.text.primary,
  muted: brandTokens.text.muted,
  /** Readable accent for copy sitting on the dark marketing backgrounds. */
  onDark: brandTokens.tint.primaryStrong,
} as const;
