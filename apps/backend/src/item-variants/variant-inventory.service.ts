import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

type ParentStockRow = {
  id: string;
  business_location_id: string;
  item_id: string;
  quantity: number;
  reserved_quantity: number;
  selling_price: number | null;
  unit_cost: number | null;
  reorder_point: number | null;
  reorder_quantity: number | null;
  is_active: boolean | null;
  item_variant_id?: string | null;
};

export type VariantStockRow = {
  id: string;
  computed_available_quantity: number;
};

/** Parent row is listed when singles remain or a variant can fill one sale. */
export const sellableParentStockWhere = {
  _or: [
    { computed_available_quantity: { _gt: 0 } },
    {
      sibling_inventory: {
        item_variant_id: { _is_null: false },
        is_active: { _eq: true },
        can_sell_one: { _eq: true },
      },
    },
  ],
};

export const SELLABLE_PARENT_STOCK_GQL = `_or: [
  { computed_available_quantity: { _gt: 0 } }
  {
    sibling_inventory: {
      item_variant_id: { _is_null: false }
      is_active: { _eq: true }
      can_sell_one: { _eq: true }
    }
  }
]`;

type CheckoutLine = {
  business_inventory_id: string;
  item_variant_id?: string | null;
};

const PARENT_FIELDS = `
  id
  business_location_id
  item_id
  quantity
  reserved_quantity
  selling_price
  unit_cost
  reorder_point
  reorder_quantity
  is_active
  item_variant_id
`;

@Injectable()
export class VariantInventoryService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async seedFromParentStock(itemId: string, variantId: string): Promise<void> {
    const parents = await this.parentsForItem(itemId);
    for (const parent of parents) {
      await this.copyIfMissing(parent, variantId);
    }
  }

  async ensureForLine(
    parentId: string,
    variantId: string
  ): Promise<VariantStockRow> {
    const parent = await this.loadParent(parentId);
    if (!parent) {
      throw new Error('Parent inventory not found');
    }
    return this.copyIfMissing(parent, variantId);
  }

  async stockForPurchase(
    inventoryId: string,
    variantId: string
  ): Promise<VariantStockRow> {
    const row = await this.loadInventory(inventoryId);
    if (!row) throw new Error('Parent inventory not found');
    if (row.item_variant_id === variantId) return stockFrom(row);
    const parent = await this.parentOf(row);
    if (!parent) throw new Error('Parent inventory not found');
    return this.copyIfMissing(parent, variantId);
  }

  async retargetLines(
    lines: CheckoutLine[],
    inventoryById: Map<string, any>
  ): Promise<void> {
    for (const line of lines) {
      await this.retargetLine(line, inventoryById);
    }
  }

  async attachAvailableQuantities<T extends ListingWithVariants>(
    items: T[]
  ): Promise<T[]> {
    const keys = listingKeys(items);
    if (keys.itemIds.length === 0) return items;
    const rows = await this.fetchVariantStock(keys.itemIds, keys.locationIds);
    applyVariantStock(items, rows);
    return items;
  }

  private async copyIfMissing(
    parent: ParentStockRow,
    variantId: string
  ): Promise<VariantStockRow> {
    const existing = await this.findVariantRow(
      parent.business_location_id,
      parent.item_id,
      variantId
    );
    if (existing) return existing;
    return this.insertCopy(parent, variantId);
  }

  private async parentsForItem(itemId: string): Promise<ParentStockRow[]> {
    const res = await this.hasura.executeQuery<{
      business_inventory: ParentStockRow[];
    }>(
      `query ParentStock($itemId: uuid!) {
        business_inventory(where: {
          item_id: { _eq: $itemId }
          item_variant_id: { _is_null: true }
        }) { ${PARENT_FIELDS} }
      }`,
      { itemId }
    );
    return res.business_inventory ?? [];
  }

  private async loadParent(id: string): Promise<ParentStockRow | null> {
    const row = await this.loadInventory(id);
    if (!row || row.item_variant_id) return null;
    return row;
  }

  private async loadInventory(id: string): Promise<ParentStockRow | null> {
    const res = await this.hasura.executeQuery<{
      business_inventory_by_pk: ParentStockRow | null;
    }>(
      `query InventoryById($id: uuid!) {
        business_inventory_by_pk(id: $id) { ${PARENT_FIELDS} }
      }`,
      { id }
    );
    return res.business_inventory_by_pk;
  }

  private async parentOf(row: ParentStockRow): Promise<ParentStockRow | null> {
    if (!row.item_variant_id) return row;
    return this.parentAt(row.business_location_id, row.item_id);
  }

  private async parentAt(
    locationId: string,
    itemId: string
  ): Promise<ParentStockRow | null> {
    const res = await this.hasura.executeQuery<{
      business_inventory: ParentStockRow[];
    }>(
      `query ParentAtLocation($locationId: uuid!, $itemId: uuid!) {
        business_inventory(where: {
          business_location_id: { _eq: $locationId }
          item_id: { _eq: $itemId }
          item_variant_id: { _is_null: true }
        }, limit: 1) { ${PARENT_FIELDS} }
      }`,
      { locationId, itemId }
    );
    return res.business_inventory?.[0] ?? null;
  }

  private async findVariantRow(
    locationId: string,
    itemId: string,
    variantId: string
  ): Promise<VariantStockRow | null> {
    const res = await this.hasura.executeQuery<{
      business_inventory: VariantStockRow[];
    }>(
      `query FindVariantStock($locationId: uuid!, $itemId: uuid!, $variantId: uuid!) {
        business_inventory(where: {
          business_location_id: { _eq: $locationId }
          item_id: { _eq: $itemId }
          item_variant_id: { _eq: $variantId }
        }, limit: 1) {
          id
          computed_available_quantity
        }
      }`,
      { locationId, itemId, variantId }
    );
    return res.business_inventory?.[0] ?? null;
  }

  private async insertCopy(
    parent: ParentStockRow,
    variantId: string
  ): Promise<VariantStockRow> {
    const res = await this.hasura.executeMutation<{
      insert_business_inventory_one: VariantStockRow | null;
    }>(
      `mutation InsertVariantStock($object: business_inventory_insert_input!) {
        insert_business_inventory_one(object: $object) {
          id
          computed_available_quantity
        }
      }`,
      { object: copyObject(parent, variantId) }
    );
    const created = res.insert_business_inventory_one;
    if (!created?.id) {
      throw new Error('Failed to seed variant inventory');
    }
    return created;
  }

  private async fetchVariantStock(
    itemIds: string[],
    locationIds: string[]
  ): Promise<VariantStockListing[]> {
    const res = await this.hasura.executeQuery<{
      business_inventory: VariantStockListing[];
    }>(
      `query VariantStockForListings($itemIds: [uuid!]!, $locationIds: [uuid!]!) {
        business_inventory(where: {
          item_id: { _in: $itemIds }
          business_location_id: { _in: $locationIds }
          item_variant_id: { _is_null: false }
          is_active: { _eq: true }
        }) {
          item_id
          item_variant_id
          business_location_id
          computed_available_quantity
        }
      }`,
      { itemIds, locationIds }
    );
    return res.business_inventory ?? [];
  }

  private async retargetLine(
    line: CheckoutLine,
    inventoryById: Map<string, any>
  ): Promise<void> {
    const variantId = line.item_variant_id;
    if (!variantId) return;
    const current = inventoryById.get(line.business_inventory_id);
    if (!current) return;
    const row = await this.stockForPurchase(current.id, variantId);
    pointLineAtStock(line, current, row, inventoryById);
  }
}

