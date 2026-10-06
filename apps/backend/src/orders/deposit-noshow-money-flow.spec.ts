/**
 * Service-level money-flow tests for the reservation deposit (PR #459 QA B-1,
 * B-2, N-1, N-2). Real OrdersService flows, real DepositRefundService,
 * DepositLedgerService and AccountsService, on an in-memory ledger
 * (FakeMoneyDb) that models balances, account_transactions and the UNIQUE
 * idempotency_key. Only collaborators that do not touch the deposit
 * (notifications, SQS, commissions, status history) are stubbed.
 */
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositLedgerService } from './deposit-ledger.service';
import { DepositRefundService } from './deposit-refund.service';
import { OrdersService } from './orders.service';
import { FakeMoneyDb } from './testing/fake-money-db.test-util';

const ORDER_ID = '0b5c2c8e-1111-4a5e-9a51-000000000459';
const TXN_ID = '7d0f3a10-2222-4c1e-8f00-000000000459';
const REASON_ID = '22222222-2222-2222-2222-222222222222';
const DEPOSIT = 500;
const TOTAL = 5000;

interface Harness {
  db: FakeMoneyDb;
  service: OrdersService;
  deposits: DepositRefundService;
  sendOrderCancelledMessage: jest.Mock;
  quoteNoshowFee: jest.Mock;
}

function createHarness(): Harness {
  const db = new FakeMoneyDb();
  db.addAccount({ id: 'acct-client', user_id: 'client-user' });
  db.addAccount({ id: 'acct-hq', user_id: db.hqUserId });

  const hasura = db.hasura as any;
  const accounts = new AccountsService(hasura);
  const ledger = new DepositLedgerService(accounts, hasura);
  const calc = new DepositCalculationService();
  const deposits = new DepositRefundService(hasura, calc, ledger);
  for (const svc of [accounts, ledger, deposits] as any[]) {
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  }

  const sendOrderCancelledMessage = jest.fn().mockResolvedValue(undefined);
  const quoteNoshowFee = jest.fn().mockResolvedValue({
    cancellationFee: 1500,
    cancellationFeePercent: 30,
    merchantShare: 750,
    platformShare: 750,
    refundAmount: 3500,
    currency: 'XAF',
  });

  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraSystemService: hasura,
    accountsService: accounts,
    depositLedgerService: ledger,
    depositRefundService: deposits,
    depositCalculationService: calc,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    orderQueueService: { sendOrderCancelledMessage },
    purchaseCreditsService: { restore: jest.fn().mockResolvedValue(undefined) },
    cancellationPolicyService: { quoteNoshowFee },
    stripeCaptureService: { cancelOrderPaymentIntent: jest.fn() },
    commissionsService: { distributeItemCommissions: jest.fn().mockResolvedValue(undefined) },
    // Same compare-and-set as OrderStatusService.updateOrderStatus (409 on loss).
    orderStatusService: {
      updateOrderStatus: async (orderId: string, status: string) => {
        const before = db.orderDetails(orderId)!.current_status;
        await new Promise((r) => setImmediate(r));
        const row = db.orders.get(orderId)!;
        if (row.current_status !== before) {
          throw new HttpException('Order status changed concurrently', HttpStatus.CONFLICT);
        }
        row.current_status = status;
        return { id: orderId, current_status: status };
      },
    },
  });
  const spy = (name: string, impl: (...args: any[]) => any) =>
    jest.spyOn(service as any, name).mockImplementation(impl as any);
  spy('requireBusinessOrderAccess', async () => 'store-user-1');
  spy('getOrderDetails', async (id: string) => db.orderDetails(id));
  spy('getOrderDetailsByNumber', async (num: string) => {
    const row = [...db.orders.values()].find((o) => o.order_number === num);
    return row ? db.orderDetails(row.id) : null;
  });
  spy('assertActivePickupFailureReason', async () => 'Client did not come');
  spy('updateReservedQuantities', async () => undefined);
  spy('createStatusHistoryEntry', async () => undefined);
  // Settlement plumbing that does not touch the deposit.
  spy('getOrCreateOrderHold', async (id: string) => ({ ...db.holds.get(id) }));
  spy('updateOrderHold', async (holdId: string, set: Record<string, unknown>) => {
    const hold = [...db.holds.values()].find((h) => h.id === holdId)!;
    Object.assign(hold, set);
  });
  spy('claimSettlementStage', async () => true);
  spy('releaseSettlementClaim', async () => undefined);
  spy('queueSettlementRetryOrRethrow', async (_h: string, _s: string, _o: unknown, error: unknown) => {
    throw error;
  });
  return { db, service, deposits, sendOrderCancelledMessage, quoteNoshowFee };
}

