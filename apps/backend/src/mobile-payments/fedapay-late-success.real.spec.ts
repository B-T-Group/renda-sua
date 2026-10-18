/**
 * F3 / S1 / S4 against the real stack: MobilePaymentCallbackProcessor ->
 * MobilePaymentsService.assertProviderConfirmsCallback -> FedaPayService ->
 * FedaPay SDK. Only the FedaPay SDK is mocked. The database and the ledger are
 * small in-memory fakes that enforce status CAS and idempotency keys, so replays
 * behave like production.
 */
import { HttpException, Logger } from '@nestjs/common';
import { Transaction } from 'fedapay';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

type Row = Record<string, any>;

function makeDb(rows: Row[]) {
  const byId = new Map<string, Row>(rows.map((r) => [r.id, { ...r }]));
  const find = (pred: (r: Row) => boolean) => {
    for (const r of byId.values()) if (pred(r)) return { ...r };
    return null;
  };
  return {
    byId,
    getTransactionByTransactionId: jest.fn(async (k: string) =>
      find((r) => r.transaction_id === k)
    ),
    getTransactionByReference: jest.fn(async (k: string) =>
      find((r) => r.reference === k)
    ),
    getTransactionById: jest.fn(async (id: string) =>
      byId.has(id) ? { ...byId.get(id) } : null
    ),
    logCallback: jest.fn(async () => undefined),
    updateTransaction: jest.fn(async (id: string, patch: Row) => {
      Object.assign(byId.get(id) as Row, patch);
    }),
    updateTransactionIfStatus: jest.fn(
      async (id: string, from: string, patch: Row) => {
        const r = byId.get(id);
        if (!r || r.status !== from) return false;
        Object.assign(r, patch);
        return true;
      }
    ),
  };
}

function makeLedger() {
  const deposits: Row[] = [];
  return {
    deposits,
    registerDepositIfNotExists: jest.fn(async (args: Row) => {
      if (deposits.some((d) => d.idempotencyKey === args.idempotencyKey)) {
        return { success: true, alreadyExists: true };
      }
      deposits.push(args);
      return { success: true, alreadyExists: false };
    }),
  };
}

function liveFedaPayTx(over: Row = {}) {
  return {
    id: 777,
    status: 'approved',
    amount: 8000,
    currency: { iso: 'XOF' },
    custom_metadata: { externalId: 'ORD1-REF' },
    ...over,
  };
}

function approved(over: Row = {}) {
  return {
    name: 'transaction.approved',
    entity: {
      id: 777,
      status: 'approved',
      amount: 8000,
      currency: 'XOF',
      reference: 'trx_777',
      custom_metadata: { externalId: 'ORD1-REF' },
      ...over,
    },
  } as any;
}

const failedOrderRow = (over: Row = {}): Row => ({
  id: 'tx-order',
  reference: 'ORD1-REF',
  transaction_id: '777',
  status: 'failed',
  transaction_type: 'PAYMENT',
  payment_entity: 'order',
  entity_id: 'ORD1',
  amount: 8000,
  currency: 'XOF',
  account_id: 'acct-client',
  provider: 'fedapay',
  customer_phone: '+22890123456',
  updated_at: '2026-10-17T10:00:00.000Z',
  ...over,
});

