/**
 * QA #509/#511 follow-up (B1 HIGH, B2 MED): a hold release must never take more than
 * the ledger still holds for THAT order. Real AccountsService (guarded balance CAS +
 * UNIQUE idempotency_key) on the in-memory FakeMoneyDb, which interleaves every await
 * like concurrent requests against Postgres.
 */
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { OrdersService } from './orders.service';
import { FakeMoneyDb } from './testing/fake-money-db.test-util';

const CLIENT = 'acct-client';
const SIBLING = 'order-sibling-J';

function createHarness(available: number) {
  const db = new FakeMoneyDb();
  db.addAccount({ id: CLIENT, user_id: 'client-user', available_balance: available });
  const hasura = db.hasura as any;
  const accounts = new AccountsService(hasura);
  (accounts as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = Object.create(OrdersService.prototype) as OrdersService;
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  Object.assign(service, { hasuraSystemService: hasura, accountsService: accounts, logger });
  const spy = (name: string, impl: (...args: any[]) => any) =>
    jest.spyOn(service as any, name).mockImplementation(impl as any);
  spy('getOrderDetails', async (id: string) => db.orderDetails(id));
  spy('getOrCreateOrderHold', async (id: string) => ({ ...db.holds.get(id) }));
  spy('updateOrderHold', async (holdId: string, set: Record<string, unknown>) => {
    const hold = [...db.holds.values()].find((h) => h.id === holdId)!;
    Object.assign(hold, set);
  });
  return { db, service: service as any, accounts, logger };
}

/** Order row + order_holds row as created *before* the ledger hold is attempted. */
function seedPendingWalletOrder(db: FakeMoneyDb, id: string, amount: number) {
  db.orders.set(id, {
    id,
    order_number: `ORD-${id}`,
    current_status: 'pending_payment',
    payment_status: 'pending',
    payment_timing: 'pay_now',
    payment_source: 'wallet',
    currency: 'XAF',
    total_amount: amount,
    subtotal: amount,
    client_user_id: 'client-user',
  });
  db.holds.set(id, {
    id: `hold-${id}`,
    order_id: id,
    client_hold_amount: amount,
    delivery_fees: 0,
    status: 'active',
  });
}

/** A sibling order whose 250 is genuinely withheld (QA order J). */
async function seedHeldSibling(h: ReturnType<typeof createHarness>) {
  await h.accounts.registerTransaction({
    accountId: CLIENT,
    amount: 250,
    transactionType: 'hold',
    memo: 'Hold for order J',
    referenceId: SIBLING,
  });
}

/** The wallet create path: hold the order, compensate when the hold throws. */
async function createWalletOrder(h: ReturnType<typeof createHarness>, id: string) {
  const order = h.db.orderDetails(id);
  try {
    await h.service.placeMissingClientHolds(order, CLIENT, 500, 0);
    return 'held';
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    await h.service.releaseWalletHoldsForPendingPaymentOrder(id);
    return 'compensated';
  }
}

const releases = (db: FakeMoneyDb, ref?: string) =>
  db.txns.filter(
    (t) => t.transaction_type === 'release' && (ref === undefined || t.reference_id === ref)
  );

describe('B1: create compensation only releases what this order still holds', () => {
  it('two parallel wallet pay-now orders, available covers one: the failed one releases nothing', async () => {
    const h = createHarness(750);
    await seedHeldSibling(h); // client: 500 available / 250 withheld (J)
    seedPendingWalletOrder(h.db, 'order-A', 500);
    seedPendingWalletOrder(h.db, 'order-B', 500);

    const outcomes = await Promise.all([
      createWalletOrder(h, 'order-A'),
      createWalletOrder(h, 'order-B'),
    ]);

    expect([...outcomes].sort()).toEqual(['compensated', 'held']);
    const failed = outcomes[0] === 'compensated' ? 'order-A' : 'order-B';
    // Before the fix: "release 500 (create compensation)" with no hold, draining J's 250.
    expect(releases(h.db, failed)).toHaveLength(0);
    expect(releases(h.db)).toHaveLength(0);
    const acct = h.db.account(CLIENT);
    expect(acct.withheld_balance).toBe(750); // winner's 500 + J's 250 still backed
    expect(acct.available_balance).toBe(0);
    // The order_holds row is still zeroed/cancelled so nothing settles against it.
    expect(h.db.holds.get(failed)).toEqual(
      expect.objectContaining({ client_hold_amount: 0, status: 'cancelled' })
    );
  });

  it('a creation that failed after its hold landed releases exactly that hold', async () => {
    const h = createHarness(750);
    await seedHeldSibling(h);
    seedPendingWalletOrder(h.db, 'order-A', 500);
    await h.service.placeMissingClientHolds(h.db.orderDetails('order-A'), CLIENT, 500, 0);

    await h.service.releaseWalletHoldsForPendingPaymentOrder('order-A');

    expect(releases(h.db, 'order-A').map((t) => t.amount)).toEqual([500]);
    expect(h.db.account(CLIENT)).toEqual(
      expect.objectContaining({ available_balance: 500, withheld_balance: 250 })
    );
  });

  it('caps the release at the net hold when the order hold row overstates it', async () => {
    const h = createHarness(1000);
    seedPendingWalletOrder(h.db, 'order-A', 500);
    await h.accounts.registerTransaction({
      accountId: CLIENT,
      amount: 200,
      transactionType: 'hold',
      memo: 'partial',
      referenceId: 'order-A',
    });
    await seedHeldSibling(h);

    await h.service.releaseWalletHoldsForPendingPaymentOrder('order-A');

    expect(releases(h.db, 'order-A').map((t) => t.amount)).toEqual([200]);
    expect(h.db.account(CLIENT).withheld_balance).toBe(250);
  });

  it('concurrent compensation and lost-paid-CAS release for one order release it once', async () => {
    const h = createHarness(750);
    await seedHeldSibling(h);
    seedPendingWalletOrder(h.db, 'order-A', 500);
    await h.service.placeMissingClientHolds(h.db.orderDetails('order-A'), CLIENT, 500, 0);

    await Promise.all([
      h.service.releaseWalletHoldsForPendingPaymentOrder('order-A'),
      h.service.releaseWalletHoldsForPendingPaymentOrder('order-A'),
      h.service.releaseNetOrderHoldAfterLostPaidCas(h.db.orderDetails('order-A'), CLIENT),
    ]);

    expect(releases(h.db, 'order-A').map((t) => t.amount)).toEqual([500]);
    expect(h.db.account(CLIENT)).toEqual(
      expect.objectContaining({ available_balance: 500, withheld_balance: 250 })
    );
  });

  it('racing releases with a deep shared pool still land once (UNIQUE key reverts the loser)', async () => {
    const h = createHarness(1500);
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 1000, transactionType: 'hold', memo: 'big sibling', referenceId: SIBLING,
    });
    seedPendingWalletOrder(h.db, 'order-A', 500);
    await h.service.placeMissingClientHolds(h.db.orderDetails('order-A'), CLIENT, 500, 0);

    await Promise.all([
      h.service.releaseWalletHoldsForPendingPaymentOrder('order-A'),
      h.service.releaseNetOrderHoldAfterLostPaidCas(h.db.orderDetails('order-A'), CLIENT),
    ]);

    expect(releases(h.db, 'order-A').map((t) => t.amount)).toEqual([500]);
    expect(h.db.account(CLIENT)).toEqual(
      expect.objectContaining({ available_balance: 500, withheld_balance: 1000 })
    );
  });

  it('a refused release keeps the order hold row for a retry instead of dropping it', async () => {
    const h = createHarness(500);
    seedPendingWalletOrder(h.db, 'order-A', 500);
    await h.service.placeMissingClientHolds(h.db.orderDetails('order-A'), CLIENT, 500, 0);
    h.db.account(CLIENT).withheld_balance = 100; // pool already short (another path over-released)

    await expect(
      h.service.releaseWalletHoldsForPendingPaymentOrder('order-A')
    ).rejects.toThrow(/insufficient funds/i);
    expect(releases(h.db)).toHaveLength(0);
    expect(h.db.holds.get('order-A')).toEqual(
      expect.objectContaining({ client_hold_amount: 500, status: 'active' })
    );
  });
});

