import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryRestockModule } from '../inventory-restock/inventory-restock.module';
import { ItemLikesController } from './item-likes.controller';
import { ItemLikesService } from './item-likes.service';

@Module({
  imports: [HasuraModule, InventoryRestockModule],
  controllers: [ItemLikesController],
  providers: [ItemLikesService],
  exports: [ItemLikesService],
})
export class ItemLikesModule {}
