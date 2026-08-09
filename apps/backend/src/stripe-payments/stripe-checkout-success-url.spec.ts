import { ConfigService } from '@nestjs/config';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

describe('StripeCheckoutService success URL fulfillment', () => {
  const createTransaction = jest.fn();
  const updateTransaction = jest.fn();
  const createCheckoutSession = jest.fn();
  let service: StripeCheckoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_123);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    createTransaction.mockImplementation(async (input: { reference: string }) => ({
      id: 'tx-1',
      reference: input.reference,
    }));
    createCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/session',
    });

    service = new StripeCheckoutService(
      { createCheckoutSession } as unknown as StripeService,
      {
        createTransaction,
        updateTransaction,
      } as unknown as StripePaymentsDatabaseService,
      {
        get: jest.fn().mockReturnValue({ appBaseUrl: 'https://app.rendasua.test' }),
      } as unknown as ConfigService
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseParams = {
    amount: 5000,
    currency: 'CAD',
    description: 'Order ORD-1',
    paymentEntity: 'order' as const,
    entityId: 'ORD-1',
  };

  it('appends fulfillment=pickup for pickup orders', async () => {
    await service.createCheckout({
      ...baseParams,
      fulfillmentMethod: 'pickup',
    });

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          'https://app.rendasua.test/payment/success?reference=ST00000123yf0u&order=ORD-1&fulfillment=pickup',
      })
    );
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl:
          'https://app.rendasua.test/payment/success?reference=ST00000123yf0u&order=ORD-1&fulfillment=pickup',
      })
    );
  });

  it('omits fulfillment suffix for delivery orders', async () => {
    await service.createCheckout({
      ...baseParams,
      fulfillmentMethod: 'delivery',
    });

    const { success_url: successUrl } = createTransaction.mock.calls[0][0];
    expect(successUrl).toBe(
      'https://app.rendasua.test/payment/success?reference=ST00000123yf0u&order=ORD-1'
    );
    expect(successUrl).not.toContain('fulfillment=');
  });

  it('does not add fulfillment suffix for non-order entities', async () => {
    await service.createCheckout({
      amount: 2500,
      currency: 'CAD',
      description: 'Rental booking',
      paymentEntity: 'rental_booking',
      entityId: 'RB-9',
      bookingId: 'booking-uuid',
      fulfillmentMethod: 'pickup',
    });

    const { success_url: successUrl } = createTransaction.mock.calls[0][0];
    expect(successUrl).toContain('bookingNumber=RB-9');
    expect(successUrl).toContain('booking=booking-uuid');
    expect(successUrl).not.toContain('fulfillment=');
  });

  it('honors an explicit successUrl over generated fulfillment links', async () => {
    await service.createCheckout({
      ...baseParams,
      fulfillmentMethod: 'pickup',
      successUrl: 'https://custom.test/done',
    });

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ success_url: 'https://custom.test/done' })
    );
  });
});
