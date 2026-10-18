/**
 * PE-approved FedaPay webhook response policy (#587), end to end through the real
 * MobilePaymentsController.fedapayCallback -> MobilePaymentCallbackProcessor ->
 * MobilePaymentsService.assertProviderConfirmsCallback -> FedaPayService -> FedaPay SDK.
 *
 * Webhook signatures are generated and verified with the real FedaPay `Webhook`; only
 * `Transaction.retrieve` (the live re-check) is mocked. The DB and ledger are in-memory fakes.
 *
 * - A definite mismatch with the live record -> 2xx `{ received, transactionId }`, no credit,
 *   no transaction write, one money-anomaly alert; the body echoes none of our values.
 * - Transient (live pending, FedaPay API/network error) -> 500 so FedaPay retries, no alert.
 * - FedaPay `refunded` is mapped explicitly and never credited or replayed.
 */
import { HttpException, Logger, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { AdminMobilePaymentsController } from './admin-mobile-payments.controller';
import { CallbackLiveMismatchError } from './callback-live-mismatch.error';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import { FedaPayService } from './providers/fedapay.service';

jest.mock('fedapay', () => {
  const actual = jest.requireActual('fedapay');
  return {
    ...actual,
    Transaction: { create: jest.fn(), retrieve: jest.fn() },
    Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  };
});
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Transaction, Webhook } = require('fedapay');

const WEBHOOK_SECRET = ['wh', 'sandbox', 'ackPolicyTestSecret'].join('_');
const STORED_REF = 'RS-STORED-REF-4417';
const LIVE_REF_OTHER = 'LIVE-OTHER-REF-9921';

type Row = Record<string, any>;
let nextEntityId = 810_001; // must not contain the amounts checked in the no-echo assertion

function makeDb(rows: Row[]) {
  const byId = new Map<string, Row>(rows.map((r) => [r.id, { ...r }]));
  const find = (pred: (r: Row) => boolean) => {
    for (const r of byId.values()) if (pred(r)) return { ...r };
    return null;
  };
  return {
    byId,
    getTransactionByTransactionId: jest.fn(async (k: string) => find((r) => r.transaction_id === k)),
    getTransactionByReference: jest.fn(async (k: string) => find((r) => r.reference === k)),
    getTransactionById: jest.fn(async (id: string) => (byId.has(id) ? { ...byId.get(id) } : null)),
    logCallback: jest.fn(async () => undefined),
    updateTransaction: jest.fn(async (id: string, patch: Row) => {
      Object.assign(byId.get(id) as Row, patch);
    }),
    updateTransactionIfStatus: jest.fn(async (id: string, from: string, patch: Row) => {
      const r = byId.get(id);
      if (!r || r.status !== from) return false;
      Object.assign(r, patch);
      return true;
    }),
  };
}

