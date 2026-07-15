import { Injectable, Logger } from '@nestjs/common';
import { CommerceInventorySyncService } from './commerce-inventory-sync.service';

/**
 * Order lifecycle hook for outbound commerce inventory sync.
 * Called when an order becomes payment-committed (`pending`) or is cancelled after commit.
 */
@Injectable()
export class CommerceOrderInventoryHook {
  private readonly logger = new Logger(CommerceOrderInventoryHook.name);

  constructor(private readonly inventorySync: CommerceInventorySyncService) {}

  async onOrderPaymentCommitted(params: {
    orderId: string;
    items: Array<{
      id: string;
      business_inventory_id: string;
      quantity: number;
    }>;
  }): Promise<void> {
    await this.adjustAll(params, 'commit');
  }

  async onOrderCancelledAfterCommit(params: {
    orderId: string;
    items: Array<{
      id: string;
      business_inventory_id: string;
      quantity: number;
    }>;
  }): Promise<void> {
    await this.adjustAll(params, 'release');
  }

  private async adjustAll(
    params: {
      orderId: string;
      items: Array<{
        id: string;
        business_inventory_id: string;
        quantity: number;
      }>;
    },
    action: 'commit' | 'release'
  ): Promise<void> {
    for (const item of params.items) {
      try {
        await this.inventorySync.pushOrderInventoryAdjustment({
          orderId: params.orderId,
          orderItemId: item.id,
          businessInventoryId: item.business_inventory_id,
          quantity: item.quantity,
          action,
        });
      } catch (error: any) {
        this.logger.warn(
          `Commerce inventory ${action} failed for order ${params.orderId} item ${item.id}: ${error?.message}`
        );
      }
    }
  }
}
