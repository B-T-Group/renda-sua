import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';

describe('in-flight mobile payment queries', () => {
  const row = {
    id: 'tx-1',
    reference: 'ORD-1-a',
    status: 'processing',
    amount: 1000,
    currency: 'XAF',
  };

  function service(rows: unknown[] | undefined = [row]) {
    const executeQuery = jest.fn().mockResolvedValue({
      mobile_payment_transactions: rows,
    });
    const db = new MobilePaymentsDatabaseService({ executeQuery } as never);
    return { db, executeQuery };
  }

  function queryOf(executeQuery: jest.Mock): string {
    return executeQuery.mock.calls[0][0] as string;
  }

  it('loads the latest pending or processing order payment', async () => {
    const { db, executeQuery } = service();

    await expect(
      db.getPendingOrderPaymentTransactionByOrderNumber('ORD-1')
    ).resolves.toEqual(row);
    expect(executeQuery.mock.calls[0][1]).toEqual({ orderNumber: 'ORD-1' });
    const query = queryOf(executeQuery);
    expect(query).toContain('payment_entity: { _eq: order }');
    expect(query).toContain('status: { _in: ["pending", "processing"] }');
    expect(query).toContain('entity_id: { _eq: $orderNumber }');
    expect(query).toContain('limit: 1');
  });

  it('returns null when no in-flight order payment exists', async () => {
    const { db } = service([]);

    await expect(
      db.getPendingOrderPaymentTransactionByOrderNumber('ORD-1')
    ).resolves.toBeNull();
  });

  it('lists give-change withdrawals that are still pending only', async () => {
    const { db, executeQuery } = service();

    await expect(db.getPendingGiveChangeWithdrawals()).resolves.toEqual([row]);
    const query = queryOf(executeQuery);
    expect(query).toContain('status: { _eq: "pending" }');
    expect(query).toContain('transaction_type: { _eq: "GIVE_CHANGE" }');
    expect(query).not.toContain('processing');
  });

  it('lists pending and processing rows for admin reconciliation', async () => {
    const { db, executeQuery } = service();

    await db.getPendingIntegrationTransactions({ limit: 10, offset: 2 });
    const query = queryOf(executeQuery);
    expect(query).toContain('status: { _in: ["pending", "processing"] }');
    expect(query).toContain('limit: 10');
    expect(query).toContain('offset: 2');
  });
});
