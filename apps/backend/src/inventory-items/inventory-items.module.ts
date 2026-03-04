import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsController } from './inventory-items.controller';
import { ItemImagesMergeService } from './item-images-merge.service';
import { InventoryItemsService } from './inventory-items.service';

@Module({
  imports: [HasuraModule, GoogleModule],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService, ItemImagesMergeService],
  exports: [InventoryItemsService],
})
export class InventoryItemsModule {}
