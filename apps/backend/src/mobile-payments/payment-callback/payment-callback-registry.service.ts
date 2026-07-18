import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PaymentCallbackHandler } from './payment-callback-handler.interface';

/**
 * Resolves payment callback handlers as singletons.
 * Handler classes are required lazily to avoid circular imports at module load.
 */
@Injectable()
export class PaymentCallbackRegistryService {
  constructor(private readonly moduleRef: ModuleRef) {}

  getHandlers(): PaymentCallbackHandler[] {
    return this.handlerTypes()
      .map((type) =>
        this.moduleRef.get<PaymentCallbackHandler>(type, { strict: false })
      )
      .filter((handler): handler is PaymentCallbackHandler => Boolean(handler));
  }

  private handlerTypes(): Type<PaymentCallbackHandler>[] {
    // Lazy requires avoid Orders ↔ Stripe ↔ MerchantLifecycle cycles at import time.
    const { OrderPaymentCallbackHandler } = require('../../orders/order-payment-callback.handler');
    const { RentalPaymentCallbackHandler } = require('../../rentals/rental-payment-callback.handler');
    const { TokenPaymentCallbackHandler } = require('../../business-tokens/token-payment-callback.handler');
    return [
      OrderPaymentCallbackHandler,
      RentalPaymentCallbackHandler,
      TokenPaymentCallbackHandler,
    ];
  }
}
