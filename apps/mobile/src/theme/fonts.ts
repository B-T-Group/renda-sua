import { Platform } from 'react-native';

/**
 * Inter faces registered by `useBrandFonts`.
 * Each weight is its own family so Android does not synthesize bold.
 * On web, a missing face must not fall through to the browser's serif default.
 */
export function brandFace(name: string, os: string = Platform.OS): string {
  return os === 'web' ? `${name}, sans-serif` : name;
}

export const fontFamily = {
  regular: brandFace('Inter_400Regular'),
  medium: brandFace('Inter_500Medium'),
  semibold: brandFace('Inter_600SemiBold'),
  bold: brandFace('Inter_700Bold'),
  /** Geometric face for large headings. Body and prices stay Inter. */
  display: brandFace('Poppins_600SemiBold'),
  displayBold: brandFace('Poppins_700Bold'),
} as const;

/** Inter face for a fontWeight, the way typography.ts pairs them (800/900 use the bold face). */
export function fontFamilyForWeight(weight?: string | number | null): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 700) return fontFamily.bold;
  if (w >= 600) return fontFamily.semibold;
  if (w >= 500) return fontFamily.medium;
  return fontFamily.regular;
}
