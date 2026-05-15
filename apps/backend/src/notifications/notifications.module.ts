import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    SmsModule,
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../orders/orders.module').OrdersModule;
    }),
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
