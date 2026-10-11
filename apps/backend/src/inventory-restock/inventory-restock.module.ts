import { Module } from '@nestjs/common';
import { InventoryRestockEventService } from './inventory-restock-event.service';
import { RestockAlertsService } from './restock-alerts.service';
import { RestockAlertsController } from './restock-alerts.controller';
import { RestockAlertStateService } from './restock-alert-state.service';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HasuraModule, NotificationsModule],
  controllers: [RestockAlertsController],
  providers: [
    InventoryRestockEventService,
    RestockAlertsService,
    RestockAlertStateService,
  ],
  exports: [
    InventoryRestockEventService,
    RestockAlertStateService,
  ],
})
export class InventoryRestockModule {}
