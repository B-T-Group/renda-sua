import { sumStockUnitsByInventory } from '../item-variants/variant-pricing.util';

export type ReservedInventoryLine = {
  business_inventory_id?: string | null;
  quantity?: number | null;
  item_variant_id?: string | null;
  variant_snapshot?: { quantity?: number | string | null } | null;
};

type HasuraMutator = {
  executeMutation<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<T>;
  executeQuery<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T>;
};

type InventoryReleaseCallback = (inventoryId: string, releasedQty: number) => void | Promise<void>;

const RELEASE_MUTATION = `
  mutation AtomicReleaseReserved($inventoryId: uuid!, $qty: Int!) {
    try_release_business_inventory(
      args: { p_inventory_id: $inventoryId, p_qty: $qty }
    ) { id }
  }
`;

const GET_INVENTORY_FOR_RESTOCK = `
  query GetInventoryForRestock($inventoryId: uuid!) {
    business_inventory_by_pk(id: $inventoryId) {
      id
      item_id
      business_location_id
      quantity
      reserved_quantity
    }
  }
`;

export function aggregateReservedQuantities(
  orderItems: ReservedInventoryLine[] | null | undefined
): Map<string, number> {
  return sumStockUnitsByInventory(orderItems ?? []);
}

/**
 * Release reserved inventory after order cancellation/completion.
 * AC-0: Optionally emits restock events when available quantity goes from 0 to >=1.
 * 
 * @param hasura - Hasura service for mutations and queries
 * @param orderItems - Order items to release
 * @param onRestockCallback - Optional callback invoked after each release for restock event emission
 */
export async function releaseReservedInventory(
  hasura: HasuraMutator,
  orderItems: ReservedInventoryLine[] | null | undefined,
  onRestockCallback?: InventoryReleaseCallback
): Promise<{ released: number; skipped: number }> {
  let released = 0;
  let skipped = 0;
  for (const [inventoryId, qty] of aggregateReservedQuantities(orderItems)) {
    const ok = await tryReleaseOne(hasura, inventoryId, qty, onRestockCallback);
    if (ok) released += 1;
    else skipped += 1;
  }
  return { released, skipped };
}

async function tryReleaseOne(
  hasura: HasuraMutator,
  inventoryId: string,
  qty: number,
  onRestockCallback?: InventoryReleaseCallback
): Promise<boolean> {
  const result = await hasura.executeMutation<{
    try_release_business_inventory?: Array<{ id: string }>;
  }>(RELEASE_MUTATION, { inventoryId, qty });
  
  const success = (result.try_release_business_inventory?.length ?? 0) > 0;
  
  // AC-0: Emit restock event if callback provided and release succeeded (fire-and-forget)
  if (success && onRestockCallback) {
    try {
      // Get inventory details to check if this is a restock transition
      const invResult = await hasura.executeQuery<{
        business_inventory_by_pk: {
          id: string;
          item_id: string;
          business_location_id: string;
          quantity: number;
          reserved_quantity: number;
        } | null;
      }>(GET_INVENTORY_FOR_RESTOCK, { inventoryId });

      if (invResult.business_inventory_by_pk) {
        void Promise.resolve(onRestockCallback(inventoryId, qty));
      }
    } catch (error: any) {
      // AC-0: Never throw, callback errors don't block the release
      // Errors are logged by the callback itself
    }
  }
  
  return success;
}
