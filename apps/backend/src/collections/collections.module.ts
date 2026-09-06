import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { CollectionAutoAssignService } from './collection-auto-assign.service';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [HasuraModule, InventoryItemsModule, AiGenerationModule],
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionAutoAssignService],
  exports: [CollectionsService, CollectionAutoAssignService],
})
export class CollectionsModule {}
