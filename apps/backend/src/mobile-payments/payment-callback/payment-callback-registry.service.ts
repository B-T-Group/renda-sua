import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OrderPaymentCallbackHandler } from '../../orders/order-payment-callback.handler';
import { RentalPaymentCallbackHandler } from '../../rentals/rental-payment-callback.handler';
import type { PaymentCallbackHandler } from './payment-callback-handler.interface';

@Injectable()
export class PaymentCallbackRegistryService implements OnModuleInit {
  private handlers: PaymentCallbackHandler[] = [];

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    this.handlers = [
      this.moduleRef.get(OrderPaymentCallbackHandler, { strict: false }),
      this.moduleRef.get(RentalPaymentCallbackHandler, { strict: false }),
    ].filter(Boolean);
  }

  getHandlers(): PaymentCallbackHandler[] {
    return this.handlers;
  }
}
