export type CleanupPromptIssue = { code: string };

/**
 * Prompt for OpenAI image edit: background/lighting only; preserve product condition.
 */
export function buildProductImageCleanupPrompt(
  issues?: CleanupPromptIssue[]
): string {
  const base = [
    'Clean up this product photo for e-commerce.',
    'SCOPE: Only clean the background and improve lighting when needed.',
    'Do NOT redesign, retouch, restore, beautify, or reimagine the product itself.',
    'Keep the product pixel-faithful to the original: same shape, color, materials, labels, logos, proportions, and condition.',
    'If the item is used or damaged, preserve that exactly — scratches, scuffs, dents, stains, fading, wear marks, and surface texture must remain visible and unchanged.',
    'Do not invent, remove, fill in, or smooth product imperfections.',
    'Prefer a clean, uncluttered background; you MAY keep a few contextual background elements only when they help the viewer understand the product.',
    'Do not invent unrelated props. Remove trash, clutter, people, unrelated objects, and anything that competes with the product.',
    'Choose a background tone (light, dark, or mid-tone) that contrasts with the product colors.',
    'Improve lighting only when needed for clarity; do not use lighting changes to hide wear or alter product appearance.',
    'Output a square composition with the product centered and filling most of the frame, optimized for a 1:1 product card display.',
  ].join(' ');

  return `${base} ${cleanupPromptHints(issues).join(' ')}`;
}

function cleanupPromptHints(issues?: CleanupPromptIssue[]): string[] {
  const codes = new Set((issues ?? []).map((i) => i.code));
  const hints: string[] = [];
  if (codes.has('IMAGE_BLURRY')) {
    hints.push(
      'Reduce blur only as needed for clarity while keeping the product unchanged, including wear and scratches.'
    );
  }
  if (codes.has('CLUTTERED_BACKGROUND') || codes.has('POOR_LIGHTING')) {
    hints.push(
      'Simplify a cluttered or poorly lit background into a clean, well-lit scene that complements the product. ' +
        'You may retain a small number of contextual background elements if they clarify the product; remove everything else. ' +
        'Do not touch or retouch the product itself.'
    );
  }
  if (codes.has('PRODUCT_TOO_SMALL')) {
    hints.push(
      'Crop tighter so the existing product fills most of the frame — do not change the product itself.'
    );
  }
  if (codes.has('TOO_MUCH_TEXT')) {
    hints.push(
      'Remove promotional text overlays and watermarks from the background only — never from the product.'
    );
  }
  if (!hints.length) {
    hints.push(
      'Clean the background and adjust lighting only if needed. Keep the product completely unchanged, including any used-item wear.'
    );
  }
  return hints;
}
