import { ConfigService } from '@nestjs/config';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from './stripe-tax.constants';

describe('StripeTaxCheckoutBuilderService', () => {
  const configService = {
    get: () => ({
      taxEnabled: true,
      taxCountries: ['CA'],
    }),
  } as unknown as ConfigService;

  const service = new StripeTaxCheckoutBuilderService(configService);

  it('builds itemized product lines with default tax code (no delivery line item)', () => {
    const lines = service.buildLineItems({
      currency: 'CAD',
      orderItems: [
        { name: 'Widget', unitPrice: 10, quantity: 2, taxCode: null },
      ],
      deliveryFee: 5,
      discountAmount: 0,
      customerAddress: {
        line1: '1 Main',
        city: 'Toronto',
        state: 'ON',
        postal_code: 'M5V 2T6',
        country: 'CA',
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].taxCode).toBe(STRIPE_TAX_CODE_GENERAL_TANGIBLE);
    expect(lines[0].unitAmount).toBe(1000);
  });

  it('builds shipping cost for Stripe Tax API', () => {
    const shipping = service.buildShippingCostForTax(5, 'CAD');
    expect(shipping).toEqual({ amount: 500, taxCode: 'txcd_92010001' });
    expect(service.buildShippingCostForTax(0, 'CAD')).toBeNull();
  });

  it('applies proportional discount across item lines', () => {
    const lines = service.buildLineItems({
      currency: 'CAD',
      orderItems: [{ name: 'A', unitPrice: 100, quantity: 1, taxCode: 'txcd_99999999' }],
      deliveryFee: 0,
      discountAmount: 10,
      customerAddress: null,
    });
    expect(lines[0].unitAmount).toBe(9000);
  });

  it('normalizes Canada country name', () => {
    expect(service.normalizeCountryCode('Canada')).toBe('CA');
  });

  it('detects tax-enabled country when configured', () => {
    expect(service.isTaxEnabledForCountry('CA')).toBe(true);
    expect(service.isTaxEnabledForCountry('CM')).toBe(false);
  });
});