function build(rows: Row[]) {
  const db = makeDb(rows);
  const ledger = makeLedger();
  const calls: string[] = [];
  const handler = {
    supportsPaymentEntity: (e: string) => e === 'order',
    onPaymentSuccess: jest.fn(async (tx: Row) => {
      calls.push(`handler:${tx.status}`);
    }),
    onPaymentFailure: jest.fn(),
    onLateSuccessAfterSupersede: jest.fn(async () => 'applied' as const),
  };
  const registry = { getHandlers: jest.fn(() => [handler]) };
  const fedapay = new FedaPayService(
    {
      get: (key: string) =>
        key === 'fedapay'
          ? { secretKey: 'sk_sandbox_test', environment: 'sandbox', mockEnabled: false }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  const hasura = { executeQuery: jest.fn(async () => ({})) };
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
  const processor = new MobilePaymentCallbackProcessor(
    db as any,
    ledger as any,
    registry as any,
    mps,
    { get: jest.fn(() => fedapay) } as any
  );
  (Transaction.retrieve as jest.Mock).mockImplementation(async () => {
    calls.push('live-retrieve');
    return liveFedaPayTx();
  });
  db.updateTransactionIfStatus.mockImplementation(
    async (id: string, from: string, patch: Row) => {
      calls.push(`cas:${from}->${patch.status}`);
      const r = db.byId.get(id);
      if (!r || r.status !== from) return false;
      Object.assign(r, patch);
      return true;
    }
  );
  ledger.registerDepositIfNotExists.mockImplementation(async (args: Row) => {
    calls.push(`deposit:${args.idempotencyKey}`);
    if (ledger.deposits.some((d) => d.idempotencyKey === args.idempotencyKey)) {
      return { success: true, alreadyExists: true };
    }
    ledger.deposits.push(args);
    return { success: true, alreadyExists: false };
  });
  return { db, ledger, handler, processor, calls };
}

const anomalyTypes = () =>
  (reportMoneyAnomaly as jest.Mock).mock.calls.map((c) => c[1]);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

describe('S1 order late success (real processor + live FedaPay re-check)', () => {
  it('routes a superseded (PROVIDER_TERMINAL_ON_RETRY) failed order row to the #545 recovery path', async () => {
    const row = failedOrderRow({ error_code: 'PROVIDER_TERMINAL_ON_RETRY' });
    const { db, ledger, handler, processor } = build([row]);

    await processor.processFedaPayCallback(approved());

    expect(Transaction.retrieve).toHaveBeenCalledWith(777, { include: 'currency' });
    expect(ledger.deposits).toEqual([
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-order', amount: 8000 }),
    ]);
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' })
    );
  });

  it('plain declined->approved order: live re-check, CAS, credit, THEN apply; replay applies nothing twice', async () => {
    const { db, ledger, handler, processor, calls } = build([failedOrderRow()]);

    await processor.processFedaPayCallback(approved());

    expect(calls).toEqual([
      'live-retrieve',
      'cas:failed->processing',
      'deposit:momo-deposit:tx-order',
      'cas:processing->success',
      'handler:success',
    ]);
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({
        status: 'success',
        error_code: 'LATE_SUCCESS_APPLIED',
        transaction_id: '777',
      })
    );
    expect(anomalyTypes()).toContain('late_success_order_credited');

    // FedaPay replays the same approved webhook.
    calls.length = 0;
    await processor.processFedaPayCallback(approved());

    // The late-success claim is not taken again and the wallet is not credited twice.
    expect(calls).not.toContain('cas:failed->processing');
    expect(ledger.deposits).toHaveLength(1);
    expect(handler.onPaymentSuccess.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: 'tx-order', status: 'success' })
    );
  });

  it('decides on the LIVE record: callback body says 8000 XOF but live amount is 9000 -> 409, nothing credited or applied', async () => {
    const { db, ledger, handler, processor } = build([failedOrderRow()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveFedaPayTx({ amount: 9000 }));

    const err = await processor.processFedaPayCallback(approved()).catch((e) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(409);
    expect(ledger.deposits).toHaveLength(0);
    expect(handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(db.byId.get('tx-order')?.status).toBe('failed');
    expect(anomalyTypes()).toContain('late_success_order_live_mismatch');
  });

  it('ignores a lying callback body when the live record confirms (body amount/currency are not trusted)', async () => {
    const { ledger, handler, processor } = build([failedOrderRow()]);

    await processor.processFedaPayCallback(
      approved({ amount: 1, currency: 'XAF' })
    );

    expect(ledger.deposits).toEqual([
      expect.objectContaining({ amount: 8000, idempotencyKey: 'momo-deposit:tx-order' }),
    ]);
    expect(handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
  });

  it('live status declined -> 409, row stays failed', async () => {
    const { db, ledger, processor } = build([failedOrderRow()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveFedaPayTx({ status: 'declined' }));

    const err = await processor.processFedaPayCallback(approved()).catch((e) => e);

    expect((err as HttpException).getStatus()).toBe(409);
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-order')?.status).toBe('failed');
  });

  it('order handler failure keeps the money in the wallet, puts the row back to processing and rethrows for retry', async () => {
    const { db, ledger, handler, processor } = build([failedOrderRow()]);
    handler.onPaymentSuccess.mockRejectedValueOnce(new Error('order cancelled meanwhile'));

    await expect(processor.processFedaPayCallback(approved())).rejects.toThrow(
      /will retry/
    );

    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-order')?.status).toBe('processing');
  });
});

describe('S1 top-up late success (real processor + live FedaPay re-check)', () => {
  const failedTopUp = (over: Row = {}): Row =>
    failedOrderRow({
      id: 'tx-topup',
      reference: 'TOPUP-REF',
      payment_entity: null,
      entity_id: null,
      amount: 5000,
      ...over,
    });

  it('credits once with momo-deposit:<tx id> after the live re-check and CAS; replay does not double-credit', async () => {
    const { db, ledger, processor, calls } = build([failedTopUp()]);
    (Transaction.retrieve as jest.Mock).mockImplementation(async () => {
      calls.push('live-retrieve');
      return liveFedaPayTx({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } });
    });
    const cb = approved({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } });

    await processor.processFedaPayCallback(cb);
    await processor.processFedaPayCallback(cb);

    expect(calls.slice(0, 3)).toEqual([
      'live-retrieve',
      'cas:failed->processing',
      'deposit:momo-deposit:tx-topup',
    ]);
    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-topup')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' })
    );
    expect(db.logCallback).toHaveBeenCalledTimes(2);
    expect(anomalyTypes()).toContain('late_success_wallet_credited');
  });

  it('live currency XAF -> 422, nothing credited, anomaly raised', async () => {
    const { db, ledger, processor } = build([failedTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(
      liveFedaPayTx({ amount: 5000, currency: { iso: 'XAF' }, custom_metadata: { externalId: 'TOPUP-REF' } })
    );

    const err = await processor
      .processFedaPayCallback(approved({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } }))
      .catch((e) => e);

    expect((err as HttpException).getStatus()).toBe(422);
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-topup')?.status).toBe('failed');
    expect(anomalyTypes()).toContain('late_success_top_up_live_mismatch');
  });
});

