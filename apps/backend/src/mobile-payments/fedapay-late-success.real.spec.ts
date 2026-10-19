/**
 * F3 / S1 / S4 against the real stack: MobilePaymentCallbackProcessor ->
 * MobilePaymentsService.assertProviderConfirmsCallback -> FedaPayService ->
 * FedaPay SDK. Only the FedaPay SDK is mocked. The database and the ledger are
 * small in-memory fakes that enforce status CAS and idempotency keys, so replays
 * behave like production.
 *
 * Order rows go through the real OrderPaymentCallbackHandler and the real
 * OrdersService classification (handleLateSuccessOnSupersededOrderTx ->
 * classifyExtraOrderPayment -> recordDuplicateOrderPayment). Only the order lookup,
 * the (huge) finalizeOrderAfterIncomingPayment and the push notification are stubbed.
 */
import { Logger } from '@nestjs/common';
import { Transaction } from 'fedapay';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';
import { OrderPaymentCallbackHandler } from '../orders/order-payment-callback.handler';
import { OrdersService } from '../orders/orders.service';

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

function build(rows: Row[], order: Row = { order_number: 'ORD1', current_status: 'pending_payment', payment_status: 'pending' }) {
  const db = makeDb(rows);
  const ledger = makeLedger();
  const calls: string[] = [];
  const orders: any = Object.create(OrdersService.prototype);
  orders.logger = new Logger('OrdersService');
  orders.mobilePaymentsDatabaseService = {
    listOrderTransactionsByStatus: jest.fn(async (orderNumber: string, status: string) =>
      [...db.byId.values()]
        .filter((r) => r.entity_id === orderNumber && r.status === status)
        .map((r) => ({ ...r }))
    ),
    updateTransactionIfStatus: (...args: [string, string, Row]) =>
      db.updateTransactionIfStatus(...args),
    updateTransaction: (...args: [string, Row]) => db.updateTransaction(...args),
  };
  orders.notificationsService = {
    sendDuplicatePaymentCreditedPush: jest.fn(async () => undefined),
  };
  orders.requireOrderDetailsByNumber = jest.fn(async () => ({
    id: 'order-uuid',
    client: { user_id: 'user-1' },
    ...order,
  }));
  orders.finalizeOrderAfterIncomingPayment = jest.fn(async (tx: Row) => {
    calls.push(`order:finalize:${tx.id}`);
  });
  const handler = new OrderPaymentCallbackHandler(orders as OrdersService) as any;
  jest.spyOn(handler, 'onPaymentSuccess').mockImplementation(async (tx: any) => {
    calls.push(`handler:${tx.status}`);
  });
  jest.spyOn(handler, 'onLateSuccessAfterSupersede');
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
  return { db, ledger, handler, processor, calls, orders };
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

  it('routes a CANCELLED superseded (SUPERSEDED_BY_RETRY) order row to the #545 path: credited, applied, row success', async () => {
    const row = failedOrderRow({ status: 'cancelled', error_code: 'SUPERSEDED_BY_RETRY' });
    const { db, ledger, handler, processor } = build([row]);

    await processor.processFedaPayCallback(approved());

    expect(Transaction.retrieve).toHaveBeenCalledWith(777, { include: 'currency' });
    expect(ledger.deposits).toEqual([
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-order', amount: 8000 }),
    ]);
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED', transaction_id: '777' })
    );
  });

  it('plain declined->approved order on an unpaid live order: live re-check, CAS, credit, THEN apply; replay applies nothing twice', async () => {
    const { db, ledger, handler, processor, calls } = build([failedOrderRow()]);

    await processor.processFedaPayCallback(approved());

    expect(calls).toEqual([
      'live-retrieve',
      'cas:failed->processing',
      'deposit:momo-deposit:tx-order',
      'order:finalize:tx-order',
      'cas:processing->success',
    ]);
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({
        status: 'success',
        error_code: 'LATE_SUCCESS_APPLIED',
        transaction_id: '777',
      })
    );
    expect(anomalyTypes()).toEqual(['late_success_order_applied']);

    // FedaPay replays the same approved webhook.
    calls.length = 0;
    await processor.processFedaPayCallback(approved());

    // The late-success claim is not taken again and the wallet is not credited twice.
    expect(calls).not.toContain('cas:failed->processing');
    expect(ledger.deposits).toHaveLength(1);
  });

  it('M1: late approval on an order cancelled after the decline -> wallet credited, order NOT applied, DUPLICATE_PAYMENT_CREDITED, duplicate alert', async () => {
    const { db, ledger, processor, calls, orders } = build([failedOrderRow()], {
      order_number: 'ORD1',
      current_status: 'cancelled',
      payment_status: 'cancelled',
    });

    await processor.processFedaPayCallback(approved());

    expect(ledger.deposits).toEqual([
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-order', amount: 8000 }),
    ]);
    expect(orders.finalizeOrderAfterIncomingPayment).not.toHaveBeenCalled();
    expect(calls).not.toContain('handler:success');
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'DUPLICATE_PAYMENT_CREDITED' })
    );
    const types = anomalyTypes();
    expect(types).toContain('duplicate_momo_collect');
    expect(types).toContain('late_success_order_duplicate');
    expect(types).not.toContain('late_success_order_applied');
    // The alert goes out only after the outcome is known.
    expect(types.indexOf('late_success_order_duplicate')).toBeGreaterThan(
      types.indexOf('duplicate_momo_collect')
    );
    expect((reportMoneyAnomaly as jest.Mock).mock.calls.find((c) => c[1] === 'duplicate_momo_collect')?.[2]).toContain('reason=order_cancelled');
    expect(orders.notificationsService.sendDuplicatePaymentCreditedPush).toHaveBeenCalledTimes(1);
  });

  it('M1: late approval on an order already paid by a newer attempt -> wallet credited, order NOT re-applied, DUPLICATE_PAYMENT_CREDITED', async () => {
    const newer = failedOrderRow({
      id: 'tx-newer',
      reference: 'ORD1-REF-2',
      transaction_id: '888',
      status: 'success',
      error_code: null,
    });
    const { db, ledger, processor, orders } = build([failedOrderRow(), newer], {
      order_number: 'ORD1',
      current_status: 'confirmed',
      payment_status: 'paid',
    });

    await processor.processFedaPayCallback(approved());

    expect(ledger.deposits).toHaveLength(1);
    expect(orders.finalizeOrderAfterIncomingPayment).not.toHaveBeenCalled();
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'DUPLICATE_PAYMENT_CREDITED' })
    );
    expect(db.byId.get('tx-newer')?.status).toBe('success');
    expect(anomalyTypes()).toEqual(['duplicate_momo_collect', 'late_success_order_duplicate']);
    expect((reportMoneyAnomaly as jest.Mock).mock.calls[0][2]).toContain('reason=duplicate');
  });

  it('M1: an unpaid order with a newer pending attempt is paid by this approval and the newer prompt is superseded', async () => {
    const pendingRetry = failedOrderRow({
      id: 'tx-retry',
      reference: 'ORD1-REF-3',
      transaction_id: '999',
      status: 'pending',
      error_code: null,
    });
    const { db, processor, orders } = build([failedOrderRow(), pendingRetry]);

    await processor.processFedaPayCallback(approved());

    expect(orders.finalizeOrderAfterIncomingPayment).toHaveBeenCalledTimes(1);
    expect(db.byId.get('tx-order')?.error_code).toBe('LATE_SUCCESS_APPLIED');
    expect(db.byId.get('tx-retry')).toEqual(
      expect.objectContaining({ status: 'cancelled', error_code: 'SUPERSEDED_BY_LATE_SUCCESS' })
    );
  });

  it('decides on the LIVE record: callback body says 8000 XOF but live amount is 9000 -> acknowledged (2xx), nothing credited or applied, one alert', async () => {
    const { db, ledger, handler, processor } = build([failedOrderRow()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveFedaPayTx({ amount: 9000 }));

    const res = await processor.processFedaPayCallback(approved());

    expect(res).toEqual({ received: true, transactionId: expect.any(Number) });
    expect(ledger.deposits).toHaveLength(0);
    expect(handler.onLateSuccessAfterSupersede).not.toHaveBeenCalled();
    expect(db.byId.get('tx-order')?.status).toBe('failed');
    // Exactly one alert: the late-success marker, not a second generic one.
    expect(anomalyTypes()).toEqual(['late_success_order_live_mismatch']);
  });

  it('ignores a lying callback body when the live record confirms (body amount/currency are not trusted)', async () => {
    const { ledger, processor, orders } = build([failedOrderRow()]);

    await processor.processFedaPayCallback(
      approved({ amount: 1, currency: 'XAF' })
    );

    expect(ledger.deposits).toEqual([
      expect.objectContaining({ amount: 8000, idempotencyKey: 'momo-deposit:tx-order' }),
    ]);
    expect(orders.finalizeOrderAfterIncomingPayment).toHaveBeenCalledTimes(1);
  });

  it('live status declined -> acknowledged (2xx), row stays failed', async () => {
    const { db, ledger, processor } = build([failedOrderRow()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveFedaPayTx({ status: 'declined' }));

    const res = await processor.processFedaPayCallback(approved());

    expect(res).toEqual({ received: true, transactionId: expect.any(Number) });
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-order')?.status).toBe('failed');
  });

  it('order classification failure keeps the money in the wallet, puts the row back to failed and rethrows; the retry finishes once', async () => {
    const { db, ledger, processor, orders } = build([failedOrderRow()]);
    orders.finalizeOrderAfterIncomingPayment.mockRejectedValueOnce(new Error('db timeout'));

    await expect(processor.processFedaPayCallback(approved())).rejects.toThrow(/will retry/);

    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-order')?.status).toBe('failed');
    expect(anomalyTypes()).not.toContain('late_success_order_applied');

    // FedaPay retries the webhook: same path, no second credit, now applied.
    await processor.processFedaPayCallback(approved());
    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-order')).toEqual(
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' })
    );
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

  it('L5: success mark and credit-failure release are CAS on our processing claim', async () => {
    const live = liveFedaPayTx({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } });
    const cb = approved({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } });

    // Credit fails: the claim is released with a CAS (processing -> failed) and the call throws.
    const failing = build([failedTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live);
    failing.ledger.registerDepositIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' } as any);
    await expect(failing.processor.processFedaPayCallback(cb)).rejects.toThrow(/will retry/);
    expect(failing.calls).toContain('cas:processing->failed');
    expect(failing.db.byId.get('tx-topup')?.status).toBe('failed');
    expect(failing.db.updateTransaction).not.toHaveBeenCalled();

    // Credit works: success is written with a CAS, never a blind update.
    const ok = build([failedTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live);
    await ok.processor.processFedaPayCallback(cb);
    expect(ok.calls).toContain('cas:processing->success');
    expect(ok.db.updateTransaction).not.toHaveBeenCalled();
    expect(ok.db.byId.get('tx-topup')?.status).toBe('success');
  });

  it('live currency XAF -> acknowledged (2xx), nothing credited, anomaly raised', async () => {
    const { db, ledger, processor } = build([failedTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(
      liveFedaPayTx({ amount: 5000, currency: { iso: 'XAF' }, custom_metadata: { externalId: 'TOPUP-REF' } })
    );

    const res = await processor.processFedaPayCallback(
      approved({ amount: 5000, custom_metadata: { externalId: 'TOPUP-REF' } })
    );

    expect(res).toEqual({ received: true, transactionId: expect.any(Number) });
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

  const liveApproved = (over: Row = {}) =>
    liveFedaPayTx({ status: 'approved', amount: 2000, custom_metadata: { externalId: 'EXP-REF' }, ...over });

  it('N3: expired event + live approved -> re-verified as SUCCESS and credited once through the CAS path', async () => {
    const { db, ledger, processor, calls } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockImplementation(async () => {
      calls.push('live-retrieve');
      return liveApproved();
    });

    const res = await processor.processFedaPayCallback(expiredEvent('transaction.expired'));

    expect(res).toEqual({ received: true, transactionId: 777 });
    expect(calls.filter((c) => c === 'live-retrieve')).toHaveLength(2); // FAILED check, then SUCCESS re-verify
    expect(calls).toEqual(
      expect.arrayContaining(['cas:pending->processing', 'deposit:momo-deposit:tx-pending', 'cas:processing->success'])
    );
    expect(calls.indexOf('cas:pending->processing')).toBeLessThan(calls.indexOf('deposit:momo-deposit:tx-pending'));
    expect(ledger.deposits).toEqual([expect.objectContaining({ amount: 2000, idempotencyKey: 'momo-deposit:tx-pending' })]);
    expect(db.byId.get('tx-pending')).toEqual(expect.objectContaining({ status: 'success', transaction_id: '777' }));
    expect(anomalyTypes()).toEqual([]);
  });

  it('N3: a later transaction.approved for the same tx never credits twice', async () => {
    const { db, ledger, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveApproved());
    await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
    await processor.processFedaPayCallback(approved({ amount: 2000, custom_metadata: { externalId: 'EXP-REF' } }));
    await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-pending')?.status).toBe('success');
  });

  it('N3: expired and approved delivered concurrently -> exactly one credit (CAS + ledger key)', async () => {
    const { db, ledger, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveApproved());
    await Promise.allSettled([
      processor.processFedaPayCallback(expiredEvent('transaction.expired')),
      processor.processFedaPayCallback(approved({ amount: 2000, custom_metadata: { externalId: 'EXP-REF' } })),
    ]);
    expect(ledger.deposits).toHaveLength(1);
    expect(ledger.deposits[0]).toEqual(expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-pending' }));
    expect(db.byId.get('tx-pending')?.status).toBe('success');
  });

  it('N3: the SUCCESS re-verify still applies: live approved but wrong amount -> acknowledged mismatch, no credit', async () => {
    const { db, ledger, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveApproved({ amount: 1999 }));
    const res = await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
    expect(res).toEqual({ received: true, transactionId: 777 });
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-pending')?.status).toBe('pending');
    expect(anomalyTypes()).toEqual(['fedapay_callback_live_mismatch']);
    expect((reportMoneyAnomaly as jest.Mock).mock.calls[0][3]).toEqual(
      expect.objectContaining({ reason: 'amount_mismatch', claimed: 'SUCCESS' })
    );
  });

  it('N3 is only for expiry: a declined event with a live approved record stays an acknowledged mismatch', async () => {
    const { db, ledger, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(liveApproved());
    await processor.processFedaPayCallback({
      ...expiredEvent('transaction.declined'),
      entity: { ...expiredEvent('transaction.declined').entity, status: 'declined' },
    });
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-pending')?.status).toBe('pending');
    expect((reportMoneyAnomaly as jest.Mock).mock.calls[0][3]).toEqual(
      expect.objectContaining({ reason: 'live_status_mismatch', claimed: 'FAILED' })
    );
  });

  it('N3 is only for a live status mismatch: expired event, live expired but wrong reference -> FAILED mismatch acknowledged, no re-verify', async () => {
    const { db, ledger, processor } = build([pendingTopUp()]);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(
      liveFedaPayTx({ status: 'expired', amount: 2000, custom_metadata: { externalId: 'OTHER-REF' } })
    );
    const res = await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
    expect(res).toEqual({ received: true, transactionId: 777 });
    expect(Transaction.retrieve).toHaveBeenCalledTimes(1); // no SUCCESS re-verify
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-pending')?.status).toBe('pending');
    expect(anomalyTypes()).toEqual(['fedapay_callback_live_mismatch']);
    expect((reportMoneyAnomaly as jest.Mock).mock.calls[0][3]).toEqual(
      expect.objectContaining({ reason: 'reference_mismatch', claimed: 'FAILED' })
    );
  });

  describe('N2: expiry runs onPaymentFailure for orders, deposits and claims, like a decline', () => {
    function withFailureSpies(entity: string | null) {
      const built = build([pendingTopUp()].map((r) => ({ ...r, payment_entity: entity, entity_id: entity ? 'ORD1' : null })));
      const orders = built.orders;
      orders.getOrderForProcessingByNumber = jest.fn(async () => ({
        id: 'order-uuid',
        order_number: 'ORD1',
        current_status: 'pending_payment',
        payment_status: 'pending',
      }));
      orders.onOrderPaymentFailed = jest.fn(async () => undefined);
      orders.onDepositPaymentFailed = jest.fn(async () => undefined);
      orders.emitClaimTopupFailed = jest.fn(async () => undefined);
      (Transaction.retrieve as jest.Mock).mockResolvedValue(
        liveFedaPayTx({ status: 'expired', amount: 2000, custom_metadata: { externalId: 'EXP-REF' } })
      );
      return { ...built, orders };
    }
    const declinedEvent = () => ({
      ...expiredEvent('transaction.declined'),
      entity: { ...expiredEvent('transaction.declined').entity, status: 'declined' },
    });

    it.each([
      ['order', 'onOrderPaymentFailed', ['order-uuid', 'expired']],
      ['order_deposit', 'onDepositPaymentFailed', ['order-uuid', 'expired']],
      ['claim_order', 'emitClaimTopupFailed', [expect.objectContaining({ id: 'tx-pending' }), 'expired']],
    ])('%s: transaction.expired fails the row and calls %s', async (entity, method, args) => {
      const { db, processor, orders } = withFailureSpies(entity);
      await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
      expect(db.byId.get('tx-pending')?.status).toBe('failed');
      expect(orders[method]).toHaveBeenCalledTimes(1);
      expect(orders[method]).toHaveBeenCalledWith(...args);
    });

    it.each([
      ['order', 'onOrderPaymentFailed'],
      ['order_deposit', 'onDepositPaymentFailed'],
      ['claim_order', 'emitClaimTopupFailed'],
    ])('%s: same handler call as a decline (parity)', async (entity, method) => {
      const { processor, orders } = withFailureSpies(entity);
      (Transaction.retrieve as jest.Mock).mockResolvedValue(
        liveFedaPayTx({ status: 'declined', amount: 2000, custom_metadata: { externalId: 'EXP-REF' } })
      );
      await processor.processFedaPayCallback(declinedEvent());
      expect(orders[method]).toHaveBeenCalledTimes(1);
      expect((orders[method] as jest.Mock).mock.calls[0][1]).toBe('declined');
    });

    it('expiry does not run failure handlers when the CAS loses (row no longer pending)', async () => {
      const { db, processor, orders } = withFailureSpies('order');
      db.updateTransactionIfStatus.mockResolvedValueOnce(false);
      await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
      expect(orders.onOrderPaymentFailed).not.toHaveBeenCalled();
    });

    it('other entities (a wallet top-up) keep no failure side effects on expiry', async () => {
      const { db, processor, handler } = withFailureSpies(null);
      const onFailure = jest.spyOn(handler, 'onPaymentFailure');
      await processor.processFedaPayCallback(expiredEvent('transaction.expired'));
      expect(db.byId.get('tx-pending')?.status).toBe('failed');
      expect(onFailure).not.toHaveBeenCalled();
    });
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

describe('L4: a FedaPay mock- PAYMENT row only skips the live re-check when FedaPay mock mode is on', () => {
  const pendingMockTopUp = (): Row => ({
    id: 'tx-mock',
    reference: 'TOPUP-M',
    transaction_id: 'mock-abc-1',
    status: 'pending',
    transaction_type: 'PAYMENT',
    payment_entity: null,
    entity_id: null,
    amount: 8000,
    currency: 'XOF',
    account_id: 'acct-client',
    provider: 'fedapay',
    customer_phone: '+22890123456',
    updated_at: '2026-10-17T10:00:00.000Z',
  });
  const approvedMock = () =>
    approved({ id: 123, reference: 'mock-abc-1', custom_metadata: { externalId: 'TOPUP-M' } });

  it('mock mode OFF (prod): the mock- row is re-checked live and nothing is credited when FedaPay does not confirm it', async () => {
    const { db, ledger, processor } = build([pendingMockTopUp()]);
    (Transaction.retrieve as jest.Mock).mockRejectedValue(new Error('Transaction not found'));

    await expect(processor.processFedaPayCallback(approvedMock())).rejects.toBeDefined();

    expect(Transaction.retrieve).toHaveBeenCalled();
    expect(ledger.deposits).toHaveLength(0);
    expect(db.byId.get('tx-mock')?.status).toBe('pending');
  });

  it('mock mode ON (DEV): the mock- row skips the live re-check and is credited', async () => {
    const { db, ledger, processor } = build([pendingMockTopUp()]);
    jest.spyOn(processor as any, 'isFedaPayMockEnabled').mockReturnValue(true);

    await processor.processFedaPayCallback(approvedMock());

    expect(Transaction.retrieve).not.toHaveBeenCalled();
    expect(ledger.deposits).toHaveLength(1);
    expect(db.byId.get('tx-mock')?.status).toBe('success');
  });
});
