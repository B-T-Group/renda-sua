jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

import { HttpException } from '@nestjs/common';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { OrdersService } from './orders.service';
import {
  decideOnPendingTx,
  isUniqueViolation,
  maskPhone,
  normalizeIdempotencyKey,
  requireValidRetryPhone,
  samePhone,
} from './pay-after-retry.util';

const PHONE_A = '+237650000099'; // current payer (MTN, DEV mock "stuck" number)
const PHONE_B = '+237699111222'; // new number (Orange)

function iso(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

async function codeOf(p: Promise<unknown>): Promise<{ status: number; code?: string }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpException) {
      const body: any = e.getResponse();
      return { status: e.getStatus(), code: typeof body === 'object' ? body.code : undefined };
    }
    throw e;
  }
  throw new Error('expected rejection');
}

describe('pay-after-retry.util', () => {
  it('accepts CM MTN / Orange numbers and returns E.164', () => {
    expect(requireValidRetryPhone('+237 677 41 45 65', 'CM')).toBe('+237677414565');
    expect(requireValidRetryPhone('699111222', 'CM')).toBe('+237699111222');
  });

  it.each([
    ['+33612345678', 'non-CM number on a CM order'],
    ['+23767741', 'too short'],
    ['+237222123456', 'CM landline (not MoMo)'],
    ['hello', 'garbage'],
  ])('rejects %s (%s) with INVALID_MOMO_PHONE', async (raw) => {
    const r = await codeOf(Promise.resolve().then(() => requireValidRetryPhone(raw, 'CM')));
    expect(r).toEqual({ status: 400, code: 'INVALID_MOMO_PHONE' });
  });

  it('compares phones across stored formats', () => {
    expect(samePhone('+237650000099', '650000099')).toBe(true);
    expect(samePhone('237650000099', '+237 650 000 099')).toBe(true);
    expect(samePhone(PHONE_A, PHONE_B)).toBe(false);
    expect(samePhone('', PHONE_B)).toBe(false);
  });

  it('masks phones', () => {
    expect(maskPhone('+237677414565')).toBe('+237 6** *** 565');
    expect(maskPhone(null)).toBeNull();
  });

  it('D1/D2: keeps a young same-phone prompt, replaces after 90 s or on phone change', () => {
    expect(decideOnPendingTx({ ageSeconds: 30, phoneChanged: false, minAgeSeconds: 90 })).toBe('already_pending');
    expect(decideOnPendingTx({ ageSeconds: 90, phoneChanged: false, minAgeSeconds: 90 })).toBe('supersede');
    expect(decideOnPendingTx({ ageSeconds: 5, phoneChanged: true, minAgeSeconds: 90 })).toBe('supersede');
  });

  it('validates idempotency keys', async () => {
    expect(normalizeIdempotencyKey('  ')).toBeNull();
    expect(normalizeIdempotencyKey('3f1c-uuid_1')).toBe('3f1c-uuid_1');
    const r = await codeOf(Promise.resolve().then(() => normalizeIdempotencyKey('bad key!')));
    expect(r.code).toBe('INVALID_IDEMPOTENCY_KEY');
  });

  it('detects Hasura uniqueness violations only', () => {
    expect(isUniqueViolation(new Error('Uniqueness violation. duplicate key value'))).toBe(true);
    expect(isUniqueViolation(new Error('Foreign key violation'))).toBe(false);
  });
});