/** Classic MoMo pay-at-pickup order whose 500 XAF deposit was captured and held. */
async function seedHeldDepositOrder(h: Harness, overrides: Record<string, unknown> = {}) {
  h.db.orders.set(ORDER_ID, {
    id: ORDER_ID,
    order_number: 'ORD-459',
    current_status: 'ready_for_pickup',
    fulfillment_method: 'pickup',
    payment_timing: 'pay_at_pickup',
    payment_source: 'mobile_money',
    payment_status: 'pending',
    pay_after_merchant_confirm: false,
    is_cooked_food_pickup: false,
    currency: 'XAF',
    total_amount: TOTAL,
    subtotal: TOTAL,
    business_id: 'biz-1',
    client_id: 'client-1',
    client_user_id: 'client-user',
    assigned_agent_id: null,
    deposit_amount: DEPOSIT,
    deposit_mobile_payment_transaction_id: TXN_ID,
    deposit_status: 'paid',
    deposit_refund_status: 'none',
    deposit_forfeit_reason: null,
    deposit_forfeited_at: null,
    deposit_forfeited_by_user_id: null,
    ...overrides,
  });
  h.db.holds.set(ORDER_ID, {
    id: 'hold-1',
    order_id: ORDER_ID,
    client_hold_amount: TOTAL - DEPOSIT,
    item_settlement_completed_at: null,
  });
  // Same ledger moves as the deposit SUCCESS callback.
  const ledger = (h.service as any).depositLedgerService as DepositLedgerService;
  await ledger.creditAndHoldDeposit({
    clientAccountId: 'acct-client',
    amount: DEPOSIT,
    orderNumber: 'ORD-459',
    depositTransactionId: TXN_ID,
  });
}

/** Remainder paid by MoMo, then the real classic item settlement runs. */
async function payRemainderAndSettle(h: Harness) {
  const accounts = (h.service as any).accountsService as AccountsService;
  await accounts.registerTransaction({
    accountId: 'acct-client',
    amount: TOTAL - DEPOSIT,
    transactionType: 'deposit',
    referenceId: '9e9e9e9e-3333-4c1e-8f00-000000000459',
    skipCashAdvanceRepayment: true,
  });
  const order = h.db.orders.get(ORDER_ID)!;
  order.payment_status = 'paid';
  h.db.holds.get(ORDER_ID)!.client_hold_amount = TOTAL; // settleAndCompletePadPayment
  jest.spyOn(h.service as any, 'settlesViaClientHoldRelease').mockReturnValue(false);
  return h.service.processOrderPayment(ORDER_ID);
}

const cancel = (h: Harness) =>
  h.service.cancelUncollectedPickup({ orderId: ORDER_ID, failure_reason_id: REASON_ID });

const depositRows = (h: Harness) =>
  h.db.txnsFor(TXN_ID).map((t) => `${t.account_id}:${t.transaction_type}:${t.amount}`);

