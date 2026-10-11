import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RestockAlertsApiService } from './restock-alerts-api.service';
import { RestockAlertsController } from './restock-alerts.controller';
import { RestockAlertsCron } from './restock-alerts.cron';
import { OrchestratorRestockNotifier } from './restock-alerts.notifier';
import { HasuraRestockRepository } from './restock-alerts.repository';

@Module({
  imports: [NotificationsModule],
  controllers: [RestockAlertsController],
  providers: [
    HasuraRestockRepository,
    OrchestratorRestockNotifier,
    RestockAlertsApiService,
    RestockAlertsCron,
  ],
})
export class RestockAlertsModule {}
