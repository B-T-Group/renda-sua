/** Unique cart line: same inventory listing + optional catalog variant. */
export function cartLineKey(
  inventoryItemId: string,
  variantId?: string | null
): string {
  return `${inventoryItemId}::${variantId ?? ''}`;
}

export function variantIdFromKey(
  inventoryItemId: string,
  key: string
): string | undefined {
  const prefix = `${inventoryItemId}::`;
  if (!key.startsWith(prefix)) return undefined;
  const rest = key.slice(prefix.length);
  return rest.length > 0 ? rest : undefined;
}
