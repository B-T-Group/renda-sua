import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  resolveQuantityForRemaining,
  type FoodConfirmationStockUpdate,
} from './food-confirmation-stock.util';
import { isFoodCategoryName } from './food-item-availability.mapper';

const GET_ORDER_ITEMS_FOR_STOCK = `
  query GetOrderItemsForFoodStock($orderId: uuid!) {
    order_items(where: { order_id: { _eq: $orderId } }) {
      id
      business_inventory_id
      business_inventory {
        id
        item_id
        business_location_id
        quantity
        reserved_quantity
        item {
          item_sub_category {
            item_category { name }
          }
        }
      }
    }
  }
`;

const SET_INVENTORY_QUANTITY = `
  mutation SetFoodInventoryQuantity($inventoryId: uuid!, $quantity: Int!) {
    update_business_inventory_by_pk(
      pk_columns: { id: $inventoryId }
      _set: { quantity: $quantity }
    ) {
      id
    }
  }
`;

const UPSERT_SOLD_OUT_FLAG = `
  mutation UpsertFoodSoldOutFlag(
    $itemId: uuid!
    $locationId: uuid!
    $markedAt: timestamptz!
  ) {
    insert_food_item_settings_one(
      object: {
        item_id: $itemId
        business_location_id: $locationId
        marked_unavailable_at: $markedAt
      }
      on_conflict: {
        constraint: food_item_settings_location_item_key
        update_columns: [marked_unavailable_at]
      }
    ) {
      id
    }
  }
`;

interface OrderItemStockRow {
  id: string;
  business_inventory_id: string | null;
  business_inventory: {
    id: string;
    item_id: string;
    business_location_id: string;
    quantity: number;
    reserved_quantity: number;
    item?: {
      item_sub_category?: {
        item_category?: { name?: string | null } | null;
      } | null;
    } | null;
  } | null;
}

/**
 * Stock corrections a merchant makes while confirming a food order, when they
 * know how many portions are actually left.
 */
@Injectable()
export class FoodOrderStockService {
  private readonly logger = new Logger(FoodOrderStockService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async applyConfirmationUpdates(
    orderId: string,
    updates: FoodConfirmationStockUpdate[]
  ): Promise<void> {
    if (!updates?.length) return;
    const rows = await this.loadOrderItems(orderId);
    for (const update of updates) {
      const row = rows.find((item) => item.id === update.order_item_id);
      if (!row?.business_inventory) continue;
      if (!this.isFoodRow(row)) continue;
      await this.applyOne(row, update);
    }
  }

  private isFoodRow(row: OrderItemStockRow): boolean {
    return isFoodCategoryName(
      row.business_inventory?.item?.item_sub_category?.item_category?.name
    );
  }

  private async applyOne(
    row: OrderItemStockRow,
    update: FoodConfirmationStockUpdate
  ): Promise<void> {
    const inventory = row.business_inventory!;
    if (update.remaining_quantity != null) {
      await this.setQuantity(
        inventory.id,
        resolveQuantityForRemaining({
          remainingQuantity: update.remaining_quantity,
          reservedQuantity: inventory.reserved_quantity ?? 0,
        })
      );
    }
    if (update.last_one) {
      await this.markSoldOut(
        inventory.item_id,
        inventory.business_location_id
      );
    }
  }

  private async loadOrderItems(
    orderId: string
  ): Promise<OrderItemStockRow[]> {
    const result = await this.hasuraSystemService.executeQuery<{
      order_items: OrderItemStockRow[];
    }>(GET_ORDER_ITEMS_FOR_STOCK, { orderId });
    return result.order_items ?? [];
  }

  private async setQuantity(
    inventoryId: string,
    quantity: number
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(SET_INVENTORY_QUANTITY, {
        inventoryId,
        quantity,
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to set food stock for inventory ${inventoryId}: ${error?.message}`
      );
    }
  }

  private async markSoldOut(
    itemId: string,
    locationId: string
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(UPSERT_SOLD_OUT_FLAG, {
        itemId,
        locationId,
        markedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to mark food item ${itemId} sold out: ${error?.message}`
      );
    }
  }
}
