import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { CollectionsModule } from '../collections/collections.module';
import { CatalogStopsController } from './catalog-stops.controller';
import { CatalogStopsService } from './catalog-stops.service';

@Module({
  imports: [
    HasuraModule,
    InventoryItemsModule,
    CollectionsModule,
  ],
  controllers: [CatalogStopsController],
  providers: [CatalogStopsService],
  exports: [CatalogStopsService],
})
export class CatalogStopsModule {}
