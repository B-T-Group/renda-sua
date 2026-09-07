/** Unique cart line: same inventory listing + optional catalog variant (aligned with web). */
export function cartLineKey(inventoryItemId: string, variantId?: string | null): string {
  return `${inventoryItemId}::${variantId ?? ''}`;
}