describe('OrdersService pay-after-confirm retry (#545)', () => {
  let svc: any;
  let db: any;
  let mps: any;
  let hasura: any;
  let order: any;
  let processor: any;

  const baseOrder = () => ({
    id: 'order-1',
    order_number: 'ORD1',
    current_status: 'confirmed',
    payment_status: 'pending',
    pay_after_merchant_confirm: true,
    total_amount: 1500,
    currency: 'XAF',
    payer_phone: PHONE_A,
    client: { user_id: 'client-user', user: { phone_number: '+237670000000', email: 'c@x.com' } },
    business_location: { address: { country: 'CM' } },
  });

  const pendingTx = (overrides: any = {}) => ({
    id: 'tx-old',
    reference: 'ORD1-1-old',
    amount: 1500,
    currency: 'XAF',
    provider: 'freemopay',
    status: 'pending',
    transaction_id: 'mock-old',
    customer_phone: PHONE_A,
    created_at: iso(200),
    payment_entity: 'order',
    entity_id: 'ORD1',
    ...overrides,
  });

  beforeEach(() => {
    (reportMoneyAnomaly as jest.Mock).mockClear();
    order = baseOrder();
    db = {
      getPendingOrderPaymentTransactionByOrderNumber: jest.fn().mockResolvedValue(null),
      getOrderTransactionByIdempotencyKey: jest.fn().mockResolvedValue(null),
      getTransactionSupersededBy: jest.fn().mockResolvedValue(null),
      countOrderRetryAttemptsSince: jest.fn().mockResolvedValue(0),
      updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
      updateTransaction: jest.fn().mockResolvedValue({}),
      listOrderTransactionsByStatus: jest.fn().mockResolvedValue([]),
      createTransaction: jest.fn().mockImplementation(async (data: any) => ({
        id: 'tx-new',
        reference: data.reference,
        status: 'pending',
        created_at: new Date().toISOString(),
        customer_phone: data.customer_phone,
      })),
    };
    mps = {
      getProviderForCountry: jest.fn().mockReturnValue('freemopay'),
      checkTransactionStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      initiatePayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'mock-new' }),
      cancelTransaction: jest.fn().mockResolvedValue(true),
      nationalCustomerIdForMypvit: jest.fn().mockReturnValue('650000099'),
    };
    hasura = {
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1', available_balance: 0 }),
      executeMutation: jest.fn().mockResolvedValue({ update_orders: { affected_rows: 1 } }),
      executeQuery: jest.fn(),
    };
    processor = { processFreemopayCallback: jest.fn().mockResolvedValue({}) };
    svc = Object.create(OrdersService.prototype);
    Object.assign(svc, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      payAfterMomoInFlight: new Set<string>(),
      mobilePaymentsDatabaseService: db,
      mobilePaymentsService: mps,
      hasuraSystemService: hasura,
      hasuraUserService: { getUser: jest.fn().mockResolvedValue({ id: 'client-user', active_persona: 'client' }) },
      mobilePaymentPhonesService: { createForUser: jest.fn().mockResolvedValue({}) },
      notificationsService: { sendDuplicatePaymentCreditedPush: jest.fn().mockResolvedValue(undefined) },
      moduleRef: { get: jest.fn().mockReturnValue(processor) },
    });
    jest.spyOn(svc, 'requireActivePersona').mockImplementation(() => undefined);
    jest.spyOn(svc, 'getOrderDetails').mockImplementation(async () => order);
    jest.spyOn(svc, 'resetOrderPaymentFailure').mockResolvedValue(undefined);
    jest.spyOn(svc, 'finalizeOrderAfterIncomingPayment').mockResolvedValue(undefined);
    jest.spyOn(svc, 'requireOrderDetailsByNumber').mockImplementation(async () => order);
  });

  const retry = (opts: any = {}) => svc.retryOrderPayment('order-1', opts);

  it('case 1/2: no pending attempt -> new request to current payer phone, tagged as retry', async () => {
    const res = await retry({ idempotencyKey: 'k1' });
    expect(res).toMatchObject({ success: true, result: 'sent', payment_rail: 'mobile_money', phone_masked: '+237 6** *** 099' });
    expect(db.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_phone: PHONE_A,
        idempotency_key: 'k1',
        description: 'order ORD1 (after confirm retry)',
        entity_id: 'ORD1',
        payment_entity: 'order',
      })
    );
    expect(mps.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: PHONE_A, amount: 1500 }),
      expect.any(String),
      'client-user'
    );
    expect(db.updateTransaction).toHaveBeenCalledWith('tx-new', { transaction_id: 'mock-new' });
    expect(svc.resetOrderPaymentFailure).toHaveBeenCalledWith('order-1');
    // Same phone: payer_phone untouched.
    expect(hasura.executeMutation).not.toHaveBeenCalledWith(expect.stringContaining('PersistRetryPayerPhone'), expect.anything());
  });

  it('case 3: stuck pending on A, retry to B -> old superseded (CAS), new to B, payer_phone=B after provider accepts', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx({ created_at: iso(10) }));
    const steps: string[] = [];
    mps.initiatePayment.mockImplementation(async () => { steps.push('send'); return { success: true, transactionId: 'mock-new' }; });
    hasura.executeMutation.mockImplementation(async (q: string) => { if (q.includes('PersistRetryPayerPhone')) steps.push('persist'); return {}; });

    const res = await retry({ phoneNumber: '699 111 222' });

    expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-old', 'pending', expect.objectContaining({
      status: 'cancelled', error_code: 'SUPERSEDED_BY_RETRY', superseded_reason: 'phone_changed',
    }));
    expect(db.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ customer_phone: PHONE_B }));
    expect(db.updateTransaction).toHaveBeenCalledWith('tx-old', { superseded_by_id: 'tx-new' });
    expect(steps).toEqual(['send', 'persist']);
    expect(hasura.executeMutation).toHaveBeenCalledWith(expect.stringContaining('payment_status: { _neq: "paid" }'), { id: 'order-1', phone: PHONE_B });
    expect(res).toMatchObject({ result: 'resent', superseded_transaction_id: 'tx-old', phone_masked: '+237 6** *** 222' });
    expect(res.payment_transaction).toMatchObject({ id: 'tx-new', status: 'pending' });
    expect(res.prompt_expires_at).toEqual(expect.any(String));
  });

  it('D3: saves the changed number only when asked', async () => {
    await retry({ phoneNumber: PHONE_B, savePhone: true });
    expect(svc.mobilePaymentPhonesService.createForUser).toHaveBeenCalledWith('client-user', 'CM', PHONE_B);
  });

  it('D3: does not save the changed number by default', async () => {
    await retry({ phoneNumber: PHONE_B });
    expect(svc.mobilePaymentPhonesService.createForUser).not.toHaveBeenCalled();
  });

  it('case 4: same phone, pending < 90 s -> already_pending, nothing sent', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx({ created_at: iso(20) }));
    const res = await retry({ phoneNumber: PHONE_A });
    expect(res.result).toBe('already_pending');
    expect(res.retry_after_seconds).toBeGreaterThan(60);
    expect(res.payment_transaction).toMatchObject({ id: 'tx-old' });
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(mps.initiatePayment).not.toHaveBeenCalled();
  });

  it('case 4: same phone, pending >= 90 s -> resent', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx({ created_at: iso(95) }));
    const res = await retry();
    expect(res.result).toBe('resent');
    expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-old', 'pending', expect.objectContaining({ superseded_reason: 'resend_after_min_age' }));
  });

  it('case 5: invalid number -> 400 INVALID_MOMO_PHONE, no tx, payer_phone unchanged', async () => {
    const r = await codeOf(retry({ phoneNumber: '+33612345678' }));
    expect(r).toEqual({ status: 400, code: 'INVALID_MOMO_PHONE' });
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.getPendingOrderPaymentTransactionByOrderNumber).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('case 6: same Idempotency-Key -> original attempt returned, nothing sent', async () => {
    db.getOrderTransactionByIdempotencyKey.mockResolvedValue(pendingTx({ id: 'tx-k', customer_phone: PHONE_B, created_at: iso(5) }));
    db.getTransactionSupersededBy.mockResolvedValue(pendingTx({ status: 'cancelled' }));
    const res = await retry({ idempotencyKey: 'k1', phoneNumber: PHONE_B });
    expect(res).toMatchObject({ result: 'resent', idempotent_replay: true, superseded_transaction_id: 'tx-old' });
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(mps.initiatePayment).not.toHaveBeenCalled();
  });

  it('case 6: unique pending index violation -> already_pending, nothing sent', async () => {
    db.createTransaction.mockRejectedValue(new Error('Uniqueness violation. duplicate key value violates unique constraint "mobile_payment_transactions_one_pending_order_uidx"'));
    db.getPendingOrderPaymentTransactionByOrderNumber
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingTx({ id: 'tx-winner', created_at: iso(1) }));
    const res = await retry();
    expect(res).toMatchObject({ result: 'already_pending', payment_transaction: { id: 'tx-winner' } });
    expect(mps.initiatePayment).not.toHaveBeenCalled();
  });

  it('case 6: lost supersede CAS -> already_pending, nothing sent', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber
      .mockResolvedValueOnce(pendingTx())
      .mockResolvedValueOnce(pendingTx({ id: 'tx-winner', created_at: iso(1) }));
    db.updateTransactionIfStatus.mockResolvedValue(false);
    const res = await retry();
    expect(res.result).toBe('already_pending');
    expect(db.createTransaction).not.toHaveBeenCalled();
  });

  it('case 6: concurrent request on this instance -> no second send', async () => {
    svc.payAfterMomoInFlight.add('order-1');
    db.getPendingOrderPaymentTransactionByOrderNumber
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingTx({ id: 'tx-winner', created_at: iso(1) }));
    const res = await retry();
    expect(res.result).toBe('already_pending');
    expect(db.createTransaction).not.toHaveBeenCalled();
  });

  it('case 8: provider status check throws -> 409 PAYMENT_STATE_UNCERTAIN, no new tx', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx());
    mps.checkTransactionStatus.mockRejectedValue(new Error('timeout'));
    const r = await codeOf(retry({ phoneNumber: PHONE_B }));
    expect(r).toEqual({ status: 409, code: 'PAYMENT_STATE_UNCERTAIN' });
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.updateTransactionIfStatus).not.toHaveBeenCalled();
  });

  it('provider already SUCCESS for old attempt -> replays success, result paid, no resend', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx());
    mps.checkTransactionStatus.mockResolvedValue({ status: 'success', amount: 1500 });
    const res = await retry();
    expect(res.result).toBe('paid');
    expect(processor.processFreemopayCallback).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS', externalId: 'ORD1-1-old' }));
    expect(db.createTransaction).not.toHaveBeenCalled();
  });

  it('provider FAILED for old attempt -> old marked failed, new request sent', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx({ created_at: iso(5) }));
    mps.checkTransactionStatus.mockResolvedValue({ status: 'failed', message: 'declined' });
    const res = await retry();
    expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-old', 'pending', expect.objectContaining({ status: 'failed' }));
    expect(res.result).toBe('sent');
  });

  it('case 9: provider rejects new request -> tx failed, 400 PROVIDER_REJECTED, payer_phone unchanged', async () => {
    mps.initiatePayment.mockResolvedValue({ success: false, message: 'Invalid payer', errorCode: 'E1' });
    const r = await codeOf(retry({ phoneNumber: PHONE_B }));
    expect(r).toEqual({ status: 400, code: 'PROVIDER_REJECTED' });
    expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-new', 'pending', expect.objectContaining({ status: 'failed', error_code: 'E1' }));
    expect(hasura.executeMutation).not.toHaveBeenCalledWith(expect.stringContaining('PersistRetryPayerPhone'), expect.anything());
  });

  it('case 9: provider throws -> treated as rejected', async () => {
    mps.initiatePayment.mockRejectedValue(new Error('ECONNRESET'));
    const r = await codeOf(retry());
    expect(r.code).toBe('PROVIDER_REJECTED');
  });

  it('D2: 5 retries in 10 min -> 429 RETRY_RATE_LIMITED, nothing superseded or sent', async () => {
    db.getPendingOrderPaymentTransactionByOrderNumber.mockResolvedValue(pendingTx());
    db.countOrderRetryAttemptsSince.mockResolvedValue(5);
    const r = await codeOf(retry({ phoneNumber: PHONE_B }));
    expect(r).toEqual({ status: 429, code: 'RETRY_RATE_LIMITED' });
    expect(db.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(db.createTransaction).not.toHaveBeenCalled();
    expect(db.countOrderRetryAttemptsSince).toHaveBeenCalledWith('ORD1', expect.any(String), '(after confirm retry)');
  });

  it('case 10: wallet covers the total and no pending -> wallet, no MoMo', async () => {
    hasura.getAccount.mockResolvedValue({ id: 'acct-1', available_balance: 5000 });
    jest.spyOn(svc, 'finalizeCookedFoodPayAfterConfirm').mockResolvedValue(undefined);
    const res = await retry();
    expect(res).toMatchObject({ result: 'wallet', payment_rail: 'wallet' });
    expect(mps.initiatePayment).not.toHaveBeenCalled();
  });

  it('case 11: cancelled pay-after order -> 409 ORDER_NOT_PAYABLE', async () => {
    order = { ...baseOrder(), current_status: 'cancelled' };
    const r = await codeOf(retry());
    expect(r).toEqual({ status: 409, code: 'ORDER_NOT_PAYABLE' });
  });

  it('pending (not yet confirmed) pay-after order -> 400 ORDER_NOT_CONFIRMED', async () => {
    order = { ...baseOrder(), current_status: 'pending' };
    const r = await codeOf(retry());
    expect(r).toEqual({ status: 400, code: 'ORDER_NOT_CONFIRMED' });
  });

  it('order paid by a late approval between insert and send -> new tx cancelled, result paid', async () => {
    let calls = 0;
    svc.getOrderDetails.mockImplementation(async () => (++calls > 1 ? { ...order, payment_status: 'paid' } : order));
    const res = await retry();
    expect(res.result).toBe('paid');
    expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-new', 'pending', expect.objectContaining({ status: 'cancelled', error_code: 'ORDER_SETTLED_BEFORE_SEND' }));
    expect(mps.initiatePayment).not.toHaveBeenCalled();
  });

  it('case 12: other user -> 403', async () => {
    order = { ...baseOrder(), client: { ...baseOrder().client, user_id: 'someone-else' } };
    const r = await codeOf(retry());
    expect(r.status).toBe(403);
  });

  it('case 12: pay-now pending_payment retry path unchanged', async () => {
    order = { ...baseOrder(), pay_after_merchant_confirm: false, payment_timing: 'pay_now', current_status: 'pending_payment' };
    const spy = jest.spyOn(svc, 'retryMobileMoneyOrderPayment').mockResolvedValue({ success: true, message: 'Payment retry initiated' });
    await retry({ phoneNumber: PHONE_B });
    expect(spy).toHaveBeenCalledWith(order, 'order-1', PHONE_B);
  });

  describe('late success on a superseded attempt (case 7)', () => {
    const lateTx = () => ({ ...pendingTx(), status: 'cancelled', error_code: 'SUPERSEDED_BY_RETRY' });

    it('unpaid live order -> first success wins: newer pending cancelled, order finalized once', async () => {
      db.listOrderTransactionsByStatus.mockResolvedValue([{ id: 'tx-new', reference: 'ORD1-2-new' }]);
      const out = await svc.handleLateSuccessOnSupersededOrderTx(lateTx());
      expect(out).toBe('applied');
      expect(db.updateTransactionIfStatus).toHaveBeenCalledWith('tx-new', 'pending', expect.objectContaining({ status: 'cancelled', error_code: 'SUPERSEDED_BY_LATE_SUCCESS' }));
      expect(svc.finalizeOrderAfterIncomingPayment).toHaveBeenCalledTimes(1);
      expect(reportMoneyAnomaly).not.toHaveBeenCalled();
    });

    it('order already paid by the new attempt -> duplicate: wallet credit kept, alert + push, no finalize', async () => {
      order = { ...baseOrder(), payment_status: 'paid', current_status: 'preparing' };
      db.listOrderTransactionsByStatus.mockResolvedValue([{ id: 'tx-new' }]);
      const out = await svc.handleLateSuccessOnSupersededOrderTx(lateTx());
      expect(out).toBe('duplicate');
      expect(svc.finalizeOrderAfterIncomingPayment).not.toHaveBeenCalled();
      expect(reportMoneyAnomaly).toHaveBeenCalledWith(expect.anything(), 'duplicate_momo_collect', expect.stringContaining('reason=duplicate'), expect.any(Object));
      expect(svc.notificationsService.sendDuplicatePaymentCreditedPush).toHaveBeenCalledWith(expect.objectContaining({ reason: 'duplicate', amount: 1500 }));
      // Processor owns the status/marker write on this path.
      expect(db.updateTransaction).not.toHaveBeenCalled();
    });

    it('order cancelled -> wallet credit + alert, no resurrection', async () => {
      order = { ...baseOrder(), current_status: 'cancelled' };
      const out = await svc.handleLateSuccessOnSupersededOrderTx(lateTx());
      expect(out).toBe('duplicate');
      expect(svc.finalizeOrderAfterIncomingPayment).not.toHaveBeenCalled();
      expect(svc.notificationsService.sendDuplicatePaymentCreditedPush).toHaveBeenCalledWith(expect.objectContaining({ reason: 'order_cancelled' }));
    });

    it('paid by this same attempt on an earlier delivery -> idempotent repair, no alert', async () => {
      order = { ...baseOrder(), payment_status: 'paid', current_status: 'preparing' };
      db.listOrderTransactionsByStatus.mockResolvedValue([]);
      const out = await svc.handleLateSuccessOnSupersededOrderTx(lateTx());
      expect(out).toBe('applied');
      expect(reportMoneyAnomaly).not.toHaveBeenCalled();
      expect(db.updateTransactionIfStatus).not.toHaveBeenCalled();
    });

    it('completed order paid by the new attempt -> duplicate (not "cancelled")', async () => {
      order = { ...baseOrder(), payment_status: 'paid', current_status: 'complete' };
      db.listOrderTransactionsByStatus.mockResolvedValue([{ id: 'tx-new' }]);
      await svc.handleLateSuccessOnSupersededOrderTx(lateTx());
      expect(svc.notificationsService.sendDuplicatePaymentCreditedPush).toHaveBeenCalledWith(expect.objectContaining({ reason: 'duplicate' }));
    });
  });

  describe('second SUCCESS on a paid pay-after order (normal pending path)', () => {
    beforeEach(() => {
      svc.finalizeOrderAfterIncomingPayment.mockRestore();
      jest.spyOn(svc, 'abortFinalizeOnTerminalOrder').mockResolvedValue(false);
      jest.spyOn(svc, 'finalizeCookedFoodPayAfterConfirm').mockResolvedValue(undefined);
    });
    const tx = { id: 'tx-new', reference: 'ORD1-2-new', entity_id: 'ORD1', amount: 1500, currency: 'XAF', payment_method: 'mobile_money' };

    it('goes to duplicate handling (alert + marker) instead of finalize', async () => {
      order = { ...baseOrder(), payment_status: 'paid', current_status: 'preparing' };
      db.listOrderTransactionsByStatus.mockResolvedValue([{ id: 'tx-old' }]);
      await svc.finalizeOrderAfterIncomingPayment(tx);
      expect(svc.finalizeCookedFoodPayAfterConfirm).not.toHaveBeenCalled();
      expect(db.updateTransaction).toHaveBeenCalledWith('tx-new', { error_code: 'DUPLICATE_PAYMENT_CREDITED' });
      expect(reportMoneyAnomaly).toHaveBeenCalledTimes(1);
    });

    it('replay of an already-recorded duplicate does not alert again', async () => {
      order = { ...baseOrder(), payment_status: 'paid', current_status: 'preparing' };
      await svc.finalizeOrderAfterIncomingPayment({ ...tx, error_code: 'DUPLICATE_PAYMENT_CREDITED' });
      expect(reportMoneyAnomaly).not.toHaveBeenCalled();
      expect(svc.finalizeCookedFoodPayAfterConfirm).not.toHaveBeenCalled();
    });

    it('replay of the paying attempt on a completed/refunded order -> no false alert', async () => {
      order = { ...baseOrder(), payment_status: 'refunded', current_status: 'complete' };
      db.listOrderTransactionsByStatus.mockResolvedValue([{ id: 'tx-new' }]);
      svc.abortFinalizeOnTerminalOrder.mockResolvedValue(true);
      await svc.finalizeOrderAfterIncomingPayment(tx);
      expect(svc.finalizeCookedFoodPayAfterConfirm).not.toHaveBeenCalled();
      expect(reportMoneyAnomaly).not.toHaveBeenCalled();
    });

    it('SUCCESS on a never-paid cancelled order -> order_cancelled alert + marker', async () => {
      order = { ...baseOrder(), payment_status: 'pending', current_status: 'cancelled' };
      await svc.finalizeOrderAfterIncomingPayment(tx);
      expect(reportMoneyAnomaly).toHaveBeenCalledWith(expect.anything(), 'duplicate_momo_collect', expect.stringContaining('reason=order_cancelled'), expect.any(Object));
      expect(db.updateTransaction).toHaveBeenCalledWith('tx-new', { error_code: 'DUPLICATE_PAYMENT_CREDITED' });
      expect(svc.finalizeCookedFoodPayAfterConfirm).not.toHaveBeenCalled();
    });

    it('first success on an unpaid order still finalizes normally', async () => {
      await svc.finalizeOrderAfterIncomingPayment(tx);
      expect(svc.finalizeCookedFoodPayAfterConfirm).toHaveBeenCalledTimes(1);
      expect(reportMoneyAnomaly).not.toHaveBeenCalled();
    });
  });
});