describe('Reservation deposit money flow (service level)', () => {
  let h: Harness;
  beforeEach(() => {
    h = createHarness();
  });

  it('(a) unpaid pay-at-pickup no-show forfeits the held deposit to HQ, no fee', async () => {
    await seedHeldDepositOrder(h);
    const preview = await h.service.getPickupNoshowPreview(ORDER_ID);
    expect(preview).toMatchObject({
      canCancel: true,
      cancellationFee: 0,
      refundAmount: 0,
      depositForfeitAmount: DEPOSIT,
      noshowPenalty: 'deposit',
    });

    const result = await cancel(h);

    expect(result).toMatchObject({
      success: true,
      fee_retained: 0,
      refund_amount: 0,
      deposit_forfeit_amount: DEPOSIT,
    });
    expect(h.quoteNoshowFee).not.toHaveBeenCalled();
    expect(depositRows(h)).toEqual([
      'acct-client:deposit:500',
      'acct-client:hold:500',
      'acct-client:release:500',
      'acct-client:payment:500',
      'acct-hq:deposit:500',
    ]);
    expect(h.db.account('acct-client')).toMatchObject({ available_balance: 0, withheld_balance: 0 });
    expect(h.db.account('acct-hq')).toMatchObject({ available_balance: 500 });
    expect(h.db.orders.get(ORDER_ID)).toMatchObject({
      current_status: 'cancelled',
      deposit_status: 'forfeited',
      deposit_forfeit_reason: 'customer_no_show_pickup',
      deposit_forfeited_by_user_id: 'store-user-1',
    });
    expect(h.sendOrderCancelledMessage).toHaveBeenCalledWith(
      ORDER_ID,
      'business',
      'client_no_show',
      'ready_for_pickup'
    );
    expect(h.db.unhandled).toEqual([]);
  });

  it('respects the no-show window', async () => {
    await seedHeldDepositOrder(h);
    (h.db as any).handlers.PickupReadyAt = () => ({
      order_status_history: [{ created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }],
    });
    await expect(cancel(h)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(depositRows(h)).toEqual(['acct-client:deposit:500', 'acct-client:hold:500']);
    expect(h.db.orders.get(ORDER_ID)!.current_status).toBe('ready_for_pickup');
  });

  it('settlement marks the deposit applied; a later forfeit or refund is refused and moves nothing', async () => {
    await seedHeldDepositOrder(h);
    await expect(payRemainderAndSettle(h)).resolves.toBe('settled');

    expect(h.db.orders.get(ORDER_ID)!.deposit_status).toBe('applied');
    expect(h.db.account('acct-client')).toMatchObject({ available_balance: 0, withheld_balance: 0 });
    const before = h.db.snapshot();

    const forfeit = await h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup');
    const refund = await h.deposits.refundDeposit(ORDER_ID, { allowAfterLock: true });

    expect(forfeit).toMatchObject({ success: false, errorCode: 'DEPOSIT_APPLIED' });
    expect(refund).toMatchObject({ success: false, errorCode: 'DEPOSIT_APPLIED' });
    expect(h.db.snapshot()).toBe(before);
  });

  it('cash-exception / external settlement applies the deposit once and marks it applied', async () => {
    await seedHeldDepositOrder(h);
    h.db.orders.get(ORDER_ID)!.payment_status = 'paid';
    jest.spyOn(h.service as any, 'settlesViaClientHoldRelease').mockReturnValue(false);

    await h.service.processOrderPayment(ORDER_ID, { skipClientLedgerMovements: true });
    // A retry of the same settlement (status already applied) does not post again.
    h.db.holds.get(ORDER_ID)!.item_settlement_completed_at = null;
    await h.service.processOrderPayment(ORDER_ID, { skipClientLedgerMovements: true });

    expect(h.db.orders.get(ORDER_ID)!.deposit_status).toBe('applied');
    expect(depositRows(h)).toEqual([
      'acct-client:deposit:500',
      'acct-client:hold:500',
      'acct-client:release:500',
      'acct-client:payment:500',
    ]);
    const before = h.db.snapshot();
    const forfeit = await h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup');
    expect(forfeit.errorCode).toBe('DEPOSIT_APPLIED');
    expect(h.db.snapshot()).toBe(before);
  });

  it.each([
    ['applied (post-fix row)', 'applied'],
    ['paid (legacy row settled before the fix)', 'paid'],
  ])(
    '(b) settled deposit forced back to ready + paid [%s]: uncollected cancel is rejected and moves no deposit money',
    async (_label, forcedDepositStatus) => {
      await seedHeldDepositOrder(h);
      await payRemainderAndSettle(h);
      // DEV simulation of a stuck completion (QA case 2).
      Object.assign(h.db.orders.get(ORDER_ID)!, {
        current_status: 'ready_for_pickup',
        payment_status: 'paid',
        deposit_status: forcedDepositStatus,
      });
      // Spare wallet funds, so only the guards (not a balance shortfall) stop a second debit.
      h.db.account('acct-client').available_balance += 1000;
      const before = h.db.snapshot();

      await expect(cancel(h)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect((await h.service.getPickupNoshowPreview(ORDER_ID)).canCancel).toBe(false);

      // Even if another path reached the deposit directly (forfeit first: on a
      // legacy 'paid' row this is the QA B-1 double charge), or via the
      // cancellation deposit policy, the deposit itself cannot move again.
      const direct = await h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup');
      expect(h.db.snapshot()).toBe(before);
      await (h.service as any).handleDepositOnCancellation(
        h.db.orderDetails(ORDER_ID),
        ORDER_ID,
        'ready_for_pickup',
        'business',
        undefined,
        'client_no_show'
      );

      expect(direct).toMatchObject({ success: false, errorCode: 'DEPOSIT_APPLIED' });
      expect(h.db.snapshot()).toBe(before);
      expect(h.db.orders.get(ORDER_ID)!.deposit_status).toBe('applied');
      expect(h.db.txnsFor(TXN_ID).filter((t) => t.transaction_type === 'payment')).toEqual([]);
    }
  );

  it('(c) a parallel double cancel produces one set of deposit ledger rows', async () => {
    await seedHeldDepositOrder(h);

    const results = await Promise.allSettled([cancel(h), cancel(h)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: HttpStatus.CONFLICT });
    expect(depositRows(h)).toEqual([
      'acct-client:deposit:500',
      'acct-client:hold:500',
      'acct-client:release:500',
      'acct-client:payment:500',
      'acct-hq:deposit:500',
    ]);
  });

  it('(c) concurrent forfeit + forfeit + refund on the same deposit: one winner, one set of rows', async () => {
    await seedHeldDepositOrder(h, { current_status: 'cancelled' });

    const [f1, f2, r1] = await Promise.all([
      h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup'),
      h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup'),
      h.deposits.refundDeposit(ORDER_ID, { allowAfterLock: true }),
    ]);

    const winners = [f1, f2, r1].filter((r) => r.success && r.errorCode !== 'ALREADY_FORFEITED');
    expect(winners).toHaveLength(1);
    const releases = h.db.txnsFor(TXN_ID).filter((t) => t.transaction_type === 'release');
    expect(releases).toHaveLength(1);
    const order = h.db.orders.get(ORDER_ID)!;
    if (order.deposit_status === 'forfeited') {
      expect(depositRows(h)).toEqual([
        'acct-client:deposit:500',
        'acct-client:hold:500',
        'acct-client:release:500',
        'acct-client:payment:500',
        'acct-hq:deposit:500',
      ]);
    } else {
      expect(order.deposit_status).toBe('refunded');
      expect(depositRows(h)).toEqual([
        'acct-client:deposit:500',
        'acct-client:hold:500',
        'acct-client:release:500',
      ]);
    }
    const client = h.db.account('acct-client');
    const hq = h.db.account('acct-hq');
    expect(client.withheld_balance).toBe(0);
    expect(client.available_balance + hq.available_balance).toBe(DEPOSIT);
  });

  it('(c) two concurrent resumes of a claimed forfeit post each leg once (idempotency keys)', async () => {
    await seedHeldDepositOrder(h, {
      current_status: 'cancelled',
      deposit_status: 'forfeited',
      deposit_forfeit_reason: 'customer_no_show_pickup',
    });

    await Promise.all([
      h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup'),
      h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup'),
    ]);

    expect(depositRows(h)).toEqual([
      'acct-client:deposit:500',
      'acct-client:hold:500',
      'acct-client:release:500',
      'acct-client:payment:500',
      'acct-hq:deposit:500',
    ]);
    expect(h.db.account('acct-client')).toMatchObject({ available_balance: 0, withheld_balance: 0 });
    expect(h.db.account('acct-hq').available_balance).toBe(DEPOSIT);
  });

  it('(d) replaying the deposit SUCCESS callback after a forfeit changes nothing and does not throw', async () => {
    await seedHeldDepositOrder(h);
    await cancel(h);
    const before = h.db.snapshot();
    const orderBefore = JSON.stringify(h.db.orders.get(ORDER_ID));

    await expect(
      h.service.finalizeDepositAfterCallback('ORD-459', TXN_ID)
    ).resolves.toBeUndefined();
    await expect(
      h.service.finalizeDepositAfterCallback('ORD-459', TXN_ID)
    ).resolves.toBeUndefined();

    expect(h.db.snapshot()).toBe(before);
    expect(JSON.stringify(h.db.orders.get(ORDER_ID))).toBe(orderBefore);
  });

  it.each([
    ['read after the forfeit', false],
    ['read before the forfeit (race: claim lost at settlement)', true],
  ])(
    'settlement refuses to count a deposit that was already forfeited [%s]',
    async (_label, staleSnapshot) => {
      await seedHeldDepositOrder(h);
      // Spare wallet funds, so only the guard (not a balance shortfall) can stop a double charge.
      h.db.account('acct-client').available_balance += 1000;
      const preForfeit = h.db.orderDetails(ORDER_ID);
      await h.deposits.forfeitDeposit(ORDER_ID, 'customer_no_show_pickup');
      expect(h.db.orders.get(ORDER_ID)!.deposit_status).toBe('forfeited');
      if (staleSnapshot) {
        (h.service as any).getOrderDetails.mockImplementationOnce(async () => ({
          ...preForfeit,
          payment_status: 'paid',
        }));
      }
      const rowsBefore = h.db.txns.length;

      await expect(payRemainderAndSettle(h)).rejects.toThrow(/was forfeited/);

      // Only the remainder top-up landed: no item payment, no second deposit debit.
      expect(h.db.txns.slice(rowsBefore).map((t) => t.transaction_type)).toEqual(['deposit']);
      expect(h.db.orders.get(ORDER_ID)!.deposit_status).toBe('forfeited');
    }
  );
});
