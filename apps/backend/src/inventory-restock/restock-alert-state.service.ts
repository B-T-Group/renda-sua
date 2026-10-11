import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const ARM_ALERT_ON_LIKE = `
  mutation ArmAlertOnLike($userId: uuid!, $itemId: uuid!) {
    insert_restock_alerts_one(
      object: {
        user_id: $userId
        item_id: $itemId
        status: "armed"
        alert_enabled: true
      }
      on_conflict: {
        constraint: restock_alerts_user_id_item_id_key
        update_columns: [status, alert_enabled, armed_at]
      }
    ) {
      id
      status
    }
  }
`;

const DISARM_ALERT_ON_UNLIKE = `
  mutation DisarmAlertOnUnlike($userId: uuid!, $itemId: uuid!) {
    update_restock_alerts(
      where: {
        user_id: { _eq: $userId }
        item_id: { _eq: $itemId }
      }
      _set: {
        status: "disarmed_unlike"
        disarmed_at: "now()"
        disarm_reason: "unliked"
      }
    ) {
      affected_rows
    }
  }
`;

const DISARM_ALERT_ON_PURCHASE = `
  mutation DisarmAlertOnPurchase($userId: uuid!, $itemId: uuid!) {
    update_restock_alerts(
      where: {
        user_id: { _eq: $userId }
        item_id: { _eq: $itemId }
        status: { _in: ["armed", "sent"] }
      }
      _set: {
        status: "disarmed_purchased"
        disarmed_at: "now()"
        disarm_reason: "purchased"
      }
    ) {
      affected_rows
    }
  }
`;

const CHECK_IF_IN_CART = `
  query CheckIfInCart($userId: uuid!, $itemId: uuid!) {
    cart_items(
      where: {
        user_id: { _eq: $userId }
        item_id: { _eq: $itemId }
      }
      limit: 1
    ) {
      id
    }
  }
`;

const CHECK_IF_IN_ACTIVE_ORDER = `
  query CheckIfInActiveOrder($userId: uuid!, $itemId: uuid!) {
    order_items(
      where: {
        order: {
          user_id: { _eq: $userId }
          status: { _nin: ["cancelled", "completed", "failed"] }
        }
        item_id: { _eq: $itemId }
      }
      limit: 1
    ) {
      id
    }
  }
`;

const CHECK_IF_OUT_OF_STOCK = `
  query CheckIfOutOfStock($itemId: uuid!) {
    business_inventory(
      where: {
        item_id: { _eq: $itemId }
        quantity: { _gt: 0 }
      }
    ) {
      id
      quantity
      reserved_quantity
    }
  }
`;

@Injectable()
export class RestockAlertStateService {
  private readonly logger = new Logger(RestockAlertStateService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * AC-§1: Arm alert when user likes an out-of-stock item
   * Skip if item is in cart or active order
   */
  async armAlertOnLike(userId: string, itemId: string): Promise<void> {
    try {
      // Check if item is in cart
      const cartCheck = await this.hasuraSystemService.executeQuery<{
        cart_items: Array<{ id: string }>;
      }>(CHECK_IF_IN_CART, { userId, itemId });

      if (cartCheck.cart_items.length > 0) {
        this.logger.debug(`Skipping alert arm: item ${itemId} in cart`);
        return;
      }

      // Check if item is in active order
      const orderCheck = await this.hasuraSystemService.executeQuery<{
        order_items: Array<{ id: string }>;
      }>(CHECK_IF_IN_ACTIVE_ORDER, { userId, itemId });

      if (orderCheck.order_items.length > 0) {
        this.logger.debug(`Skipping alert arm: item ${itemId} in active order`);
        return;
      }

      // Check if item is out of stock
      const stockCheck = await this.hasuraSystemService.executeQuery<{
        business_inventory: Array<{
          id: string;
          quantity: number;
          reserved_quantity: number;
        }>;
      }>(CHECK_IF_OUT_OF_STOCK, { itemId });

      let hasAvailableStock = false;
      for (const inv of stockCheck.business_inventory) {
        const available = inv.quantity - (inv.reserved_quantity || 0);
        if (available >= 1) {
          hasAvailableStock = true;
          break;
        }
      }

      if (hasAvailableStock) {
        this.logger.debug(`Skipping alert arm: item ${itemId} is in stock`);
        return;
      }

      // Arm the alert
      await this.hasuraSystemService.executeMutation(ARM_ALERT_ON_LIKE, {
        userId,
        itemId,
      });

      this.logger.log(`Armed restock alert for user ${userId} on item ${itemId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to arm alert on like for user ${userId}, item ${itemId}: ${error?.message}`,
        error?.stack
      );
    }
  }

  /**
   * AC-§1: Disarm alert when user unlikes an item
   */
  async disarmAlertOnUnlike(userId: string, itemId: string): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(DISARM_ALERT_ON_UNLIKE, {
        userId,
        itemId,
      });

      this.logger.log(`Disarmed restock alert for user ${userId} on item ${itemId} (unliked)`);
    } catch (error: any) {
      this.logger.error(
        `Failed to disarm alert on unlike for user ${userId}, item ${itemId}: ${error?.message}`,
        error?.stack
      );
    }
  }

  /**
   * AC-§1: Disarm alert when user purchases the item
   */
  async disarmAlertOnPurchase(userId: string, itemId: string): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(DISARM_ALERT_ON_PURCHASE, {
        userId,
        itemId,
      });

      this.logger.log(`Disarmed restock alert for user ${userId} on item ${itemId} (purchased)`);
    } catch (error: any) {
      this.logger.error(
        `Failed to disarm alert on purchase for user ${userId}, item ${itemId}: ${error?.message}`,
        error?.stack
      );
    }
  }

  /**
   * Disarm alerts for multiple items in an order
   */
  async disarmAlertsForOrderItems(userId: string, itemIds: string[]): Promise<void> {
    for (const itemId of itemIds) {
      await this.disarmAlertOnPurchase(userId, itemId);
    }
  }
}
