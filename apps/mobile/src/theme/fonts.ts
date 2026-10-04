/**
 * Inter faces registered by `useBrandFonts`.
 * Each weight is its own family so Android does not synthesize bold.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Geometric face for large headings. Body and prices stay Inter. */
  display: 'Poppins_600SemiBold',
  displayBold: 'Poppins_700Bold',
} as const;
