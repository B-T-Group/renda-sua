/**
 * S2 (payer/payee number format) and S3 (no provider text to clients on payout
 * failure) through the real services. Only the FedaPay SDK is mocked; Hasura and
 * the ledger are fakes at their I/O boundary.
 */
import { HttpException, Logger } from '@nestjs/common';
import { inspect } from 'util';
import { Payout, Transaction } from 'fedapay';
import { GiveChangePayoutService } from './give-change-payout.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

const SECRET = 'sk_live_LEAKED_SECRET_123';

function realStack() {
  const fedapay = new FedaPayService(
    {
      get: (key: string) =>
        key === 'fedapay'
          ? { secretKey: 'sk_sandbox_test', environment: 'sandbox', mockEnabled: false }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  const hasura = {
    executeQuery: jest.fn(async (query: string) =>
      query.includes('CheckFedaPayActive')
        ? { supported_payment_systems: [{ active: true }] }
        : {}
    ),
  };
  const mps = new MobilePaymentsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    fedapay,
    hasura as any
  );
  return { fedapay, mps };
}

let logged: unknown[][];
beforeEach(() => {
  jest.clearAllMocks();
  logged = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest
      .spyOn(Logger.prototype, level)
      .mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
  }
});
const allLogs = () => logged.map((args) => inspect(args, { depth: 10 })).join('\n');

describe('S2: FedaPay gets the bare 8-digit national number with country TG', () => {
  const inputs = ['+22890123456', '22890123456', '90123456'];

  it.each(inputs)('payer %s -> { number: "90123456", country: "TG" } on create and push', async (phone) => {
    const { mps } = realStack();
    const sendNowWithToken = jest.fn().mockResolvedValue(undefined);
    (Transaction.create as jest.Mock).mockResolvedValue({
      id: 4242,
      status: 'pending',
      generateToken: jest.fn().mockResolvedValue({ token: 'tok' }),
      sendNowWithToken,
    });

    const res = await mps.initiatePayment(
      {
        amount: 1000,
        currency: 'XOF',
        description: 'Order',
        customerPhone: phone,
        provider: 'fedapay',
        itemCountry: 'TG',
        transactionType: 'PAYMENT',
      } as any,
      'REF-S2'
    );

    expect(res.success).toBe(true);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { phone_number: { number: '90123456', country: 'TG' } },
        mode: 'togocel',
      })
    );
    expect(sendNowWithToken).toHaveBeenCalledWith('togocel', 'tok', {
      phone_number: { number: '90123456', country: 'TG' },
    });
  });

  it.each(inputs)('payee %s -> { number: "90123456", country: "TG" } on Payout.create', async (phone) => {
    const { mps } = realStack();
    (Payout.all as jest.Mock).mockResolvedValue({ payouts: [] });
    (Payout.create as jest.Mock).mockResolvedValue({
      id: 99,
      status: 'pending',
      sendNow: jest.fn().mockResolvedValue(undefined),
    });

    const res = await mps.initiatePayment(
      {
        amount: 1000,
        currency: 'XOF',
        description: 'Payout',
        customerPhone: phone,
        provider: 'fedapay',
        itemCountry: 'TG',
        transactionType: 'GIVE_CHANGE',
      } as any,
      'REF-S2-OUT'
    );

    expect(res.success).toBe(true);
    expect(Payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { phone_number: { number: '90123456', country: 'TG' } },
      })
    );
  });

  it('moov_tg prefixes are sent bare too, on the moov_tg channel', async () => {
    const { mps } = realStack();
    (Transaction.create as jest.Mock).mockResolvedValue({
      id: 4243,
      status: 'pending',
      generateToken: jest.fn().mockResolvedValue({ token: 'tok' }),
      sendNowWithToken: jest.fn().mockResolvedValue(undefined),
    });

    await mps.initiatePayment(
      {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22896123456',
        provider: 'fedapay',
        itemCountry: 'TG',
        transactionType: 'PAYMENT',
      } as any,
      'REF-MOOV'
    );

    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'moov_tg',
        customer: { phone_number: { number: '96123456', country: 'TG' } },
      })
    );
  });
});