type ListingWithVariants = {
  item_id?: string;
  business_location_id?: string;
  business_location?: { id?: string };
  item?: {
    id?: string;
    item_variants?: Array<{ id: string; available_quantity?: number | null }>;
  };
};

type VariantStockListing = {
  item_id: string;
  item_variant_id: string;
  business_location_id: string;
  computed_available_quantity: number;
};

function listingKeys(items: ListingWithVariants[]): {
  itemIds: string[];
  locationIds: string[];
} {
  const itemIds = new Set<string>();
  const locationIds = new Set<string>();
  for (const item of items) {
    const itemId = item.item?.id ?? item.item_id;
    const locationId = item.business_location?.id ?? item.business_location_id;
    if (itemId) itemIds.add(itemId);
    if (locationId) locationIds.add(locationId);
  }
  return { itemIds: [...itemIds], locationIds: [...locationIds] };
}

function applyVariantStock(
  items: ListingWithVariants[],
  rows: VariantStockListing[]
): void {
  const byKey = new Map<string, number>();
  for (const row of rows) {
    byKey.set(
      `${row.business_location_id}:${row.item_variant_id}`,
      Number(row.computed_available_quantity)
    );
  }
  for (const item of items) {
    const locationId = item.business_location?.id ?? item.business_location_id;
    for (const variant of item.item?.item_variants ?? []) {
      const qty = byKey.get(`${locationId}:${variant.id}`);
      if (qty != null) variant.available_quantity = qty;
    }
  }
}

function stockFrom(row: ParentStockRow): VariantStockRow {
  const available = Number(row.quantity) - Number(row.reserved_quantity);
  return { id: row.id, computed_available_quantity: available };
}

function pointLineAtStock(
  line: CheckoutLine,
  current: { computed_available_quantity?: number },
  row: VariantStockRow,
  inventoryById: Map<string, any>
): void {
  if (row.id === line.business_inventory_id) {
    current.computed_available_quantity = row.computed_available_quantity;
    return;
  }
  inventoryById.set(row.id, listingWithoutVariant(current, row));
  line.business_inventory_id = row.id;
}

function listingWithoutVariant(current: object, row: VariantStockRow) {
  const { item_variant_id: _id, item_variant: _variant, ...listing } =
    current as { item_variant_id?: string; item_variant?: unknown };
  return {
    ...listing,
    id: row.id,
    computed_available_quantity: row.computed_available_quantity,
  };
}

function copyObject(parent: ParentStockRow, variantId: string) {
  return {
    business_location_id: parent.business_location_id,
    item_id: parent.item_id,
    item_variant_id: variantId,
    quantity: parent.quantity,
    reserved_quantity: parent.reserved_quantity,
    selling_price: parent.selling_price,
    unit_cost: parent.unit_cost,
    reorder_point: parent.reorder_point,
    reorder_quantity: parent.reorder_quantity,
    is_active: parent.is_active ?? true,
  };
}
