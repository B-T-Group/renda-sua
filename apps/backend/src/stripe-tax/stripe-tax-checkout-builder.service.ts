import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import {
  StripeCheckoutTaxLineItem,
  StripeTaxCustomerAddress,
} from '../stripe-payments/stripe.service';
import {
  STRIPE_TAX_CODE_GENERAL_TANGIBLE,
  STRIPE_TAX_CODE_SHIPPING,
} from './stripe-tax.constants';

export interface OrderTaxLineInput {
  name: string;
  unitPrice: number;
  quantity: number;
  taxCode?: string | null;
  reference?: string;
}

export interface BuildCheckoutTaxParams {
  currency: string;
  orderItems: OrderTaxLineInput[];
  deliveryFee: number;
  discountAmount: number;
  customerAddress?: StripeTaxCustomerAddress | null;
  sellerCountry?: string | null;
}

@Injectable()
export class StripeTaxCheckoutBuilderService {
  constructor(private readonly configService: ConfigService) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  isTaxEnabledForCountry(countryCode?: string | null): boolean {
    if (!this.config.taxEnabled) return false;
    if (!countryCode) return false;
    return this.config.taxCountries.includes(countryCode.trim().toUpperCase());
  }

  buildLineItems(params: BuildCheckoutTaxParams): StripeCheckoutTaxLineItem[] {
    const items = params.orderItems.map((item) => ({
      name: item.name,
      unitAmount: this.toMinorUnits(item.unitPrice, params.currency),
      quantity: item.quantity,
      taxCode: item.taxCode?.trim() || STRIPE_TAX_CODE_GENERAL_TANGIBLE,
      reference: item.reference,
    }));

    const discounted = this.applyProportionalDiscount(
      items,
      params.discountAmount,
      params.currency
    );

    if (params.deliveryFee > 0) {
      discounted.push({
        name: 'Delivery',
        unitAmount: this.toMinorUnits(params.deliveryFee, params.currency),
        quantity: 1,
        taxCode: STRIPE_TAX_CODE_SHIPPING,
        reference: 'delivery',
      });
    }

    return discounted.filter((line) => line.unitAmount > 0 && line.quantity > 0);
  }

  private applyProportionalDiscount(
    lines: StripeCheckoutTaxLineItem[],
    discountAmount: number,
    currency: string
  ): StripeCheckoutTaxLineItem[] {
    if (discountAmount <= 0 || lines.length === 0) return lines;
    const subtotalMajor = lines.reduce(
      (sum, line) =>
        sum + (this.fromMinorUnits(line.unitAmount, currency) * line.quantity),
      0
    );
    if (subtotalMajor <= 0) return lines;
    const ratio = Math.min(1, discountAmount / subtotalMajor);
    return lines.map((line) => {
      const unitMajor = this.fromMinorUnits(line.unitAmount, currency);
      const discountedUnit = unitMajor * (1 - ratio);
      return {
        ...line,
        unitAmount: this.toMinorUnits(discountedUnit, currency),
      };
    });
  }

  toMinorUnits(amount: number, currency: string): number {
    const zeroDecimal = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'CLP']);
    if (zeroDecimal.has(currency.toUpperCase())) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }

  fromMinorUnits(amount: number, currency: string): number {
    const zeroDecimal = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'CLP']);
    if (zeroDecimal.has(currency.toUpperCase())) return amount;
    return amount / 100;
  }

  normalizeCountryCode(country: string | null | undefined): string | null {
    if (!country?.trim()) return null;
    const value = country.trim();
    if (value.length === 2) return value.toUpperCase();
    const map: Record<string, string> = {
      canada: 'CA',
      cameroon: 'CM',
      'united states': 'US',
      'united states of america': 'US',
    };
    return map[value.toLowerCase()] ?? value.slice(0, 2).toUpperCase();
  }

  addressFromRecord(address: {
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }): StripeTaxCustomerAddress | null {
    const country = this.normalizeCountryCode(address.country);
    if (!country) return null;
    return {
      line1: address.address_line_1,
      line2: address.address_line_2 ?? undefined,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country,
    };
  }
}