describe('B2: settlement first release is capped by the order own net hold', () => {
  const settle = (h: ReturnType<typeof createHarness>, orderId: string, amount = 500) =>
    h.service.releaseClientSettlementHold({
      accountId: CLIENT,
      orderId,
      amount,
      memo: `Hold released for order ${orderId} (items)`,
      idempotencyKey: `settle:item:release:${orderId}`,
    });

  it('QA H5: an order with no hold does not take a sibling order withheld', async () => {
    const h = createHarness(1000);
    await h.accounts.registerTransaction({
      accountId: CLIENT,
      amount: 500,
      transactionType: 'hold',
      memo: 'Hold for H6',
      referenceId: 'order-H6',
    }); // 500 available / 500 withheld, all of it H6's

    await expect(settle(h, 'order-H5')).resolves.toEqual({ success: true });

    expect(releases(h.db)).toHaveLength(0);
    expect(h.db.account(CLIENT).withheld_balance).toBe(500); // H6 still backed
  });

  it('a short hold is not released when available cannot cover the rest (kept locked)', async () => {
    const h = createHarness(1000);
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 200, transactionType: 'hold', memo: 'H5 short', referenceId: 'order-H5',
    });
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 500, transactionType: 'hold', memo: 'H6', referenceId: 'order-H6',
    });
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 300, transactionType: 'withdrawal', memo: 'drain', referenceId: 'w-1',
    }); // 0 available / 700 withheld (200 H5 + 500 H6)

    const result = await settle(h, 'order-H5');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(releases(h.db)).toHaveLength(0);
    expect(h.db.account(CLIENT).withheld_balance).toBe(700);
  });

  it('a short hold releases only its own net when available covers the remainder', async () => {
    const h = createHarness(2000);
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 200, transactionType: 'hold', memo: 'H5 short', referenceId: 'order-H5',
    });
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 500, transactionType: 'hold', memo: 'H6', referenceId: 'order-H6',
    }); // 1300 available / 700 withheld

    await expect(settle(h, 'order-H5')).resolves.toEqual(
      expect.objectContaining({ success: true })
    );

    expect(releases(h.db, 'order-H5').map((t) => t.amount)).toEqual([200]);
    expect(h.db.account(CLIENT).withheld_balance).toBe(500); // H6 untouched
  });

  it('a fully held order still releases the full amount once (idempotent retry)', async () => {
    const h = createHarness(500);
    await h.accounts.registerTransaction({
      accountId: CLIENT, amount: 500, transactionType: 'hold', memo: 'P1', referenceId: 'order-P1',
    });

    await settle(h, 'order-P1');
    await settle(h, 'order-P1');

    expect(releases(h.db, 'order-P1').map((t) => t.amount)).toEqual([500]);
    expect(h.db.account(CLIENT)).toEqual(
      expect.objectContaining({ available_balance: 500, withheld_balance: 0 })
    );
  });
});
