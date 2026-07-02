import { Global, Module } from '@nestjs/common';
import { DeliveryPinService } from './delivery-pin.service';
import { DeliveryPinStorageService } from './delivery-pin-storage.service';
import { PinCryptoService } from './pin-crypto.service';

@Global()
@Module({
  providers: [PinCryptoService, DeliveryPinStorageService, DeliveryPinService],
  exports: [DeliveryPinService, DeliveryPinStorageService, PinCryptoService],
})
export class DeliveryPinModule {}
