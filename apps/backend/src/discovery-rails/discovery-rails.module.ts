import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { CollectionsModule } from '../collections/collections.module';
import { DiscoveryRailsController } from './discovery-rails.controller';
import { DiscoveryRailsService } from './discovery-rails.service';

@Module({
  imports: [
    HasuraModule,
    InventoryItemsModule,
    CollectionsModule,
  ],
  controllers: [DiscoveryRailsController],
  providers: [DiscoveryRailsService],
  exports: [DiscoveryRailsService],
})
export class DiscoveryRailsModule {}
