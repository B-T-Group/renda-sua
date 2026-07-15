import { Injectable, Logger } from '@nestjs/common';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CommerceConnectionService } from './commerce-connection.service';
import {
  CommerceIntegrationRow,
  CommerceIntegrationsDatabaseService,
} from './commerce-integrations-database.service';
import { CommerceQueueService } from './commerce-queue.service';

@Injectable()
export class CommerceInventorySyncService {
  private readonly logger = new Logger(CommerceInventorySyncService.name);

  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly connection: CommerceConnectionService,
    private readonly access: BusinessItemsAccessService,
    private readonly hasura: HasuraSystemService,
    private readonly queue: CommerceQueueService
  ) {}

  async manualSync(integrationId: string, businessId?: string) {
    const ctx = await this.access.resolveAccess(businessId);
    const integration = await this.connection.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );
    await this.queue.enqueue({
      type: 'reconcile',
      integrationId: integration.id,
      trigger: 'MANUAL_SYNC',
    });
    return { success: true, queued: true };
  }

  async reconcileIntegration(
    integration: CommerceIntegrationRow,
    trigger: 'MANUAL_SYNC' | 'RECONCILIATION' = 'RECONCILIATION'
  ): Promise<void> {
    if (integration.status !== 'connected') return;
    const flags = integration.feature_flags || {};
    if (flags.inboundInventorySyncEnabled === false) return;

    const { token, connector } = this.connection.getDecryptedAccess(
      integration.provider,
      integration
    );
    const locationMappings = (
      await this.db.listMappings(integration.id, 'location')
    ).filter((m) => m.sync_enabled);
    if (!locationMappings.length) return;

    const inventoryItemMappings = await this.db.listMappings(
      integration.id,
      'inventory_item'
    );
    const inventoryItemByExternal = new Map(
      inventoryItemMappings.map((m) => [m.external_id, m])
    );

    const runId = await this.db.createSyncRun({
      integration_id: integration.id,
      trigger,
      direction: 'inbound',
      entity_type: 'inventory_level',
      status: 'running',
    });

    let corrected = 0;
    let cursor: string | null = null;
    try {
      do {
        const page = await connector.getInventoryLevels(
          token,
          integration.external_shop_id,
          {
            locationIds: locationMappings.map((m) => m.external_id),
            cursor,
          }
        );
        for (const level of page.levels) {
          const invItem = inventoryItemByExternal.get(
            level.externalInventoryItemId
          );
          if (!invItem) continue;
          const loc = locationMappings.find(
            (m) => m.external_id === level.externalLocationId
          );
          if (!loc) continue;
          const applied = await this.applyShopifyAvailable({
            integrationId: integration.id,
            provider: integration.provider,
            variantId: invItem.internal_id,
            businessLocationId: loc.internal_id,
            available: level.available,
            externalInventoryItemId: level.externalInventoryItemId,
            externalLocationId: level.externalLocationId,
            externalUpdatedAt: level.updatedAt,
            trigger,
            syncRunId: runId,
          });
          if (applied) corrected += 1;
        }
        cursor = page.nextCursor;
      } while (cursor);

      await this.db.completeSyncRun(runId, 'success', { corrected });
      await this.db.updateIntegration(integration.id, {
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
    } catch (error: any) {
      this.logger.error(
        `Reconcile failed for ${integration.id}: ${error?.message}`
      );
      await this.db.completeSyncRun(
        runId,
        'failed',
        { corrected },
        error?.message
      );
      await this.db.updateIntegration(integration.id, {
        last_error: error?.message || 'reconcile_failed',
        status:
          error?.message?.includes('401') || error?.message?.includes('Unauthorized')
            ? 'reauth_required'
            : integration.status,
      });
    }
  }

  async applyShopifyAvailable(params: {
    integrationId: string;
    provider: 'shopify';
    variantId: string;
    businessLocationId: string;
    available: number;
    externalInventoryItemId: string;
    externalLocationId: string;
    externalUpdatedAt?: string;
    trigger: 'WEBHOOK' | 'MANUAL_SYNC' | 'RECONCILIATION' | 'INITIAL_IMPORT';
    syncRunId?: string;
  }): Promise<boolean> {
    const inventory = await this.findInventoryForVariant(
      params.businessLocationId,
      params.variantId
    );
    if (!inventory) return false;

    const reserved = inventory.reserved_quantity || 0;
    const targetQuantity = Math.max(0, params.available) + reserved;
    if (inventory.quantity === targetQuantity) {
      return false;
    }

    await this.hasura.executeMutation(
      `
      mutation ($id: uuid!, $quantity: Int!) {
        update_business_inventory_by_pk(
          pk_columns: { id: $id }
          _set: { quantity: $quantity }
        ) { id }
      }
    `,
      { id: inventory.id, quantity: targetQuantity }
    );

    await this.db.recordSyncEvent({
      sync_run_id: params.syncRunId,
      integration_id: params.integrationId,
      provider: params.provider,
      direction: 'inbound',
      entity_type: 'inventory_level',
      internal_entity_id: inventory.id,
      external_entity_id: `${params.externalInventoryItemId}:${params.externalLocationId}`,
      trigger: params.trigger,
      status: 'success',
      metadata: {
        shopifyAvailable: params.available,
        reserved,
        previousQuantity: inventory.quantity,
        newQuantity: targetQuantity,
        externalUpdatedAt: params.externalUpdatedAt,
      },
    });
    return true;
  }

  async pushOrderInventoryAdjustment(params: {
    orderId: string;
    orderItemId: string;
    businessInventoryId: string;
    quantity: number;
    action: 'commit' | 'release';
  }): Promise<void> {
    const inventory = await this.getInventoryWithContext(
      params.businessInventoryId
    );
    if (!inventory?.item_variant_id) return;

    const businessId = inventory.business_location?.business_id;
    if (!businessId) return;

    const integration = await this.db.findIntegrationByBusinessAndProvider(
      businessId,
      'shopify'
    );
    if (!integration || integration.status !== 'connected') return;
    const flags = integration.feature_flags || {};
    if (flags.outboundInventorySyncEnabled !== true) return;

    const variantMapping = await this.db.findMappingByInternal(
      integration.id,
      'inventory_item',
      inventory.item_variant_id
    );
    const locationMapping = await this.db.findMappingByInternal(
      integration.id,
      'location',
      inventory.business_location_id
    );
    if (
      !variantMapping ||
      !locationMapping ||
      !locationMapping.sync_enabled
    ) {
      return;
    }

    const delta =
      params.action === 'commit' ? -Math.abs(params.quantity) : Math.abs(params.quantity);
    const idempotencyKey = `rendasua-order-${params.orderId}-item-${params.orderItemId}-${params.action}`;

    const isNew = await this.db.recordSyncEvent({
      integration_id: integration.id,
      provider: 'shopify',
      direction: 'outbound',
      entity_type: 'inventory_level',
      internal_entity_id: inventory.id,
      external_entity_id: variantMapping.external_id,
      trigger: 'RENDASUA_ORDER',
      status: 'pending',
      idempotency_key: idempotencyKey,
      metadata: { delta, orderId: params.orderId },
    });
    if (!isNew) return;

    await this.queue.enqueue({
      type: 'outbound_inventory',
      integrationId: integration.id,
      orderId: params.orderId,
      orderItemId: params.orderItemId,
      externalInventoryItemId: variantMapping.external_id,
      externalLocationId: locationMapping.external_id,
      delta,
      idempotencyKey,
      action: params.action,
    });
  }

  async executeOutboundAdjustment(message: {
    integrationId: string;
    externalInventoryItemId: string;
    externalLocationId: string;
    delta: number;
    idempotencyKey: string;
  }): Promise<void> {
    const integration = await this.db.findIntegrationById(message.integrationId);
    if (!integration || integration.status !== 'connected') return;
    const { token, connector } = this.connection.getDecryptedAccess(
      integration.provider,
      integration
    );
    await connector.adjustInventory(token, integration.external_shop_id, {
      externalInventoryItemId: message.externalInventoryItemId,
      externalLocationId: message.externalLocationId,
      delta: message.delta,
      idempotencyKey: message.idempotencyKey,
      reason: 'correction',
      referenceDocumentUri: `gid://rendasua/Sync/${message.idempotencyKey}`,
    });
    await this.db.markSyncEventByIdempotencyKey(
      message.idempotencyKey,
      'success'
    );
  }

  private async findInventoryForVariant(
    businessLocationId: string,
    variantId: string
  ): Promise<{ id: string; quantity: number; reserved_quantity: number } | null> {
    const q = `
      query ($locationId: uuid!, $variantId: uuid!) {
        business_inventory(
          where: {
            business_location_id: { _eq: $locationId }
            item_variant_id: { _eq: $variantId }
          }
          limit: 1
        ) {
          id quantity reserved_quantity
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      business_inventory: Array<{
        id: string;
        quantity: number;
        reserved_quantity: number;
      }>;
    }>(q, { locationId: businessLocationId, variantId });
    return res.business_inventory[0] ?? null;
  }

  private async getInventoryWithContext(inventoryId: string): Promise<{
    id: string;
    business_location_id: string;
    item_variant_id: string | null;
    business_location?: { business_id: string };
  } | null> {
    const q = `
      query ($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          business_location_id
          item_variant_id
          business_location { business_id }
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      business_inventory_by_pk: {
        id: string;
        business_location_id: string;
        item_variant_id: string | null;
        business_location?: { business_id: string };
      } | null;
    }>(q, { id: inventoryId });
    return res.business_inventory_by_pk;
  }
}
