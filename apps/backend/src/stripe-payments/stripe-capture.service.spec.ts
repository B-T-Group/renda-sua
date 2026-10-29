import type { StripePaymentTransaction } from './stripe-payments-database.service';
import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  const now = new Date('2026-07-06T10:00:00.000Z');
  let config: {
    manualCaptureEnabled: boolean;
    manualCaptureCountries?: string[];
  };
  let service: StripeCaptureService;
  let stripeService: {
    capturePaymentIntent: jest.Mock;
    cancelPaymentIntent: jest.Mock;
    retrievePaymentIntent: jest.Mock;
    expireCheckoutSession: jest.Mock;
  };
  let databaseService: {
    getTransactionByEntityId: jest.Mock;
    updateTransaction: jest.Mock;
  };
  let accountsService: {
    registerDepositIfNotExists: jest.Mock;
  };
  let orderTaxLifecycle: {
    finalizeAfterCapture: jest.Mock;
    voidForOrder: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    config = { manualCaptureEnabled: true, manualCaptureCountries: ['CA'] };
    stripeService = {
      capturePaymentIntent: jest.fn(),
      cancelPaymentIntent: jest.fn(),
      retrievePaymentIntent: jest.fn(),
      expireCheckoutSession: jest.fn(),
    };
    databaseService = {
      getTransactionByEntityId: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = {
      registerDepositIfNotExists: jest.fn(),
    };
    orderTaxLifecycle = {
      finalizeAfterCapture: jest.fn().mockResolvedValue(undefined),
      voidForOrder: jest.fn().mockResolvedValue(undefined),
    };
    service = new StripeCaptureService(
      stripeService as never,
      databaseService as never,
      { get: jest.fn(() => config) } as never,
      accountsService as never,
      orderTaxLifecycle as never
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeTransaction(
    overrides: Partial<StripePaymentTransaction> = {}
  ): StripePaymentTransaction {
    return {
      id: 'tx-123',
      reference: 'ORDER-1001',
      amount: 125,
      currency: 'CAD',
      status: 'authorized',
      transaction_type: 'PAYMENT',
      capture_method: 'manual',
      stripe_payment_intent_id: 'pi_123',
      account_id: 'account-123',
      payment_entity: 'order',
      entity_id: 'ORDER-1001',
      created_at: '2026-07-06T09:00:00.000Z',
      updated_at: '2026-07-06T09:00:00.000Z',
      ...overrides,
    };
  }

  it('resolves manual capture only for configured countries', () => {
    expect(service.resolveCaptureMethodForOrderEntity(' ca ')).toBe('manual');
    expect(service.resolveCaptureMethodForOrderEntity('CM')).toBe('automatic');

    config.manualCaptureCountries = [];
    expect(service.resolveCaptureMethodForOrderEntity('CM')).toBe('manual');

    config.manualCaptureEnabled = false;
    expect(service.resolveCaptureMethodForOrderEntity('CA')).toBe('automatic');
  });

  it('always uses manual capture for pickup and shipping', () => {
    config.manualCaptureEnabled = false;
    expect(service.resolveCaptureMethodForOrderEntity('CM', 'pickup')).toBe(
      'manual'
    );
    expect(service.resolveCaptureMethodForOrderEntity('CM', 'shipping')).toBe(
      'manual'
    );
  });

  it('captures an authorized manual transaction and records the capture time', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      undefined
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'success', captured_at: now.toISOString() }
    );
  });

  it('persists partial captureAmount so wallet credit matches Stripe charge', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'requires_capture',
      amount: 12500,
    });
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      { amount: 100, currency: 'CAD' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending', amount: 100 }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'success', captured_at: now.toISOString(), amount: 100 }
    );
  });

  it('persists partial amount when syncing an already captured PaymentIntent', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
      amount_received: 10000,
    });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({
      success: true,
      message: 'Already captured on Stripe',
      captured: true,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      captured_at: now.toISOString(),
      amount: 100,
    });
  });

  it('does not overwrite amount when Stripe already captured the full charge', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
      amount_received: 12500,
    });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({
      success: true,
      message: 'Already captured on Stripe',
      captured: true,
    });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      captured_at: now.toISOString(),
    });
  });

  it('scales a pre-tax captureAmount when Stripe Tax increased the authorization', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'requires_capture',
      amount: 14125,
    });
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 125,
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      { amount: 141.25, currency: 'CAD' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending', amount: 125 }
    );
  });

  it('scales a waived-fee captureAmount to keep tax on the remaining goods', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'requires_capture',
      amount: 14125,
    });
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      { amount: 113, currency: 'CAD' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'success', captured_at: now.toISOString(), amount: 100 }
    );
  });

  it('credits wallet using the persisted (possibly partial) transaction amount', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'success', amount: 100 })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });

    await expect(
      service.creditWalletForCapturedOrder('ORDER-1001')
    ).resolves.toBe('account-123');

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-123',
        amount: 100,
        referenceId: 'tx-123',
        skipCashAdvanceRepayment: true,
      })
    );
  });

  it('skips a second wallet credit when the webhook already deposited', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'success', amount: 125 })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: true,
    });

    await expect(
      service.creditWalletForCapturedOrder('ORDER-1001')
    ).resolves.toBe('account-123');

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-123',
        amount: 125,
        referenceId: 'tx-123',
        skipCashAdvanceRepayment: true,
      })
    );
  });

  it('restores authorization status when Stripe capture fails', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.capturePaymentIntent.mockRejectedValue(new Error('Stripe down'));

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: false, message: 'Stripe down' });

    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'authorized', error_message: 'Stripe down' }
    );
  });

  it('does not call Stripe capture for automatic capture transactions', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ capture_method: 'automatic', status: 'pending' })
    );

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Automatic capture order',
      captured: true,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('cancels eligible authorizations and records cancellation before Stripe call', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'capture_pending' })
    );
    stripeService.cancelPaymentIntent.mockResolvedValue({ id: 'pi_123' });

    await expect(
      service.cancelOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: true });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'cancelled',
      error_message: 'Payment authorization cancelled',
    });
    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'cancel_order-id-123'
    );
  });

  it('blocks cancellation after capture so callers use refunds instead', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'success' })
    );
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
    });

    await expect(
      service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
    ).resolves.toEqual({
      success: false,
      message: 'Payment already captured; use refund',
    });

    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('expires an open checkout session when the PaymentIntent does not exist yet', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({
        status: 'pending',
        stripe_payment_intent_id: undefined,
        stripe_session_id: 'cs_123',
      })
    );
    stripeService.expireCheckoutSession.mockResolvedValue({ id: 'cs_123' });

    await expect(
      service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
    ).resolves.toEqual({ success: true });

    expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith('cs_123');
    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'cancelled',
      error_message: 'Checkout session expired on order cancellation',
    });
  });

  describe('#627: Stripe says the PaymentIntent is already canceled', () => {
    const alreadyCanceled = (shape: 'object' | 'raw' | 'message') => {
      const e: any = new Error(
        'You cannot cancel this PaymentIntent because it has a status of canceled.'
      );
      if (shape === 'object') {
        e.code = 'payment_intent_unexpected_state';
        e.payment_intent = { status: 'canceled' };
      } else if (shape === 'raw') {
        e.raw = { code: 'payment_intent_unexpected_state', payment_intent: { status: 'canceled' } };
      } else {
        e.code = 'payment_intent_unexpected_state';
      }
      return e;
    };

    it.each(['object', 'raw', 'message'] as const)('treated as success (%s), row stays cancelled', async (shape) => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction({ status: 'authorized' }));
      databaseService.updateTransaction.mockClear();
      stripeService.cancelPaymentIntent.mockRejectedValue(alreadyCanceled(shape));
      await expect(
        service.cancelOrderPaymentIntent({ orderId: 'order-id-123', orderNumber: 'ORDER-1001' })
      ).resolves.toEqual({ success: true, skipped: true, message: 'Already canceled' });
      expect(databaseService.updateTransaction).toHaveBeenCalledTimes(1);
      expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', expect.objectContaining({ status: 'cancelled' }));
    });

    it.each([
      ['another unexpected state', { code: 'payment_intent_unexpected_state', payment_intent: { status: 'succeeded' } }],
      ['another error code', { code: 'card_declined', payment_intent: { status: 'canceled' } }],
      ['a network error', { message: 'socket hang up' }],
    ])('%s is still a failure and restores the row', async (_n, fields) => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction({ status: 'authorized' }));
      databaseService.updateTransaction.mockClear();
      stripeService.cancelPaymentIntent.mockRejectedValue(Object.assign(new Error((fields as any).message ?? 'x'), fields));
      const res = await service.cancelOrderPaymentIntent({ orderId: 'order-id-123', orderNumber: 'ORDER-1001' });
      expect(res.success).toBe(false);
      expect(databaseService.updateTransaction).toHaveBeenLastCalledWith('tx-123', expect.objectContaining({ status: 'authorized' }));
    });
  });

  describe('order tax snapshot lifecycle', () => {
    const capture = () =>
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      });

    it('finalizes the tax snapshot after our own capture (webhook returns early on success)', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
      const pi = {
        id: 'pi_123',
        status: 'succeeded',
        amount_received: 11300,
        metadata: { stripe_tax_calculation_id: 'taxcalc_1' },
      };
      stripeService.capturePaymentIntent.mockResolvedValue(pi);

      await expect(capture()).resolves.toEqual({ success: true, captured: true });

      expect(orderTaxLifecycle.finalizeAfterCapture).toHaveBeenCalledWith({
        orderNumber: 'ORDER-1001',
        paymentIntent: pi,
      });
      // ...after the transaction row was marked success.
      const successOrder = databaseService.updateTransaction.mock.invocationCallOrder[1];
      expect(orderTaxLifecycle.finalizeAfterCapture.mock.invocationCallOrder[0]).toBeGreaterThan(
        successOrder
      );
    });

    it('does not change the transaction amount or capture amount because of tax finalization', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
      stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });
      await capture();
      expect(databaseService.updateTransaction.mock.calls.map((c) => c[1])).toEqual([
        { status: 'capture_pending' },
        { status: 'success', captured_at: now.toISOString() },
      ]);
      expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
        'pi_123',
        'capture_order-id-123',
        undefined
      );
    });

    it('still reports a successful capture when tax finalization throws', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
      stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });
      orderTaxLifecycle.finalizeAfterCapture.mockRejectedValue(new Error('hasura down'));
      await expect(capture()).resolves.toEqual({ success: true, captured: true });
    });

    it('does not finalize when the capture fails or is only initiated', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
      stripeService.capturePaymentIntent.mockRejectedValueOnce(new Error('card_declined'));
      await capture();
      stripeService.capturePaymentIntent.mockResolvedValueOnce({ status: 'processing' });
      await capture();
      expect(orderTaxLifecycle.finalizeAfterCapture).not.toHaveBeenCalled();
    });

    it('finalizes when Stripe had already captured the PaymentIntent', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
      const pi = { id: 'pi_123', status: 'succeeded', amount_received: 12500 };
      stripeService.retrievePaymentIntent.mockResolvedValue(pi);
      await capture();
      expect(orderTaxLifecycle.finalizeAfterCapture).toHaveBeenCalledWith({
        orderNumber: 'ORDER-1001',
        paymentIntent: pi,
      });
    });

    it('voids the estimated tax when the authorization is cancelled', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'authorized' })
      );
      stripeService.cancelPaymentIntent.mockResolvedValue({ id: 'pi_123' });
      await service.cancelOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      });
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    it('voids when a never-paid checkout session is cancelled', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({
          status: 'pending',
          stripe_payment_intent_id: undefined,
          stripe_session_id: 'cs_123',
        })
      );
      await service.cancelOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      });
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    it('never voids a captured order and does not void when the cancel fails', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      stripeService.retrievePaymentIntent.mockResolvedValue({ status: 'succeeded' });
      await service.cancelOrderPaymentIntent({ orderId: 'o', orderNumber: 'ORDER-1001' });

      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'authorized' })
      );
      stripeService.cancelPaymentIntent.mockRejectedValue(new Error('network'));
      await service.cancelOrderPaymentIntent({ orderId: 'o', orderNumber: 'ORDER-1001' });
      expect(orderTaxLifecycle.voidForOrder).not.toHaveBeenCalled();
    });

    it('a failing void never fails the cancel', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'authorized' })
      );
      stripeService.cancelPaymentIntent.mockResolvedValue({ id: 'pi_123' });
      orderTaxLifecycle.voidForOrder.mockRejectedValue(new Error('boom'));
      await expect(
        service.cancelOrderPaymentIntent({ orderId: 'o', orderNumber: 'ORDER-1001' })
      ).resolves.toEqual({ success: true });
    });

    it('voids tax when Stripe says the PaymentIntent is already canceled', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'authorized' })
      );
      const error: any = new Error(
        'You cannot cancel this PaymentIntent because it has a status of canceled.'
      );
      error.code = 'payment_intent_unexpected_state';
      error.payment_intent = { status: 'canceled' };
      stripeService.cancelPaymentIntent.mockRejectedValue(error);

      await expect(
        service.cancelOrderPaymentIntent({
          orderId: 'order-id-123',
          orderNumber: 'ORDER-1001',
        })
      ).resolves.toEqual({
        success: true,
        skipped: true,
        message: 'Already canceled',
      });
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    it.each(['cancelled', 'expired'] as const)(
      'a %s row is not sent to Stripe again, but the tax estimate is still voided',
      async (status) => {
        databaseService.getTransactionByEntityId.mockResolvedValue(
          makeTransaction({ status })
        );
        await expect(
          service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
        ).resolves.toEqual({
          success: true,
          skipped: true,
          message: `Status is ${status}`,
        });
        expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
        expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledTimes(1);
        expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
      }
    );

    it('does not void tax for a skipped status that was never an open estimate', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'refunded' })
      );
      await expect(
        service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
      ).resolves.toMatchObject({ success: true, skipped: true });
      expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(orderTaxLifecycle.voidForOrder).not.toHaveBeenCalled();
    });

    it('voids tax when the row says captured but Stripe has already canceled the PaymentIntent', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      stripeService.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_123',
        status: 'canceled',
      });
      await expect(
        service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
      ).resolves.toEqual({
        success: true,
        skipped: true,
        message: 'Already canceled',
      });
      expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
        status: 'cancelled',
        error_message: 'PaymentIntent already canceled on Stripe',
      });
      expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    it('releases a success-marked authorization Stripe still holds, and voids tax', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      stripeService.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_123',
        status: 'requires_capture',
      });
      stripeService.cancelPaymentIntent.mockResolvedValue({ id: 'pi_123' });
      await expect(
        service.cancelOrderPaymentIntent({
          orderId: 'order-id-123',
          orderNumber: 'ORDER-1001',
        })
      ).resolves.toEqual({ success: true });
      expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
        'pi_123',
        'cancel_order-id-123'
      );
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    it('does not void tax when a captured row cannot be re-read from Stripe', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      stripeService.retrievePaymentIntent.mockRejectedValue(new Error('stripe down'));
      await expect(
        service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
      ).resolves.toEqual({ success: false, message: 'stripe down' });
      expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(orderTaxLifecycle.voidForOrder).not.toHaveBeenCalled();
    });

    it('does not void tax when there is no PaymentIntent and checkout was not pending', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        makeTransaction({ status: 'failed', stripe_payment_intent_id: undefined })
      );
      await expect(
        service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
      ).resolves.toEqual({
        success: true,
        skipped: true,
        message: 'No Stripe payment intent',
      });
      expect(orderTaxLifecycle.voidForOrder).not.toHaveBeenCalled();
    });
  });
});
