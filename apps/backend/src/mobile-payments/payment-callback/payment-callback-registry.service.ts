import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OrderPaymentCallbackHandler } from '../../orders/order-payment-callback.handler';
import { RentalPaymentCallbackHandler } from '../../rentals/rental-payment-callback.handler';
import type { PaymentCallbackHandler } from './payment-callback-handler.interface';

const HANDLER_TYPES: Type<PaymentCallbackHandler>[] = [
  OrderPaymentCallbackHandler,
  RentalPaymentCallbackHandler,
];

@Injectable()
export class PaymentCallbackRegistryService {
  constructor(private readonly moduleRef: ModuleRef) {}

  getHandlers(): PaymentCallbackHandler[] {
    return HANDLER_TYPES.map((type) =>
      this.moduleRef.get<PaymentCallbackHandler>(type, { strict: false })
    ).filter((handler): handler is PaymentCallbackHandler => Boolean(handler));
  }
}
