import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductInterestController } from './product-interest.controller';
import { ProductInterestService } from './product-interest.service';

@Module({
  imports: [HasuraModule, NotificationsModule],
  controllers: [ProductInterestController],
  providers: [ProductInterestService],
  exports: [ProductInterestService],
})
export class ProductInterestModule {}
