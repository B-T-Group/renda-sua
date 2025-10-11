import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliveryWindowsController } from './delivery-windows.controller';
import { DeliveryWindowsService } from './delivery-windows.service';

@Module({
  imports: [HasuraModule],
  controllers: [DeliveryWindowsController],
  providers: [DeliverySlotsService, DeliveryWindowsService],
  exports: [DeliverySlotsService, DeliveryWindowsService],
})
export class DeliveryModule {}
