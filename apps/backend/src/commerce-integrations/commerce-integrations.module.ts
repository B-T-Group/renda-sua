import { Module } from '@nestjs/common';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { CommerceConnectionService } from './commerce-connection.service';
import { CommerceImportService } from './commerce-import.service';
import {
  CommerceIntegrationsController,
  CommerceIntegrationsInternalController,
  CommerceIntegrationsWebhookController,
} from './commerce-integrations.controller';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';
import { CommerceInventorySyncCronService } from './commerce-inventory-sync-cron.service';
import { CommerceInventorySyncService } from './commerce-inventory-sync.service';
import { CommerceMappingService } from './commerce-mapping.service';
import { CommerceQueueService } from './commerce-queue.service';
import { CommerceTokenCryptoService } from './commerce-token-crypto.service';
import { CommerceWebhookService } from './commerce-webhook.service';
import { CommerceConnectorRegistry } from './connectors/connector.registry';
import { ShopifyGraphqlClient } from './connectors/shopify/shopify-graphql.client';
import { ShopifyConnector } from './connectors/shopify/shopify.connector';
import { CommerceOrderInventoryHook } from './commerce-order-inventory.hook';

@Module({
  imports: [BusinessItemsModule],
  controllers: [
    CommerceIntegrationsController,
    CommerceIntegrationsWebhookController,
    CommerceIntegrationsInternalController,
  ],
  providers: [
    CommerceTokenCryptoService,
    CommerceIntegrationsDatabaseService,
    ShopifyGraphqlClient,
    ShopifyConnector,
    CommerceConnectorRegistry,
    CommerceQueueService,
    CommerceConnectionService,
    CommerceMappingService,
    CommerceImportService,
    CommerceInventorySyncService,
    CommerceInventorySyncCronService,
    CommerceWebhookService,
    CommerceOrderInventoryHook,
  ],
  exports: [
    CommerceInventorySyncService,
    CommerceOrderInventoryHook,
    CommerceIntegrationsDatabaseService,
  ],
})
export class CommerceIntegrationsModule {}
