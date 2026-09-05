import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { DeliveryEstimateController } from './delivery-estimate.controller';
import { DeliveryEstimateService } from './delivery-estimate.service';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliveryWindowsController } from './delivery-windows.controller';
import { DeliveryWindowsService } from './delivery-windows.service';

@Module({
  imports: [HasuraModule, DeliveryConfigModule],
  controllers: [DeliveryWindowsController, DeliveryEstimateController],
  providers: [
    DeliverySlotsService,
    DeliveryWindowsService,
    DeliveryEstimateService,
  ],
  exports: [
    DeliverySlotsService,
    DeliveryWindowsService,
    DeliveryEstimateService,
  ],
})
export class DeliveryModule {}
