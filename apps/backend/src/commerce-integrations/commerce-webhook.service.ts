import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';
import { CommerceInventorySyncService } from './commerce-inventory-sync.service';
import {
  CommerceQueueMessage,
  CommerceQueueService,
} from './commerce-queue.service';
import { CommerceConnectorRegistry } from './connectors/connector.registry';

@Injectable()
export class CommerceWebhookService implements OnModuleInit {
  private readonly logger = new Logger(CommerceWebhookService.name);

  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly registry: CommerceConnectorRegistry,
    private readonly queue: CommerceQueueService,
    private readonly inventorySync: CommerceInventorySyncService
  ) {}

  onModuleInit(): void {
    this.queue.registerLocalHandler((message) => this.processQueueMessage(message));
  }

  async handleShopifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{ accepted: boolean }> {
    const connector = this.registry.get('shopify');
    const event = connector.verifyWebhook(rawBody, headers);
    if (!event) {
      return { accepted: false };
    }

    const integration = event.shopDomain
      ? await this.db.findIntegrationByShop('shopify', event.shopDomain)
      : null;

    const isNew = await this.db.recordWebhookEvent({
      provider: 'shopify',
      event_id: event.eventId,
      topic: event.topic,
      shop_domain: event.shopDomain,
      integration_id: integration?.id,
      payload: event.payload,
    });
    if (!isNew) {
      return { accepted: true };
    }

    await this.queue.enqueue({
      type: 'webhook',
      provider: 'shopify',
      eventId: event.eventId,
      topic: event.topic,
      shopDomain: event.shopDomain,
      integrationId: integration?.id,
      payload: event.payload,
    });
    return { accepted: true };
  }

  async processQueueMessage(message: CommerceQueueMessage): Promise<void> {
    if (message.type === 'reconcile') {
      const integration = await this.db.findIntegrationById(
        message.integrationId
      );
      if (integration) {
        await this.inventorySync.reconcileIntegration(
          integration,
          message.trigger
        );
      }
      return;
    }

    if (message.type === 'outbound_inventory') {
      try {
        await this.inventorySync.executeOutboundAdjustment(message);
      } catch (error: any) {
        this.logger.error(
          `Outbound inventory failed: ${error?.message}`
        );
        await this.db.markSyncEventByIdempotencyKey(
          message.idempotencyKey,
          'failed',
          error?.message || 'outbound_inventory_failed'
        );
        await this.db.updateIntegration(message.integrationId, {
          last_error: error?.message || 'outbound_inventory_failed',
        });
        throw error;
      }
      return;
    }

    if (message.type === 'webhook') {
      try {
        await this.processWebhook(message);
        await this.db.markWebhookProcessed(
          'shopify',
          message.eventId,
          'success'
        );
      } catch (error: any) {
        this.logger.error(
          `Webhook processing failed ${message.eventId}: ${error?.message}`
        );
        await this.db.markWebhookProcessed(
          'shopify',
          message.eventId,
          'failed',
          error?.message
        );
      }
    }
  }

  private async processWebhook(message: {
    topic: string;
    shopDomain?: string;
    integrationId?: string;
    payload: unknown;
  }): Promise<void> {
    const integration = message.integrationId
      ? await this.db.findIntegrationById(message.integrationId)
      : message.shopDomain
      ? await this.db.findIntegrationByShop('shopify', message.shopDomain)
      : null;
    if (!integration) return;

    const topic = message.topic.toLowerCase();
    if (topic.includes('app/uninstalled') || topic.includes('app_uninstalled')) {
      await this.db.updateIntegration(integration.id, {
        status: 'disconnected',
        access_token_encrypted: null,
        last_error: 'App uninstalled from Shopify',
      });
      return;
    }

    if (
      topic.includes('inventory_levels') ||
      topic.includes('inventory_levels/update')
    ) {
      await this.handleInventoryLevelWebhook(integration.id, message.payload);
      return;
    }

    if (topic.includes('products/delete')) {
      const payload = message.payload as { admin_graphql_api_id?: string; id?: number };
      const externalId =
        payload.admin_graphql_api_id ||
        (payload.id ? `gid://shopify/Product/${payload.id}` : null);
      if (!externalId) return;
      const mapping = await this.db.findMappingByExternal(
        integration.id,
        'product',
        externalId
      );
      if (mapping) {
        await this.db.updateMapping(mapping.id, { sync_enabled: false });
      }
      return;
    }

    if (topic.includes('locations/delete') || topic.includes('locations_delete')) {
      const payload = message.payload as { admin_graphql_api_id?: string; id?: number };
      const externalId =
        payload.admin_graphql_api_id ||
        (payload.id ? `gid://shopify/Location/${payload.id}` : null);
      if (!externalId) return;
      const mapping = await this.db.findMappingByExternal(
        integration.id,
        'location',
        externalId
      );
      if (mapping) {
        await this.db.updateMapping(mapping.id, { sync_enabled: false });
      }
    }
  }

  private async handleInventoryLevelWebhook(
    integrationId: string,
    payload: unknown
  ): Promise<void> {
    const body = payload as {
      inventory_item_id?: number;
      location_id?: number;
      available?: number;
      admin_graphql_api_id?: string;
      updated_at?: string;
    };
    if (
      body.inventory_item_id == null ||
      body.location_id == null ||
      body.available == null
    ) {
      return;
    }
    const inventoryItemGid = `gid://shopify/InventoryItem/${body.inventory_item_id}`;
    const locationGid = `gid://shopify/Location/${body.location_id}`;

    const invItem = await this.db.findMappingByExternal(
      integrationId,
      'inventory_item',
      inventoryItemGid
    );
    const location = await this.db.findMappingByExternal(
      integrationId,
      'location',
      locationGid
    );
    if (!invItem || !location || !location.sync_enabled) return;

    await this.inventorySync.applyShopifyAvailable({
      integrationId,
      provider: 'shopify',
      variantId: invItem.internal_id,
      businessLocationId: location.internal_id,
      available: body.available,
      externalInventoryItemId: inventoryItemGid,
      externalLocationId: locationGid,
      externalUpdatedAt: body.updated_at,
      trigger: 'WEBHOOK',
    });
  }
}
