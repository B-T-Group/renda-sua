/**
 * One-line pay button (P&UX R2-2): Paper buttons ellipsize a long label, so shrink the font a
 * step for long labels instead ("Payer 11 850 FCFA et démarrer" on a 390 pt sheet).
 */
export function payLabelStyle(label: string): { fontSize?: number; letterSpacing?: number } {
  if (label.length > 32) return { fontSize: 13, letterSpacing: 0 };
  if (label.length > 26) return { fontSize: 14, letterSpacing: 0 };
  return {};
}
