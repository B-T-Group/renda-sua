/**
 * Routing and validation rules through the real MobilePaymentsService,
 * MobilePaymentsController and OrdersService code. Only the FedaPay SDK,
 * Hasura and the MyPVit HTTP wrapper are faked.
 */
import { HttpException, Logger } from '@nestjs/common';
import { Transaction } from 'fedapay';
import { OrdersService } from '../orders/orders.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

function realMps(overrides: { hasura?: any; mypvit?: any } = {}) {
  const fedapay = new FedaPayService(
    {
      get: (key: string) =>
        key === 'fedapay'
          ? { secretKey: 'sk_sandbox_test', environment: 'sandbox', mockEnabled: false }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  const hasura = overrides.hasura ?? {
    executeQuery: jest.fn(async (q: string) =>
      q.includes('CheckFedaPayActive') ? { supported_payment_systems: [{ active: true }] } : {}
    ),
  };
  const mypvit = overrides.mypvit ?? { testConnection: jest.fn().mockResolvedValue(true) };
  const freemopay = { testConnection: jest.fn().mockResolvedValue(true) };
  jest.spyOn(fedapay, 'testConnection').mockResolvedValue(true);
  const mps = new MobilePaymentsService(
    mypvit as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    freemopay as any,
    fedapay,
    hasura as any
  );
  return { mps, hasura, mypvit };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('F-M5: GA airtel/moov rows are served by MyPVit', () => {
  it.each(['airtel', 'moov', 'AIRTEL'])('supported_payment_systems row "%s" for GA lists MyPVit', async (name) => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        supported_payment_systems: [{ name, country: 'GA', active: true }],
      }),
    };
    const { mps } = realMps({ hasura });
    const providers = await mps.getProvidersForCountry('GA');
    expect(providers.map((p) => p.name)).toEqual(['MyPVit']);
  });
});

describe('Service FedaPay TG check (validatePaymentRequest)', () => {
  it('a non-Togo phone with the fedapay hint is refused with the Togo message', async () => {
    const { mps } = realMps();
    const res = await mps.validatePaymentRequest({
      customerPhone: '+237650123456',
      provider: 'fedapay',
      currency: 'XOF',
      amount: 1000,
    });
    expect(res).toEqual({
      success: false,
      message: 'FedaPay requires a Togo (+228) phone number',
      errorCode: 'INVALID_PHONE_NUMBER',
    });
  });

  it('a valid Togo phone passes', async () => {
    const { mps } = realMps();
    await expect(
      mps.validatePaymentRequest({ customerPhone: '+22890123456', provider: 'fedapay', currency: 'XOF', amount: 1000 })
    ).resolves.toBeNull();
  });
});

describe('409/422 are FedaPay-only (assertProviderConfirmsCallback)', () => {
  const fedapayTx = {
    id: 'tx-f',
    transaction_id: '777',
    provider: 'fedapay',
    amount: 1000,
    currency: 'XOF',
    reference: 'REF-F',
  };

  it('FedaPay: live declined vs claimed SUCCESS -> 409', async () => {
    const { mps } = realMps();
    (Transaction.retrieve as jest.Mock).mockResolvedValue({
      id: 777, status: 'declined', amount: 1000, currency: { iso: 'XOF' }, custom_metadata: { externalId: 'REF-F' },
    });
    const err = await mps.assertProviderConfirmsCallback(fedapayTx, 'SUCCESS').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(409);
  });

  it('FedaPay: live currency XAF -> 422', async () => {
    const { mps } = realMps();
    (Transaction.retrieve as jest.Mock).mockResolvedValue({
      id: 777, status: 'approved', amount: 1000, currency: { iso: 'XAF' }, custom_metadata: { externalId: 'REF-F' },
    });
    const err = await mps.assertProviderConfirmsCallback(fedapayTx, 'SUCCESS').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(422);
  });

  it('MyPVit: the same definite mismatch is a plain (5xx, retried) error, not a 409', async () => {
    const mypvit = {
      testConnection: jest.fn().mockResolvedValue(true),
      checkTransactionStatus: jest.fn().mockResolvedValue({
        transactionId: 'pv-1', status: 'FAILED', amount: 1000, currency: 'XAF', reference: 'REF-M',
      }),
    };
    const { mps } = realMps({ mypvit });
    const err = await mps
      .assertProviderConfirmsCallback(
        { id: 'tx-m', transaction_id: 'pv-1', provider: 'mypvit', customer_phone: '+24177123456', amount: 1000, currency: 'XAF', reference: 'REF-M' },
        'SUCCESS'
      )
      .catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(HttpException);
  });
});

