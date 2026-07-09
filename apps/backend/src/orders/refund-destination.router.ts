import { Injectable } from '@nestjs/common';
import { RefundConfigService } from './refund-config.service';
import type { RefundDestination } from './refund.types';

@Injectable()
export class RefundDestinationRouter {
  constructor(private readonly refundConfig: RefundConfigService) {}

  resolve(
    paymentSource: string | null | undefined,
    forceDestination?: RefundDestination
  ): RefundDestination {
    return this.refundConfig.resolveDestination(paymentSource, forceDestination);
  }

  isStripeDestination(destination: RefundDestination): boolean {
    return destination === 'stripe';
  }

  isWalletDestination(destination: RefundDestination): boolean {
    return destination === 'wallet';
  }
}