function build(rowOver: Row = {}) {
  const entityId = nextEntityId++;
  const row: Row = {
    id: `tx-${entityId}`,
    reference: STORED_REF,
    transaction_id: String(entityId),
    status: 'pending',
    transaction_type: 'PAYMENT',
    payment_entity: null,
    entity_id: null,
    amount: 5000,
    currency: 'XOF',
    account_id: 'acct-1',
    provider: 'fedapay',
    customer_phone: '+22990123456',
    ...rowOver,
  };
  const db = makeDb([row]);
  const deposits: Row[] = [];
  const ledger = {
    registerDepositIfNotExists: jest.fn(async (args: Row) => {
      deposits.push(args);
      return { success: true, alreadyExists: false };
    }),
  };
  const handler = {
    entityType: 'account_recharge',
    canHandle: () => true,
    onPaymentSuccess: jest.fn(async () => undefined),
    onPaymentFailure: jest.fn(async () => undefined),
  };
  const fedapay = new FedaPayService(
    {
      get: (key: string) =>
        key === 'fedapay'
          ? { secretKey: ['sk', 'sandbox', 'x'].join('_'), environment: 'sandbox', mockEnabled: false }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  const mps = new MobilePaymentsService(
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, fedapay,
    { executeQuery: jest.fn(async () => ({})) } as any
  );
  const processor = new MobilePaymentCallbackProcessor(
    db as any,
    ledger as any,
    { getHandlers: jest.fn(() => [handler]) } as any,
    mps,
    { get: jest.fn(() => fedapay) } as any
  );
  const config = { get: (k: string) => (k === 'fedapay.webhookSecret' ? WEBHOOK_SECRET : undefined) };
  const any = {} as any;
  const controller = new MobilePaymentsController(
    mps, db as any, any, any, any, processor, any, any, any, config as any
  );
  return { entityId, row, db, deposits, ledger, mps, processor, controller };
}

function live(entityId: number, over: Row = {}) {
  return {
    id: entityId,
    status: 'approved',
    amount: 5000,
    currency: { iso: 'XOF' },
    custom_metadata: { externalId: STORED_REF },
    ...over,
  };
}

function signedRequest(entityId: number, status = 'approved', name = `transaction.${status}`) {
  const payload = JSON.stringify({
    name,
    entity: { id: entityId, status, amount: 5000, currency: 'XOF', custom_metadata: { externalId: STORED_REF } },
  });
  const header = Webhook.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
    timestamp: Math.floor(Date.now() / 1000),
  });
  return { headers: { 'x-fedapay-signature': header }, body: Buffer.from(payload) } as any;
}

const anomalies = () => (reportMoneyAnomaly as jest.Mock).mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  for (const level of ['log', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
  }
});
afterEach(() => jest.restoreAllMocks());

describe('the FedaPay webhook route answers 2xx on a resolved handler', () => {
  it('is a POST with no non-2xx @HttpCode override (Nest default 201)', () => {
    const fn = MobilePaymentsController.prototype.fedapayCallback;
    expect(Reflect.getMetadata(METHOD_METADATA, fn)).toBe(RequestMethod.POST);
    const code = Reflect.getMetadata(HTTP_CODE_METADATA, fn);
    expect(code === undefined || (code >= 200 && code < 300)).toBe(true);
  });
});

