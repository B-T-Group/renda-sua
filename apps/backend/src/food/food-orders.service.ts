import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { FoodConfirmationStockUpdate } from './food-confirmation-stock.util';
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
        item {
          item_sub_category {
            item_category { name }
          }
        }
      }
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
    item?: {
      item_sub_category?: {
        item_category?: { name?: string | null } | null;
      } | null;
    } | null;
  } | null;
}

/** System-level food concerns for existing orders. */
@Injectable()
export class FoodOrdersService {
  private readonly logger = new Logger(FoodOrdersService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /** True when any line on the order is a cooked dish. */
  async containsCookedFood(orderId: string): Promise<boolean> {
    try {
      const rows = await this.loadOrderItems(orderId);
      return rows.some((row) => this.isFoodRow(row));
    } catch (error: any) {
      this.logger.warn(
        `Could not tell whether order ${orderId} contains food: ${error?.message}`
      );
      return false;
    }
  }

  /**
   * Sold-out flags a merchant sets while confirming a food order.
   * Remaining-quantity stock writes are ignored; cooked food does not track stock.
   */
  async applyConfirmationUpdates(
    orderId: string,
    updates: FoodConfirmationStockUpdate[]
  ): Promise<void> {
    if (!updates?.length) return;
    const rows = await this.loadOrderItems(orderId);
    for (const update of updates) {
      if (!update.last_one) continue;
      const row = rows.find((item) => item.id === update.order_item_id);
      if (!row?.business_inventory) continue;
      if (!this.isFoodRow(row)) continue;
      await this.markSoldOut(
        row.business_inventory.item_id,
        row.business_inventory.business_location_id
      );
    }
  }

  private isFoodRow(row: OrderItemStockRow): boolean {
    return isFoodCategoryName(
      row.business_inventory?.item?.item_sub_category?.item_category?.name
    );
  }

  private async loadOrderItems(
    orderId: string
  ): Promise<OrderItemStockRow[]> {
    const result = await this.hasuraSystemService.executeQuery<{
      order_items: OrderItemStockRow[];
    }>(GET_ORDER_ITEMS_FOR_STOCK, { orderId });
    return result.order_items ?? [];
  }

  private async markSoldOut(
    itemId: string,
    locationId: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(UPSERT_SOLD_OUT_FLAG, {
      itemId,
      locationId,
      markedAt: new Date().toISOString(),
    });
  }
}
