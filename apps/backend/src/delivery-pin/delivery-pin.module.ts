import { Global, Module } from '@nestjs/common';
import { DeliveryPinService } from './delivery-pin.service';

@Global()
@Module({
  providers: [DeliveryPinService],
  exports: [DeliveryPinService],
})
export class DeliveryPinModule {}