describe('OrdersService validates before creating the payment row', () => {
  it('invalid phone for FedaPay -> 400, no transaction row, no provider call', async () => {
    const { mps } = realMps();
    const initiate = jest.spyOn(mps, 'initiatePayment');
    const database = { createTransaction: jest.fn(), updateTransaction: jest.fn() };
    const orders = Object.assign(Object.create(OrdersService.prototype), {
      logger: new Logger('OrdersService'),
      mobilePaymentsService: mps,
      mobilePaymentsDatabaseService: database,
    });

    const err = await orders
      .initiateMomoForCreatedOrder({
        orderNumber: 'ORD-V',
        totalAmount: 5000,
        currency: 'XOF',
        accountId: 'acct-1',
        phoneNumber: '+237650123456',
        provider: 'fedapay',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(400);
    expect(database.createTransaction).not.toHaveBeenCalled();
    expect(initiate).not.toHaveBeenCalled();
  });
});

describe('Controller phone region comes from the resolved provider; item country is ISO-normalized', () => {
  function controller() {
    const database = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'db-1' }),
      updateTransaction: jest.fn(),
    };
    const mps = {
      resolveProviderFromRequest: jest.fn(async (r: any) => r.provider),
      initiatePayment: jest.fn().mockResolvedValue({ success: true, transactionId: '1' }),
      scheduleMockCallback: jest.fn(),
    };
    const c = new MobilePaymentsController(
      mps as never,
      database as never,
      {} as never,
      {} as never,
      { getUser: jest.fn().mockResolvedValue({ id: 'u' }) } as never,
      {} as never,
      {} as never,
      {} as never,
      { canView: jest.fn().mockResolvedValue(true) } as never,
      { get: jest.fn().mockReturnValue(false) } as never
    );
    return { c, database };
  }
  const run = (c: MobilePaymentsController, body: Record<string, unknown>) =>
    c.initiatePayment({ user: { id: 'u' } } as never, { amount: 1000, transactionType: 'PAYMENT', ...body } as any);

  it.each([
    ['fedapay', '90123456', 'XOF'],
    ['freemopay', '650123456', 'XAF'],
  ])('%s accepts a national-format number %s (parsed in the provider region)', async (provider, phone, currency) => {
    const { c, database } = controller();
    await run(c, { provider, customerPhone: phone, currency });
    expect(database.createTransaction).toHaveBeenCalled();
  });

  it('item country "Togo" is normalized to TG and matches a +228 payer', async () => {
    const { c, database } = controller();
    await run(c, { provider: 'fedapay', customerPhone: '+22890123456', currency: 'XOF', itemCountry: 'Togo' });
    expect(database.createTransaction).toHaveBeenCalled();
  });

  it('item country "Cameroon" vs a +228 payer -> 400 PHONE_COUNTRY_MISMATCH, no row', async () => {
    const { c, database } = controller();
    const err = await run(c, {
      provider: 'fedapay',
      customerPhone: '+22890123456',
      currency: 'XOF',
      itemCountry: 'Cameroon',
    }).catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(400);
    expect(((err as HttpException).getResponse() as any).error).toBe('PHONE_COUNTRY_MISMATCH');
    expect(database.createTransaction).not.toHaveBeenCalled();
  });
});
