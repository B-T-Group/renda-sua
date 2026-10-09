import { Injectable } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { currencyDecimals, normalizeFeeCountryCode } from './fee-percent.util';

export const SERVICE_FEE_CONFIG_KEY = 'service_fee';

@Injectable()
export class ServiceFeeService {
  constructor(private readonly configurations: ConfigurationsService) {}

  /** Seller-country fee for a new order. Missing row or unknown country is 0. */
  async resolve(
    country: string | null | undefined,
    currency: string
  ): Promise<number> {
    const code = normalizeFeeCountryCode(country);
    if (!code) return 0;
    const row = await this.configurations.getConfigurationByKey(
      SERVICE_FEE_CONFIG_KEY,
      code
    );
    return roundServiceFee(Number(row?.number_value ?? 0), currency);
  }
}

/** Half-up to the currency minor unit. Non-positive values are 0. */
export function roundServiceFee(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(amount * factor) / factor;
}