describe('definite mismatch with the live record -> acknowledged (2xx), no credit, no state change, alerted, no echo', () => {
  const cases: Array<[string, string, Row, Row, string]> = [
    // [label, event status, row override, live override, reason]
    ['SUCCESS claimed, live declined', 'approved', {}, { status: 'declined' }, 'live_status_mismatch'],
    ['SUCCESS claimed, live canceled', 'approved', {}, { status: 'canceled' }, 'live_status_mismatch'],
    ['live currency XAF', 'approved', {}, { currency: { iso: 'XAF' } }, 'live_currency_not_xof'],
    ['live currency missing', 'approved', {}, { currency: undefined }, 'missing_live_currency'],
    ['stored currency not XOF', 'approved', { currency: 'XAF' }, {}, 'stored_currency_not_xof'],
    ['amount mismatch', 'approved', {}, { amount: 4999 }, 'amount_mismatch'],
    ['live reference mismatch', 'approved', {}, { custom_metadata: { externalId: LIVE_REF_OTHER } }, 'reference_mismatch'],
    ['FAILED claimed (declined), live approved', 'declined', {}, { status: 'approved' }, 'live_status_mismatch'],
    ['FAILED claimed, live reference mismatch', 'declined', {}, { status: 'declined', custom_metadata: { externalId: LIVE_REF_OTHER } }, 'reference_mismatch'],
    ['SUCCESS claimed, live refunded', 'approved', {}, { status: 'refunded' }, 'live_refunded'],
    ['FAILED claimed, live refunded', 'declined', {}, { status: 'refunded' }, 'live_refunded'],
  ];

  it.each(cases)('%s', async (_label, eventStatus, rowOver, liveOver, reason) => {
    const { entityId, row, db, deposits, controller } = build(rowOver);
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId, liveOver));

    const res = await controller.fedapayCallback(signedRequest(entityId, eventStatus));

    // 2xx with the usual body; it carries only FedaPay's own entity id.
    expect(res).toEqual({ received: true, transactionId: entityId });
    const body = JSON.stringify(res);
    for (const value of [STORED_REF, LIVE_REF_OTHER, row.id, '4999', '5000', 'XAF', 'XOF', reason, 'expected', 'mismatch']) {
      expect(body).not.toContain(value);
    }
    // No credit, no transaction write.
    expect(deposits).toHaveLength(0);
    expect(db.updateTransaction).not.toHaveBeenCalled();
    expect(db.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(db.byId.get(row.id)?.status).toBe('pending');
    // Exactly one alert, with the reason; the expected/actual detail goes to the alert only.
    expect(anomalies()).toHaveLength(1);
    const [, marker, message, context] = anomalies()[0];
    expect(marker).toBe('fedapay_callback_live_mismatch');
    expect(context).toEqual(expect.objectContaining({ transactionId: row.id, reason, fedapayEntityId: entityId }));
    expect(message).toContain('acknowledged without credit or state change');
  });

  it('keeps expected/actual values in the alert (for the on-call), e.g. the amount mismatch', async () => {
    const { entityId, controller } = build();
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId, { amount: 4999 }));
    await controller.fedapayCallback(signedRequest(entityId));
    expect(anomalies()[0][2]).toContain('expected 5000, live 4999');
  });

  it('an acknowledged event is recorded, so a redelivery of it is a duplicate, not reprocessed', async () => {
    const { entityId, controller } = build();
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId, { status: 'declined' }));
    await controller.fedapayCallback(signedRequest(entityId));
    const again = await controller.fedapayCallback(signedRequest(entityId)).catch((e: unknown) => e);
    expect((again as HttpException).getStatus()).toBe(200);
    expect(Transaction.retrieve).toHaveBeenCalledTimes(1);
  });

  it('missing provider transaction_id is definite too (service level, FedaPay only)', async () => {
    const { mps } = build();
    const err = await mps
      .assertProviderConfirmsCallback(
        { id: 'tx-noid', provider: 'fedapay', transaction_id: null, reference: STORED_REF } as any,
        'SUCCESS'
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CallbackLiveMismatchError);
    expect((err as CallbackLiveMismatchError).reason).toBe('missing_transaction_id');
    expect(Transaction.retrieve).not.toHaveBeenCalled();
  });

  it('missing transaction_id is acknowledged by the processor (2xx, alert, no credit)', async () => {
    const { entityId, mps, processor, deposits } = build();
    const real = mps.assertProviderConfirmsCallback.bind(mps);
    jest
      .spyOn(mps, 'assertProviderConfirmsCallback')
      .mockImplementation((tx: any, claimed) => real({ ...tx, transaction_id: null }, claimed));
    const res = await processor.processFedaPayCallback(JSON.parse(signedRequest(entityId).body.toString()));
    expect(res).toEqual({ received: true, transactionId: entityId });
    expect(deposits).toHaveLength(0);
    expect(anomalies()[0][3]).toEqual(expect.objectContaining({ reason: 'missing_transaction_id' }));
  });

  it('a non-FedaPay row with no transaction_id still throws a plain (5xx, retried) error', async () => {
    const { mps } = build();
    const err = await mps
      .assertProviderConfirmsCallback({ id: 'tx-mp', provider: 'mypvit', transaction_id: '' } as any, 'SUCCESS')
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(CallbackLiveMismatchError);
    expect(String((err as Error).message)).toMatch(/missing provider transaction_id/);
  });
});

