/**
 * Renda character geometry and colours (spec #451 §1, viewBox 0 0 82 100), shared by
 * the animated engine and the static avatar. Kept free of the engine so the header
 * (main bundle) and message avatars never pull in the wedge geometry or the rAF engine.
 */
import { brandTokens } from '../../theme/brandTokens';

export type RendaEyes = 'expressive' | 'dot' | 'none';

/** Expressive eyes need >= 36 px of character height, dots 20-35 px, none below 20. */
export function eyesForSize(size: number): RendaEyes {
  if (size >= 36) return 'expressive';
  if (size >= 20) return 'dot';
  return 'none';
}

export const RENDA_WIDTH_RATIO = 0.82;
export const CX = 41;
export const CY = 50;
export const EYE_X = [28, 54] as const;
export const EYE_Y = 46;

const hex = (h: string) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mixHex(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, '0')
    ).join('')
  );
}

/** Colours come from the brand tokens only (no gold, no orange; green only in the Success sparkle). */
export const RENDA_COLORS = {
  main: brandTokens.primary.main,
  light: brandTokens.primary.light,
  tint: brandTokens.tint.primaryStrong,
  navy: brandTokens.secondary.main,
  /** secondary.main with a 12% black inner shade at the face edge. */
  navyEdge: mixHex(brandTokens.secondary.main, '#000000', 0.12),
  white: brandTokens.primary.contrastText,
  sparkCore: brandTokens.cta.main,
  sparkLight: brandTokens.cta.light,
} as const;
