import { Injectable, Type } from '@nestjs/common';
import { ContextId, ModuleRef } from '@nestjs/core';
import { OrderPaymentCallbackHandler } from '../../orders/order-payment-callback.handler';
import { RentalPaymentCallbackHandler } from '../../rentals/rental-payment-callback.handler';
import { TokenPaymentCallbackHandler } from '../../business-tokens/token-payment-callback.handler';
import type { PaymentCallbackHandler } from './payment-callback-handler.interface';

const HANDLER_TYPES: Type<PaymentCallbackHandler>[] = [
  OrderPaymentCallbackHandler,
  RentalPaymentCallbackHandler,
  TokenPaymentCallbackHandler,
];

@Injectable()
export class PaymentCallbackRegistryService {
  constructor(private readonly moduleRef: ModuleRef) {}

  async getHandlers(contextId: ContextId): Promise<PaymentCallbackHandler[]> {
    const handlers = await Promise.all(
      HANDLER_TYPES.map((type) =>
        this.moduleRef.resolve<PaymentCallbackHandler>(type, contextId, {
          strict: false,
        })
      )
    );
    return handlers.filter((handler): handler is PaymentCallbackHandler =>
      Boolean(handler)
    );
  }
}