describe('transient conditions stay 5xx so FedaPay retries (no alert, no credit)', () => {
  it('live status pending -> 500 with a generic body', async () => {
    const { entityId, row, db, deposits, controller } = build();
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId, { status: 'pending' }));

    const err = (await controller.fedapayCallback(signedRequest(entityId)).catch((e: unknown) => e)) as HttpException;

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(500);
    expect(err.getResponse()).toEqual({ success: false, message: 'Failed to process FedaPay callback' });
    expect(deposits).toHaveLength(0);
    expect(db.byId.get(row.id)?.status).toBe('pending');
    expect(anomalies()).toHaveLength(0);
  });

  it('FedaPay API / network error on the live re-check -> 500, and the retry is processed again', async () => {
    const { entityId, controller } = build();
    (Transaction.retrieve as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('connect ETIMEDOUT api.fedapay.com'), { code: 'ETIMEDOUT' })
    );

    const err = (await controller.fedapayCallback(signedRequest(entityId)).catch((e: unknown) => e)) as HttpException;
    expect(err.getStatus()).toBe(500);
    expect(anomalies()).toHaveLength(0);

    // Not recorded as seen: FedaPay's retry gets a real re-check.
    (Transaction.retrieve as jest.Mock).mockResolvedValueOnce(live(entityId, { status: 'declined' }));
    const res = await controller.fedapayCallback(signedRequest(entityId));
    expect(res).toEqual({ received: true, transactionId: entityId });
    expect(Transaction.retrieve).toHaveBeenCalledTimes(2);
  });

  it('ambiguous live status is transient at the service level', async () => {
    const { mps } = build();
    jest.spyOn(mps, 'checkTransactionStatus').mockResolvedValue({
      transactionId: '1', status: 'ambiguous', amount: 5000, currency: 'XOF', reference: STORED_REF,
    });
    const err = await mps
      .assertProviderConfirmsCallback({ id: 'tx-a', provider: 'fedapay', transaction_id: '1', reference: STORED_REF } as any, 'SUCCESS')
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(CallbackLiveMismatchError);
    expect(String((err as Error).message)).toMatch(/transient, will retry/);
  });

  it('a processing failure after a confirmed live record is still a 500 (not swallowed)', async () => {
    const { entityId, controller, processor } = build();
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId));
    jest.spyOn(processor as any, 'processPendingFedaPay').mockRejectedValue(new Error('Wallet credit failed; will retry'));
    const err = (await controller.fedapayCallback(signedRequest(entityId)).catch((e: unknown) => e)) as HttpException;
    expect(err.getStatus()).toBe(500);
    expect(anomalies()).toHaveLength(0);
  });
});

describe('FedaPay `refunded` is mapped explicitly and never credited or replayed', () => {
  it('checkTransactionStatus maps refunded to refunded (not pending, not failed)', async () => {
    const { entityId, mps } = build();
    (Transaction.retrieve as jest.Mock).mockResolvedValue(live(entityId, { status: 'refunded' }));
    const status = await mps.checkTransactionStatus(String(entityId), 'fedapay');
    expect(status.status).toBe('refunded');
  });

  it('a status poll never writes refunded to the row (kept pending for manual review)', async () => {
    const { controller, db, row } = build();
    await (controller as any).persistPolledStatus(row.id, { status: 'refunded', message: 'refunded' });
    expect(db.updateTransaction).toHaveBeenCalledWith(row.id, expect.objectContaining({ status: 'pending' }));
  });

  it('admin resolve does not replay a refunded transaction (no processor call)', async () => {
    const { row, db, mps } = build();
    const processor = { processFreemopayCallback: jest.fn(), processMypvitCallback: jest.fn(), processFedaPayCallback: jest.fn() };
    jest.spyOn(mps, 'checkTransactionStatus').mockResolvedValue({
      transactionId: row.transaction_id, status: 'refunded', amount: 5000, currency: 'XOF', reference: STORED_REF,
    });
    jest.spyOn(mps as any, 'resolveAdminIntegrationProvider').mockResolvedValue('fedapay');
    const admin = new AdminMobilePaymentsController(db as any, mps, processor as any);
    const res: any = await admin.resolve(row.id, {} as any);
    expect(res.replayed).toBe(false);
    expect(res.message).toMatch(/refunded; manual review required/);
    expect(processor.processFreemopayCallback).not.toHaveBeenCalled();
    expect(processor.processFedaPayCallback).not.toHaveBeenCalled();
  });

  it('pending-withdrawal resolve treats refunded as uncertain (no balance return)', () => {
    const svc = Object.create(PendingWithdrawalResolveService.prototype);
    expect((svc as any).normalizeLiveStatus('refunded')).toBe('ambiguous');
    expect((svc as any).normalizeLiveStatus('declined')).toBe('failed');
  });
});
