import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [HasuraModule, InventoryItemsModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
