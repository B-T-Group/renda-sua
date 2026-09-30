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
};

const RELEASE_MUTATION = `
  mutation AtomicReleaseReserved($inventoryId: uuid!, $qty: Int!) {
    try_release_business_inventory(
      args: { p_inventory_id: $inventoryId, p_qty: $qty }
    ) { id }
  }
`;

export function aggregateReservedQuantities(
  orderItems: ReservedInventoryLine[] | null | undefined
): Map<string, number> {
  return sumStockUnitsByInventory(orderItems ?? []);
}

export async function releaseReservedInventory(
  hasura: HasuraMutator,
  orderItems: ReservedInventoryLine[] | null | undefined
): Promise<{ released: number; skipped: number }> {
  let released = 0;
  let skipped = 0;
  for (const [inventoryId, qty] of aggregateReservedQuantities(orderItems)) {
    const ok = await tryReleaseOne(hasura, inventoryId, qty);
    if (ok) released += 1;
    else skipped += 1;
  }
  return { released, skipped };
}

async function tryReleaseOne(
  hasura: HasuraMutator,
  inventoryId: string,
  qty: number
): Promise<boolean> {
  const result = await hasura.executeMutation<{
    try_release_business_inventory?: Array<{ id: string }>;
  }>(RELEASE_MUTATION, { inventoryId, qty });
  return (result.try_release_business_inventory?.length ?? 0) > 0;
}