describe('S3: a FedaPay payout failure never returns provider text', () => {
  function payoutService() {
    const { fedapay, mps } = realStack();
    const db = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'gc-tx-1', reference: 'GC-REF' }),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const accounts = {
      getAccountBalance: jest.fn().mockResolvedValue({ availableBalance: 100000, currency: 'XOF' }),
      registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true, transactionId: 'hold-1' }),
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true, transactionId: 'rel-1' }),
      registerTransaction: jest.fn(),
    };
    const service = new GiveChangePayoutService(db as any, mps, accounts as any, fedapay);
    return { service, db, accounts };
  }
  const params = {
    amount: 1000,
    currency: 'XOF',
    description: 'Withdrawal',
    customerPhone: '+22890123456',
    accountId: 'acct-1',
    provider: 'fedapay' as const,
  };
  function sdkFailsWithSecret() {
    (Payout.all as jest.Mock).mockResolvedValue({ payouts: [] });
    const sdkError: any = new Error(
      `Request failed: Authorization: Bearer ${SECRET} rejected for 22890123456`
    );
    sdkError.config = { headers: { Authorization: `Bearer ${SECRET}` } };
    (Payout.create as jest.Mock).mockRejectedValue(sdkError);
  }

  it('success:false path returns a generic message + PAYOUT_PROVIDER_ERROR; the secret is nowhere in the result', async () => {
    const { service, db, accounts } = payoutService();
    sdkFailsWithSecret();

    const result = await service.executeGiveChangePayout(params, {
      throwOnWithdrawalFailure: false,
    });

    expect(result.success).toBe(false);
    expect(result.data).toEqual(
      expect.objectContaining({
        error: 'PAYOUT_PROVIDER_ERROR',
        message: 'Failed to initiate withdrawal. Please try again or contact support.',
      })
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('Request failed');
    // Server-side record keeps the failure, the hold is released.
    expect(db.updateTransaction).toHaveBeenCalledWith(
      'gc-tx-1',
      expect.objectContaining({ status: 'failed' })
    );
    expect(accounts.registerReleaseIfNotExists).toHaveBeenCalled();
    expect(allLogs()).not.toContain(SECRET);
  });

  it('exception path (throwOnWithdrawalFailure) -> 502 generic body; secret not in the body, the row or the logs', async () => {
    const { service, db } = payoutService();
    const mps = (service as any).mobilePaymentsService;
    const thrown: any = new Error(`socket hang up Authorization: Bearer ${SECRET}`);
    thrown.stack = `Error: ${SECRET}\n    at x`;
    jest.spyOn(mps, 'initiatePayment').mockRejectedValue(thrown);

    const err = await service
      .executeGiveChangePayout(params, { throwOnWithdrawalFailure: true })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(502);
    expect((err as HttpException).getResponse()).toEqual({
      success: false,
      message: 'Failed to initiate withdrawal. Please try again or contact support.',
      error: 'PAYOUT_PROVIDER_ERROR',
    });
    expect(JSON.stringify(db.updateTransaction.mock.calls)).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
  });

  it('the controller response for the same failure carries only the generic error', async () => {
    const { service } = payoutService();
    sdkFailsWithSecret();
    const { MobilePaymentsController } = await import('./mobile-payments.controller');
    const controller = new MobilePaymentsController(
      {} as never,
      {} as never,
      {} as never,
      service as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never
    );

    // The real controller mapping that /mobile-payments/initiate (GIVE_CHANGE) returns.
    const response = await (controller as any).executeOwnedGiveChangePayout(
      { ...params, transactionType: 'GIVE_CHANGE' },
      'acct-1',
      'fedapay',
      'user-1'
    );

    expect(JSON.stringify(response)).not.toContain(SECRET);
    expect(response.success).toBe(false);
    expect(response.data?.error).toBe('PAYOUT_PROVIDER_ERROR');
    expect(response.data?.message).toBe(
      'Failed to initiate withdrawal. Please try again or contact support.'
    );
  });
});
