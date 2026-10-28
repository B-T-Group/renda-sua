import { StripeTaxCalculationService } from './stripe-tax-calculation.service';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';

describe('StripeTaxCalculationService snapshot recording', () => {
  const config = { taxEnabled: true, taxCountries: ['CA'] };
  const configService = { get: () => config } as never;
  const builder = new StripeTaxCheckoutBuilderService(configService);
  const address = {
    address_line_1: '1 Main',
    city: 'Toronto',
    state: 'ON',
    postal_code: 'M5V 2T6',
    country: 'CA',
  };
  const calculation = {
    id: 'taxcalc_1',
    amount_total: 11300,
    tax_amount_exclusive: 1300,
    tax_breakdown: [],
  };
  let stripeService: { createTaxCalculation: jest.Mock };
  let taxLifecycle: { recordEstimate: jest.Mock };
  let service: StripeTaxCalculationService;

  const params = (over: Record<string, unknown> = {}) =>
    ({
      orderNumber: 'ORD-1',
      currency: 'CAD',
      orderItems: [{ name: 'Widget', unitPrice: 100, quantity: 1, taxCode: null }],
      deliveryFee: 0,
      discountAmount: 0,
      deliveryAddress: address,
      transactionId: 'tx-1',
      ...over,
    }) as never;

  beforeEach(() => {
    stripeService = { createTaxCalculation: jest.fn().mockResolvedValue(calculation) };
    taxLifecycle = { recordEstimate: jest.fn().mockResolvedValue(undefined) };
    service = new StripeTaxCalculationService(
      stripeService as never,
      builder,
      configService,
      taxLifecycle as never
    );
  });

  it('records the estimate when an orderId is supplied and returns the same numbers as before', async () => {
    const result = await service.calculateForOrder(params({ orderId: 'o-1' }));
    expect(taxLifecycle.recordEstimate).toHaveBeenCalledWith({
      orderId: 'o-1',
      currency: 'CAD',
      calculation,
    });
    expect(result).toMatchObject({ calculationId: 'taxcalc_1', amountTotal: 113, amountTax: 13 });
  });

  it('does not record without an orderId', async () => {
    await service.calculateForOrder(params());
    expect(taxLifecycle.recordEstimate).not.toHaveBeenCalled();
  });

  it('does not record for countries without tax', async () => {
    await service.calculateForOrder(
      params({ orderId: 'o-1', deliveryAddress: { ...address, country: 'GA' } })
    );
    expect(stripeService.createTaxCalculation).not.toHaveBeenCalled();
    expect(taxLifecycle.recordEstimate).not.toHaveBeenCalled();
  });
});
