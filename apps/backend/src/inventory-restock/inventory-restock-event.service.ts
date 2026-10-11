import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const EMIT_RESTOCK_EVENT = `
  mutation EmitRestockEvent(
    $inventoryId: uuid!
    $itemId: uuid!
    $businessLocationId: uuid!
    $availableQuantity: Int!
    $totalQuantity: Int!
    $reservedQuantity: Int!
  ) {
    insert_restock_events_one(
      object: {
        inventory_id: $inventoryId
        item_id: $itemId
        business_location_id: $businessLocationId
        available_quantity: $availableQuantity
        total_quantity: $totalQuantity
        reserved_quantity: $reservedQuantity
        event_type: "restocked"
      }
    ) {
      id
      created_at
    }
  }
`;

const UPDATE_LAST_RESTOCKED = `
  mutation UpdateLastRestocked($inventoryId: uuid!, $restockedAt: timestamptz!) {
    update_business_inventory_by_pk(
      pk_columns: { id: $inventoryId }
      _set: { last_restocked_at: $restockedAt }
    ) {
      id
    }
  }
`;

const CHECK_ITEM_ACTIVE_AND_VISIBLE = `
  query CheckItemActiveAndVisible($itemId: uuid!, $businessLocationId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      is_active
      status
      moderation_status
      business {
        id
        business_locations(where: { id: { _eq: $businessLocationId } }) {
          id
          market_state {
            country_code
          }
        }
      }
    }
  }
`;

export interface InventoryWriteContext {
  inventoryId: string;
  itemId: string;
  businessLocationId: string;
  previousAvailableQuantity: number;
  newTotalQuantity: number;
  newReservedQuantity?: number;
}

@Injectable()
export class InventoryRestockEventService {
  private readonly logger = new Logger(InventoryRestockEventService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Emit a restock event if available quantity goes from 0/null to >=1.
   * This is the single shared path for all inventory writes.
   * 
   * AC-0: Must be async/fire-and-forget and never block the inventory write.
   * Available = quantity - reserved, and the item must be active and visible.
   * 
   * @param context - Inventory write context
   * @returns Promise<void> - Always resolves, never throws
   */
  async emitRestockEventIfApplicable(
    context: InventoryWriteContext
  ): Promise<void> {
    try {
      const {
        inventoryId,
        itemId,
        businessLocationId,
        previousAvailableQuantity,
        newTotalQuantity,
        newReservedQuantity = 0,
      } = context;

      const newAvailableQuantity = newTotalQuantity - newReservedQuantity;

      // Check if this is a restock transition: 0/null to >=1
      const wasOutOfStock = previousAvailableQuantity <= 0;
      const isNowInStock = newAvailableQuantity >= 1;

      if (!wasOutOfStock || !isNowInStock) {
        // Not a restock transition
        return;
      }

      // Verify the item is active and visible in a market
      const itemCheck = await this.hasuraSystemService.executeQuery<{
        items_by_pk: {
          id: string;
          is_active: boolean;
          status: string;
          moderation_status: string;
          business: {
            id: string;
            business_locations: Array<{
              id: string;
              market_state: { country_code: string } | null;
            }>;
          };
        } | null;
      }>(CHECK_ITEM_ACTIVE_AND_VISIBLE, { itemId, businessLocationId });

      const item = itemCheck.items_by_pk;
      if (!item) {
        this.logger.warn(
          `Cannot emit restock event: item ${itemId} not found`
        );
        return;
      }

      if (!item.is_active || item.status !== 'active' || item.moderation_status !== 'approved') {
        this.logger.debug(
          `Skipping restock event for inactive/unapproved item ${itemId}`
        );
        return;
      }

      const location = item.business.business_locations.find(
        (loc) => loc.id === businessLocationId
      );
      if (!location || !location.market_state) {
        this.logger.debug(
          `Skipping restock event for item ${itemId}: location not visible in any market`
        );
        return;
      }

      // Emit the restock event
      const restockedAt = new Date().toISOString();
      await this.hasuraSystemService.executeMutation(EMIT_RESTOCK_EVENT, {
        inventoryId,
        itemId,
        businessLocationId,
        availableQuantity: newAvailableQuantity,
        totalQuantity: newTotalQuantity,
        reservedQuantity: newReservedQuantity,
      });

      // Update last_restocked_at
      await this.hasuraSystemService.executeMutation(UPDATE_LAST_RESTOCKED, {
        inventoryId,
        restockedAt,
      });

      this.logger.log(
        `Restock event emitted for item ${itemId} at location ${businessLocationId}: ${newAvailableQuantity} available`
      );
    } catch (error: any) {
      // AC-0: Never throw, just log the error
      this.logger.error(
        `Failed to emit restock event for inventory ${context.inventoryId}: ${error?.message}`,
        error?.stack
      );
    }
  }

  /**
   * Convenience wrapper for inventory updates where we need to query the previous state
   */
  async emitRestockEventAfterUpdate(
    inventoryId: string,
    newTotalQuantity: number,
    newReservedQuantity: number = 0
  ): Promise<void> {
    try {
      // Query for the inventory record to get context
      const result = await this.hasuraSystemService.executeQuery<{
        business_inventory_by_pk: {
          id: string;
          item_id: string;
          business_location_id: string;
          quantity: number;
          reserved_quantity: number;
        } | null;
      }>(
        `
        query GetInventoryContext($inventoryId: uuid!) {
          business_inventory_by_pk(id: $inventoryId) {
            id
            item_id
            business_location_id
            quantity
            reserved_quantity
          }
        }
      `,
        { inventoryId }
      );

      const inventory = result.business_inventory_by_pk;
      if (!inventory) {
        this.logger.warn(`Inventory ${inventoryId} not found for restock event`);
        return;
      }

      const previousAvailableQuantity =
        (inventory.quantity || 0) - (inventory.reserved_quantity || 0);

      await this.emitRestockEventIfApplicable({
        inventoryId: inventory.id,
        itemId: inventory.item_id,
        businessLocationId: inventory.business_location_id,
        previousAvailableQuantity,
        newTotalQuantity,
        newReservedQuantity,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed in emitRestockEventAfterUpdate for ${inventoryId}: ${error?.message}`,
        error?.stack
      );
    }
  }
}