describe('S4 expiry (real processor + live FedaPay re-check)', () => {
  const pendingTopUp = (): Row =>
    failedOrderRow({
      id: 'tx-pending',
      reference: 'EXP-REF',
      status: 'pending',
      payment_entity: null,
      entity_id: null,
      amount: 2000,
    });
  const expiredEvent = (name: string) =>
    ({
      name,
      entity: {
        id: 777,
        status: 'expired',
        amount: 2000,
        reference: 'trx_777',
        custom_metadata: { externalId: 'EXP-REF' },
      },
    }) as any;

  it.each(['transaction.expired', 'transaction.updated'])(
    '%s with status expired is terminal: FAILED live re-check, then the row fails',
    async (name) => {
      const { db, processor } = build([pendingTopUp()]);
      (Transaction.retrieve as jest.Mock).mockResolvedValue(
        liveFedaPayTx({ status: 'expired', amount: 2000, custom_metadata: { externalId: 'EXP-REF' } })
      );

      await processor.processFedaPayCallback(expiredEvent(name));

      expect(Transaction.retrieve).toHaveBeenCalledWith(777, { include: 'currency' });
      expect(db.byId.get('tx-pending')?.status).toBe('failed');
    }
  );

  it('rejects the expiry when the live record says approved (409) and leaves the row pending', async () => {
    const { db, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(
      liveFedaPayTx({ status: 'approved', amount: 2000, custom_metadata: { externalId: 'EXP-REF' } })
    );

    const err = await processor
      .processFedaPayCallback(expiredEvent('transaction.expired'))
      .catch((e) => e);

    expect((err as HttpException).getStatus()).toBe(409);
    expect(db.byId.get('tx-pending')?.status).toBe('pending');
  });

  it('transaction.updated with a non-expired status stays a no-op', async () => {
    const { db, processor } = build([pendingTopUp()]);

    await processor.processFedaPayCallback({
      ...expiredEvent('transaction.updated'),
      entity: { ...expiredEvent('transaction.updated').entity, status: 'approved' },
    });

    expect(Transaction.retrieve).not.toHaveBeenCalled();
    expect(db.byId.get('tx-pending')?.status).toBe('pending');
  });
});
