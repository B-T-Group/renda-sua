import { Global, Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';
import { StockAvailabilityController } from './stock-availability.controller';
import { StockAvailabilityService } from './stock-availability.service';

@Global()
@Module({
  imports: [HasuraModule, GoogleModule, EmbeddingsModule, RbacModule, NotificationsModule],
  controllers: [InventoryItemsController, StockAvailabilityController],
  providers: [InventoryItemsService, StockAvailabilityService],
  exports: [InventoryItemsService, StockAvailabilityService],
})
export class InventoryItemsModule {}
