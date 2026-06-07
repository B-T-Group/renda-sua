import { Global, Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';

@Global()
@Module({
  imports: [HasuraModule, GoogleModule, EmbeddingsModule],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryItemsModule {}
