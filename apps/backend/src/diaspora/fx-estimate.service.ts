import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DiasporaConfig } from '../config/configuration';

/** Indicative amount shown to a payer abroad. Never used for settlement. */
export interface FxEstimate {
  /** Payer-facing currency, e.g. CAD. */
  currency: string;
  /** Indicative amount in the payer currency. */
  amount: number;
  /** Rate applied: 1 unit of the merchant currency in payer currency. */
  rate: number;
  /** Provenance so the UI can label the number honestly. */
  source: 'indicative_config';
}

/** ISO country → payer presentment currency for the launch markets. */
const PAYER_CURRENCY_BY_COUNTRY: Record<string, string> = {
  CA: 'CAD',
  US: 'USD',
};

/**
 * MVP FX presentment for diaspora checkout.
 *
 * Stripe still charges the merchant currency, so the payer's card issuer sets
 * the real rate. This service only produces the "you'll pay ≈" line and the
 * snapshot stored on the order. Full Adaptive Pricing is issue #178, which
 * replaces the implementation without changing these call sites.
 */
@Injectable()
export class FxEstimateService {
  constructor(private readonly configService: ConfigService) {}

  private get rates(): Record<string, number> {
    return this.configService.get<DiasporaConfig>('diaspora')?.fxRates ?? {};
  }

  /** Presentment currency for a payer billing country, when we know one. */
  payerCurrencyForCountry(countryCode?: string | null): string | null {
    const code = countryCode?.trim().toUpperCase();
    if (!code) return null;
    return PAYER_CURRENCY_BY_COUNTRY[code] ?? null;
  }

  /**
   * Indicative payer-currency amount, or null when no rate is configured. A
   * missing rate must hide the FX line rather than guess at one.
   */
  estimate(params: {
    amount: number;
    merchantCurrency: string;
    payerCountry?: string | null;
  }): FxEstimate | null {
    const payerCurrency = this.payerCurrencyForCountry(params.payerCountry);
    const merchantCurrency = params.merchantCurrency?.trim().toUpperCase();
    if (!payerCurrency || !merchantCurrency) return null;
    if (payerCurrency === merchantCurrency) return null;
    if (!Number.isFinite(params.amount) || params.amount <= 0) return null;

    const rate = this.rates[`${merchantCurrency}:${payerCurrency}`];
    if (!rate) return null;

    return {
      currency: payerCurrency,
      amount: Number((params.amount * rate).toFixed(2)),
      rate,
      source: 'indicative_config',
    };
  }
}
