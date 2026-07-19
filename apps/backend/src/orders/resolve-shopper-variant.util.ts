/**
 * Resolves the shopper's catalog choice for an order line.
 *
 * Product rule (shared inventory rows):
 * - 0 variants → base item (null)
 * - 1+ variants + no requested id → base item (null)
 * - 1+ variants + requested id → that variant (or invalid)
 *
 * Per-variant inventory rows (item_variant_id set on stock) still bind to that row.
 */

export type ShopperVariantResolveError =
  | 'ITEM_VARIANT_INVALID'
  | 'ITEM_VARIANT_MISMATCH';

export class ShopperVariantResolveException extends Error {
  constructor(
    public readonly code: ShopperVariantResolveError,
    message: string
  ) {
    super(message);
    this.name = 'ShopperVariantResolveException';
  }
}

export function resolveShopperVariant(params: {
  requestedVariantId?: string | null;
  inventoryRow: {
    item_variant_id?: string | null;
    item_variant?: unknown;
    item?: { item_variants?: unknown[] | null };
  };
}): unknown | null {
  const { inventoryRow } = params;
  const requestedId = params.requestedVariantId?.trim() || '';
  const rowVariantId = inventoryRow.item_variant_id as string | null | undefined;
  const activeVariants = inventoryRow.item?.item_variants ?? [];

  if (rowVariantId) {
    return resolveRowBoundVariant(
      rowVariantId,
      requestedId,
      activeVariants,
      inventoryRow.item_variant
    );
  }

  if (!Array.isArray(activeVariants) || activeVariants.length === 0) {
    return null;
  }

  if (!requestedId) {
    return null;
  }

  const match = activeVariants.find(
    (v: any) => v?.id === requestedId
  );
  if (!match) {
    throw new ShopperVariantResolveException(
      'ITEM_VARIANT_INVALID',
      'Invalid or unavailable variant for this product.'
    );
  }
  return match;
}

function resolveRowBoundVariant(
  rowVariantId: string,
  requestedId: string,
  activeVariants: unknown[],
  fallbackVariant: unknown
): unknown {
  const rowVariant =
    (Array.isArray(activeVariants)
      ? activeVariants.find((v: any) => v?.id === rowVariantId)
      : null) ||
    fallbackVariant ||
    null;
  if (!rowVariant) {
    throw new ShopperVariantResolveException(
      'ITEM_VARIANT_INVALID',
      'Inventory variant is unavailable for this product.'
    );
  }
  if (requestedId && requestedId !== rowVariantId) {
    throw new ShopperVariantResolveException(
      'ITEM_VARIANT_MISMATCH',
      'Selected variant does not match inventory stock row.'
    );
  }
  return rowVariant;
}
