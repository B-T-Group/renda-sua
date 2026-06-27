import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;
  let checkoutSessionsCreate: jest.Mock;
  let paymentIntentsCreate: jest.Mock;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue({
        secretKey: 'sk_test_123',
        apiVersion: '2024-06-20',
      }),
    } as unknown as ConfigService;

    checkoutSessionsCreate = jest.fn().mockResolvedValue({
      id: 'cs_test_123',
    } as Stripe.Checkout.Session);
    paymentIntentsCreate = jest.fn().mockResolvedValue({
      id: 'pi_test_123',
    } as Stripe.PaymentIntent);

    service = new StripeService(configService);
    (service as any).client = {
      checkout: { sessions: { create: checkoutSessionsCreate } },
      paymentIntents: { create: paymentIntentsCreate },
    };
  });

  it('creates Checkout sessions with decimal currency minor units', async () => {
    await service.createCheckoutSession({
      amount: 12.34,
      currency: 'USD',
      description: 'Order payment',
      reference: 'ref-123',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
      metadata: { paymentEntity: 'order', entityId: 'order-123' },
    });

    const [payload, options] = checkoutSessionsCreate.mock.calls[0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(1234);
    expect(payload.line_items[0].price_data.currency).toBe('usd');
    expect(payload.metadata).toEqual({
      reference: 'ref-123',
      paymentEntity: 'order',
      entityId: 'order-123',
    });
    expect(options).toEqual({ idempotencyKey: 'checkout_ref-123' });
  });

  it('keeps zero-decimal currency amounts in major units', async () => {
    await service.createCheckoutSession({
      amount: 1500.4,
      currency: 'XAF',
      description: 'Order payment',
      reference: 'ref-xaf',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    });

    const [payload] = checkoutSessionsCreate.mock.calls[0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(1500);
    expect(payload.line_items[0].price_data.currency).toBe('xaf');
  });

  it('creates PaymentIntents with metadata and idempotency keys', async () => {
    await service.createPaymentIntent({
      amount: 42.5,
      currency: 'CAD',
      description: 'Native order payment',
      reference: 'ref-pi',
      customerEmail: 'client@example.com',
      metadata: { paymentEntity: 'order', entityId: 'order-456' },
    });

    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      {
        amount: 4250,
        currency: 'cad',
        description: 'Native order payment',
        receipt_email: 'client@example.com',
        automatic_payment_methods: { enabled: true },
        metadata: {
          reference: 'ref-pi',
          paymentEntity: 'order',
          entityId: 'order-456',
        },
      },
      { idempotencyKey: 'pi_ref-pi' }
    );
  });
});
