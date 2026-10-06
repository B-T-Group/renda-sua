import { lightColors } from './colors';

/**
 * Renda character palette (#451 spec §1). Brand-fixed: the same hexes in light
 * and dark mode, so it reads from the light palette on purpose. Green appears
 * only in the one-shot Success sparkle (cta tokens), never gold or orange.
 */
export const rendaCharacterTokens = {
  /** Ring sweep gradient: primary.main → primary.light → tint.primaryStrong highlight. */
  ringMain: lightColors.primary.main,
  ringLight: lightColors.primary.light,
  /** `tint.primaryStrong` (web brandTokens); the highlight arc of the ring. */
  ringHighlight: '#8FB6F0',
  /** Face: secondary.main with a radial inner shade to 12% black at the edge. */
  face: lightColors.secondary.main,
  eye: '#FFFFFF',
  /** Halo: primary.main on light surfaces, primary.light in dark mode. */
  haloLight: lightColors.primary.main,
  haloDark: lightColors.primary.light,
  /** Success sparkle: success.main / light on web = mobile cta tokens. */
  sparkleCore: lightColors.cta.main,
  sparkleLight: lightColors.cta.light,
} as const;

export type RendaCharacterTokens = typeof rendaCharacterTokens;
