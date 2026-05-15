import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { OrdersModule } from '../orders/orders.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    SmsModule,
    forwardRef(() => OrdersModule),
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
