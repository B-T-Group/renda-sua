import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import type { RefundDestination } from './refund.types';

@Injectable()
export class RefundConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  isV2Enabled(): boolean {
    const raw = process.env.REFUNDS_V2_ENABLED;
    if (raw === 'true' || raw === '1') {
      return true;
    }
    if (raw === 'false' || raw === '0') {
      return false;
    }
    return this.configService.get('order')?.refundsV2Enabled ?? true;
  }

  resolveDestination(
    paymentSource: string | null | undefined,
    forceDestination?: RefundDestination
  ): RefundDestination {
    if (forceDestination) {
      return forceDestination;
    }
    if (paymentSource === 'credit_card') {
      return 'stripe';
    }
    return 'wallet';
  }
}
